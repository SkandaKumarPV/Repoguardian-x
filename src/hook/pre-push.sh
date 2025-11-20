#!/bin/bash
# RepoGuardian Pre-Push Hook
# This hook scans staged files for security issues before allowing a push

echo "🔒 RepoGuardian: Scanning staged files for security issues..."

# Find the CLI tool
CLI_PATH=""

# Check if node_modules/.bin/repoguardian exists (local install)
if [ -f "./node_modules/.bin/repoguardian" ]; then
    CLI_PATH="./node_modules/.bin/repoguardian"
# Check if npm global bin contains repoguardian
elif command -v repoguardian &> /dev/null; then
    CLI_PATH="repoguardian"
# Check if we can run from dist
elif [ -f "./dist/cli.js" ]; then
    CLI_PATH="node ./dist/cli.js"
else
    echo "❌ Error: RepoGuardian CLI not found"
    echo "Please run: npm install"
    exit 1
fi

# Run the scan on staged files
$CLI_PATH --scan-staged

# Capture the exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Security scan passed - push allowed"
    exit 0
elif [ $EXIT_CODE -eq 1 ]; then
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "⚠️  PUSH BLOCKED - Security issues detected"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "Action required:"
    echo "  1. Check the VS Code Problems panel for details"
    echo "  2. Fix or remove the detected secrets"
    echo "  3. Add false positives to .safecommit-ignore"
    echo "  4. Commit changes and try pushing again"
    echo ""
    echo "To bypass this check (NOT recommended):"
    echo "  git push --no-verify"
    echo ""
    exit 1
else
    echo "❌ Error occurred during security scan"
    echo "Please check the output above for details"
    exit 1
fi
