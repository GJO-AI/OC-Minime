# Webhook-Based Multi-Agent Architecture

## Executive Summary
A hub-and-spoke design where:
- **Coordinator** = Mission Control (master)
- **Workers** = OC-Instances with lightweight webhook receivers
- **Communication** = HTTP POST with retries
- **No persistent connections required**

## Core Principles
1. **Agents don't listen** - they receive webhooks
2. **Coordinator owns state** - single source of truth
3. **Async by default** - webhooks are fire-and-forget
4. **Simple to debug** - HTTP + JSON, nothing exotic

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    COORDINATOR (Master)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Task Queue │  │   Router    │  │  State Store (Git)  │ │
│  │  (SQLite)   │  │             │  │                     │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘ │
│         │                │                                   │
│         └────────────────┼──────────────────┐                │
│                          ▼                  ▼                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Webhook Dispatcher                      │   │
│  │  • POST to worker webhook endpoints                  │   │
│  │  • Retry with exponential backoff                    │   │
│  │  • Queue failed deliveries                           │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   OC-Instance 1 │ │   OC-Instance 2 │ │   OC-Instance N │
│  ┌─────────────┐│ │  ┌─────────────┐│ │  ┌─────────────┐│
│  │ Webhook     ││ │  │ Webhook     ││ │  │ Webhook     ││
│  │ Server      ││ │  │ Server      ││ │  │ Server      ││
│  │ (Port 3000) ││ │  │ (Port 3000) ││ │  │ (Port 3000) ││
│  └──────┬──────┘│ │  └──────┬──────┘│ │  └──────┬──────┘│
│         ▼       │ │         ▼       │ │         ▼       │
│  Spawns OpenClaw│ │  Spawns OpenClaw│ │  Spawns OpenClaw│
│  Session        │ │  Session        │ │  Session        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Components

### 1. Coordinator (Mission Control)

**Responsibilities:**
- Receive tasks from user
- Route to appropriate worker
- Track task status
- Aggregate results
- Handle failures

**Technology:**
- Node.js/Express or Python/FastAPI
- SQLite for task queue
- Git for shared state
- Runs on dedicated machine or main instance

**Database Schema:**
```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    from_agent TEXT,
    to_agent TEXT,
    content TEXT,
    status TEXT, -- pending, assigned, running, completed, failed
    created_at DATETIME,
    assigned_at DATETIME,
    completed_at DATETIME,
    result TEXT,
    retry_count INTEGER DEFAULT 0
);

CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    name TEXT,
    webhook_url TEXT,
    capabilities TEXT, -- JSON array
    last_seen DATETIME,
    status TEXT -- online, offline, busy
);
```

### 2. Worker Webhook Server

**Lightweight HTTP server on each OC-Instance:**

```javascript
// webhook-server.js - runs on each machine
const express = require('express');
const { spawn } = require('child_process');

const app = express();
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', agent: process.env.AGENT_ID });
});

// Receive task from coordinator
app.post('/webhook/task', async (req, res) => {
    const { task_id, content, from, reply_to } = req.body;
    
    // Acknowledge immediately
    res.json({ status: 'accepted', task_id });
    
    // Spawn OpenClaw session to process
    const oc = spawn('openclaw', [
        'sessions_spawn',
        '--label', `task-${task_id}`,
        '--mode', 'run',
        '--model', 'kimi-coding/k2p5',
        '--task', content
    ]);
    
    // When done, send result back to coordinator
    oc.on('close', (code) => {
        sendResultToCoordinator(task_id, code);
    });
});

// Receive result (for sub-agents)
app.post('/webhook/result', (req, res) => {
    const { task_id, result, status } = req.body;
    // Forward to coordinator
    forwardToCoordinator(task_id, result, status);
    res.json({ status: 'ok' });
});

app.listen(3000, '0.0.0.0', () => {
    console.log(`Webhook server for ${process.env.AGENT_ID} on port 3000`);
});
```

### 3. Communication Flow

**Task Assignment:**
```
1. User asks Coordinator: "Research AI trends"
2. Coordinator creates task in SQLite
3. Coordinator finds capable agent (OC-Instance-2)
4. Coordinator POSTs to http://instance-2:3000/webhook/task
5. Instance-2 webhook spawns OpenClaw session
6. OpenClaw processes task
7. When done, POSTs result back to Coordinator
8. Coordinator marks task complete
9. Coordinator notifies user
```

**Failure Handling:**
```
If webhook fails:
  1. Retry 3x with exponential backoff (1s, 2s, 4s)
  2. If still failing, mark agent offline
  3. Reassign task to another agent
  4. Alert user
```

---

## Deployment

### Coordinator Machine
```bash
# Install
git clone https://github.com/GJO-AI/oc-coordinator.git
cd oc-coordinator
npm install

# Configure
cat > .env << EOF
PORT=4000
DB_PATH=./coordinator.db
AGENTS_CONFIG=./agents.json
EOF

# Register agents
cat > agents.json << EOF
{
  "agents": [
    {"id": "oc-minime-1", "webhook": "http://192.168.12.100:3000", "caps": ["coding", "research"]},
    {"id": "oc-minime-2", "webhook": "http://192.168.12.101:3000", "caps": ["writing", "analysis"]},
    {"id": "oc-minime-3", "webhook": "http://192.168.12.102:3000", "caps": ["design", "frontend"]}
  ]
}
EOF

# Start
npm start
```

### Worker Machines
```bash
# On each OC-Instance machine
git clone https://github.com/GJO-AI/oc-webhook.git
cd oc-webhook
npm install

# Configure
cat > .env << EOF
AGENT_ID=oc-minime-2
COORDINATOR_URL=http://192.168.12.118:4000
WEBHOOK_PORT=3000
EOF

# Start (keeps running)
npm start
```

---

## Scaling to Cluster

**Phase 1: Single Coordinator (now)**
- 1 coordinator
- 3-5 workers
- SQLite sufficient

**Phase 2: Multiple Coordinators (future)**
- Coordinators elect leader (Raft consensus)
- PostgreSQL instead of SQLite
- Load balancer in front

**Phase 3: Mesh (future)**
- Workers can delegate to other workers
- Distributed hash table for task routing
- No single coordinator

---

## Why This Won't Fail

| Previous Attempt | Why It Failed | This Solution |
|------------------|---------------|---------------|
| Redis Pub/Sub | Agent can't hold connection | Webhook = HTTP POST, no connection |
| WebSocket | Agent can't listen persistently | Webhook server is separate process |
| Mission Control | Tried to do too much | Coordinator does one thing: route |
| Shared Git | 5-10 second latency | Webhook = sub-second |

**Key difference:**
- Before: Agent had to "listen" (impossible in OpenClaw)
- Now: Agent receives HTTP POST (always possible)

---

## Safety Mechanisms

1. **Idempotency:** Tasks have IDs, processing same ID twice is safe
2. **Timeouts:** Tasks timeout after 30 min, marked failed
3. **Dead Letter Queue:** Failed webhooks go to DLQ for manual review
4. **Circuit Breaker:** If agent fails 5x, marked offline
5. **Audit Log:** Every webhook logged to Git

---

## Integration with OpenClaw

**New skill: `oc-webhook`**
```yaml
name: oc-webhook
description: Receive tasks via webhook, coordinate with team
---

When webhook POST received:
1. Parse task
2. Log to .inbox/TASK-{id}.md
3. Process with current context
4. POST result back to coordinator
5. Archive to .archive/
```

---

## Minimal Viable Test

**Step 1:** Deploy webhook server on this machine
**Step 2:** Create simple coordinator (even just curl scripts)
**Step 3:** Test: `curl -X POST http://localhost:3000/webhook/task -d '{"task":"hello"}'`
**Step 4:** Verify OpenClaw session spawns
**Step 5:** Expand to second machine

---

## A2A and MCP Analysis

**A2A (Agent-to-Agent):**
- Requires agents to expose capabilities endpoint
- Assumes persistent availability
- **Doesn't fit:** OpenClaw agents aren't always "up"

**MCP (Model Context Protocol):**
- Context sharing standard
- Great for tools, not coordination
- **Doesn't fit:** We need task routing, not context

**This Architecture:**
- Fits OpenClaw's request/response model
- Webhooks work everywhere
- Can wrap A2A/MCP later if needed

---

## Recommendation

**Start here:**
1. Build webhook server (100 lines of Node.js)
2. Deploy on 2 machines
3. Test with curl
4. Build coordinator
5. Add SQLite queue
6. Add retry logic

**Timeline:** 2-3 days to working prototype

Want me to build the webhook server prototype on this machine?
