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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const scanner_1 = require("./core/scanner");
const reports_1 = require("./core/reports");
let diagnosticCollection;
let statusBarItem;
function activate(context) {
    console.log('RepoGuardian X is now active');
    // Create diagnostic collection for the Problems panel
    diagnosticCollection = vscode.languages.createDiagnosticCollection('repoguardian');
    context.subscriptions.push(diagnosticCollection);
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'repoguardian.scan';
    updateStatusBar('idle');
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand('repoguardian.scan', runSecurityScan));
    context.subscriptions.push(vscode.commands.registerCommand('repoguardian.installHook', installPrePushHook));
    context.subscriptions.push(vscode.commands.registerCommand('repoguardian.showLastReport', showLastReport));
    context.subscriptions.push(vscode.commands.registerCommand('repoguardian.addToIgnore', addToIgnoreList));
    context.subscriptions.push(vscode.commands.registerCommand('repoguardian.openRemediation', openRemediationNotes));
    // Watch for file saves if enabled
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument((document) => {
        const config = vscode.workspace.getConfiguration('repoguardian');
        if (config.get('scanOnSave')) {
            scanSingleFile(document.uri.fsPath);
        }
    }));
    // Load last report on startup
    loadAndDisplayLastReport();
    // Cleanup old reports
    const workspacePath = getWorkspacePath();
    if (workspacePath) {
        (0, reports_1.cleanupOldReports)(workspacePath);
    }
}
function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
/**
 * Update status bar item
 */
function updateStatusBar(status) {
    switch (status) {
        case 'scanning':
            statusBarItem.text = '$(sync~spin) RepoGuardian: Scanning...';
            statusBarItem.backgroundColor = undefined;
            break;
        case 'clean':
            statusBarItem.text = '$(shield) RepoGuardian: Clean';
            statusBarItem.backgroundColor = undefined;
            break;
        case 'issues':
            statusBarItem.text = '$(alert) RepoGuardian: Issues Found';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            break;
        default:
            statusBarItem.text = '$(shield) RepoGuardian';
            statusBarItem.backgroundColor = undefined;
    }
}
/**
 * Get workspace path
 */
function getWorkspacePath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0].uri.fsPath;
}
/**
 * Run security scan on entire workspace
 */
async function runSecurityScan() {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    updateStatusBar('scanning');
    diagnosticCollection.clear();
    try {
        const report = await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'RepoGuardian: Scanning workspace...',
            cancellable: false
        }, async () => {
            return (0, scanner_1.scanWorkspace)({ workspacePath });
        });
        // Save report
        (0, reports_1.saveReport)(report, workspacePath);
        // Display detections in Problems panel
        displayDetections(report.detections);
        // Update status bar
        if (report.detectionsFound === 0) {
            updateStatusBar('clean');
            vscode.window.showInformationMessage(`✅ RepoGuardian: No security issues detected (${report.filesScanned} files scanned)`);
        }
        else {
            updateStatusBar('issues');
            vscode.window.showWarningMessage(`⚠️ RepoGuardian: Found ${report.detectionsFound} issue(s) in ${report.filesScanned} files`);
        }
    }
    catch (error) {
        updateStatusBar('idle');
        vscode.window.showErrorMessage(`RepoGuardian scan failed: ${error}`);
    }
}
/**
 * Scan a single file
 */
async function scanSingleFile(filePath) {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        return;
    }
    try {
        const report = (0, scanner_1.scanFiles)([filePath], workspacePath);
        // Clear diagnostics for this file
        const uri = vscode.Uri.file(filePath);
        diagnosticCollection.delete(uri);
        // Add new diagnostics
        if (report.detections.length > 0) {
            const diagnostics = report.detections
                .filter(d => d.filePath === filePath)
                .map(d => createDiagnostic(d));
            diagnosticCollection.set(uri, diagnostics);
        }
    }
    catch (error) {
        console.error('Failed to scan file:', error);
    }
}
/**
 * Display detections in Problems panel
 */
function displayDetections(detections) {
    diagnosticCollection.clear();
    // Group by file
    const byFile = new Map();
    for (const detection of detections) {
        if (!byFile.has(detection.filePath)) {
            byFile.set(detection.filePath, []);
        }
        byFile.get(detection.filePath).push(detection);
    }
    // Create diagnostics for each file
    for (const [filePath, fileDetections] of byFile) {
        const uri = vscode.Uri.file(filePath);
        const diagnostics = fileDetections.map(d => createDiagnostic(d));
        diagnosticCollection.set(uri, diagnostics);
    }
}
/**
 * Create a diagnostic from a detection
 */
function createDiagnostic(detection) {
    const line = Math.max(0, detection.line - 1);
    const range = new vscode.Range(line, 0, line, 1000);
    let severity;
    switch (detection.severity) {
        case 'error':
            severity = vscode.DiagnosticSeverity.Error;
            break;
        case 'warning':
            severity = vscode.DiagnosticSeverity.Warning;
            break;
        default:
            severity = vscode.DiagnosticSeverity.Information;
    }
    const diagnostic = new vscode.Diagnostic(range, `[${detection.ruleId}] ${detection.ruleName}: ${detection.snippet}`, severity);
    diagnostic.source = 'RepoGuardian';
    diagnostic.code = detection.ruleId;
    return diagnostic;
}
/**
 * Install pre-push hook
 */
async function installPrePushHook() {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const gitHooksPath = path.join(workspacePath, '.git', 'hooks');
    if (!fs.existsSync(path.join(workspacePath, '.git'))) {
        vscode.window.showErrorMessage('Not a git repository');
        return;
    }
    try {
        // Ensure hooks directory exists
        fs.mkdirSync(gitHooksPath, { recursive: true });
        // Determine which hook to use based on platform
        const isWindows = process.platform === 'win32';
        const hookSource = path.join(__dirname, 'hook', isWindows ? 'pre-push.cmd' : 'pre-push.sh');
        const hookDest = path.join(gitHooksPath, 'pre-push');
        // Copy hook file
        fs.copyFileSync(hookSource, hookDest);
        // Make executable on Unix
        if (!isWindows) {
            fs.chmodSync(hookDest, '755');
        }
        vscode.window.showInformationMessage('✅ Pre-push hook installed successfully');
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to install hook: ${error}`);
    }
}
/**
 * Show last report
 */
async function showLastReport() {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }
    const report = (0, reports_1.loadLatestReport)(workspacePath);
    if (!report) {
        vscode.window.showInformationMessage('No previous scan reports found');
        return;
    }
    // Display in Problems panel
    displayDetections(report.detections);
    // Update status bar
    if (report.detectionsFound === 0) {
        updateStatusBar('clean');
    }
    else {
        updateStatusBar('issues');
    }
    // Show summary
    const message = report.detectionsFound === 0
        ? `Last scan (${report.timestamp}): No issues found`
        : `Last scan (${report.timestamp}): ${report.detectionsFound} issue(s) found`;
    vscode.window.showInformationMessage(message);
}
/**
 * Load and display last report on startup
 */
function loadAndDisplayLastReport() {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        return;
    }
    const report = (0, reports_1.loadLatestReport)(workspacePath);
    if (report) {
        displayDetections(report.detections);
        if (report.detectionsFound === 0) {
            updateStatusBar('clean');
        }
        else {
            updateStatusBar('issues');
        }
    }
}
/**
 * Add item to ignore list
 */
async function addToIgnoreList(uri, line) {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        return;
    }
    const ignorePath = path.join(workspacePath, '.safecommit-ignore');
    const relativePath = path.relative(workspacePath, uri.fsPath);
    const entry = `${relativePath}:${line}`;
    try {
        let content = '';
        if (fs.existsSync(ignorePath)) {
            content = fs.readFileSync(ignorePath, 'utf-8');
        }
        if (!content.includes(entry)) {
            content += `\n${entry}\n`;
            fs.writeFileSync(ignorePath, content);
            vscode.window.showInformationMessage(`Added to .safecommit-ignore: ${entry}`);
        }
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to update .safecommit-ignore: ${error}`);
    }
}
/**
 * Open remediation notes
 */
async function openRemediationNotes() {
    const workspacePath = getWorkspacePath();
    if (!workspacePath) {
        return;
    }
    const notesPath = path.join(workspacePath, 'docs', 'AI_REMEDIATION_NOTES.md');
    if (fs.existsSync(notesPath)) {
        const doc = await vscode.workspace.openTextDocument(notesPath);
        await vscode.window.showTextDocument(doc);
    }
    else {
        vscode.window.showWarningMessage('Remediation notes not found');
    }
}
//# sourceMappingURL=extension.js.map