Demo steps (2 min):
1) Run: bash scripts/install-hooks.sh
2) Add demo/scenario-secret/secrets.env.bad, git add, git commit -> attempt push -> expected: blocked
3) Open VS Code -> Problems panel -> view masked detection -> apply quick fix -> remove secret
4) git push -> passes
