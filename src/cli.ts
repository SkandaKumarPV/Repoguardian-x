#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { scanWorkspace, scanFiles, ScanReport } from './core/scanner';
import { saveReport, cleanupOldReports } from './core/reports';

interface CliOptions {
  scanStaged?: boolean;
  scanFiles?: string[];
  output?: string;
  workspacePath?: string;
}

/**
 * Get list of staged files from git
 */
function getStagedFiles(workspacePath: string): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      cwd: workspacePath,
      encoding: 'utf-8'
    });
    
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } catch (error) {
    console.error('Failed to get staged files. Are you in a git repository?');
    return [];
  }
}

/**
 * Print scan results to console
 */
function printResults(report: ScanReport): void {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('           RepoGuardian Security Scan Results          ');
  console.log('═══════════════════════════════════════════════════════\n');
  
  console.log(`Timestamp:       ${report.timestamp}`);
  console.log(`Files Scanned:   ${report.filesScanned}`);
  console.log(`Detections:      ${report.detectionsFound}`);
  console.log();

  if (report.detectionsFound === 0) {
    console.log('✓ No security issues detected. Repository is clean!\n');
  } else {
    console.log('⚠ Security issues detected:\n');
    
    // Group by severity
    const errors = report.detections.filter(d => d.severity === 'error');
    const warnings = report.detections.filter(d => d.severity === 'warning');
    const infos = report.detections.filter(d => d.severity === 'info');
    
    if (errors.length > 0) {
      console.log(`\n❌ ERRORS (${errors.length}):`);
      errors.forEach(d => {
        console.log(`  ${d.filePath}:${d.line}`);
        console.log(`    [${d.ruleId}] ${d.ruleName}`);
        console.log(`    ${d.snippet}`);
        console.log();
      });
    }
    
    if (warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
      warnings.forEach(d => {
        console.log(`  ${d.filePath}:${d.line}`);
        console.log(`    [${d.ruleId}] ${d.ruleName}`);
        console.log(`    ${d.snippet}`);
        console.log();
      });
    }
    
    if (infos.length > 0) {
      console.log(`\nℹ️  INFO (${infos.length}):`);
      infos.forEach(d => {
        console.log(`  ${d.filePath}:${d.line}`);
        console.log(`    [${d.ruleId}] ${d.ruleName}`);
        console.log(`    ${d.snippet}`);
        console.log();
      });
    }
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️  PUSH BLOCKED - Security issues must be resolved');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\nPlease check the VS Code Problems panel for details.');
    console.log('To ignore false positives, add them to .safecommit-ignore\n');
  }
}

/**
 * Save report to JSON file
 */
function saveToFile(report: ScanReport, outputPath: string): void {
  try {
    const json = JSON.stringify(report, null, 2);
    fs.writeFileSync(outputPath, json, 'utf-8');
    console.log(`\nReport saved to: ${outputPath}`);
  } catch (error) {
    console.error('Failed to save report:', error);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--scan-staged') {
      options.scanStaged = true;
    } else if (arg === '--scan-files') {
      options.scanFiles = [];
      i++;
      while (i < args.length && !args[i].startsWith('--')) {
        options.scanFiles.push(args[i]);
        i++;
      }
      i--;
    } else if (arg === '--output') {
      i++;
      if (i < args.length) {
        options.output = args[i];
      }
    } else if (arg === '--workspace' || arg === '--cwd') {
      i++;
      if (i < args.length) {
        options.workspacePath = args[i];
      }
    }
  }
  
  return options;
}

/**
 * Print usage information
 */
function printUsage(): void {
  console.log(`
RepoGuardian CLI - Local Security Scanner

Usage:
  repoguardian [options]

Options:
  --scan-staged              Scan only staged files (for pre-push hook)
  --scan-files <files...>    Scan specific files
  --output <path>            Save report to JSON file
  --workspace <path>         Set workspace directory (default: current)
  --help                     Show this help message

Examples:
  repoguardian --scan-staged
  repoguardian --scan-files src/file1.js src/file2.ts
  repoguardian --output report.json

Exit Codes:
  0 - No issues found (clean)
  1 - Security issues detected
  2 - Error during scan
`);
}

/**
 * Main CLI entry point
 */
function main(): void {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  const options = parseArgs(args);
  const workspacePath = options.workspacePath || process.cwd();
  
  try {
    let report: ScanReport;
    
    if (options.scanStaged) {
      // Scan staged files only
      const stagedFiles = getStagedFiles(workspacePath);
      
      if (stagedFiles.length === 0) {
        console.log('No staged files to scan.');
        process.exit(0);
      }
      
      console.log(`Scanning ${stagedFiles.length} staged file(s)...`);
      report = scanFiles(stagedFiles, workspacePath);
    } else if (options.scanFiles && options.scanFiles.length > 0) {
      // Scan specific files
      console.log(`Scanning ${options.scanFiles.length} file(s)...`);
      report = scanFiles(options.scanFiles, workspacePath);
    } else {
      // Scan entire workspace
      console.log('Scanning workspace...');
      report = scanWorkspace({ workspacePath });
    }
    
    // Save report to .repo-guardian/reports/
    try {
      saveReport(report, workspacePath);
      cleanupOldReports(workspacePath);
    } catch (error) {
      console.error('Warning: Failed to save report to disk');
    }
    
    // Print results
    printResults(report);
    
    // Save to custom output if specified
    if (options.output) {
      saveToFile(report, options.output);
    }
    
    // Exit with appropriate code
    if (report.detectionsFound > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Error during scan:', error);
    process.exit(2);
  }
}

// Run CLI if executed directly
if (require.main === module) {
  main();
}

export { main, parseArgs, printResults };
