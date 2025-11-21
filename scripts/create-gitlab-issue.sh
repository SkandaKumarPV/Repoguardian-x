#!/bin/bash
# Create GitLab Issue from RepoGuardian masked report
# Uses GitLab CI API with CI_JOB_TOKEN

set -e

REPORT_FILE="${1:-repoguardian-report.json}"
CI_PROJECT_ID="${CI_PROJECT_ID}"
CI_COMMIT_SHA="${CI_COMMIT_SHA}"
CI_JOB_TOKEN="${CI_JOB_TOKEN}"
CI_SERVER_URL="${CI_SERVER_URL}"
CI_PROJECT_URL="${CI_PROJECT_URL}"

if [ ! -f "$REPORT_FILE" ]; then
  echo "Report file not found: $REPORT_FILE"
  exit 0
fi

# Parse report
FINDINGS_COUNT=$(jq -r '.detectionsFound' "$REPORT_FILE")

if [ "$FINDINGS_COUNT" -eq 0 ]; then
  echo "No findings to report"
  exit 0
fi

echo "Found $FINDINGS_COUNT issues in report"

# Extract summary
FILES_SCANNED=$(jq -r '.filesScanned' "$REPORT_FILE")
TIMESTAMP=$(jq -r '.timestamp' "$REPORT_FILE")

# Count by category
SECRET_COUNT=$(jq '[.detections[] | select(.ruleId | startswith("secret-"))] | length' "$REPORT_FILE")
LICENSE_COUNT=$(jq '[.detections[] | select(.ruleId | startswith("license-"))] | length' "$REPORT_FILE")

# Build findings table
FINDINGS_TABLE="| File | Line | Rule | Snippet |\n|------|------|------|---------|"
while IFS= read -r line; do
  FILE=$(echo "$line" | jq -r '.filePath')
  LINE_NUM=$(echo "$line" | jq -r '.line')
  RULE=$(echo "$line" | jq -r '.ruleName')
  SNIPPET=$(echo "$line" | jq -r '.snippet' | head -c 80)
  FINDINGS_TABLE="${FINDINGS_TABLE}\n| \`${FILE}\` | ${LINE_NUM} | ${RULE} | \`${SNIPPET}...\` |"
done < <(jq -c '.detections[]' "$REPORT_FILE" | head -10)

if [ "$FINDINGS_COUNT" -gt 10 ]; then
  FINDINGS_TABLE="${FINDINGS_TABLE}\n| ... | ... | ... | ... |\n| _(${FINDINGS_COUNT} total findings)_ | | | |"
fi

# Build issue description
ISSUE_TITLE="🔒 RepoGuardian X – Security/License Issues Detected (${FINDINGS_COUNT} findings)"

ISSUE_BODY=$(cat <<EOF
## RepoGuardian X Security Scan Results

**Commit:** \`${CI_COMMIT_SHA:0:8}\`  
**Scan Time:** ${TIMESTAMP}  
**Files Scanned:** ${FILES_SCANNED}  
**Total Findings:** ${FINDINGS_COUNT}

### Summary by Category
- 🔐 **Secrets/Credentials:** ${SECRET_COUNT}
- ⚖️ **License Issues:** ${LICENSE_COUNT}

### Latest Findings (Masked)
${FINDINGS_TABLE}

---

## 🛠️ Remediation Checklist

### For Secrets/Credentials:
- [ ] **Rotate compromised credentials immediately**
- [ ] Move secrets to environment variables or secure vault
- [ ] Update \`.safecommit-ignore\` for test fixtures (if false positive)
- [ ] Review git history - secrets may exist in previous commits
- [ ] Consider using git-filter-repo to remove from history

### For License Issues:
- [ ] Remove GPL/copyleft code if incompatible with project license
- [ ] Replace with compatible alternative
- [ ] Add proper attribution if code is acceptable
- [ ] Update LICENSE file if needed

### General:
- [ ] Run local scan: \`node dist/cli.js\`
- [ ] Fix all issues or add to ignore list
- [ ] Re-run CI pipeline to verify fixes
- [ ] Remove quarantine label once clean

---

**Report:** See pipeline artifacts for full masked JSON report  
**Pipeline:** ${CI_PROJECT_URL}/-/pipelines/${CI_PIPELINE_ID}

*All data above is masked - no raw secrets exposed.*
EOF
)

# Check if issue already exists for this commit
EXISTING_ISSUE=$(curl --silent --header "JOB-TOKEN: ${CI_JOB_TOKEN}" \
  "${CI_SERVER_URL}/api/v4/projects/${CI_PROJECT_ID}/issues?labels=repoguardian&state=opened" \
  | jq -r ".[] | select(.description | contains(\"${CI_COMMIT_SHA:0:8}\")) | .iid" | head -1)

if [ -n "$EXISTING_ISSUE" ]; then
  echo "Issue #${EXISTING_ISSUE} already exists for this commit, adding note..."
  
  NOTE_BODY="**Update:** Re-scan at ${TIMESTAMP} still shows ${FINDINGS_COUNT} findings."
  
  curl --silent --request POST \
    --header "JOB-TOKEN: ${CI_JOB_TOKEN}" \
    --header "Content-Type: application/json" \
    --data "{\"body\": \"${NOTE_BODY}\"}" \
    "${CI_SERVER_URL}/api/v4/projects/${CI_PROJECT_ID}/issues/${EXISTING_ISSUE}/notes"
  
  echo "Note added to issue #${EXISTING_ISSUE}"
else
  echo "Creating new issue..."
  
  # Create new issue
  RESPONSE=$(curl --silent --request POST \
    --header "JOB-TOKEN: ${CI_JOB_TOKEN}" \
    --header "Content-Type: application/json" \
    --data "$(jq -n \
      --arg title "$ISSUE_TITLE" \
      --arg description "$ISSUE_BODY" \
      --argjson labels '["security", "repoguardian", "quarantine"]' \
      '{title: $title, description: $description, labels: $labels}')" \
    "${CI_SERVER_URL}/api/v4/projects/${CI_PROJECT_ID}/issues")
  
  ISSUE_IID=$(echo "$RESPONSE" | jq -r '.iid')
  
  if [ -n "$ISSUE_IID" ] && [ "$ISSUE_IID" != "null" ]; then
    echo "✅ Created issue #${ISSUE_IID}"
    echo "View at: ${CI_PROJECT_URL}/-/issues/${ISSUE_IID}"
  else
    echo "⚠️  Failed to create issue. Response:"
    echo "$RESPONSE" | jq '.'
  fi
fi
