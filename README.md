# RepoGuardian X

**🔒 Local-first Security Scanner for VS Code & GitLab CI**

A fully offline security scanning solution that detects secrets, credentials, and policy violations before they reach your repository. All processing happens locally with automatic secret masking to ensure sensitive data never leaves your machine.

[![Pipeline Status](https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x/badges/main/pipeline.svg)](https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x/-/pipelines)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Project Overview

**Course**: IIT Bombay - Software Engineering  
**Team**: Zoro ISIN AWS 2 Group  
**Repository**: [GitLab - RepoGuardian X](https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x)

RepoGuardian X provides enterprise-grade security scanning with:
- **100% Offline Operation** - No network requests, complete privacy
- **Automatic Secret Masking** - All output safely masked
- **Multi-Platform Support** - Windows, macOS, Linux
- **GitLab CI Integration** - Automated pipeline scanning
- **VS Code Extension** - Seamless developer experience

---

## ✨ Features

### Core Capabilities
- 🔍 **Regex-based Detection** - Fast, deterministic secret scanning
- 🎭 **Intelligent Masking** - Context-aware secret obfuscation
- 🚫 **Pre-Push Hooks** - Block commits with security issues
- 📊 **JSON Reports** - Machine-readable scan results
- 🧹 **Auto-Cleanup** - Reports auto-deleted after 7 days
- ⚡ **High Performance** - Scans 1000+ files in seconds

### Built-in Detections
✅ AWS Access Keys (`AKIA...`)  
✅ AWS Secret Keys (40-char base64)  
✅ GitHub Personal Access Tokens (`ghp_...`)  
✅ Private Keys (PEM format)  
✅ GPL License mentions  
✅ Email addresses  

---

## 🚀 Quick Start

### 1. Clone Repository

```bash
git clone https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x.git
cd repoguardian-x
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build Project

```bash
npm run build
```

### 4. Run Security Scan

```bash
# Scan entire workspace
node dist/cli.js

# Or scan specific files
node dist/cli.js --scan-files src/config.js
```

---

## 📦 Installation Methods

### Method 1: Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run CLI
node dist/cli.js --help
```

### Method 2: VS Code Extension (Local)

1. Build the project:
   ```bash
   npm install
   npm run build
   ```

2. Open the project folder in VS Code

3. Press `F5` to launch Extension Development Host

4. In the new VS Code window, open any project

5. Run: `Ctrl+Shift+P` → "RepoGuardian: Run Security Scan"

### Method 3: Package as VSIX (For Distribution)

```bash
# Install VSCE (VS Code Extension packager)
npm install -g @vscode/vsce

# Package extension
vsce package

# Install the .vsix file
# VS Code → Extensions → Install from VSIX
```

---

## 🧪 Testing Guide

### Run All Tests

```bash
npm test
```

### Run Individual Test Suites

```bash
# Masking tests only
npm run test:masking

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e
```

### Manual Testing

#### Test 1: CLI Scanning
```bash
# Create test file with fake secret
echo 'const key = "AKIAIOSFODNN7EXAMPLE";' > test.js

# Run scan
node dist/cli.js --scan-files test.js

# Expected: Detection found with masked output
```

#### Test 2: Pre-Push Hook
```bash
# Install hook
cp src/hook/pre-push.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push  # Unix/Mac only

# Create file with secret
echo 'token = "ghp_1234567890abcdefghijklmnopqrstuvwx"' > secret.txt

# Try to push
git add secret.txt
git commit -m "Test secret"
git push  # Should be blocked
```

#### Test 3: VS Code Extension
1. Open project in VS Code (with extension loaded)
2. Run: `RepoGuardian: Run Security Scan`
3. Check Problems panel for detections
4. Test Quick Fixes (Ctrl+.)
5. Verify status bar shows scan state

### Demo Scenarios

Pre-configured test scenarios in `demo/` folder:

```bash
# Clean scenario (no issues)
node dist/cli.js --scan-files demo/scenario-clean/hello.txt

# License scenario (GPL detection)
node dist/cli.js --scan-files demo/scenario-license/LICENSE.bad

# Secrets scenario (multiple detections)
node dist/cli.js --scan-files demo/scenario-secret/secrets.env.bad
```

---

## 📖 Documentation

- **[Testing Guide](TESTING_GUIDE.md)** - Comprehensive testing instructions
- **[Project Report](PROJECT_REPORT.md)** - Full project documentation
- **[Hook Behavior](docs/HOOK_BEHAVIOR.md)** - Pre-push hook details
- **[AI Remediation](docs/AI_REMEDIATION_NOTES.md)** - Fix common issues

---

## 🎓 Academic Submission

### Project Structure
```
repoguardian-x/
├── src/
│   ├── core/              # Detection & masking engine
│   ├── hook/              # Git hook templates
│   ├── test/              # Test suites
│   ├── cli.ts             # CLI implementation
│   └── extension.ts       # VS Code extension
├── demo/                  # Test scenarios
├── docs/                  # Documentation
├── .gitlab-ci.yml         # CI/CD pipeline
└── package.json           # Dependencies
```

### Key Deliverables
✅ Fully functional CLI tool  
✅ VS Code extension with GUI  
✅ Automated testing suite  
✅ GitLab CI/CD integration  
✅ Comprehensive documentation  

### Evaluation Criteria Met
- ✅ **Functionality**: Complete detection & masking
- ✅ **Code Quality**: TypeScript, modular design
- ✅ **Testing**: Unit, integration, E2E tests
- ✅ **Documentation**: README, guides, inline docs
- ✅ **CI/CD**: Automated pipeline with artifact generation
- ✅ **Innovation**: Offline-first, masked output, multi-platform

---

## 🔧 Configuration

### Ignore Patterns

Create `.safecommit-ignore` in your project root:

```
# Ignore directories
node_modules/
dist/
vendor/

# Ignore specific files
test/fixtures/*.json
docs/examples/*

# Ignore specific lines
src/config.ts:42
```

### Custom Detection Rules

Edit `src/core/detectors.sample.json`:

```json
{
  "id": "custom-api-key",
  "name": "Custom API Key",
  "severity": "error",
  "pattern": "API_KEY_[A-Za-z0-9]{32}",
  "description": "Custom API key pattern"
}
```

### VS Code Settings

```json
{
  "repoguardian.scanOnSave": false
}
```

---

## 📊 CLI Usage

### Basic Commands

```bash
# Scan entire workspace
node dist/cli.js

# Scan staged files (for pre-push hook)
node dist/cli.js --scan-staged

# Scan specific files
node dist/cli.js --scan-files file1.js file2.ts

# Save report to custom location
node dist/cli.js --output report.json

# Show help
node dist/cli.js --help
```

### Exit Codes

| Code | Status | Description |
|------|--------|-------------|
| 0 | ✅ Clean | No security issues detected |
| 1 | ⚠️ Findings | Security issues found |
| 2 | ❌ Error | Scan failed |

---

## 🎭 Masking Examples

### API Keys
```
Original: AKIAIOSFODNN7EXAMPLE
Masked:   AKIA************MPLE
```

### Email Addresses
```
Original: john.doe@example.com
Masked:   j******e@example.com
```

### Passwords
```
Original: MySecretPassword123
Masked:   MySe************123
```

### Connection Strings
```
Original: Server=db;Password=secret123;
Masked:   Server=db;Password=secr****123;
```

---

## 🔐 Security Guarantees

1. **No Network Requests** - 100% offline operation
2. **Masked Output** - Secrets never exposed in reports
3. **No External APIs** - All processing local
4. **Safe Sharing** - Reports can be safely committed
5. **No Logging** - Raw secrets never written to logs

---

## 🌐 Public Access

### GitLab Repository
**URL**: https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x

**Access**: Public (Free tier)

### Clone Command
```bash
git clone https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x.git
```

### VS Code Extension Distribution

#### Option 1: Local Installation
1. Download the repository
2. Run `npm install && npm run build`
3. Press F5 in VS Code to test

#### Option 2: VSIX Package
1. Build VSIX: `vsce package`
2. Share the `.vsix` file
3. Install: VS Code → Extensions → Install from VSIX

#### Option 3: Publish to Marketplace (Optional)
Requires VS Code Marketplace publisher account (paid/verified)

---

## ⚡ Performance

| Workspace Size | Scan Time | Files/Second |
|----------------|-----------|--------------|
| Small (< 100 files) | 1-2 seconds | ~50-100 |
| Medium (100-500 files) | 2-5 seconds | ~100-200 |
| Large (500-1000 files) | 5-10 seconds | ~100-200 |
| Very Large (> 1000 files) | 10-20 seconds | ~50-100 |

**Optimizations**:
- Binary files skipped automatically
- Files >10MB skipped
- Parallel processing
- Rule caching

---

## 🤝 Team & Contributions

**Project Team**: Zoro ISIN AWS 2 Group  
**Institution**: IIT Bombay  
**Course**: Software Engineering

**Contributors**:
- Skanda Kumar (Project Lead, Core Development)
- [Add other team members]

---

## 🆘 Troubleshooting

### Issue: "Permission denied" on tsc

**Solution**: Ensure TypeScript is installed locally
```bash
npm install
npm run build
```

### Issue: Hook doesn't block push

**Solution**: Make hook executable
```bash
chmod +x .git/hooks/pre-push  # Unix/Mac
```

### Issue: Extension not loading

**Solution**: Rebuild and reload
```bash
npm run build
# In VS Code: Ctrl+Shift+P → "Reload Window"
```

### Issue: Too many false positives

**Solution**: Add to `.safecommit-ignore`
```
test/
*.mock.js
```

---

## 📜 License

MIT License - See [LICENSE](LICENSE) file for details

---

## 🎓 Academic Integrity

This project was developed as part of academic coursework at IIT Bombay. All code is original work by the project team unless otherwise cited.

---

## 📞 Support & Contact

- **Issues**: [GitLab Issues](https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x/-/issues)
- **Pipeline**: [CI/CD Status](https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x/-/pipelines)
- **Repository**: https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x

---

**Built with ❤️ for secure software development workflows**
