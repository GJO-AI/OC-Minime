#!/bin/bash
# OpenClaw Workspace Backup Script

LOGFILE="/home/oc-minime/.openclaw/workspace/.backup.log"
JSONLOG="/home/oc-minime/.openclaw/workspace/.backup.json"
cd /home/oc-minime/.openclaw/workspace || exit 1

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
STATUS="success"
MESSAGE=""

echo "=== Backup started: $TIMESTAMP ===" >> "$LOGFILE"

# Add all changes
git add -A >> "$LOGFILE" 2>&1
ADD_OUTPUT=$(git add -A 2>&1)

# Check if there are changes to commit
if git diff --cached --quiet; then
    MESSAGE="No changes to commit"
    echo "$TIMESTAMP: $MESSAGE" >> "$LOGFILE"
else
    COMMIT_MSG="Backup: $(date '+%Y-%m-%d %H:%M')"
    COMMIT_OUTPUT=$(git commit -m "$COMMIT_MSG" 2>&1)
    
    PUSH_OUTPUT=$(git push origin main 2>&1)
    PUSH_EXIT=$?
    
    if [ $PUSH_EXIT -eq 0 ]; then
        MESSAGE="Backup successful"
        echo "$TIMESTAMP: $MESSAGE" >> "$LOGFILE"
    else
        STATUS="error"
        MESSAGE="Push failed: $PUSH_OUTPUT"
        echo "$TIMESTAMP: ERROR - $MESSAGE" >> "$LOGFILE"
    fi
fi

echo "" >> "$LOGFILE"

# Write JSON log for dashboard
# Read existing JSON or create empty array
if [ -f "$JSONLOG" ]; then
    JSON_DATA=$(cat "$JSONLOG")
else
    JSON_DATA="[]"
fi

# Add new entry
NEW_ENTRY="{\"timestamp\":\"$TIMESTAMP\",\"status\":\"$STATUS\",\"message\":\"$MESSAGE\"}"

# Remove trailing ], add new entry, close
echo "$JSON_DATA" | sed 's/\]/,\n/' | sed "s/\]/$NEW_ENTRY]/" > "$JSONLOG.tmp"
echo "$NEW_ENTRY" > "$JSONLOG"

# Keep only last 30 entries
python3 -c "
import json
try:
    with open('$JSONLOG', 'r') as f:
        data = json.load(f)
    if isinstance(data, list):
        data = data[-30:]
        with open('$JSONLOG', 'w') as f:
            json.dump(data, f)
except:
    pass
" 2>/dev/null
