#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
exports.parseArgs = parseArgs;
exports.printResults = printResults;
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const scanner_1 = require("./core/scanner");
const reports_1 = require("./core/reports");
/**
 * Get list of staged files from git
 */
function getStagedFiles(workspacePath) {
    try {
        const output = (0, child_process_1.execSync)('git diff --cached --name-only --diff-filter=ACM', {
            cwd: workspacePath,
            encoding: 'utf-8'
        });
        return output
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }
    catch (error) {
        console.error('Failed to get staged files. Are you in a git repository?');
        return [];
    }
}
/**
 * Print scan results to console
 */
function printResults(report) {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('           RepoGuardian Security Scan Results          ');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`Timestamp:       ${report.timestamp}`);
    console.log(`Files Scanned:   ${report.filesScanned}`);
    console.log(`Detections:      ${report.detectionsFound}`);
    console.log();
    if (report.detectionsFound === 0) {
        console.log('✓ No security issues detected. Repository is clean!\n');
    }
    else {
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
function saveToFile(report, outputPath) {
    try {
        const json = JSON.stringify(report, null, 2);
        fs.writeFileSync(outputPath, json, 'utf-8');
        console.log(`\nReport saved to: ${outputPath}`);
    }
    catch (error) {
        console.error('Failed to save report:', error);
    }
}
/**
 * Parse command line arguments
 */
function parseArgs(args) {
    const options = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--scan-staged') {
            options.scanStaged = true;
        }
        else if (arg === '--scan-files') {
            options.scanFiles = [];
            i++;
            while (i < args.length && !args[i].startsWith('--')) {
                options.scanFiles.push(args[i]);
                i++;
            }
            i--;
        }
        else if (arg === '--output') {
            i++;
            if (i < args.length) {
                options.output = args[i];
            }
        }
        else if (arg === '--workspace' || arg === '--cwd') {
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
function printUsage() {
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
function main() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        printUsage();
        process.exit(0);
    }
    const options = parseArgs(args);
    const workspacePath = options.workspacePath || process.cwd();
    try {
        let report;
        if (options.scanStaged) {
            // Scan staged files only
            const stagedFiles = getStagedFiles(workspacePath);
            if (stagedFiles.length === 0) {
                console.log('No staged files to scan.');
                process.exit(0);
            }
            console.log(`Scanning ${stagedFiles.length} staged file(s)...`);
            report = (0, scanner_1.scanFiles)(stagedFiles, workspacePath);
        }
        else if (options.scanFiles && options.scanFiles.length > 0) {
            // Scan specific files
            console.log(`Scanning ${options.scanFiles.length} file(s)...`);
            report = (0, scanner_1.scanFiles)(options.scanFiles, workspacePath);
        }
        else {
            // Scan entire workspace
            console.log('Scanning workspace...');
            report = (0, scanner_1.scanWorkspace)({ workspacePath });
        }
        // Save report to .repo-guardian/reports/
        try {
            (0, reports_1.saveReport)(report, workspacePath);
            (0, reports_1.cleanupOldReports)(workspacePath);
        }
        catch (error) {
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
        }
        else {
            process.exit(0);
        }
    }
    catch (error) {
        console.error('\n❌ Error during scan:', error);
        process.exit(2);
    }
}
// Run CLI if executed directly
if (require.main === module) {
    main();
}
//# sourceMappingURL=cli.js.map