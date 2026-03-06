# OpenClaw Setup Guide

A step-by-step guide to setting up OpenClaw with custom configurations, skills, and dashboard.

## Prerequisites

- Linux server/machine (Ubuntu 24.04 recommended)
- Node.js 18+ (OpenClaw handles this via nvm)
- GitHub account for backups

---

## Step 1: Install OpenClaw

```bash
# Install OpenClaw CLI
npm install -g openclaw

# Initialize
openclaw onboard
```

Follow the onboarding wizard:
- Choose "local" mode
- Select your chat platform (webchat for now)
- Configure the initial model (minimax is default)

---

## Step 2: Configure Models

### Add Kimi for Coding (Optional)

```bash
# Edit the config
nano ~/.openclaw/openclaw.json
```

Add to `models.providers`:

```json
"kimi-coding": {
  "baseUrl": "https://api.kimi.com/coding/",
  "api": "anthropic-messages",
  "models": [
    {
      "id": "k2p5",
      "name": "Kimi for Coding",
      "reasoning": true,
      "input": ["text", "image"],
      "cost": { "input": 0, "output": 0 },
      "contextWindow": 262144,
      "maxTokens": 32768
    }
  ]
}
```

Add to `agents.defaults.models`:

```json
"kimi-coding/k2p5": {
  "alias": "Kimi for Coding"
}
```

Set primary model:

```json
"agents": {
  "defaults": {
    "model": {
      "primary": "minimax/MiniMax-M2.5"
    }
  }
}
```

### Enable Memory Search

Add to `agents.defaults`:

```json
"memorySearch": {
  "enabled": true,
  "provider": "openai",
  "sources": ["memory"]
}
```

Restart gateway:

```bash
openclaw gateway restart
```

---

## Step 3: Install Skills

### Install ClawHub CLI (if not bundled)

```bash
npm i -g clawhub
```

### Self-Improving Agent

```bash
clawhub install self-improving-agent
```

Create learning files:

```bash
mkdir -p ~/.openclaw/workspace/.learnings
cp ~/.openclaw/workspace/skills/self-improving-agent/assets/LEARNINGS.md ~/.openclaw/workspace/.learnings/
cp ~/.openclaw/workspace/skills/self-improving-agent/assets/LEARNINGS.md ~/.openclaw/workspace/.learnings/ERRORS.md
```

### Elite Longterm Memory

```bash
clawhub install elite-longterm-memory --force
```

Create memory files:

```bash
mkdir -p ~/.openclaw/workspace/memory
cat > ~/.openclaw/workspace/SESSION-STATE.md << 'EOF'
# SESSION-STATE.md — Active Working Memory

## Current Task
[None]

## Key Context
[None yet]

## Pending Actions
- [ ] None

## Recent Decisions
[None yet]

---
*Last updated: TIMESTAMP*
EOF
```

---

## Step 4: Install Browser Automation (Optional)

```bash
# Install agent-browser CLI
npm install -g agent-browser
agent-browser install

# Install Claude Code VS Code extension
code --install-extension anthropic.claude-code
```

---

## Step 5: GitHub Backup Setup

### Initialize Git

```bash
cd ~/.openclaw/workspace
git init
git branch -M main
```

### Configure Git

```bash
git config user.email "your-email@example.com"
git config user.name "Your Name"
```

### Add Remote

```bash
git remote add origin https://github.com/YOUR_ORG/YOUR_REPO.git
```

### Create Backup Script

```bash
cat > ~/.openclaw/workspace/backup.sh << 'EOF'
#!/bin/bash
LOGFILE="$HOME/.openclaw/workspace/.backup.log"
JSONLOG="$HOME/.openclaw/workspace/.backup.json"
cd "$HOME/.openclaw/workspace" || exit 1

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
STATUS="success"
MESSAGE=""

echo "=== Backup started: $TIMESTAMP ===" >> "$LOGFILE"

git add -A >> "$LOGFILE" 2>&1

if git diff --cached --quiet; then
    MESSAGE="No changes to commit"
    echo "$TIMESTAMP: $MESSAGE" >> "$LOGFILE"
    STATUS="no-change"
else
    git commit -m "Backup: $(date '+%Y-%m-%d %H:%M')" >> "$LOGFILE" 2>&1
    
    if git push origin main >> "$LOGFILE" 2>&1; then
        MESSAGE="Backup successful"
        echo "$TIMESTAMP: $MESSAGE" >> "$LOGFILE"
    else
        STATUS="error"
        MESSAGE="Push failed"
        echo "$TIMESTAMP: ERROR - $MESSAGE" >> "$LOGFILE"
    fi
fi

echo "" >> "$LOGFILE"

# Update JSON log
python3 << PYTHON
import json, os
JSONLOG = "$JSONLOG"
TIMESTAMP = "$TIMESTAMP"
STATUS = "$STATUS"
MESSAGE = """$MESSAGE""".replace('"', '\\"')

data = []
if os.path.exists(JSONLOG):
    try:
        with open(JSONLOG, 'r') as f:
            data = json.load(f)
        if not isinstance(data, list):
            data = [data]
    except:
        data = []

data.append({"timestamp": TIMESTAMP, "status": STATUS, "message": MESSAGE})
data = data[-30:]

with open(JSONLOG, 'w') as f:
    json.dump(data, f, indent=2)
PYTHON
EOF

chmod +x ~/.openclaw/workspace/backup.sh
```

### Add Cron Job

```bash
crontab -e
# Add line:
0 * * * * /home/USER/.openclaw/workspace/backup.sh >> /home/USER/.openclaw/workspace/.backup.log 2>&1
```

---

## Step 6: Dashboard (Optional)

### Create Dashboard HTML

Copy `dashboard.html` from the GitHub repo or create fresh:

```bash
# Start HTTP server
cd ~/.openclaw/workspace
python3 -m http.server 8080 --bind 0.0.0.0
```

Access at: `http://SERVER_IP:8080/dashboard.html`

---

## Common Commands

```bash
# Gateway management
openclaw gateway start
openclaw gateway stop
openclaw gateway restart
openclaw gateway status

# Skills
openclaw skills list
clawhub install SKILL_NAME

# Cron jobs
openclaw cron list
openclaw cron add --every 1h --name "job-name" --system-event "event"

# Configuration
openclaw configure
openclaw doctor
```

---

## File Locations

| Path | Description |
|------|-------------|
| `~/.openclaw/openclaw.json` | Main config |
| `~/.openclaw/workspace/` | Workspace files |
| `~/.openclaw/workspace/skills/` | Installed skills |
| `~/.openclaw/workspace/.learnings/` | Learning logs |
| `~/.openclaw/workspace/.backup.json` | Backup history |

---

## Troubleshooting

### Gateway won't start

```bash
# Check config validity
python3 -c "import json; json.load(open('$HOME/.openclaw/openclaw.json'))"

# Check logs
tail -f /tmp/openclaw/openclaw-*.log
```

### Model not allowed

Add model to `agents.defaults.models` in config.

### Cron not running

```bash
# Check cron status
systemctl status cron

# Check crontab
crontab -l
```

---

## Next Steps

1. Customize `AGENTS.md`, `SOUL.md`, `USER.md` in workspace
2. Add more skills via ClawHub
3. Configure additional channels (Discord, WhatsApp, etc.)
4. Set up node pairing for desktop control
