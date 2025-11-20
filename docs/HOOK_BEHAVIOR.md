# Pre-Push Hook Behavior

## Overview

The RepoGuardian pre-push hook provides **automated security scanning** before code reaches your remote repository. It runs silently in the background, scanning staged files and blocking pushes if security issues are detected.

## Installation

### Via VS Code Extension
1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run: `RepoGuardian: Install Pre-Push Hook`
3. Confirmation message appears

### Manual Installation

**Unix/Linux/Mac**:
```bash
cp src/hook/pre-push.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
```

**Windows**:
```powershell
Copy-Item src\hook\pre-push.cmd .git\hooks\pre-push
```

## Hook Workflow

```
Developer executes: git push
         │
         ▼
┌─────────────────────────────────────────┐
│   Git invokes pre-push hook             │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   Hook locates RepoGuardian CLI         │
│   • Check node_modules/.bin/            │
│   • Check global installation           │
│   • Check dist/cli.js                   │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   Execute: repoguardian --scan-staged   │
│   • Get staged files from git           │
│   • Scan each file with detection rules │
│   • Apply masking to findings           │
└────────────┬────────────────────────────┘
             │
             ▼
        Exit Code?
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
  Code 0           Code 1
  (Clean)         (Findings)
    │                 │
    ▼                 ▼
┌─────────┐      ┌──────────────────────┐
│ Allow   │      │ Block push           │
│ Push    │      │ Show detailed report │
└─────────┘      └──────────────────────┘
```

## Hook Behavior

### Success Scenario (Exit Code 0)

**Terminal Output**:
```
🔒 RepoGuardian: Scanning staged files for security issues...
Scanning 3 staged file(s)...
✅ Security scan passed - push allowed
```

**Action**: Push proceeds normally

---

### Blocked Scenario (Exit Code 1)

**Terminal Output**:
```
🔒 RepoGuardian: Scanning staged files for security issues...
Scanning 3 staged file(s)...

═══════════════════════════════════════════════════════
           RepoGuardian Security Scan Results          
═══════════════════════════════════════════════════════

Timestamp:       2025-11-20T10:30:00.000Z
Files Scanned:   3
Detections:      2

❌ ERRORS (2):
  src/config.ts:15
    [aws-access-key] AWS Access Key ID
    const key = "AKIA********MPLE";

  src/utils/db.ts:42
    [private-key-pem] Private Key PEM
    -----BEGIN PRIVATE KEY-----

════════════════════════════════════════════════════════════
⚠️  PUSH BLOCKED - Security issues detected
════════════════════════════════════════════════════════════

Action required:
  1. Check the VS Code Problems panel for details
  2. Fix or remove the detected secrets
  3. Add false positives to .safecommit-ignore
  4. Commit changes and try pushing again

To bypass this check (NOT recommended):
  git push --no-verify

```

**Action**: Push is aborted

---

### Error Scenario (Exit Code 2)

**Terminal Output**:
```
🔒 RepoGuardian: Scanning staged files for security issues...
❌ Error: RepoGuardian CLI not found
Please run: npm install
```

**Action**: Push is aborted

## Platform-Specific Implementations

### Unix/Linux/Mac (pre-push.sh)
- Written in Bash
- Uses `#!/bin/bash` shebang
- Requires execute permission (`chmod +x`)
- Locates Node.js and CLI tool
- Handles exit codes with `$?`

### Windows (pre-push.cmd)
- Written in Batch script
- Uses `@echo off` for clean output
- Handles exit codes with `%ERRORLEVEL%`
- Looks for `.cmd` wrapper first

## Scanned File Detection

The hook uses Git to identify staged files:

```bash
git diff --cached --name-only --diff-filter=ACM
```

**Flags**:
- `--cached`: Staged files only
- `--name-only`: File paths only
- `--diff-filter=ACM`: Added, Copied, Modified (excludes Deleted)

## Bypassing the Hook

### Temporary Bypass (Single Push)
```bash
git push --no-verify
```
**Use Case**: Emergency deployments, false positives

⚠️ **Warning**: This skips security checks entirely

### Permanent Disable
```bash
rm .git/hooks/pre-push
```
**Use Case**: Testing, development environments

⚠️ **Not Recommended**: Defeats the purpose of security scanning

## Integration with VS Code

When the hook blocks a push:

1. **Terminal Message**: Clear instructions displayed
2. **Problems Panel**: Detections shown with file locations
3. **Status Bar**: Shows warning indicator
4. **Quick Fixes**: Available for each detection

**Developer Workflow**:
```
Push attempt
  → Hook blocks
  → Check VS Code Problems panel
  → Fix issues or add to ignore list
  → Commit fixes
  → Push again
```

## Handling False Positives

### Add to Ignore List

Create/edit `.safecommit-ignore`:
```
# Ignore test files
test/fixtures/fake-credentials.json

# Ignore specific line
src/docs/examples.ts:42

# Ignore entire directory
vendor/third-party/
```

### Use Quick Fix in VS Code

1. Click on detection in Problems panel
2. Click lightbulb icon
3. Select "Add to .safecommit-ignore"
4. Commit `.safecommit-ignore` changes
5. Push again

## Performance

### Typical Scan Times

| Staged Files | Scan Time |
|--------------|-----------|
| 1-10 files   | < 1 second |
| 10-50 files  | 1-2 seconds |
| 50-100 files | 2-5 seconds |
| 100+ files   | 5-10 seconds |

**Factors**:
- File sizes
- Number of detection rules
- System performance

### Optimization Tips

1. **Stage incrementally**: Push smaller changesets
2. **Use .safecommit-ignore**: Skip known-safe files
3. **Pre-scan before staging**: Run `repoguardian` before committing

## Troubleshooting

### "RepoGuardian CLI not found"
**Cause**: CLI not built or installed
**Solution**:
```bash
npm install
npm run build
```

### "Failed to get staged files"
**Cause**: Not in a git repository
**Solution**: Ensure you're in the root of a git repository

### Hook doesn't run
**Cause**: Hook not executable (Unix) or missing
**Solution**:
```bash
# Unix/Linux/Mac
chmod +x .git/hooks/pre-push

# Verify
ls -l .git/hooks/pre-push
```

### Hook runs but doesn't block
**Cause**: Exit code not being honored
**Solution**: Check hook script has `exit $EXIT_CODE` or `exit /b %ERRORLEVEL%`

### Different behavior on Windows vs Unix
**Cause**: Different script versions installed
**Solution**: Re-install hook using VS Code extension or copy correct platform script

## Security Considerations

### What the Hook Protects Against

✅ **Prevents**:
- Accidentally pushing AWS keys
- Committing GitHub tokens
- Exposing database passwords
- Sharing API credentials
- Pushing private keys

✅ **Does NOT Prevent**:
- Secrets in commit history (already pushed)
- Secrets in untracked files
- Secrets in binary files
- Secrets not matching detection patterns

### Best Practices

1. **Install hook immediately**: After cloning repository
2. **Never bypass without review**: Use `--no-verify` sparingly
3. **Educate team**: Ensure all contributors understand hook behavior
4. **Monitor ignore list**: Review `.safecommit-ignore` regularly
5. **Test hook**: Make intentional violation to verify it blocks

## Hook Lifecycle

### When Hook Runs
- ✅ Before `git push` completes
- ✅ After commit is created
- ✅ Only on files being pushed
- ❌ Not on `git commit`
- ❌ Not on `git pull`

### When Hook Doesn't Run
- First push to new remote (no remote tracking branch yet)
- Force push with `--no-verify`
- Pushing tags only (`git push --tags`)
- Using `--force` flag (still runs, but may be ignored by developers)

## Advanced Configuration

### Custom CLI Path

Edit hook script to specify custom CLI location:

**Bash**:
```bash
CLI_PATH="/custom/path/to/repoguardian"
```

**Batch**:
```batch
set CLI_PATH=C:\custom\path\to\repoguardian.cmd
```

### Custom Error Messages

Edit hook script to customize output messages in the `echo` statements.

### Integration with Other Hooks

Combine with other pre-push checks:

```bash
#!/bin/bash

# Run tests
npm test || exit 1

# Run linter
npm run lint || exit 1

# Run security scan
repoguardian --scan-staged || exit 1

# All checks passed
exit 0
```

## Comparison with Other Solutions

| Feature | RepoGuardian Hook | git-secrets | pre-commit |
|---------|------------------|-------------|------------|
| Offline | ✅ Yes | ✅ Yes | ✅ Yes |
| VS Code Integration | ✅ Yes | ❌ No | ❌ No |
| Masked Output | ✅ Yes | ❌ No | ⚠️ Varies |
| Pre-push | ✅ Yes | ✅ Yes | ⚠️ Pre-commit |
| Staged-only scan | ✅ Yes | ❌ All files | ⚠️ Varies |

## See Also

- [CLI Usage Guide](CLI_USAGE.md) - CLI command reference
- [Scan Workflow](SCAN_WORKFLOW.md) - How scanning works
- [Extension Behavior](EXTENSION_BEHAVIOR.md) - VS Code extension features
