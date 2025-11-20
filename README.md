# RepoGuardian X

**Local-first VS Code security extension with automated pre-push scanning**

RepoGuardian X is a fully offline security scanner that detects secrets, credentials, and policy violations before they reach your repository. All scanning happens locally with masked output to ensure secrets never leave your machine.

## ✨ Features

- 🔒 **100% Offline** - No network requests, all processing local
- 🎭 **Automatic Masking** - Secrets masked in all output
- 🚫 **Pre-Push Hook** - Block pushes with security issues
- 🔍 **VS Code Integration** - Problems panel, Quick Fixes, status bar
- ⚡ **Fast Scanning** - Line-by-line regex detection
- 📊 **JSON Reports** - Saved to `.repo-guardian/reports/`
- 🧹 **Auto-Cleanup** - Reports auto-deleted after 7 days

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Install pre-push hook (optional)
cp src/hook/pre-push.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push  # Unix/Mac only
```

### First Scan

```bash
# Scan entire workspace
node dist/cli.js

# Or scan staged files
node dist/cli.js --scan-staged
```

### VS Code Usage

1. Open workspace in VS Code
2. Run: `RepoGuardian: Run Security Scan` (Command Palette)
3. View detections in Problems panel
4. Install hook: `RepoGuardian: Install Pre-Push Hook`

## 📖 Documentation

- **[Scan Workflow](docs/SCAN_WORKFLOW.md)** - How scanning works internally
- **[CLI Usage Guide](docs/CLI_USAGE.md)** - Command-line interface reference
- **[Hook Behavior](docs/HOOK_BEHAVIOR.md)** - Pre-push hook details
- **[Extension Behavior](docs/EXTENSION_BEHAVIOR.md)** - VS Code features
- **[Detection Rules Guide](docs/DETECTION_RULES_GUIDE.md)** - Customize detection rules

## 🎯 Use Cases

### Developer Workflow
```bash
# 1. Write code
vim src/config.ts

# 2. Run security scan
node dist/cli.js

# 3. Fix issues or add to ignore list
echo "src/test-fixtures/*" >> .safecommit-ignore

# 4. Commit and push (hook runs automatically)
git add .
git commit -m "Add new feature"
git push  # Hook scans staged files
```

### CI/CD Integration
```yaml
# .github/workflows/security.yml
- name: Security Scan
  run: |
    npm install
    npm run build
    node dist/cli.js
```

## 🔍 Detection Rules

Built-in detection for:
- ✅ AWS Access Keys (`AKIA...`)
- ✅ AWS Secret Keys (40-char base64)
- ✅ GitHub Tokens (`ghp_...`)
- ✅ Private Keys (PEM format)
- ✅ GPL License mentions
- ✅ Email addresses

**Customize**: Edit `src/core/detectors.sample.json`

## 🎭 Masking Examples

**API Keys**:
```
Original: AKIAIOSFODNN7EXAMPLE
Masked:   AKIA********MPLE
```

**Emails**:
```
Original: john.doe@example.com
Masked:   j******e@example.com
```

**Passwords**:
```
Original: MySecretPassword123
Masked:   MySe************123
```

## 📊 CLI Commands

```bash
# Scan entire workspace
node dist/cli.js

# Scan staged files (pre-push hook)
node dist/cli.js --scan-staged

# Scan specific files
node dist/cli.js --scan-files src/file1.js src/file2.ts

# Save report to custom location
node dist/cli.js --output report.json

# Show help
node dist/cli.js --help
```

**Exit Codes**:
- `0` - Clean (no issues)
- `1` - Issues found
- `2` - Error occurred

## 🛠️ Configuration

### Ignore Patterns

Create `.safecommit-ignore`:
```
# Ignore directories
node_modules/
vendor/

# Ignore specific files
test/fixtures/*.json

# Ignore specific lines
src/config.ts:42
```

### VS Code Settings

```json
{
  "repoguardian.scanOnSave": false  // Enable auto-scan on save
}
```

## 🧪 Testing

```bash
# Run masking tests
npm test

# Or directly
node dist/test/masking.test.js

# Run integration tests
node dist/test/integration.test.js
```

## 📦 Project Structure

```
repoguardian-x/
├── src/
│   ├── core/                    # Core detection engine
│   │   ├── detector.ts          # Rule loading & scanning
│   │   ├── scanner.ts           # File walker & orchestration
│   │   ├── masking.ts           # Secret masking logic
│   │   ├── reports.ts           # Report storage & cleanup
│   │   ├── detectors.sample.json # Detection rules
│   │   └── detectors.schema.json # Rule schema
│   ├── hook/                    # Git hook templates
│   │   ├── pre-push.sh          # Unix/Mac hook
│   │   └── pre-push.cmd         # Windows hook
│   ├── test/                    # Test files
│   │   ├── masking.test.ts      # Masking tests
│   │   └── integration.test.ts  # E2E tests
│   ├── cli.ts                   # CLI entry point
│   └── extension.ts             # VS Code extension
├── docs/                        # Documentation
├── demo/                        # Demo scenarios
└── package.json
```

## 🔐 Security Guarantees

1. **No Network Requests** - Everything runs locally
2. **Masked Output** - Secrets never exposed in reports
3. **No Logging** - Raw secrets never written to logs
4. **Offline Operation** - No internet required
5. **Safe Sharing** - Reports can be safely committed

## ⚡ Performance

| Workspace Size | Scan Time |
|----------------|-----------|
| Small (< 100 files) | 1-2 seconds |
| Medium (100-500 files) | 2-5 seconds |
| Large (500-1000 files) | 5-10 seconds |

**Optimizations**:
- Binary files skipped automatically
- Files >10MB skipped
- Rule caching
- Parallel file processing

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Add tests for new features
4. Ensure all tests pass
5. Submit pull request

## 📄 License

See [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### "Cannot find module 'fs'"
**Solution**: Run `npm install` to install Node.js types

### "RepoGuardian CLI not found" (in hook)
**Solution**: Run `npm run build` to compile TypeScript

### Hook doesn't block push
**Solution**: Ensure hook is executable: `chmod +x .git/hooks/pre-push`

### Too many false positives
**Solution**: Add patterns to `.safecommit-ignore`

## 📚 Additional Resources

- [AI Remediation Notes](docs/AI_REMEDIATION_NOTES.md) - Fix common issues
- [Demo Scenarios](demo/) - Example use cases
- [Security Policy](SECURITY.md) - Report vulnerabilities

## 🎓 Learn More

- **Scan Workflow**: Understand the detection pipeline
- **CLI Usage**: Master command-line options
- **Hook Behavior**: Deep dive into pre-push hooks
- **Extension Features**: Leverage VS Code integration
- **Rule Customization**: Create custom detection rules

---

**Built with ❤️ for secure development workflows**
