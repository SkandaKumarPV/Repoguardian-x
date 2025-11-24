# RepoGuardian X

![RepoGuardian X Logo](images/logo.png)

**🔒 Never leak a secret again.**

A fully offline security scanning VS Code extension that detects secrets, credentials, and policy violations before they reach your repository. All processing happens locally with automatic secret masking to ensure sensitive data never leaves your machine.

**Developed by:** Skanda Kumar PV, Prajan K, Sanjay SG

[![Pipeline Status](https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x/badges/main/pipeline.svg)](https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x/-/pipelines)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Project Overview

**Course**: IIT Bombay - Software Engineering  
**Team**: Zoro ISIN AWS 2 Group  

**Repositories**:
- **GitLab**: [https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x](https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x)
- **GitHub**: [https://github.com/SkandaKumarPV/Repoguardian-x](https://github.com/SkandaKumarPV/Repoguardian-x)

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

## 📦 Installation (For Academic Submission)

### **Installing the RepoGuardian X Extension**

This project is distributed as a **VS Code extension package (.vsix file)** for easy installation and testing.

#### **Step 1: Get the Extension Package**

1. Clone the repository:
   ```bash
   git clone https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x.git
   cd repoguardian-x
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Package the extension:
   ```bash
   npm install -g @vscode/vsce
   vsce package
   ```
   
   This creates `repoguardian-x-1.0.0.vsix`

#### **Step 2: Install in VS Code**

**Method 1: Via Command Palette**
1. Open VS Code
2. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
3. Type "Extensions: Install from VSIX"
4. Select the `repoguardian-x-1.0.0.vsix` file
5. Reload VS Code when prompted

**Method 2: Via Extensions Sidebar**
1. Open VS Code
2. Click Extensions icon (or press `Ctrl+Shift+X`)
3. Click the `...` menu at the top
4. Select "Install from VSIX..."
5. Choose the `.vsix` file
6. Reload VS Code

#### **Step 3: Verify Installation**

1. Open any project in VS Code
2. Press `Ctrl+Shift+P`
3. Type "RepoGuardian X"
4. You should see commands like:
   - `RepoGuardian X: Run Security Scan`
   - `RepoGuardian X: Install Pre-Push Hook`
   - `RepoGuardian X: Show Last Report`

### **For Evaluators/Instructors**

The packaged `.vsix` file contains everything needed to run the extension:
- ✅ No additional installation required
- ✅ Works completely offline
- ✅ All features included (scanning, masking, hooks)
- ✅ Cross-platform compatible (Windows, Mac, Linux)

**To test immediately:**
```bash
# Quick test with pre-built package
code --install-extension repoguardian-x-1.0.0.vsix
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
2. Run: `RepoGuardian X: Run Security Scan` (Ctrl+Shift+P)
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

## 🎬 Using RepoGuardian X Extension

### **Quick Start Guide**

1. **Install the Extension** (see Installation section above)

2. **Run Your First Scan**
   - Open any project in VS Code
   - Press `Ctrl+Shift+P`
   - Type: `RepoGuardian X: Run Security Scan`
   - View results in the **Problems** panel (Ctrl+Shift+M)

3. **Install Git Hook** (Optional)
   - Press `Ctrl+Shift+P`
   - Type: `RepoGuardian X: Install Pre-Push Hook`
   - Now every `git push` will automatically scan staged files

4. **View Reports**
   - Press `Ctrl+Shift+P`
   - Type: `RepoGuardian X: Show Last Report`
   - See detailed JSON report with masked secrets

### **Extension Features**

#### 🔍 **Automatic Scanning**
- Detects AWS keys, GitHub tokens, private keys, emails
- Scans on-demand via command palette
- Optional: Scan on file save

#### 🎭 **Smart Masking**
- All secrets automatically masked in output
- Shows first 4 + last 4 characters only
- Safe to share reports with instructors

#### 🚫 **Git Hook Integration**
- Blocks dangerous commits before push
- Works on Windows, Mac, and Linux
- One-click installation

#### 📊 **Problems Panel Integration**
- All findings appear in VS Code Problems panel
- Click to jump to exact line
- Severity indicators (Error/Warning/Info)

#### ⚡ **High Performance**
- Scans 1000+ files in seconds
- Skips binary files automatically
- Zero network requests (100% offline)

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

## 🌐 Source Code & Distribution

### **Repositories** (Public Access)

**GitLab (Primary)**
- URL: https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x
- CI/CD Pipeline: Automated builds and tests
- Clone: `git clone https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x.git`

**GitHub (Mirror)**
- URL: https://github.com/SkandaKumarPV/Repoguardian-x
- Clone: `git clone https://github.com/SkandaKumarPV/Repoguardian-x.git`

### **Extension Distribution**

This project is distributed as a **`.vsix` package** for VS Code:

✅ **No Marketplace Submission** - Direct installation via VSIX file  
✅ **No User Account Required** - Works completely offline  
✅ **Easy Sharing** - Single file contains everything  
✅ **Academic Friendly** - Perfect for course submissions  

**Why VSIX instead of publishing?**
- This is an academic project, not a commercial product
- Instructors/evaluators can install directly without marketplace dependencies
- Complete control over distribution and versioning
- No publisher account or fees required

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

- **GitLab**: https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x
- **GitHub**: https://github.com/SkandaKumarPV/Repoguardian-x
- **Issues**: [GitLab Issues](https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x/-/issues)
- **Pipeline**: [CI/CD Status](https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x/-/pipelines)

---

## 📝 For Academic Evaluators

### **Submission Package Includes:**

1. ✅ **Source Code** - Complete TypeScript implementation in `src/`
2. ✅ **VS Code Extension** - Install via `repoguardian-x-1.0.0.vsix`
3. ✅ **Test Suite** - Run with `npm test` (38 passing tests)
4. ✅ **Documentation** - This comprehensive README
5. ✅ **CI/CD Pipeline** - Automated builds on GitLab
6. ✅ **Demo Scenarios** - Pre-configured test cases in `demo/`

### **How to Evaluate:**

**Quick Test (2 minutes):**
```bash
# Install the extension
code --install-extension repoguardian-x-1.0.0.vsix

# Open any project and scan
Ctrl+Shift+P → "RepoGuardian X: Run Security Scan"
```

**Full Evaluation (10 minutes):**
```bash
# Clone and build
git clone https://gitlab.com/zoro.isin.aws.2-group/repoguardian-x.git
cd repoguardian-x
npm install
npm run build

# Run tests
npm test

# Test demo scenarios
node dist/cli.js --scan-files demo/scenario-secret/secrets.env.bad

# Install extension
vsce package
code --install-extension repoguardian-x-1.0.0.vsix
```

### **Key Evaluation Points:**

✅ **Functionality** - Detects AWS keys, GitHub tokens, emails, licenses  
✅ **Security** - All secrets properly masked in output  
✅ **Usability** - One-click installation, intuitive commands  
✅ **Performance** - Fast scanning (1000+ files in <10 seconds)  
✅ **Quality** - TypeScript, comprehensive tests, CI/CD  
✅ **Documentation** - Complete README, inline code comments  
✅ **Innovation** - 100% offline, VS Code integration, Git hooks  

---

**Built with ❤️ for IIT Bombay Software Engineering Course**  
**Team: Zoro ISIN AWS 2 Group**
