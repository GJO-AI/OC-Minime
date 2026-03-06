#!/bin/bash
# OpenClaw Workspace Backup Script

LOGFILE="/home/oc-minime/.openclaw/workspace/.backup.log"
cd /home/oc-minime/.openclaw/workspace || exit 1

echo "=== Backup started: $(date) ===" >> "$LOGFILE"

# Add all changes
git add -A >> "$LOGFILE" 2>&1

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "$(date): No changes to commit" >> "$LOGFILE"
else
    git commit -m "Backup: $(date '+%Y-%m-%d %H:%M')" >> "$LOGFILE" 2>&1
    git push origin main >> "$LOGFILE" 2>&1
    echo "$(date): Backup successful" >> "$LOGFILE"
fi

echo "" >> "$LOGFILE"
