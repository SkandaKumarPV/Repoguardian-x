# Testing the New UX Features

This guide will help you manually test all four new UX features.

## Prerequisites
1. Open this workspace in VS Code
2. The RepoGuardian extension should be active (check status bar)
3. Create a test file with some secrets to trigger detections

## Test File

Create a file called `test-secrets.js` with the following content:

```javascript
// AWS credentials
const awsKey = "AKIAIOSFODNN7EXAMPLE";
const awsSecret = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";

// GitHub token
const githubToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";

// API key
const apiKey = "sk_test_4eC39HqLyjWDarjtT1zdp7dc";
```

## Test Steps

### 1. Test Status Bar Security Indicator

1. After saving the test file, click "RepoGuardian: Scan Workspace" from the command palette (Ctrl+Shift+P)
2. **Expected**: Status bar should show "⚠️ RepoGuardian: X issues" (where X is the number of secrets found)
3. **Test**: Click the status bar item
4. **Expected**: Scan Summary webview should open

### 2. Test Inline Hover Explanations

1. Open the `test-secrets.js` file
2. You should see red squiggly lines under the secret values
3. **Test**: Hover your mouse over `AKIAIOSFODNN7EXAMPLE`
4. **Expected**: A hover tooltip appears showing:
   - Rule name (e.g., "AWS Access Key")
   - Severity level
   - Description of why it's dangerous
   - Masked snippet
   - Link to "Fix Wizard"

### 3. Test Secret Fix Wizard

#### Option A: Via Quick Fix Menu
1. Place cursor on a secret (red squiggle)
2. Press `Ctrl+.` or click the lightbulb icon
3. **Expected**: Menu shows "🔧 Fix with RepoGuardian Wizard"
4. Click it
5. **Expected**: QuickPick menu appears with 4 options:
   - Move to .env file
   - Add to .safecommit-ignore
   - View masked report
   - View remediation tips

#### Option B: Via Hover Link
1. Hover over a secret
2. Click the "Fix Wizard" link in the hover tooltip
3. **Expected**: Same QuickPick menu appears

#### Test Each Option:

**Move to .env:**
1. Select "Move to .env file"
2. Enter a variable name like `AWS_ACCESS_KEY_ID`
3. **Expected**: 
   - `.env` file is created/updated with the actual secret
   - `.env.example` is created/updated with placeholder
   - Notification suggests replacing the inline value with `process.env.AWS_ACCESS_KEY_ID`

**Add to ignore:**
1. Select "Add to .safecommit-ignore"
2. **Expected**: 
   - `.safecommit-ignore` is created/updated
   - Entry added as `test-secrets.js:2` (or appropriate line)
   - Notification confirms addition

**View masked report:**
1. Select "View masked report"
2. **Expected**: Webview opens showing detailed detection info with masked snippet

**View remediation tips:**
1. Select "View remediation tips"
2. **Expected**: Webview opens with rule-specific guidance on how to fix this type of secret

### 4. Test Scan Summary Webview

#### Opening the Webview:
- **Method 1**: Click status bar item
- **Method 2**: Command Palette → "RepoGuardian: Open Scan Summary"
- **Method 3**: Click "View Summary" in notification after scan

#### Verify Content:
1. **Header**: Shows status badge ("Clean" or "X Issues Found")
2. **Summary Cards**: Grid showing:
   - Files Scanned
   - Total Issues
   - Errors (count)
   - Warnings (count)
   - Info (count)
3. **Findings Table**: Lists all detections with:
   - Severity icon
   - File:line (clickable)
   - Rule name
   - Masked snippet
   - Action buttons (🔧 Fix, 🙈 Ignore)

#### Test Interactions:

**Test file links:**
1. Click a file name in the findings table
2. **Expected**: File opens at the correct line with the detection highlighted

**Test Fix button:**
1. Click the 🔧 button on any finding
2. **Expected**: Fix Wizard opens for that specific issue

**Test Ignore button:**
1. Click the 🙈 button on any finding
2. **Expected**: File:line is added to `.safecommit-ignore`
3. **Expected**: Notification confirms addition

**Test Rescan button:**
1. Fix one of the issues in your test file
2. Click the "🔄 Rescan Workspace" button in the webview
3. **Expected**: New scan runs
4. **Expected**: Webview updates automatically with new results
5. **Expected**: Status bar updates with new count

### 5. Test Clean State

1. Add all issues to `.safecommit-ignore` or remove all secrets from test file
2. Run scan again
3. **Expected**: 
   - Status bar shows "🛡️ RepoGuardian: Clean" in green
   - Scan Summary webview shows "✨ No Issues Found" message
   - No findings table (replaced with success message)

## Troubleshooting

**If status bar doesn't appear:**
- Check settings: `repoguardian.showStatusBar` should be `true`
- Restart VS Code

**If hover tooltips don't appear:**
- Make sure you've run a scan first
- Hover directly over the red squiggle
- Wait a moment for the tooltip to appear

**If webview is blank:**
- Check Developer Tools (Help → Toggle Developer Tools)
- Look for console errors
- Try closing and reopening the webview

**If fixes don't work:**
- Check file permissions
- Verify workspace folder is writable
- Check `.safecommit-ignore` and `.env` files are not read-only

## Success Criteria

All features are working correctly if:
- ✅ Status bar shows real-time issue count and is clickable
- ✅ Hover tooltips provide detailed explanations with "Fix Wizard" link
- ✅ Fix Wizard opens from quick fix menu and hover link
- ✅ All 4 Fix Wizard options work correctly
- ✅ Scan Summary webview displays comprehensive report
- ✅ All webview buttons and links function properly
- ✅ Rescan updates all UI elements automatically
- ✅ Clean state displays appropriate messages

## Notes

- All features work **100% offline** with no external API calls
- `.env` files are automatically added to `.gitignore`
- `.safecommit-ignore` uses relative paths for portability
- Webview persists state when hidden
- Status bar updates in real-time during scans
- Multiple Fix Wizard sessions can be open simultaneously

## Demo Workflow

For a complete demonstration:

1. Create test file with secrets
2. Run scan (watch status bar animate)
3. Hover over secret (see detailed explanation)
4. Click status bar (open Scan Summary)
5. Review findings in table
6. Click file name (jump to location)
7. Press Ctrl+. (open quick fix menu)
8. Select Fix Wizard (see 4 options)
9. Choose "Move to .env" (see files created)
10. Click Rescan (watch updates)
11. Verify clean state

This demonstrates all four features in a natural workflow! 🎉
