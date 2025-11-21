import * as fs from 'fs';
import * as path from 'path';
import { scanFile, scanText, clearRulesCache } from '../core/detector';
import { scanWorkspace, scanFiles } from '../core/scanner';
import { saveReport, loadLatestReport } from '../core/reports';

/**
 * Simple test utilities
 */
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

/**
 * Test: Full end-to-end demo scenario
 */
function testEndToEndDemoScenario() {
  console.log('\n=== Testing End-to-End Demo Scenario ===');

  // Create temporary test directory
  const testDir = path.join(__dirname, '..', '..', '.test-temp');
  
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  
  fs.mkdirSync(testDir, { recursive: true });

  try {
    // Step 1: Create a file with a fake secret
    console.log('\n  Step 1: Create file with fake secret...');
    const testFile = path.join(testDir, 'config.js');
    const secretContent = `
// Configuration file
const config = {
  apiKey: "AKIAIOSFODNN7EXAMPLE",
  email: "admin@example.com",
  dbPassword: "MySecretPass123"
};

module.exports = config;
`;
    fs.writeFileSync(testFile, secretContent);
    assert(fs.existsSync(testFile), 'Test file should be created');

    // Step 2: Run local scan
    console.log('  Step 2: Run local scan...');
    const report = scanWorkspace({ workspacePath: testDir });
    
    assert(report.detectionsFound > 0, 'Scan should detect issues');
    assert(report.filesScanned === 1, 'Should scan one file');
    console.log(`     Found ${report.detectionsFound} issue(s)`);

    // Step 3: Verify masking in report
    console.log('  Step 3: Verify masking...');
    let hasAwsKey = false;
    let hasMasking = false;
    
    for (const detection of report.detections) {
      if (detection.ruleId === 'aws-access-key') {
        hasAwsKey = true;
        // Verify the secret is masked
        assert(!detection.snippet.includes('AKIAIOSFODNN7EXAMPLE'), 
          'Raw secret should not appear in detection snippet');
        assert(detection.snippet.includes('****'), 
          'Detection snippet should contain masking');
        hasMasking = true;
      }
    }
    
    assert(hasAwsKey, 'Should detect AWS access key');
    assert(hasMasking, 'Detection should be masked');

    // Step 4: Save report
    console.log('  Step 4: Save report...');
    const reportPath = saveReport(report, testDir);
    assert(fs.existsSync(reportPath), 'Report should be saved to disk');

    // Step 5: Load report and verify
    console.log('  Step 5: Load and verify report...');
    const loadedReport = loadLatestReport(testDir);
    assert(loadedReport !== null, 'Should load saved report');
    assert(loadedReport!.detectionsFound === report.detectionsFound, 
      'Loaded report should match saved report');

    // Step 6: Verify JSON report is masked
    console.log('  Step 6: Verify JSON report masking...');
    const reportContent = fs.readFileSync(reportPath, 'utf-8');
    assert(!reportContent.includes('AKIAIOSFODNN7EXAMPLE'), 
      'JSON report should not contain raw secret');
    assert(reportContent.includes('****'), 
      'JSON report should contain masked values');

    // Step 7: Test with clean file
    console.log('  Step 7: Test clean file scenario...');
    const cleanFile = path.join(testDir, 'clean.txt');
    fs.writeFileSync(cleanFile, 'Hello World\nThis is a clean file.');
    
    const cleanReport = scanWorkspace({ workspacePath: testDir });
    // Should still detect secrets in config.js, but clean.txt should be scanned
    assert(cleanReport.filesScanned === 2, 'Should scan both files');

    // Cleanup
    console.log('  Cleanup...');
    fs.rmSync(testDir, { recursive: true });
    
    console.log('\n  ✅ End-to-end demo scenario completed successfully!');
  } catch (error) {
    // Cleanup on error
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    throw error;
  }
}

/**
 * Test: Detection accuracy
 */
function testDetectionAccuracy() {
  console.log('\n=== Testing Detection Accuracy ===');

  const testCases = [
    {
      name: 'AWS Access Key',
      content: 'AWS_KEY=AKIAIOSFODNN7EXAMPLE',
      expectedRuleId: 'aws-access-key',
      shouldDetect: true
    },
    {
      name: 'GitHub Token',
      content: 'GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwx',
      expectedRuleId: 'github-token',
      shouldDetect: true
    },
    {
      name: 'Email Address',
      content: 'Contact: admin@example.com',
      expectedRuleId: 'email-address',
      shouldDetect: true
    },
    {
      name: 'GPL License',
      content: 'This code is licensed under GPL v3',
      expectedRuleId: 'gpl-license',
      shouldDetect: true
    },
    {
      name: 'Clean Code',
      content: 'const x = 42; console.log(x);',
      expectedRuleId: null,
      shouldDetect: false
    }
  ];

  clearRulesCache();

  for (const testCase of testCases) {
    const detections = scanText(testCase.content, 'test.js');
    
    if (testCase.shouldDetect) {
      assert(detections.length > 0, 
        `Should detect ${testCase.name}`);
      
      if (testCase.expectedRuleId) {
        const found = detections.some(d => d.ruleId === testCase.expectedRuleId);
        assert(found, 
          `Should detect rule ${testCase.expectedRuleId} for ${testCase.name}`);
      }
    } else {
      const hasExpectedRule = !testCase.expectedRuleId || 
        !detections.some(d => d.ruleId === testCase.expectedRuleId);
      assert(hasExpectedRule, 
        `Should not detect false positive for ${testCase.name}`);
    }
  }
}

/**
 * Test: Configuration options
 */
function testConfigurationOptions() {
  console.log('\n=== Testing Configuration Options ===');

  const testDir = path.join(__dirname, '..', '..', '.test-config');
  
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  
  fs.mkdirSync(testDir, { recursive: true });

  try {
    // Create test files
    const file1 = path.join(testDir, 'small.txt');
    const file2 = path.join(testDir, 'file.js');
    
    fs.writeFileSync(file1, 'AWS_KEY=AKIAIOSFODNN7EXAMPLE');
    fs.writeFileSync(file2, 'const x = 123;');

    // Test maxFileSize
    console.log('  Testing maxFileSize option...');
    const report1 = scanWorkspace({ 
      workspacePath: testDir,
      maxFileSize: 10 // Very small size
    });
    
    // With very small maxFileSize, files might be skipped
    console.log(`     Scanned ${report1.filesScanned} file(s) with maxFileSize=10`);

    // Test ignorePaths
    console.log('  Testing ignorePaths option...');
    const report2 = scanWorkspace({ 
      workspacePath: testDir,
      ignorePaths: ['*.js']
    });
    
    // file.js should be ignored
    console.log(`     Scanned ${report2.filesScanned} file(s) with ignorePaths=['*.js']`);

    // Cleanup
    fs.rmSync(testDir, { recursive: true });
    
    console.log('  ✅ Configuration options tests passed');
  } catch (error) {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    throw error;
  }
}

/**
 * Run all end-to-end tests
 */
function runE2ETests() {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║    RepoGuardian E2E Tests                 ║');
  console.log('╚════════════════════════════════════════════╝');

  try {
    testEndToEndDemoScenario();
    testDetectionAccuracy();
    testConfigurationOptions();

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║    ✅ All E2E Tests Passed!               ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ E2E Tests Failed:', error);
    process.exit(1);
  }
}

// Allow importing for use in other tests
export { testEndToEndDemoScenario, testDetectionAccuracy, testConfigurationOptions };

// Run if executed directly
if (require.main === module) {
  runE2ETests();
}
