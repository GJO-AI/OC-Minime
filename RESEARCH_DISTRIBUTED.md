# Distributed Multi-Machine OC Instances

## Problem
- Each OC-Minime instance on separate machine
- Need real-time or near real-time coordination
- Git (Option 1) too slow for interactive work
- NFS (Option 5) complex across machines

## Viable Options for Distributed Setup

---

## Option A: Central Redis Broker

**Architecture:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  OC-MiniMe-1 │◄───►│   Redis      │◄───►│  OC-MiniMe-2 │
│  (Machine A) │     │  (Machine C) │     │  (Machine B) │
└──────────────┘     └──────────────┘     └──────────────┘
                            ▲
                            │
                     ┌──────┴──────┐
                     │ OC-MiniMe-3 │
                     │ (Machine D) │
                     └─────────────┘
```

**Setup:**
1. Pick one machine as "hub" (or use cloud Redis)
2. Install Redis: `sudo apt install redis-server`
3. Bind to LAN: `bind 0.0.0.0` in redis.conf
4. Each OC instance publishes/subscribes

**Message format:**
```json
{
  "from": "oc-minime-1",
  "to": "oc-minime-2", 
  "type": "task",
  "task": "Research AI trends",
  "context": "User asked about...",
  "timestamp": "2026-03-06T20:00:00Z"
}
```

**Pros:**
- ✅ Real-time (sub-second)
- ✅ Decoupled - machines don't need to know each other's IPs
- ✅ Reliable delivery
- ✅ Works across internet (if Redis exposed)

**Cons:**
- ❌ Single point of failure (hub machine)
- ❌ Redis needs to be always up
- ❌ Network latency if machines far apart

---

## Option B: Webhook Mesh (Peer-to-Peer)

**Architecture:**
```
┌──────────────┐◄─────────────────►┌──────────────┐
│  OC-MiniMe-1 │                    │  OC-MiniMe-2 │
│  (Machine A) │◄─────────────────►│  (Machine B) │
└──────┬───────┘                    └──────┬───────┘
       ▲                                    ▲
       └──────────────┬─────────────────────┘
                      │
               ┌──────┴──────┐
               │ OC-MiniMe-3 │
               │ (Machine C) │
               └─────────────┘
```

**Setup:**
1. Each machine exposes HTTP endpoint (via OpenClaw Gateway or separate server)
2. Maintain registry: Machine A knows IPs of B, C
3. Send direct HTTP POST with task/context

**Message flow:**
```
OC-1 wants OC-2 to do something:
POST http://192.168.1.12:18789/webhook
→ OC-2 receives, processes, responds
```

**Pros:**
- ✅ No central server needed
- ✅ Direct communication
- ✅ Each machine autonomous

**Cons:**
- ❌ Each machine needs reachable IP
- ❌ Firewall/NAT issues
- ❌ Complex retry logic
- ❌ Discovery problem (how do they find each other?)

---

## Option C: Shared Git with Webhook Triggers

**Architecture:**
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  OC-MiniMe-1 │◄───►│   GitHub     │◄───►│  OC-MiniMe-2 │
│  (Machine A) │     │   Webhooks   │     │  (Machine B) │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Setup:**
1. Use GitHub as coordination hub
2. OC-1 pushes task to repo
3. GitHub webhook notifies OC-2
4. OC-2 pulls, processes, pushes result

**Pros:**
- ✅ Uses existing GitHub setup
- ✅ Reliable delivery via webhooks
- ✅ Audit trail in Git

**Cons:**
- ❌ 2-5 second latency (webhook + git pull)
- ❌ GitHub dependency
- ❌ Rate limits

---

## Option D: MQTT Broker (Lightweight)

Like Redis but lighter weight. Good for IoT-style messaging.

```bash
# Install mosquitto
sudo apt install mosquitto

# Each instance subscribes:
mosquitto_sub -h BROKER_IP -t "oc-minime/team/tasks"

# Publish task:
mosquitto_pub -h BROKER_IP -t "oc-minime/team/tasks" -m '{"task":"..."}'
```

---

## Recommendation for Distributed

### If machines on same LAN:
**Option A (Redis Hub)**
- Pick strongest machine as hub
- All others connect to it
- Real-time, reliable

### If machines across internet:
**Option C (GitHub Webhooks)**
- Slower but works anywhere
- No VPN needed

### If you want no central point:
**Option B (Mesh) with Tailscale**
- Use Tailscale for mesh VPN
- Each machine gets stable IP
- Direct connections

---

## Simplest Working Solution

**Redis Hub on one machine:**

1. **Hub machine** (pick any):
```bash
sudo apt install redis-server
sudo nano /etc/redis/redis.conf
# Change: bind 127.0.0.1 → bind 0.0.0.0
sudo systemctl restart redis
```

2. **Each OC instance:**
- Skill that connects to Redis
- Publishes on `oc-tasks`
- Subscribes to own channel

3. **Task handoff:**
```javascript
// OC-1 assigns task to OC-2
redis.publish('oc-minime-2', JSON.stringify({
  from: 'oc-minime-1',
  task: 'Research X',
  replyTo: 'oc-minime-1'
}))
```

---

## Next Step

Want me to set up Redis on this machine as a hub? Then other machines can connect to `192.168.12.118:6379`.
