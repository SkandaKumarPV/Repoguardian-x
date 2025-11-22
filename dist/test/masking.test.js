"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runTests = runTests;
const masking_1 = require("../core/masking");
/**
 * Simple test runner
 */
function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAILED: ${message}`);
        process.exit(1);
    }
    else {
        console.log(`✅ PASSED: ${message}`);
    }
}
function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        console.error(`❌ FAILED: ${message}`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Actual:   ${actual}`);
        process.exit(1);
    }
    else {
        console.log(`✅ PASSED: ${message}`);
    }
}
/**
 * Test maskSecret function
 */
function testMaskSecret() {
    console.log('\n=== Testing maskSecret ===');
    // Long string: first 4 + last 4 visible, minimum 4 asterisks in middle
    const longSecret = 'AKIAIOSFODNN7EXAMPLE';
    const masked = (0, masking_1.maskSecret)(longSecret);
    assert(masked.startsWith('AKIA'), 'Long secret should start with first 4 chars');
    assert(masked.endsWith('MPLE'), 'Long secret should end with last 4 chars');
    assert(masked.includes('****'), 'Long secret should have at least 4 asterisks');
    assertEqual(masked, 'AKIA************MPLE', 'Long secret masking');
    // Short string (<8 chars): first + last visible
    const shortSecret = 'abc123';
    const maskedShort = (0, masking_1.maskSecret)(shortSecret);
    assertEqual(maskedShort, 'a****3', 'Short secret masking (6 chars)');
    // Very short strings
    assertEqual((0, masking_1.maskSecret)('ab'), 'a*', 'Very short secret (2 chars)');
    assertEqual((0, masking_1.maskSecret)('a'), '*', 'Single char secret');
    assertEqual((0, masking_1.maskSecret)(''), '****', 'Empty string');
    // 8 character string (edge case)
    assertEqual((0, masking_1.maskSecret)('12345678'), '1234****5678', '8 character secret');
}
/**
 * Test maskEmail function
 */
function testMaskEmail() {
    console.log('\n=== Testing maskEmail ===');
    const email = 'john.doe@example.com';
    const masked = (0, masking_1.maskEmail)(email);
    assert(masked.endsWith('@example.com'), 'Email domain should be preserved');
    assert(masked.startsWith('j'), 'Email should start with first char');
    assert(masked.includes('*'), 'Email local part should be masked');
    assertEqual(masked, 'j******e@example.com', 'Email masking');
    // Short email local part
    const shortEmail = 'ab@test.com';
    const maskedShort = (0, masking_1.maskEmail)(shortEmail);
    assertEqual(maskedShort, 'a*@test.com', 'Short email masking');
    // Very short local part
    const veryShort = 'a@test.com';
    const maskedVeryShort = (0, masking_1.maskEmail)(veryShort);
    assert(maskedVeryShort.includes('*'), 'Very short email should be masked');
}
/**
 * Test maskConnectionString function
 */
function testMaskConnectionString() {
    console.log('\n=== Testing maskConnectionString ===');
    // Key=value format
    const connStr1 = 'Server=myServer;Database=myDB;User=admin;Password=MySecretPass123;';
    const masked1 = (0, masking_1.maskConnectionString)(connStr1);
    assert(masked1.includes('Password='), 'Connection string should preserve key');
    assert(!masked1.includes('MySecretPass123'), 'Connection string should mask password');
    assert(masked1.includes('MySe') && masked1.includes('s123'), 'Connection string should partially mask password');
    // URL format
    const connStr2 = 'mongodb://user:MySecretPass123@localhost:27017/mydb';
    const masked2 = (0, masking_1.maskConnectionString)(connStr2);
    assert(masked2.includes('mongodb://'), 'URL format should preserve protocol');
    assert(!masked2.includes(':MySecretPass123@'), 'URL password should be masked');
    assert(masked2.includes('@localhost'), 'URL host should be preserved');
}
/**
 * Test maskValue function
 */
function testMaskValue() {
    console.log('\n=== Testing maskValue ===');
    // Email detection
    const email = 'test@example.com';
    const maskedEmail = (0, masking_1.maskValue)(email, 'email-address');
    assert(maskedEmail.includes('@'), 'Email should be detected and masked properly');
    // Connection string detection
    const connStr = 'password=secret123';
    const maskedConn = (0, masking_1.maskValue)(connStr);
    assert(!connStr.includes('secret123') || maskedConn.includes('*'), 'Connection string password should be masked');
    // Regular secret
    const secret = 'AKIAIOSFODNN7EXAMPLE';
    const maskedSecret = (0, masking_1.maskValue)(secret);
    assertEqual(maskedSecret, 'AKIA************MPLE', 'Regular secret masking');
}
/**
 * Test maskSnippet function
 */
function testMaskSnippet() {
    console.log('\n=== Testing maskSnippet ===');
    const snippet = 'const apiKey = "AKIAIOSFODNN7EXAMPLE";';
    const pattern = 'AKIA[0-9A-Z]{16}';
    const masked = (0, masking_1.maskSnippet)(snippet, 'aws-access-key', pattern);
    assert(!masked.includes('AKIAIOSFODNN7EXAMPLE'), 'Snippet should mask the matched pattern');
    assert(masked.includes('const apiKey'), 'Snippet should preserve surrounding code');
    assert(masked.includes('AKIA************MPLE'), 'Snippet should contain masked value');
}
/**
 * Test maskDetections function
 */
function testMaskDetections() {
    console.log('\n=== Testing maskDetections ===');
    const detections = [
        {
            ruleId: 'aws-access-key',
            ruleName: 'AWS Access Key',
            severity: 'error',
            snippet: 'const key = "AKIAIOSFODNN7EXAMPLE";',
            filePath: '/test/file.js',
            line: 10
        },
        {
            ruleId: 'email-address',
            ruleName: 'Email Address',
            severity: 'info',
            snippet: 'email: "john.doe@example.com"',
            filePath: '/test/config.js',
            line: 5
        }
    ];
    const masked = (0, masking_1.maskDetections)(detections);
    assertEqual(masked.length, 2, 'Should return same number of detections');
    // Note: maskDetections currently returns detections as-is since masking happens in detector
    assertEqual(masked[0].ruleId, 'aws-access-key', 'Rule ID should be preserved');
    assertEqual(masked[0].line, 10, 'Line number should be preserved');
}
/**
 * Test with fake credentials
 */
function testFakeCredentials() {
    console.log('\n=== Testing Fake Credentials ===');
    const fakeAWSKey = 'AKIAIOSFODNN7EXAMPLE';
    const masked1 = (0, masking_1.maskSecret)(fakeAWSKey);
    assert(!masked1.includes('IOSFODNN7EX'), 'Fake AWS key should not expose middle portion');
    const fakePassword = 'SuperSecret123!@#';
    const masked2 = (0, masking_1.maskSecret)(fakePassword);
    assert(!masked2.includes('Secret'), 'Fake password should not expose middle portion');
    const fakeToken = 'ghp_1234567890abcdefghijklmnopqrstuvwx';
    const masked3 = (0, masking_1.maskSecret)(fakeToken);
    assert(masked3.includes('****'), 'Fake token should be masked with asterisks');
    assert(masked3.startsWith('ghp_'), 'Fake token should preserve prefix');
}
/**
 * Run all tests
 */
function runTests() {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║    RepoGuardian Masking Tests             ║');
    console.log('╚════════════════════════════════════════════╝');
    try {
        testMaskSecret();
        testMaskEmail();
        testMaskConnectionString();
        testMaskValue();
        testMaskSnippet();
        testMaskDetections();
        testFakeCredentials();
        console.log('\n╔════════════════════════════════════════════╗');
        console.log('║    ✅ ALL TESTS PASSED                     ║');
        console.log('╚════════════════════════════════════════════╝\n');
        process.exit(0);
    }
    catch (error) {
        console.error('\n╔════════════════════════════════════════════╗');
        console.error('║    ❌ TESTS FAILED                         ║');
        console.error('╚════════════════════════════════════════════╝\n');
        console.error(error);
        process.exit(1);
    }
}
// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}
//# sourceMappingURL=masking.test.js.map