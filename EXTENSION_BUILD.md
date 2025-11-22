# Building the RepoGuardian X Extension Package

## Prerequisites

Ensure you have Node.js and npm installed.

## Steps to Create VSIX Package

### 1. Install VSCE (VS Code Extension packager)

```bash
npm install -g @vscode/vsce
```

### 2. Add Logo (Important!)

Download the logo and save it:
- URL: https://i.postimg.cc/qMzDPkjY/Repo-Guardian-X.png
- Save as: `images/logo.png`

### 3. Build the Extension

```bash
npm install
npm run build
```

### 4. Package as VSIX

```bash
vsce package
```

This creates: `repoguardian-x-1.0.0.vsix`

### 5. Install the Extension

**Method 1: Command Line**
```bash
code --install-extension repoguardian-x-1.0.0.vsix
```

**Method 2: VS Code UI**
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Click "..." menu → "Install from VSIX..."
4. Select `repoguardian-x-1.0.0.vsix`

### 6. Test the Extension

1. Open any project in VS Code
2. Press `Ctrl+Shift+P`
3. Type: `RepoGuardian X: Run Security Scan`
4. Check the Problems panel for results

## Distribution

Share the `.vsix` file with:
- ✅ Instructors/evaluators
- ✅ Team members
- ✅ Anyone who wants to test the extension

**File to share**: `repoguardian-x-1.0.0.vsix` (typically 500KB - 2MB)

## Troubleshooting

### Error: "Missing logo"
- Download from: https://i.postimg.cc/qMzDPkjY/Repo-Guardian-X.png
- Save as: `images/logo.png`
- Run `vsce package` again

### Error: "Cannot find module"
- Run: `npm install`
- Run: `npm run build`
- Try packaging again

### Extension not showing commands
- Reload VS Code: `Ctrl+Shift+P` → "Reload Window"
- Check extension is enabled in Extensions panel

## Notes

- The `.vsix` file contains everything needed
- No internet connection required for installation
- Works completely offline after installation
- Compatible with Windows, Mac, and Linux
