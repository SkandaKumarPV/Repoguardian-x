#!/bin/bash
# Manage quarantine labels on merge requests based on scan results
# Uses GitLab CI API with CI_JOB_TOKEN

set -e

REPORT_FILE="${1:-repoguardian-report.json}"
CI_PROJECT_ID="${CI_PROJECT_ID}"
CI_COMMIT_SHA="${CI_COMMIT_SHA}"
CI_JOB_TOKEN="${CI_JOB_TOKEN}"
CI_SERVER_URL="${CI_SERVER_URL}"
CI_MERGE_REQUEST_IID="${CI_MERGE_REQUEST_IID}"

QUARANTINE_LABEL="quarantine/contains-secret"

if [ ! -f "$REPORT_FILE" ]; then
  echo "Report file not found: $REPORT_FILE"
  exit 0
fi

# Parse report
FINDINGS_COUNT=$(jq -r '.detectionsFound' "$REPORT_FILE")

echo "Findings count: $FINDINGS_COUNT"

# Function to get MR IID for current commit
get_mr_iid() {
  if [ -n "$CI_MERGE_REQUEST_IID" ]; then
    echo "$CI_MERGE_REQUEST_IID"
    return
  fi
  
  # Try to find MR by commit
  curl --silent --header "JOB-TOKEN: ${CI_JOB_TOKEN}" \
    "${CI_SERVER_URL}/api/v4/projects/${CI_PROJECT_ID}/repository/commits/${CI_COMMIT_SHA}/merge_requests" \
    | jq -r '.[0].iid // empty'
}

MR_IID=$(get_mr_iid)

if [ -z "$MR_IID" ]; then
  echo "No merge request found for this commit, skipping label management"
  exit 0
fi

echo "Managing labels for MR !${MR_IID}"

# Get current MR labels
CURRENT_LABELS=$(curl --silent --header "JOB-TOKEN: ${CI_JOB_TOKEN}" \
  "${CI_SERVER_URL}/api/v4/projects/${CI_PROJECT_ID}/merge_requests/${MR_IID}" \
  | jq -r '.labels | join(",")')

echo "Current labels: ${CURRENT_LABELS}"

HAS_QUARANTINE_LABEL=false
if echo "$CURRENT_LABELS" | grep -q "$QUARANTINE_LABEL"; then
  HAS_QUARANTINE_LABEL=true
fi

if [ "$FINDINGS_COUNT" -gt 0 ]; then
  # Findings detected - add quarantine label if not present
  if [ "$HAS_QUARANTINE_LABEL" = false ]; then
    echo "Adding quarantine label..."
    
    # Add label
    NEW_LABELS="${CURRENT_LABELS}"
    if [ -n "$NEW_LABELS" ]; then
      NEW_LABELS="${NEW_LABELS},${QUARANTINE_LABEL}"
    else
      NEW_LABELS="${QUARANTINE_LABEL}"
    fi
    
    curl --silent --request PUT \
      --header "JOB-TOKEN: ${CI_JOB_TOKEN}" \
      --header "Content-Type: application/json" \
      --data "{\"labels\": \"${NEW_LABELS}\"}" \
      "${CI_SERVER_URL}/api/v4/projects/${CI_PROJECT_ID}/merge_requests/${MR_IID}"
    
    echo "✅ Added quarantine label to MR !${MR_IID}"
    
    # Add comment
    COMMENT="🔒 **RepoGuardian**: This branch contains ${FINDINGS_COUNT} security/license finding(s). Labeled as \`${QUARANTINE_LABEL}\`."
    
    curl --silent --request POST \
      --header "JOB-TOKEN: ${CI_JOB_TOKEN}" \
      --header "Content-Type: application/json" \
      --data "{\"body\": \"${COMMENT}\"}" \
      "${CI_SERVER_URL}/api/v4/projects/${CI_PROJECT_ID}/merge_requests/${MR_IID}/notes"
  else
    echo "Quarantine label already present"
  fi
else
  # No findings - remove quarantine label if present
  if [ "$HAS_QUARANTINE_LABEL" = true ]; then
    echo "Removing quarantine label..."
    
    # Remove label
    NEW_LABELS=$(echo "$CURRENT_LABELS" | sed "s/${QUARANTINE_LABEL}//g" | sed 's/,,/,/g' | sed 's/^,//g' | sed 's/,$//g')
    
    curl --silent --request PUT \
      --header "JOB-TOKEN: ${CI_JOB_TOKEN}" \
      --header "Content-Type: application/json" \
      --data "{\"labels\": \"${NEW_LABELS}\"}" \
      "${CI_SERVER_URL}/api/v4/projects/${CI_PROJECT_ID}/merge_requests/${MR_IID}"
    
    echo "✅ Removed quarantine label from MR !${MR_IID}"
    
    # Add comment
    COMMENT="✅ **RepoGuardian**: Scan passed clean. Quarantine label removed."
    
    curl --silent --request POST \
      --header "JOB-TOKEN: ${CI_JOB_TOKEN}" \
      --header "Content-Type: application/json" \
      --data "{\"body\": \"${COMMENT}\"}" \
      "${CI_SERVER_URL}/api/v4/projects/${CI_PROJECT_ID}/merge_requests/${MR_IID}/notes"
  else
    echo "No quarantine label to remove - branch is clean"
  fi
fi

echo "Label management complete"
