When push blocked:
- Message: "RepoGuardian blocked your push — potential secret or license issue detected."
- Actions:
  1) Unstage: git reset HEAD <file>
  2) Open VS Code -> Problems panel
  3) Fix or move secret to env var / secrets manager, then rotate key
Tone: friendly, instructive.
