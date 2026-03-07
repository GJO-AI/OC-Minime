# AgentGram Test Environment Setup

## Architecture for Testing

```
┌─────────────────────────────────────────────────────────────┐
│  MACHINE 1: OC-MiniMe (Master + Hub)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ OpenClaw    │  │ AgentGram   │  │ AgentGram Hub       │  │
│  │ Gateway     │  │ Adapter     │  │ (Port 4000)         │  │
│  │ (18789)     │  │ (3000)      │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         ▲                ▲                    ▲              │
│         │                │                    │              │
│         └────────────────┴────────────────────┘              │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ MACHINE 2     │ │ MACHINE 3     │ │ MACHINE 4     │
│ oc-worker-1   │ │ oc-worker-2   │ │ oc-worker-3   │
│               │ │               │ │               │
│ ┌───────────┐ │ │ ┌───────────┐ │ │ ┌───────────┐ │
│ │OpenClaw   │ │ │ │OpenClaw   │ │ │ │OpenClaw   │ │
│ │Gateway    │ │ │ │Gateway    │ │ │ │Gateway    │ │
│ │(18789)    │ │ │ │(18789)    │ │ │ │(18789)    │ │
│ └───────────┘ │ │ └───────────┘ │ │ └───────────┘ │
│       ▲       │ │       ▲       │ │       ▲       │
│       │       │ │       │       │ │       │       │
│ ┌─────┴─────┐ │ │ ┌─────┴─────┐ │ │ ┌─────┴─────┐ │
│ │AgentGram  │ │ │ │AgentGram  │ │ │ │AgentGram  │ │
│ │Adapter    │ │ │ │Adapter    │ │ │ │Adapter    │ │
│ │(3000)     │ │ │ │(3000)     │ │ │ │(3000)     │ │
│ └───────────┘ │ │ └───────────┘ │ │ └───────────┘ │
└───────────────┘ └───────────────┘ └───────────────┘
```

## Machine 1: Hub + Master (This Machine)

Already configured. Ensure Hub is accessible:

```bash
# Check Hub will be reachable
ip addr show | grep "inet " | head -1
# Should show: 192.168.12.118 (or your LAN IP)

# Firewall check
sudo ufw allow 4000/tcp  # If using ufw
```

## Machine 2, 3, 4: Worker Setup

### Step 1: Install OpenClaw

```bash
# Same as SETUP.md
npm install -g openclaw
openclaw onboard

# Configure models (use Kimi for workers too)
# Edit ~/.openclaw/openclaw.json
```

### Step 2: Configure Gateway for LAN

```bash
# Edit ~/.openclaw/openclaw.json
# Set bind to "lan" so Hub can reach webhooks
{
  "gateway": {
    "bind": "lan",
    "port": 18789
  }
}

openclaw gateway restart
```

### Step 3: Install AgentGram Skill

```bash
# Via ClawHub (once published)
clawhub install agentgram

# OR manually for now
git clone https://github.com/GJO-AI/OC-Minime.git /tmp/oc-reference
cp -r /tmp/oc-reference/skills/agentgram ~/.openclaw/workspace/skills/
```

### Step 4: Configure AgentGram Adapter

Create `~/.agentgram/config.json`:

```json
{
  "agentId": "oc-worker-1",
  "hubUrl": "http://192.168.12.118:4000",
  "gatewayUrl": "ws://localhost:18789",
  "port": 3000,
  "capabilities": ["coding", "testing"]
}
```

### Step 5: Start Adapter

```bash
# Install dependencies
cd ~/.openclaw/workspace/skills/agentgram/src
npm install express ws axios uuid

# Start adapter
node adapter.js
```

Or create systemd service:

```bash
# /etc/systemd/system/agentgram-adapter.service
[Unit]
Description=AgentGram Adapter
After=network.target

[Service]
Type=simple
User=oc-minime
WorkingDirectory=/home/oc-minime/.openclaw/workspace/skills/agentgram/src
ExecStart=/usr/bin/node adapter.js
Environment="AGENT_ID=oc-worker-1"
Environment="AGENTGRAM_HUB_URL=http://192.168.12.118:4000"
Environment="AGENTGRAM_CAPABILITIES=coding,testing"
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable agentgram-adapter
sudo systemctl start agentgram-adapter
```

## Capability Assignment

Assign different capabilities to each worker:

| Machine | Agent ID | Capabilities | Role |
|---------|----------|--------------|------|
| 1 | oc-minime | research, coordination | Master/Hub |
| 2 | oc-worker-1 | coding, testing | Developer |
| 3 | oc-worker-2 | analysis, trading | Analyst |
| 4 | oc-worker-3 | writing, publishing | Content |

## Testing Checklist

### Phase 1: Connectivity
- [ ] All machines on same LAN
- [ ] Hub reachable from workers (`curl http://192.168.12.118:4000/health`)
- [ ] Workers register with Hub
- [ ] Heartbeats received

### Phase 2: Simple Task
- [ ] Submit single task to specific agent
- [ ] Agent receives and processes
- [ ] Result returned to Hub
- [ ] Master sees completion

### Phase 3: Workflow
- [ ] Submit workflow with dependencies
- [ ] Tasks execute in order
- [ ] Results passed between tasks
- [ ] Final output correct

### Phase 4: Failure Handling
- [ ] Kill one worker mid-task
- [ ] Task retried on another worker
- [ ] Workflow continues

## Network Requirements

| Port | Service | Direction |
|------|---------|-----------|
| 4000 | AgentGram Hub | Inbound to Machine 1 |
| 3000 | AgentGram Adapter | Inbound to Workers |
| 18789 | OpenClaw Gateway | Localhost only |

## Troubleshooting

**Workers can't reach Hub:**
```bash
# Check network
ping 192.168.12.118

# Check Hub is listening
netstat -tlnp | grep 4000

# Check firewall
sudo ufw status
```

**Adapter won't start:**
```bash
# Check dependencies
npm list express ws axios

# Check config
cat ~/.agentgram/config.json | python3 -m json.tool

# Run manually to see errors
cd ~/.openclaw/workspace/skills/agentgram/src
node adapter.js
```

**Agents not registering:**
```bash
# Check Hub logs
tail -f /var/log/agentgram/hub.log

# Check adapter logs
journalctl -u agentgram-adapter -f
```

## Quick Test Commands

```bash
# From worker, test Hub connectivity
curl http://192.168.12.118:4000/api/v1/health

# Submit test task
curl -X POST http://192.168.12.118:4000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "test-1",
    "task_id": "test-task-1",
    "type": "test",
    "content": "Say hello from worker",
    "requirements": {
      "capabilities": ["coding"]
    }
  }'

# Check task status
curl http://192.168.12.118:4000/api/v1/tasks/test-task-1
```

## Next Steps

Once 2-3 workers are connected:
1. Build Hub API (if not done)
2. Test simple task routing
3. Build workflow engine
4. Test dependency resolution
5. Document results

Ready to start building? What machines do you have available?
