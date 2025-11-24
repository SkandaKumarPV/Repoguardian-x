import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { scanWorkspace, scanFiles, ScanReport } from './core/scanner';
import { saveReport, loadLatestReport, cleanupOldReports } from './core/reports';
import { loadRules, Detection } from './core/detector';

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;
let currentReport: ScanReport | null = null;
let scanSummaryPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log('RepoGuardian X is now active');
  
  // Show welcome message
  vscode.window.showInformationMessage(
    '🔒 RepoGuardian X activated! Never leak a secret again.',
    'Run Scan',
    'Install Hook'
  ).then(selection => {
    if (selection === 'Run Scan') {
      vscode.commands.executeCommand('repoguardian.scan');
    } else if (selection === 'Install Hook') {
      vscode.commands.executeCommand('repoguardian.installHook');
    }
  });

  // Create diagnostic collection for the Problems panel
  diagnosticCollection = vscode.languages.createDiagnosticCollection('repoguardian');
  context.subscriptions.push(diagnosticCollection);

  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'repoguardian.openScanSummary';
  statusBarItem.tooltip = 'Click to open scan summary';
  updateStatusBar('idle', 0);
  
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

  // NEW: Register Fix Wizard command
  context.subscriptions.push(
    vscode.commands.registerCommand('repoguardian.fixIssue', showFixWizard)
  );

  // NEW: Register Scan Summary command
  context.subscriptions.push(
    vscode.commands.registerCommand('repoguardian.openScanSummary', openScanSummary)
  );

  // NEW: Register hover provider for diagnostics
  context.subscriptions.push(
    vscode.languages.registerHoverProvider('*', new RepoGuardianHoverProvider())
  );

  // NEW: Register code action provider for quick fixes
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider('*', new RepoGuardianCodeActionProvider(), {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
    })
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
function updateStatusBar(status: 'idle' | 'scanning' | 'clean' | 'issues', issueCount: number = 0) {
  switch (status) {
    case 'scanning':
      statusBarItem.text = '$(sync~spin) RepoGuardian: Scanning...';
      statusBarItem.backgroundColor = undefined;
      statusBarItem.color = undefined;
      break;
    case 'clean':
      statusBarItem.text = '$(shield-check) RepoGuardian: Clean';
      statusBarItem.backgroundColor = undefined;
      statusBarItem.color = new vscode.ThemeColor('charts.green');
      break;
    case 'issues':
      const icon = issueCount > 5 ? '$(error)' : '$(warning)';
      statusBarItem.text = `${icon} RepoGuardian: ${issueCount} issue${issueCount !== 1 ? 's' : ''}`;
      statusBarItem.backgroundColor = issueCount > 5 
        ? new vscode.ThemeColor('statusBarItem.errorBackground')
        : new vscode.ThemeColor('statusBarItem.warningBackground');
      statusBarItem.color = undefined;
      break;
    default:
      statusBarItem.text = '$(shield) RepoGuardian';
      statusBarItem.backgroundColor = undefined;
      statusBarItem.color = undefined;
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

    // Store in global state
    currentReport = report;

    // Display detections in Problems panel
    displayDetections(report.detections);

    // Update status bar with issue count
    const enableNotifications = config.get('enableNotifications', true);
    
    if (report.detectionsFound === 0) {
      updateStatusBar('clean', 0);
      if (enableNotifications) {
        vscode.window.showInformationMessage(
          `✅ RepoGuardian: Clean - No issues in ${report.filesScanned} files`
        );
      }
    } else {
      updateStatusBar('issues', report.detectionsFound);
      if (enableNotifications) {
        const action = await vscode.window.showWarningMessage(
          `⚠️ RepoGuardian: ${report.detectionsFound} issue(s) found`,
          'View Summary',
          'Open Problems'
        );
        
        if (action === 'View Summary') {
          openScanSummary();
        } else if (action === 'Open Problems') {
          vscode.commands.executeCommand('workbench.actions.view.problems');
        }
      }
    }

    // Refresh webview if open
    if (scanSummaryPanel) {
      scanSummaryPanel.webview.html = getScanSummaryWebviewContent(currentReport);
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

    // Use bash script for all platforms (Git Bash is used on Windows)
    const hookSource = path.join(__dirname, 'hook', 'pre-push.sh');
    const hookDest = path.join(gitHooksPath, 'pre-push');

    // Copy hook file
    fs.copyFileSync(hookSource, hookDest);

    // Make executable (Git on Windows respects this too)
    try {
      fs.chmodSync(hookDest, '755');
    } catch (chmodError) {
      // Ignore chmod errors on Windows
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
async function addToIgnoreList(uriOrString: vscode.Uri | string, line?: number) {
  const workspacePath = getWorkspacePath();
  
  if (!workspacePath) {
    return;
  }

  const ignorePath = path.join(workspacePath, '.safecommit-ignore');
  
  let entry: string;
  
  // Handle both string format "path:line" and (uri, line) format
  if (typeof uriOrString === 'string') {
    // String format: "path:line" or just "path"
    if (uriOrString.includes(':')) {
      const parts = uriOrString.split(':');
      const filePath = parts.slice(0, -1).join(':'); // Handle Windows paths with colons
      const relativePath = path.relative(workspacePath, filePath);
      entry = `${relativePath}:${parts[parts.length - 1]}`;
    } else {
      const relativePath = path.relative(workspacePath, uriOrString);
      entry = relativePath;
    }
  } else {
    // Uri format
    const relativePath = path.relative(workspacePath, uriOrString.fsPath);
    entry = line ? `${relativePath}:${line}` : relativePath;
  }
  
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

/**
 * Secret Fix Wizard - Guide users through fixing detected secrets
 */
async function showFixWizard(uri?: vscode.Uri, diagnostic?: vscode.Diagnostic) {
  if (!uri || !diagnostic) {
    vscode.window.showErrorMessage('No issue selected');
    return;
  }

  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    return;
  }

  const ruleId = String(diagnostic.code);
  const fileName = path.basename(uri.fsPath);
  const lineNumber = diagnostic.range.start.line + 1;

  const options = [
    {
      label: '$(file-symlink-file) Move to .env file',
      description: 'Extract secret to environment variable',
      action: 'moveToEnv'
    },
    {
      label: '$(exclude) Add to .safecommit-ignore',
      description: 'Suppress this warning (use with caution)',
      action: 'addToIgnore'
    },
    {
      label: '$(file-code) View masked report',
      description: 'See full context in scan report',
      action: 'viewReport'
    },
    {
      label: '$(book) View remediation tips',
      description: 'Learn how to fix this type of issue',
      action: 'viewTips'
    }
  ];

  const selected = await vscode.window.showQuickPick(options, {
    placeHolder: `Fix issue in ${fileName}:${lineNumber}`,
    title: 'RepoGuardian Fix Wizard'
  });

  if (!selected) {
    return;
  }

  switch (selected.action) {
    case 'moveToEnv':
      await moveSecretToEnv(uri, diagnostic, workspacePath);
      break;
    case 'addToIgnore':
      await addToIgnoreList(`${uri.fsPath}:${lineNumber}`);
      break;
    case 'viewReport':
      await viewMaskedReport(uri, lineNumber);
      break;
    case 'viewTips':
      await showRemediationTips(ruleId);
      break;
  }
}

/**
 * Move secret to .env file
 */
async function moveSecretToEnv(uri: vscode.Uri, diagnostic: vscode.Diagnostic, workspacePath: string) {
  const document = await vscode.workspace.openTextDocument(uri);
  const lineText = document.lineAt(diagnostic.range.start.line).text;
  
  // Suggest a variable name
  const ruleId = String(diagnostic.code);
  let suggestedName = 'SECRET_VALUE';
  
  if (ruleId.includes('aws-access-key')) {
    suggestedName = 'AWS_ACCESS_KEY_ID';
  } else if (ruleId.includes('aws-secret')) {
    suggestedName = 'AWS_SECRET_ACCESS_KEY';
  } else if (ruleId.includes('github')) {
    suggestedName = 'GITHUB_TOKEN';
  } else if (ruleId.includes('api')) {
    suggestedName = 'API_KEY';
  }

  const varName = await vscode.window.showInputBox({
    prompt: 'Enter environment variable name',
    value: suggestedName,
    validateInput: (value) => {
      if (!/^[A-Z_][A-Z0-9_]*$/.test(value)) {
        return 'Variable name must be uppercase with underscores';
      }
      return null;
    }
  });

  if (!varName) {
    return;
  }

  const envPath = path.join(workspacePath, '.env');
  const envExamplePath = path.join(workspacePath, '.env.example');
  
  // Add to .env
  try {
    const secretValue = lineText.substring(diagnostic.range.start.character, diagnostic.range.end.character);
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
    
    if (!envContent.includes(varName)) {
      fs.appendFileSync(envPath, `\n${varName}=${secretValue}\n`);
      vscode.window.showInformationMessage(`Added ${varName} to .env`);
    }

    // Add to .env.example
    if (!fs.existsSync(envExamplePath) || !fs.readFileSync(envExamplePath, 'utf-8').includes(varName)) {
      fs.appendFileSync(envExamplePath, `\n${varName}=your_${varName.toLowerCase()}_here\n`);
    }

    // Show diff suggestion
    vscode.window.showInformationMessage(
      `Replace the secret in ${path.basename(uri.fsPath)} with: process.env.${varName}`,
      'Open File'
    ).then(action => {
      if (action === 'Open File') {
        vscode.window.showTextDocument(uri);
      }
    });

  } catch (error) {
    vscode.window.showErrorMessage(`Failed to move secret: ${error}`);
  }
}

/**
 * View masked report for specific detection
 */
async function viewMaskedReport(uri: vscode.Uri, lineNumber: number) {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    return;
  }

  const report = loadLatestReport(workspacePath);
  if (!report || report.detections.length === 0) {
    vscode.window.showInformationMessage('No recent scan report found');
    return;
  }

  const detection = report.detections.find(
    d => d.filePath === uri.fsPath && d.line === lineNumber
  );

  if (!detection) {
    vscode.window.showInformationMessage('Detection not found in report');
    return;
  }

  const message = `**File:** ${path.basename(detection.filePath)}\n` +
    `**Line:** ${detection.line}\n` +
    `**Rule:** ${detection.ruleName}\n` +
    `**Severity:** ${detection.severity}\n` +
    `**Masked Snippet:** \`${detection.snippet}\`\n\n` +
    `**Description:** ${detection.description}`;

  const panel = vscode.window.createWebviewPanel(
    'repoguardianReport',
    'Detection Details',
    vscode.ViewColumn.Beside,
    {}
  );

  panel.webview.html = getReportWebviewContent(message);
}

/**
 * Show remediation tips based on rule type
 */
async function showRemediationTips(ruleId: string) {
  let tips = '### Remediation Tips\n\n';

  if (ruleId.includes('aws')) {
    tips += `**AWS Credentials:**\n`;
    tips += `- Store in \`~/.aws/credentials\` or use AWS Secrets Manager\n`;
    tips += `- Use IAM roles for EC2/Lambda instead of hardcoded keys\n`;
    tips += `- Rotate credentials immediately if exposed\n`;
    tips += `- Use AWS SDK's credential chain for automatic loading\n`;
  } else if (ruleId.includes('private-key')) {
    tips += `**Private Keys:**\n`;
    tips += `- Never commit private keys to version control\n`;
    tips += `- Store in \`~/.ssh/\` with proper permissions (chmod 600)\n`;
    tips += `- Use SSH agent for key management\n`;
    tips += `- Regenerate key pairs if compromised\n`;
  } else if (ruleId.includes('github')) {
    tips += `**GitHub Tokens:**\n`;
    tips += `- Use GitHub Secrets for Actions workflows\n`;
    tips += `- Store in \`.env\` file (add to .gitignore)\n`;
    tips += `- Use fine-grained tokens with minimal permissions\n`;
    tips += `- Revoke token immediately at github.com/settings/tokens\n`;
  } else if (ruleId.includes('license')) {
    tips += `**License Issues:**\n`;
    tips += `- Review license compatibility with your project\n`;
    tips += `- Consider alternative libraries with permissive licenses\n`;
    tips += `- Consult legal team for GPL/copyleft concerns\n`;
    tips += `- Document all third-party licenses used\n`;
  } else {
    tips += `**General Secret Management:**\n`;
    tips += `- Use environment variables for all secrets\n`;
    tips += `- Add \`.env\` to .gitignore\n`;
    tips += `- Use secret management tools (Vault, AWS Secrets Manager)\n`;
    tips += `- Scan repositories regularly with RepoGuardian\n`;
  }

  tips += `\n---\n\n`;
  tips += `**Next Steps:**\n`;
  tips += `1. Remove the secret from your code\n`;
  tips += `2. Revoke/rotate the credential immediately\n`;
  tips += `3. Use environment variables or secret managers\n`;
  tips += `4. Add .env to .gitignore if not already present\n`;
  tips += `5. Consider using git-filter-repo to remove from history\n`;

  const panel = vscode.window.createWebviewPanel(
    'repoguardianTips',
    'Remediation Tips',
    vscode.ViewColumn.Beside,
    {}
  );

  panel.webview.html = getReportWebviewContent(tips);
}

/**
 * Hover Provider for inline explanations
 */
class RepoGuardianHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Hover | undefined> {
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    
    // Find diagnostic at this position
    const diagnostic = diagnostics.find(d => d.range.contains(position));
    
    if (!diagnostic || !diagnostic.code) {
      return undefined;
    }

    const ruleId = String(diagnostic.code);
    const rules = loadRules();
    const rule = rules.find(r => r.id === ruleId);

    if (!rule) {
      return undefined;
    }

    const severityIcon = rule.severity === 'error' ? '🔴' : rule.severity === 'warning' ? '⚠️' : 'ℹ️';
    
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;
    
    markdown.appendMarkdown(`### ${severityIcon} ${rule.name}\n\n`);
    markdown.appendMarkdown(`**Severity:** ${rule.severity.toUpperCase()}\n\n`);
    markdown.appendMarkdown(`**Description:** ${rule.description}\n\n`);
    markdown.appendMarkdown(`**Why this is dangerous:**\n`);
    
    // Add danger explanations based on rule type
    if (ruleId.includes('aws-access-key') || ruleId.includes('aws-secret-key')) {
      markdown.appendMarkdown(`- Grants access to AWS services and resources\n`);
      markdown.appendMarkdown(`- Can incur massive cloud bills if misused\n`);
      markdown.appendMarkdown(`- Difficult to revoke if widely distributed\n\n`);
    } else if (ruleId.includes('private-key')) {
      markdown.appendMarkdown(`- Can decrypt sensitive data\n`);
      markdown.appendMarkdown(`- Enables impersonation and unauthorized access\n`);
      markdown.appendMarkdown(`- Compromise may go undetected for long periods\n\n`);
    } else if (ruleId.includes('github-token')) {
      markdown.appendMarkdown(`- Grants access to repositories and code\n`);
      markdown.appendMarkdown(`- Can modify or delete critical code\n`);
      markdown.appendMarkdown(`- May expose other secrets in repositories\n\n`);
    } else if (ruleId.includes('license')) {
      markdown.appendMarkdown(`- May impose unwanted legal obligations\n`);
      markdown.appendMarkdown(`- Could require source code disclosure\n`);
      markdown.appendMarkdown(`- Incompatible with commercial use cases\n\n`);
    } else {
      markdown.appendMarkdown(`- Sensitive information exposed in version control\n`);
      markdown.appendMarkdown(`- Can be exploited by unauthorized parties\n`);
      markdown.appendMarkdown(`- Difficult to remove from git history\n\n`);
    }
    
    markdown.appendMarkdown(`**Detected snippet (masked):** \`${diagnostic.message}\`\n\n`);
    markdown.appendMarkdown(`---\n\n`);
    markdown.appendMarkdown(`💡 **Quick Fix:** Use the [Fix Wizard](command:repoguardian.fixIssue) to resolve this issue\n`);

    return new vscode.Hover(markdown, diagnostic.range);
  }
}

/**
 * Code Action Provider for quick fixes
 */
class RepoGuardianCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection
  ): vscode.CodeAction[] {
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    const relevantDiagnostics = diagnostics.filter(d => d.range.intersection(range));

    if (relevantDiagnostics.length === 0) {
      return [];
    }

    const actions: vscode.CodeAction[] = [];

    for (const diagnostic of relevantDiagnostics) {
      // Fix with Wizard action
      const fixAction = new vscode.CodeAction(
        '🔧 Fix with RepoGuardian Wizard',
        vscode.CodeActionKind.QuickFix
      );
      fixAction.command = {
        command: 'repoguardian.fixIssue',
        title: 'Fix with Wizard',
        arguments: [document.uri, diagnostic]
      };
      fixAction.diagnostics = [diagnostic];
      fixAction.isPreferred = true;
      actions.push(fixAction);

      // Add to ignore action
      const ignoreAction = new vscode.CodeAction(
        '🙈 Add to .safecommit-ignore',
        vscode.CodeActionKind.QuickFix
      );
      ignoreAction.command = {
        command: 'repoguardian.addToIgnore',
        title: 'Add to Ignore',
        arguments: [`${document.uri.fsPath}:${diagnostic.range.start.line + 1}`]
      };
      ignoreAction.diagnostics = [diagnostic];
      actions.push(ignoreAction);
    }

    return actions;
  }
}

/**
 * Open Scan Summary Webview
 */
async function openScanSummary() {
  const workspacePath = getWorkspacePath();
  if (!workspacePath) {
    return;
  }

  // Reuse existing panel if available
  if (scanSummaryPanel) {
    scanSummaryPanel.reveal(vscode.ViewColumn.One);
    return;
  }

  scanSummaryPanel = vscode.window.createWebviewPanel(
    'repoguardianSummary',
    'RepoGuardian Scan Summary',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );

  // Load report data
  const report = currentReport || loadLatestReport(workspacePath);

  scanSummaryPanel.webview.html = getScanSummaryWebviewContent(report);

  // Handle messages from webview
  scanSummaryPanel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'rescan':
          await runSecurityScan();
          break;
        case 'fixIssue':
          const { filePath, line } = message;
          const uri = vscode.Uri.file(filePath);
          const diagnostics = vscode.languages.getDiagnostics(uri);
          const diagnostic = diagnostics.find(d => d.range.start.line + 1 === line);
          if (diagnostic) {
            await showFixWizard(uri, diagnostic);
          }
          break;
        case 'addToIgnore':
          await addToIgnoreList(`${message.filePath}:${message.line}`);
          break;
        case 'openFile':
          const fileUri = vscode.Uri.file(message.filePath);
          const doc = await vscode.workspace.openTextDocument(fileUri);
          const editor = await vscode.window.showTextDocument(doc);
          if (message.line) {
            const pos = new vscode.Position(message.line - 1, 0);
            editor.selection = new vscode.Selection(pos, pos);
            editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
          }
          break;
      }
    }
  );

  scanSummaryPanel.onDidDispose(() => {
    scanSummaryPanel = undefined;
  });
}

/**
 * Generate HTML for scan summary webview
 */
function getScanSummaryWebviewContent(report: ScanReport | null): string {
  if (!report) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
          }
          .empty-state {
            text-align: center;
            padding: 60px 20px;
          }
          .empty-state h2 {
            color: var(--vscode-descriptionForeground);
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            cursor: pointer;
            font-size: 14px;
            border-radius: 2px;
            margin-top: 20px;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>
      <body>
        <div class="empty-state">
          <h2>🔍 No Scan Results Available</h2>
          <p>Run a security scan to see results here.</p>
          <button onclick="rescan()">Scan Workspace Now</button>
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          function rescan() {
            vscode.postMessage({ command: 'rescan' });
          }
        </script>
      </body>
      </html>
    `;
  }

  const errors = report.detections.filter(d => d.severity === 'error').length;
  const warnings = report.detections.filter(d => d.severity === 'warning').length;
  const infos = report.detections.filter(d => d.severity === 'info').length;
  
  const statusIcon = report.detections.length === 0 ? '✅' : '⚠️';
  const statusText = report.detections.length === 0 ? 'Clean' : `${report.detections.length} Issues Found`;
  const statusClass = report.detections.length === 0 ? 'clean' : errors > 0 ? 'error' : 'warning';

  const findingsHtml = report.detections.map((d, index) => {
    const severityIcon = d.severity === 'error' ? '🔴' : d.severity === 'warning' ? '⚠️' : 'ℹ️';
    const fileName = path.basename(d.filePath);
    return `
      <tr class="finding-row">
        <td>${severityIcon}</td>
        <td><a href="#" onclick="openFile('${d.filePath.replace(/\\/g, '\\\\')}', ${d.line})">${fileName}:${d.line}</a></td>
        <td>${d.ruleName}</td>
        <td><code>${d.snippet}</code></td>
        <td class="actions">
          <button onclick="fixIssue('${d.filePath.replace(/\\/g, '\\\\')}', ${d.line})" title="Fix with Wizard">🔧</button>
          <button onclick="addToIgnore('${d.filePath.replace(/\\/g, '\\\\')}', ${d.line})" title="Add to Ignore">🙈</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          margin: 0;
        }
        .header {
          margin-bottom: 30px;
          border-bottom: 1px solid var(--vscode-panel-border);
          padding-bottom: 20px;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 24px;
        }
        .status {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 4px;
          font-weight: bold;
          margin: 10px 0;
        }
        .status.clean {
          background-color: rgba(0, 128, 0, 0.2);
          color: #4caf50;
        }
        .status.warning {
          background-color: rgba(255, 165, 0, 0.2);
          color: #ff9800;
        }
        .status.error {
          background-color: rgba(255, 0, 0, 0.2);
          color: #f44336;
        }
        .summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin: 20px 0;
        }
        .summary-card {
          background-color: var(--vscode-editor-inactiveSelectionBackground);
          padding: 20px;
          border-radius: 4px;
          border: 1px solid var(--vscode-panel-border);
        }
        .summary-card h3 {
          margin: 0 0 10px 0;
          font-size: 14px;
          color: var(--vscode-descriptionForeground);
          text-transform: uppercase;
        }
        .summary-card .value {
          font-size: 32px;
          font-weight: bold;
        }
        .actions-bar {
          margin: 20px 0;
        }
        button {
          background-color: var(--vscode-button-background);
          color: var(--vscode-button-foreground);
          border: none;
          padding: 10px 20px;
          cursor: pointer;
          font-size: 14px;
          border-radius: 2px;
          margin-right: 10px;
        }
        button:hover {
          background-color: var(--vscode-button-hoverBackground);
        }
        button.secondary {
          background-color: var(--vscode-button-secondaryBackground);
          color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover {
          background-color: var(--vscode-button-secondaryHoverBackground);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th {
          text-align: left;
          padding: 12px;
          background-color: var(--vscode-editor-inactiveSelectionBackground);
          border-bottom: 2px solid var(--vscode-panel-border);
          font-weight: bold;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        tr:hover {
          background-color: var(--vscode-list-hoverBackground);
        }
        code {
          background-color: var(--vscode-textCodeBlock-background);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: var(--vscode-editor-font-family);
          font-size: 12px;
        }
        a {
          color: var(--vscode-textLink-foreground);
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        .actions button {
          padding: 5px 10px;
          font-size: 16px;
          margin-right: 5px;
        }
        .timestamp {
          color: var(--vscode-descriptionForeground);
          font-size: 12px;
        }
        .empty-findings {
          text-align: center;
          padding: 40px;
          color: var(--vscode-descriptionForeground);
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🛡️ RepoGuardian Scan Summary</h1>
        <div class="status ${statusClass}">${statusIcon} ${statusText}</div>
        <div class="timestamp">Scanned at: ${new Date(report.timestamp).toLocaleString()}</div>
      </div>

      <div class="summary">
        <div class="summary-card">
          <h3>Files Scanned</h3>
          <div class="value">${report.filesScanned}</div>
        </div>
        <div class="summary-card">
          <h3>Total Issues</h3>
          <div class="value">${report.detections.length}</div>
        </div>
        <div class="summary-card">
          <h3>Errors</h3>
          <div class="value" style="color: #f44336;">${errors}</div>
        </div>
        <div class="summary-card">
          <h3>Warnings</h3>
          <div class="value" style="color: #ff9800;">${warnings}</div>
        </div>
        <div class="summary-card">
          <h3>Info</h3>
          <div class="value" style="color: #2196f3;">${infos}</div>
        </div>
      </div>

      <div class="actions-bar">
        <button onclick="rescan()">🔄 Rescan Workspace</button>
      </div>

      ${report.detections.length > 0 ? `
        <h2>Findings</h2>
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Location</th>
              <th>Rule</th>
              <th>Masked Snippet</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${findingsHtml}
          </tbody>
        </table>
      ` : `
        <div class="empty-findings">
          <h2>✨ No Issues Found</h2>
          <p>Your workspace is clean! All scanned files passed security checks.</p>
        </div>
      `}

      <script>
        const vscode = acquireVsCodeApi();
        
        function rescan() {
          vscode.postMessage({ command: 'rescan' });
        }
        
        function fixIssue(filePath, line) {
          vscode.postMessage({ command: 'fixIssue', filePath, line });
        }
        
        function addToIgnore(filePath, line) {
          vscode.postMessage({ command: 'addToIgnore', filePath, line });
        }
        
        function openFile(filePath, line) {
          vscode.postMessage({ command: 'openFile', filePath, line });
        }
      </script>
    </body>
    </html>
  `;
}

/**
 * Helper function to generate simple report webview content
 */
function getReportWebviewContent(markdownContent: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: var(--vscode-font-family);
          padding: 20px;
          color: var(--vscode-foreground);
          background-color: var(--vscode-editor-background);
          line-height: 1.6;
        }
        h3 { color: var(--vscode-textLink-foreground); }
        code {
          background-color: var(--vscode-textCodeBlock-background);
          padding: 2px 6px;
          border-radius: 3px;
        }
        ul { padding-left: 20px; }
      </style>
    </head>
    <body>
      ${markdownContent.replace(/\n/g, '<br>')}
    </body>
    </html>
  `;
}
