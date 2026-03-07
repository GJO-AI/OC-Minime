# Overnight Research: AgentGram Architecture Thoughts

## Key Challenge: OpenClaw Session Lifecycle

OpenClaw agents are **ephemeral** - they spawn, do work, then exit. They cannot:
- Hold persistent WebSocket connections
- Poll continuously in background
- Listen for events while idle

## Solution: Sidecar Pattern (Confirmed)

**Sidecar (Node.js daemon):**
- Runs 24/7 as systemd service
- Holds WebSocket to Hub
- Spawns OpenClaw only when work arrives
- ~50MB RAM, minimal CPU

**Trade-offs:**
- ✅ Works with OpenClaw constraints
- ✅ Reliable message delivery
- ✅ Can restart/recover independently
- ❌ Extra process per machine
- ❌ More moving parts

## Research: Message Queue Options

### Redis vs SQLite vs RabbitMQ

| Feature | Redis | SQLite | RabbitMQ |
|---------|-------|--------|----------|
| Persistence | Optional | Always | Always |
| Complexity | Medium | Low | High |
| Zero-config | No | Yes | No |
| Retry logic | Manual | Manual | Built-in |
| Our use case | Good | ✅ Best | Overkill |

**Decision:** SQLite for MVP
- Zero configuration
- Survives restarts
- ACID guarantees
- Simple backup (copy file)

## Research: WebSocket vs HTTP Long-Polling

For Sidecar → Hub connection:

**WebSocket:**
- ✅ True bidirectional
- ✅ Lower latency
- ❌ Harder to debug
- ❌ Firewall issues

**HTTP Long-Polling:**
- ✅ Works through any firewall
- ✅ Easier to debug
- ✅ Can use curl for testing
- ❌ Higher latency (~1s)

**Decision:** WebSocket for production, HTTP fallback for debugging

## Potential Failure Modes & Mitigations

### 1. Sidecar Crashes
**Mitigation:** systemd auto-restart, persistent queue in SQLite

### 2. Hub Goes Down
**Mitigation:** Sidecar queues locally, retries with backoff

### 3. OpenClaw Fails to Spawn
**Mitigation:** Sidecar catches error, reports failure to Hub, Hub retries on other agent

### 4. Network Partition
**Mitigation:** Heartbeat timeout, mark agent offline, reassign tasks

### 5. Infinite Loop
**Mitigation:** Max retries (3), timeout per task (30 min), human escalation

## Simplifications for MVP

**Week 1-2 (MVP):**
- ✅ SQLite (not Redis)
- ✅ Single Hub (not clustered)
- ✅ WebSocket only (no fallback)
- ✅ Simple retry (exponential backoff)
- ❌ No load balancing (round-robin)
- ❌ No advanced scheduling (FIFO)

**Week 3+ (Add if needed):**
- Priority queues
- Load balancing by capability
- Circuit breakers
- Metrics/monitoring

## Dashboard Requirement Analysis

**Why dashboard must work:**
- Proof that HTTP server works
- Proof that file serving works
- Proof that the machine is reachable
- Visual confirmation of system health

**If dashboard breaks, these break:**
- Hub API (same HTTP server pattern)
- Sidecar webhook (same port binding)
- File serving (same static file logic)

**Dashboard is the canary.**

## Insight: Failed Attempts Analysis

### Attempt 1: Redis Pub/Sub
**Failed because:** Expected OpenClaw to subscribe and listen
**Reality:** OpenClaw can't hold subscriber connection

### Attempt 2: WebSocket Hub
**Failed because:** Expected agents to maintain persistent WebSocket
**Reality:** OpenClaw sessions end after response

### Attempt 3: Telegram Polling
**Failed because:** Required human to say "check coms"
**Reality:** Not autonomous, human bottleneck

### This Attempt: Sidecar + Hub
**Why it works:** Sidecar handles persistence, OpenClaw handles work
**Separation of concerns:** Listener vs Worker

## Code Structure Thoughts

### Hub Structure
```
src/hub/
├── server.js          # HTTP/WebSocket server
├── database.js        # SQLite wrapper
├── agents.js          # Agent registry
├── tasks.js           # Task queue
├── workflows.js       # DAG engine
├── router.js          # Message routing
└── api/               # REST endpoints
    ├── agents.js
    ├── tasks.js
    ├── workflows.js
    └── health.js
```

### Sidecar Structure
```
src/sidecar/
├── adapter.js         # Main entry point
├── hub-connection.js  # WebSocket client
├── gateway.js         # OpenClaw spawning
├── task-handler.js    # Process incoming tasks
├── result-sender.js   # Send results back
└── health.js          # Heartbeat
```

## Testing Strategy

### Unit Tests (Not Critical for MVP)
- Database queries
- Message formatting
- Retry logic

### Integration Tests (Critical)
1. Sidecar connects to Hub
2. Hub assigns task to Sidecar
3. Sidecar spawns OpenClaw
4. OpenClaw completes task
5. Result returns to Hub

### End-to-End Test (Phase 2 MVP)
1. Submit workflow via API
2. Instance 1 receives task
3. Instance 1 completes
4. Instance 2 auto-triggered
5. Instance 2 completes
6. Result returned to user

## Security Considerations

**For MVP:**
- HTTP (not HTTPS) on LAN
- Simple token auth
- No encryption needed (trusted network)

**For Production:**
- HTTPS/WSS
- mTLS between sidecars
- OAuth for Mission Control
- Audit logging

## Performance Expectations

**Latency:**
- Task assignment: < 1 second
- Agent spawn: 2-5 seconds
- Task completion: depends on work
- End-to-end workflow: minutes to hours

**Throughput:**
- Hub: 1000 tasks/minute (easily)
- Sidecar: 1 task at a time (serial)
- Can scale by adding agents

**Bottlenecks:**
- OpenClaw spawn time (2-5s)
- LLM API rate limits
- Git operations

## Questions for Tomorrow

1. Should sidecar spawn multiple OpenClaw sessions in parallel?
   - Pro: Higher throughput
   - Con: More complex, resource contention
   - MVP: Serial only

2. How to handle long-running tasks (> 30 min)?
   - Option: Extend timeout
   - Option: Checkpoint/resume
   - Option: Human approval to continue
   - MVP: Simple timeout, fail if exceeded

3. Should tasks be idempotent?
   - Yes, always
   - Use task_id for deduplication
   - Safe to retry

4. What if agent crashes mid-task?
   - Hub times out
   - Retries on another agent
   - Partial work may be lost
   - MVP: Acceptable, document limitation

## Tomorrow's Build Order

**Day 1:**
1. Create Hub project structure
2. SQLite schema
3. Agent registry API
4. Basic WebSocket server

**Day 2:**
1. Sidecar connection to Hub
2. Task assignment flow
3. OpenClaw spawn integration
4. Result return

**Day 3:**
1. Test on OC-MiniMe
2. Setup Mini PC 1
3. Two-machine test
4. Debug issues

**Day 4-5:**
1. Polish
2. Documentation
3. Prepare for Phase 2

## Final Thoughts

**What will make this succeed:**
1. Simplicity - do less, do it well
2. Separation - sidecar persists, OpenClaw works
3. Reliability - retry, recover, don't lose data
4. Testing - validate each piece before next

**What will make this fail:**
1. Over-engineering
2. Skipping tests
3. Adding machines before basics work
4. Human-in-the-loop (Telegram)

**The goal:**
Say one sentence, get result. No babysitting.

Ready to build. 🚀
