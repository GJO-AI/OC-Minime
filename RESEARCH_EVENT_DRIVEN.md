# Event-Driven Multi-Agent Communication

## Core Problem
OpenClaw agents are **request/response**, not event-driven:
- ❌ Can't subscribe to Redis and wait for messages
- ❌ No persistent WebSocket listener
- ❌ Must be triggered to check messages

**Result:** You had to poll via Telegram - "check your messages"

## Why Previous Attempts Failed

### Attempt 1: Redis Pub/Sub
- Agent subscribes to Redis channel
- **Problem:** OpenClaw session ends after response
- **Result:** No persistent listener

### Attempt 2: WebSocket Hub
- WebSocket connection to coordinator
- **Problem:** Agent can't hold connection open
- **Result:** Misses messages while idle

### Attempt 3: Webhook
- External HTTP trigger
- **Problem:** Agent needs public endpoint
- **Result:** Firewall/NAT issues

---

## Solutions That Actually Work

### Solution 1: Heartbeat Polling (What you had)
**How it works:**
- Agent checks Telegram every 30 seconds
- Reads messages, responds

**Better implementation:**
```bash
# Cron job on each agent
*/1 * * * * curl http://localhost:8080/check-coms
```

**Latency:** 30-60 seconds

---

### Solution 2: Push via Gateway Wake
**How it works:**
- Use OpenClaw Gateway heartbeat feature
- External system sends "wake" message
- Agent polls when woken

**Implementation:**
```javascript
// Coordinator sends wake signal
curl -X POST http://gateway:18789/wake \
  -d '{"agent":"oc-minime-2", "reason":"new-task"}'
```

**Agent config:**
```json
{
  "heartbeat": {
    "prompt": "Check for new tasks from coordinator",
    "interval": 300
  }
}
```

**Latency:** 5 minutes (heartbeat interval)

---

### Solution 3: Long-Polling Worker
**How it works:**
- Spawn persistent sub-agent that polls Redis
- Sub-agent sends message to parent when task arrives

**Architecture:**
```
┌─────────────────────────────────────────────┐
│ Main Agent (OC-Minime)                      │
│  ┌─────────────────────────────────────┐   │
│  │ Sub-Agent (Long-Polling Worker)     │   │
│  │  • Connects to Redis                │   │
│  │  • Blocks waiting for messages      │   │
│  │  • When message arrives:            │   │
│  │    - Sends message to main agent    │   │
│  │    - Main agent wakes up            │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Implementation:**
```bash
# Spawn listener process
sessions_spawn({
  label: "redis-listener",
  mode: "session",  // Keep running!
  task: "Connect to Redis at 192.168.12.118:6379, subscribe to 'oc-minime-1', when message arrives send it to parent session"
})
```

**Pros:**
- ✅ Near real-time (seconds)
- ✅ Uses existing OpenClaw tools
- ✅ No external webhook needed

**Cons:**
- ❌ One session always running (cost)
- ❌ Complex error handling

---

### Solution 4: Webhook → Session Spawn (Recommended)
**How it works:**
- Each agent exposes simple webhook endpoint
- Coordinator POSTs task to webhook
- Webhook spawns new agent session
- Session processes task, responds

**Architecture:**
```
Coordinator ──POST──► OC-Agent-2 Webhook
                      (simple HTTP server)
                            │
                            ▼
                     Spawns OpenClaw Session
                            │
                            ▼
                     Agent Processes Task
                            │
                            ▼
                     Responds to Coordinator
```

**Implementation:**
```javascript
// Simple webhook receiver on each machine
const express = require('express');
const { spawn } = require('child_process');

app.post('/task', (req, res) => {
  const task = req.body;
  
  // Spawn OpenClaw session
  spawn('openclaw', ['sessions_spawn', '--task', task.content]);
  
  res.json({status: 'accepted'});
});

app.listen(3000);
```

**Pros:**
- ✅ True event-driven
- ✅ Scalable
- ✅ Agent only runs when needed

**Cons:**
- ❌ Each machine needs public IP or Tailscale
- ❌ Webhook server always running

---

### Solution 5: Shared SQLite with NOTIFY (Best for LAN)
**How it works:**
- Shared SQLite database on network drive
- Coordinator writes task to `tasks` table
- Agents use SQLite NOTIFY or polling
- Agent spawns when new row detected

**Implementation:**
```sql
-- Coordinator writes task
INSERT INTO tasks (to_agent, content, status) 
VALUES ('oc-minime-2', 'Research AI', 'pending');

-- Agent checks every 10 seconds
SELECT * FROM tasks WHERE to_agent = 'oc-minime-2' AND status = 'pending';
```

**Pros:**
- ✅ Simple, reliable
- ✅ Works on LAN with NFS/SMB
- ✅ No new infrastructure

**Cons:**
- ❌ 10 second polling delay
- ❌ NFS required

---

## Recommended Approach

### For your setup (separate machines, same LAN):

**Use Solution 4 (Webhook) with Tailscale:**

1. **Install Tailscale** on all machines
   - Gives stable IPs (100.x.x.x)
   - Bypasses firewall/NAT

2. **Simple webhook server** on each machine
   - Node.js/Python script
   - Listens on port 3000
   - Spawns OpenClaw session on POST

3. **Coordinator** sends tasks:
   ```bash
   curl -X POST http://100.x.x.x:3000/task \
     -d '{"task":"Research AI", "from":"oc-minime-1"}'
   ```

**Latency:** Sub-second
**Reliability:** High (Tailscale mesh)
**Complexity:** Medium

---

## Why This Works

| Approach | Latency | Real-Time | Complexity |
|----------|---------|-----------|------------|
| Telegram Polling | 30-60s | ❌ | Low |
| Gateway Wake | 5min | ❌ | Low |
| Long-Polling Sub-Agent | 1-5s | ✅ | High |
| Webhook + Tailscale | <1s | ✅ | Medium |
| SQLite Polling | 10s | ❌ | Low |

**Webhook + Tailscale** hits the sweet spot:
- Fast enough for interactive use
- No persistent sessions needed
- Secure (Tailscale encryption)
- Works across internet

---

## Next Steps

1. Install Tailscale on all machines
2. Test connectivity: `ping 100.x.x.x`
3. Deploy webhook server to one machine
4. Test task handoff
5. Scale to all machines

Want me to set up a webhook prototype on this machine?
