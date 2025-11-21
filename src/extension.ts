import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { scanWorkspace, scanFiles } from './core/scanner';
import { saveReport, loadLatestReport, cleanupOldReports } from './core/reports';

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log('RepoGuardian X is now active');

  // Create diagnostic collection for the Problems panel
  diagnosticCollection = vscode.languages.createDiagnosticCollection('repoguardian');
  context.subscriptions.push(diagnosticCollection);

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'repoguardian.scan';
  updateStatusBar('idle');
  
  // Show status bar based on config
  const config = vscode.workspace.getConfiguration('repoguardian');
  if (config.get('showStatusBar', true)) {
    statusBarItem.show();
  }
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('repoguardian.scan', runSecurityScan)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repoguardian.installHook', installPrePushHook)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repoguardian.showLastReport', showLastReport)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repoguardian.addToIgnore', addToIgnoreList)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('repoguardian.openRemediation', openRemediationNotes)
  );

  // Watch for file saves if enabled
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      const config = vscode.workspace.getConfiguration('repoguardian');
      if (config.get('scanOnSave')) {
        scanSingleFile(document.uri.fsPath);
      }
    })
  );

  // Load last report on startup
  loadAndDisplayLastReport();

  // Cleanup old reports
  const workspacePath = getWorkspacePath();
  if (workspacePath) {
    const config = vscode.workspace.getConfiguration('repoguardian');
    const retentionDays = config.get('reportRetentionDays', 7);
    cleanupOldReports(workspacePath, retentionDays);
  }
}

export function deactivate() {
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
function updateStatusBar(status: 'idle' | 'scanning' | 'clean' | 'issues') {
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
function getWorkspacePath(): string | undefined {
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
    const config = vscode.workspace.getConfiguration('repoguardian');
    const maxFileSize = config.get('maxFileSize', 1048576);
    const ignorePaths = config.get<string[]>('ignorePaths', []);
    
    const report = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'RepoGuardian: Scanning workspace...',
        cancellable: false
      },
      async () => {
        return scanWorkspace({ 
          workspacePath,
          maxFileSize,
          ignorePaths
        });
      }
    );

    // Save report
    saveReport(report, workspacePath);

    // Display detections in Problems panel
    displayDetections(report.detections);

    // Update status bar
    const config = vscode.workspace.getConfiguration('repoguardian');
    const enableNotifications = config.get('enableNotifications', true);
    
    if (report.detectionsFound === 0) {
      updateStatusBar('clean');
      if (enableNotifications) {
        vscode.window.showInformationMessage(
          `✅ RepoGuardian: Clean - No issues in ${report.filesScanned} files`
        );
      }
    } else {
      updateStatusBar('issues');
      if (enableNotifications) {
        const action = await vscode.window.showWarningMessage(
          `⚠️ RepoGuardian: ${report.detectionsFound} issue(s) found`,
          'View Report',
          'Open Problems'
        );
        
        if (action === 'View Report') {
          showLastReport();
        } else if (action === 'Open Problems') {
          vscode.commands.executeCommand('workbench.actions.view.problems');
        }
      }
    }
  } catch (error) {
    updateStatusBar('idle');
    vscode.window.showErrorMessage(`RepoGuardian scan failed: ${error}`);
  }
}

/**
 * Scan a single file
 */
async function scanSingleFile(filePath: string) {
  const workspacePath = getWorkspacePath();
  
  if (!workspacePath) {
    return;
  }

  try {
    const report = scanFiles([filePath], workspacePath);
    
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
  } catch (error) {
    console.error('Failed to scan file:', error);
  }
}

/**
 * Display detections in Problems panel
 */
function displayDetections(detections: any[]) {
  diagnosticCollection.clear();

  // Group by file
  const byFile = new Map<string, any[]>();
  
  for (const detection of detections) {
    if (!byFile.has(detection.filePath)) {
      byFile.set(detection.filePath, []);
    }
    byFile.get(detection.filePath)!.push(detection);
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
function createDiagnostic(detection: any): vscode.Diagnostic {
  const line = Math.max(0, detection.line - 1);
  const range = new vscode.Range(line, 0, line, 1000);
  
  let severity: vscode.DiagnosticSeverity;
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

  const diagnostic = new vscode.Diagnostic(
    range,
    `[${detection.ruleId}] ${detection.ruleName}: ${detection.snippet}`,
    severity
  );

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
  } catch (error) {
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

  const report = loadLatestReport(workspacePath);
  
  if (!report) {
    vscode.window.showInformationMessage('No previous scan reports found');
    return;
  }

  // Display in Problems panel
  displayDetections(report.detections);

  // Update status bar
  if (report.detectionsFound === 0) {
    updateStatusBar('clean');
  } else {
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

  const report = loadLatestReport(workspacePath);
  
  if (report) {
    displayDetections(report.detections);
    
    if (report.detectionsFound === 0) {
      updateStatusBar('clean');
    } else {
      updateStatusBar('issues');
    }
  }
}

/**
 * Add item to ignore list
 */
async function addToIgnoreList(uri: vscode.Uri, line: number) {
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
  } catch (error) {
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
  } else {
    vscode.window.showWarningMessage('Remediation notes not found');
  }
}
