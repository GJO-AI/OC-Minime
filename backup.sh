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

# Check if there are changes to commit
if git diff --cached --quiet; then
    MESSAGE="No changes to commit"
    echo "$TIMESTAMP: $MESSAGE" >> "$LOGFILE"
    STATUS="no-change"
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

# Write to JSON log (maintain array)
python3 << PYTHON
import json
import os
from datetime import datetime, timedelta

JSONLOG = "$JSONLOG"
TIMESTAMP = "$TIMESTAMP"
STATUS = "$STATUS"
MESSAGE = """$MESSAGE""".replace('"', '\\"')

# Read existing data
if os.path.exists(JSONLOG):
    try:
        with open(JSONLOG, 'r') as f:
            data = json.load(f)
        if not isinstance(data, list):
            data = [data]
    except:
        data = []
else:
    data = []

# Add new entry
data.append({
    "timestamp": TIMESTAMP,
    "status": STATUS,
    "message": MESSAGE
})

# Keep only last 30 entries (last 24 hours)
data = data[-30:]

# Write back
with open(JSONLOG, 'w') as f:
    json.dump(data, f, indent=2)

print(f"Logged backup: {STATUS}")
PYTHON
