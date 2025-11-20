@echo off
REM RepoGuardian Pre-Push Hook (Windows)
REM This hook scans staged files for security issues before allowing a push

echo 🔒 RepoGuardian: Scanning staged files for security issues...

REM Find the CLI tool
set CLI_PATH=

REM Check if node_modules\.bin\repoguardian exists (local install)
if exist "node_modules\.bin\repoguardian.cmd" (
    set CLI_PATH=node_modules\.bin\repoguardian.cmd
) else if exist "node_modules\.bin\repoguardian" (
    set CLI_PATH=node node_modules\.bin\repoguardian
) else (
    REM Check if we can run from dist
    if exist "dist\cli.js" (
        set CLI_PATH=node dist\cli.js
    ) else (
        echo ❌ Error: RepoGuardian CLI not found
        echo Please run: npm install
        exit /b 1
    )
)

REM Run the scan on staged files
%CLI_PATH% --scan-staged

REM Capture the exit code
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% equ 0 (
    echo ✅ Security scan passed - push allowed
    exit /b 0
) else if %EXIT_CODE% equ 1 (
    echo.
    echo ════════════════════════════════════════════════════════════
    echo ⚠️  PUSH BLOCKED - Security issues detected
    echo ════════════════════════════════════════════════════════════
    echo.
    echo Action required:
    echo   1. Check the VS Code Problems panel for details
    echo   2. Fix or remove the detected secrets
    echo   3. Add false positives to .safecommit-ignore
    echo   4. Commit changes and try pushing again
    echo.
    echo To bypass this check (NOT recommended):
    echo   git push --no-verify
    echo.
    exit /b 1
) else (
    echo ❌ Error occurred during security scan
    echo Please check the output above for details
    exit /b 1
)
