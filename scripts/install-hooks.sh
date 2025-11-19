#!/bin/bash
# Install pre-push template to .git/hooks
mkdir -p .git/hooks
cp src/hook/pre-push.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push
echo "Installed pre-push hook (placeholder)."
