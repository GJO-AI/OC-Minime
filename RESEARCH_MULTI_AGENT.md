# Multi-Instance Agent Collaboration Research

## Problem Statement
Multiple OpenClaw instances (OC-Minime agents) need to:
- Communicate in real-time or near real-time
- Share context and state
- Coordinate tasks without conflicts
- Work as a team

## Options Analysis

---

## Option 1: Git-Based Shared Workspace (Async)
**Approach:** All instances share a Git repository as their workspace

**How it works:**
- Each instance has the same Git repo cloned
- They commit/push changes regularly
- Shared files: MEMORY.md, .learnings/, TASKS.md
- Conflicts resolved via merge

**Pros:**
- ✅ Simple, already implemented
- ✅ Version history
- ✅ No extra infrastructure
- ✅ Works offline, syncs when online

**Cons:**
- ❌ Not real-time (seconds/minutes delay)
- ❌ Merge conflicts
- ❌ No orchestration

**Best for:** Document sharing, async collaboration

---

## Option 2: Shared Message Queue (Redis/MQTT)
**Approach:** Central message broker that all instances connect to

**How it works:**
- Install Redis or MQTT broker (mosquitto)
- Each instance publishes/subscribes to channels
- Topics: `oc-minime-1`, `oc-minime-2`, `team-broadcast`
- Messages: JSON with task, context, response

**Pros:**
- ✅ Real-time (milliseconds)
- ✅ Decoupled - instances don't know about each other directly
- ✅ Scalable
- ✅ Existing OpenClaw message skills

**Cons:**
- ❌ Requires broker infrastructure
- ❌ Added complexity
- ❌ Need to handle message persistence

**Best for:** Real-time task handoff, status updates

**Implementation:**
```bash
# Install Redis
sudo apt install redis-server

# Each instance connects
redis-cli SUBSCRIBE oc-team-channel
```

---

## Option 3: Coordinator Pattern (Hub & Spoke)
**Approach:** One "coordinator" instance, multiple "worker" instances

**How it works:**
- Coordinator = main brain, has full context
- Workers = specialized (coding, research, etc.)
- Coordinator spawns tasks via `sessions_spawn` to workers
- Workers report back via `sessions_send`

**Pros:**
- ✅ Clear hierarchy
- ✅ Central state management
- ✅ Works with existing OpenClaw tools
- ✅ Single source of truth

**Cons:**
- ❌ Single point of failure
- ❌ Coordinator can be bottleneck
- ❌ Not truly peer-to-peer

**Best for:** Master/worker workflows

**Implementation:**
```javascript
// Coordinator spawns work
sessions_spawn({
  target: "worker-instance-key",
  task: "Research X",
  model: "kimi-coding/k2p5"
})
```

---

## Option 4: Shared SQLite with Litestream
**Approach:** Shared database that syncs between instances

**How it works:**
- SQLite database in shared location (S3, NFS)
- Litestream replicates changes
- All instances read/write same DB
- Tables: tasks, messages, context

**Pros:**
- ✅ Structured data
- ✅ ACID transactions
- ✅ Automatic conflict resolution
- ✅ Existing skills (elite-longterm-memory uses SQLite)

**Cons:**
- ❌ Requires S3 or shared storage
- ❌ Write contention
- ❌ Setup complexity

**Best for:** Shared state, task queue

---

## Option 5: File-Based Messaging (Simple)
**Approach:** Shared directory with JSON message files

**How it works:**
- Shared NFS/SMB mount at `/shared/oc-messages/`
- Each instance polls for new `.msg` files
- Format: `{from, to, timestamp, payload}`
- Cleanup old messages periodically

**Pros:**
- ✅ Very simple
- ✅ No new services
- ✅ Works with any shared filesystem

**Cons:**
- ❌ Polling delay (1-5 seconds)
- ❌ File cleanup needed
- ❌ No delivery guarantees

**Best for:** Simple setups, existing NAS

---

## Option 6: Webhook Mesh (Direct)
**Approach:** Each instance exposes webhook endpoint

**How it works:**
- Instance A has endpoint: `POST /webhook/message`
- Instance B sends messages to A's endpoint
- JSON payload with task/context
- Requires each instance to be reachable

**Pros:**
- ✅ Direct communication
- ✅ No central broker
- ✅ HTTP standard

**Cons:**
- ❌ Each instance needs public IP or tunnel
- ❌ Firewall issues
- ❌ Complex discovery

**Best for:** Cloud deployments, public endpoints

---

## Recommendation

### For simple team collaboration:
**Option 1 (Git) + Option 5 (File messages)**
- Git for shared memory/docs
- Simple file messages for coordination
- 1-5 second latency acceptable

### For real-time coordination:
**Option 3 (Coordinator pattern)**
- One "team lead" instance
- Workers report via sessions_send
- Use existing OpenClaw tools

### For production scale:
**Option 2 (Redis)**
- Fast, reliable
- Existing MQTT/Redis skills
- Can add persistence

---

## Hybrid Approach (Recommended)

**Architecture:**
```
┌─────────────────────────────────────┐
│         Shared Git Repo              │
│   (MEMORY.md, .learnings/, docs)    │
└─────────────────────────────────────┘
           ▲            ▲
           │            │
    ┌──────┴────┐  ┌────┴──────┐
    │ OC-MiniMe │  │ OC-Worker │
    │ (Main)    │  │ (Coding)  │
    └─────┬─────┘  └────┬──────┘
          │             │
          └──────┬──────┘
                 │
         ┌───────┴───────┐
         │  Redis/MQTT   │
         │  (Real-time)  │
         └───────────────┘
```

**Workflow:**
1. Main instance assigns task via Redis
2. Worker instance picks up task
3. Worker writes results to Git
4. Main instance reviews/merges

---

## Next Steps

1. **Pick one pattern** (recommend Git+Redis hybrid)
2. **Prototype with 2 instances**
3. **Test task handoff**
4. **Measure latency**
5. **Scale if successful**

---

*Research compiled for OC-Minime team collaboration*
