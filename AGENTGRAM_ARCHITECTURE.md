# AgentGram: Distributed Agent Orchestration Platform

## Overview
A distributed task orchestration system for OpenClaw agents with:
- Central message hub (like Telegram service)
- Service registry (capability-based routing)
- Dependency-aware task scheduling
- Workflow DAG execution

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENTGRAM HUB                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │  API Gateway    │  │  Message Bus    │  │  Workflow Engine            │   │
│  │  (REST/WebSocket)│  │  (Redis/RabbitMQ)│  │  (DAG Scheduler)            │   │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘   │
│           │                    │                         │                    │
│  ┌────────┴────────────────────┴─────────────────────────┴───────────────┐   │
│  │                         Core Services                                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │   │
│  │  │   Registry   │  │ Task Queue   │  │   State DB   │  │  Audit    │  │   │
│  │  │  (Who/What)  │  │ (Priorities) │  │ (SQLite/PG)  │  │  (Git)    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘  │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
         ▼                          ▼                          ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   OC-Instance-1  │    │   OC-Instance-2  │    │   OC-Instance-3  │
│  ┌──────────────┐│    │  ┌──────────────┐│    │  ┌──────────────┐│
│  │ AgentGram    ││    │  │ AgentGram    ││    │  │ AgentGram    ││
│  │ Adapter      ││    │  │ Adapter      ││    │  │ Adapter      ││
│  │ (Channel)    ││    │  │ (Channel)    ││    │  │ (Channel)    ││
│  └──────┬───────┘│    │  └──────┬───────┘│    │  └──────┬───────┘│
│         │        │    │         │        │    │         │        │
│  ┌──────┴───────┐│    │  ┌──────┴───────┐│    │  ┌──────┴───────┐│
│  │ Main Agent   ││    │  │ Main Agent   ││    │  │ Main Agent   ││
│  │  ┌────────┐  ││    │  │  ┌────────┐  ││    │  │  ┌────────┐  ││
│  │  │Sub-Agent│  ││    │  │  │Sub-Agent│  ││    │  │  │Sub-Agent│  ││
│  │  └────────┘  ││    │  │  └────────┘  ││    │  │  └────────┘  ││
│  └──────────────┘│    │  └──────────────┘│    │  └──────────────┘│
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## Core Components

### 1. AgentGram Hub

**Responsibilities:**
- Service registry (which agents exist, their capabilities)
- Task routing (who should do what)
- Workflow orchestration (dependencies, sequencing)
- State management (what's running, what's done)
- Message brokering (relay between agents)

**API Endpoints:**
```http
# Agent Registration
POST /api/v1/agents/register
{
  "agent_id": "oc-minime-2",
  "instance_id": "machine-b",
  "webhook_url": "http://192.168.12.101:3000",
  "capabilities": ["vibe-coding", "testing", "nodejs"],
  "capacity": 3,  // Max concurrent tasks
  "metadata": {
    "gpu": true,
    "location": "us-west"
  }
}

# Task Submission
POST /api/v1/tasks
{
  "workflow_id": "wf-123",
  "task_id": "task-456",
  "type": "vibe-code",
  "content": "Build a React component for...",
  "requirements": {
    "capabilities": ["vibe-coding", "react"],
    "gpu": false
  },
  "dependencies": [],  // Can run immediately
  "priority": "high",
  "timeout": 1800  // seconds
}

# Task with Dependencies
POST /api/v1/tasks
{
  "workflow_id": "wf-123",
  "task_id": "task-789",
  "type": "vibe-test",
  "content": "Test the component from task-456",
  "dependencies": ["task-456"],  // Wait for this
  "priority": "normal"
}

# Query Task Status
GET /api/v1/tasks/{task_id}

# Send Message to Agent
POST /api/v1/messages
{
  "to": "oc-minime-2",
  "from": "coordinator",
  "thread_id": "wf-123",
  "content": "Please clarify...",
  "context": { ... }
}
```

### 2. Service Registry

**Schema:**
```sql
CREATE TABLE agents (
    agent_id TEXT PRIMARY KEY,
    instance_id TEXT,
    webhook_url TEXT NOT NULL,
    capabilities JSON,  -- ["vibe-coding", "react", "testing"]
    capacity INTEGER DEFAULT 1,
    current_load INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('online', 'offline', 'busy')),
    last_heartbeat DATETIME,
    metadata JSON,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agent_capabilities (
    capability TEXT,
    agent_id TEXT,
    proficiency INTEGER CHECK (proficiency BETWEEN 1 AND 10),
    FOREIGN KEY (agent_id) REFERENCES agents(agent_id)
);

-- Index for fast capability lookup
CREATE INDEX idx_capabilities ON agent_capabilities(capability, proficiency DESC);
```

**Routing Logic:**
```python
def find_best_agent(task_requirements):
    # Match capabilities
    candidates = agents.where(
        capabilities.contains_all(task_requirements['capabilities'])
    ).where(
        status == 'online',
        current_load < capacity
    )
    
    # Score by:
    # - Capability match (exact matches score higher)
    # - Current load (less busy = higher score)
    # - Proficiency rating
    # - Proximity (same network/datacenter)
    
    return candidates.order_by(score DESC).first()
```

### 3. Task Queue & Workflow Engine

**Task States:**
```
pending → assigned → running → [completed | failed | cancelled]
   ↓
waiting_for_dependencies
```

**Workflow DAG:**
```yaml
workflow:
  id: "build-feature-x"
  name: "Build Feature X"
  
  tasks:
    - id: "research"
      type: "research"
      agent_profile: "researcher"
      content: "Research best practices for..."
      
    - id: "design"
      type: "vibe-design"
      agent_profile: "designer"
      content: "Create design based on research"
      dependencies: ["research"]
      
    - id: "implement"
      type: "vibe-code"
      agent_profile: "senior-dev"
      content: "Implement the design"
      dependencies: ["design"]
      
    - id: "test"
      type: "vibe-test"
      agent_profile: "qa-engineer"
      content: "Test the implementation"
      dependencies: ["implement"]
      
    - id: "review"
      type: "code-review"
      agent_profile: "tech-lead"
      content: "Review the implementation and tests"
      dependencies: ["implement", "test"]  # Both must complete
```

**Execution:**
1. Parse workflow into DAG
2. Find tasks with no dependencies (ready to run)
3. Assign to available agents based on `agent_profile`
4. When task completes, check if dependents can start
5. Repeat until all tasks complete or fail

### 4. AgentGram Adapter (Per Instance)

**Runs on each OC-Instance machine:**

```javascript
// agentgram-adapter.js
const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');

class AgentGramAdapter {
  constructor(config) {
    this.agent_id = config.agent_id;
    this.hub_url = config.hub_url;
    this.gateway_url = config.gateway_url;
    this.webhook_port = config.webhook_port;
    
    this.active_threads = new Map(); // thread_id -> session_key
  }

  async start() {
    // 1. Start webhook server
    this.startWebhookServer();
    
    // 2. Register with Hub
    await this.registerWithHub();
    
    // 3. Connect to Gateway (as channel)
    this.connectToGateway();
    
    // 4. Start heartbeat
    this.startHeartbeat();
  }

  startWebhookServer() {
    const app = express();
    app.use(express.json());

    // Hub sends tasks here
    app.post('/webhook/task', async (req, res) => {
      const { task_id, thread_id, content, context } = req.body;
      
      // Acknowledge immediately
      res.json({ status: 'accepted', agent: this.agent_id });
      
      // Forward to OpenClaw Gateway as incoming message
      await this.injectToGateway({
        thread_id,
        content: `[Task ${task_id}] ${content}`,
        context
      });
    });

    // Hub sends messages here
    app.post('/webhook/message', async (req, res) => {
      const { thread_id, content, from } = req.body;
      
      res.json({ status: 'accepted' });
      
      await this.injectToGateway({
        thread_id,
        content: `[From ${from}] ${content}`,
        from
      });
    });

    app.listen(this.webhook_port, '0.0.0.0');
  }

  async injectToGateway(message) {
    // Use OpenClaw Gateway WebSocket API
    // Create or reuse session for thread_id
    // Inject message as if from Telegram/Discord
    
    const session_key = await this.getOrCreateSession(message.thread_id);
    
    await this.gateway_ws.send(JSON.stringify({
      type: 'message',
      session_key,
      content: message.content,
      metadata: message.context
    }));
  }

  async registerWithHub() {
    await axios.post(`${this.hub_url}/api/v1/agents/register`, {
      agent_id: this.agent_id,
      webhook_url: `http://${getIp()}:${this.webhook_port}`,
      capabilities: await this.detectCapabilities(),
      capacity: 3
    });
  }

  async detectCapabilities() {
    // Read from agent config or detect from installed skills
    return ['vibe-coding', 'testing', 'nodejs', 'react'];
  }

  startHeartbeat() {
    setInterval(async () => {
      await axios.post(`${this.hub_url}/api/v1/agents/heartbeat`, {
        agent_id: this.agent_id,
        current_load: this.active_threads.size,
        status: this.active_threads.size > 0 ? 'busy' : 'online'
      });
    }, 30000); // Every 30 seconds
  }
}
```

---

## Task Types & Routing

### Task Type Registry

```json
{
  "task_types": {
    "research": {
      "description": "Research a topic and compile findings",
      "required_capabilities": ["research", "web-search"],
      "estimated_duration": "10-30m",
      "output_format": "markdown-report",
      "agent_profile": "researcher"
    },
    "vibe-code": {
      "description": "Implement feature from spec",
      "required_capabilities": ["vibe-coding", "coding"],
      "estimated_duration": "30-60m",
      "output_format": "git-commit",
      "agent_profile": "developer"
    },
    "vibe-test": {
      "description": "Test implementation and report bugs",
      "required_capabilities": ["vibe-testing", "testing"],
      "estimated_duration": "15-30m",
      "output_format": "test-report",
      "agent_profile": "qa-engineer"
    },
    "code-review": {
      "description": "Review code for quality",
      "required_capabilities": ["code-review"],
      "estimated_duration": "10-20m",
      "output_format": "review-comments",
      "agent_profile": "senior-dev"
    }
  }
}
```

### Agent Profiles

```json
{
  "profiles": {
    "researcher": {
      "capabilities": ["research", "web-search", "analysis"],
      "models": ["kimi-coding/k2p5"],
      "skills": ["web-search", "summarize"]
    },
    "developer": {
      "capabilities": ["vibe-coding", "coding", "git"],
      "models": ["kimi-coding/k2p5"],
      "skills": ["coding-agent", "github"]
    },
    "qa-engineer": {
      "capabilities": ["vibe-testing", "testing"],
      "models": ["kimi-coding/k2p5"],
      "skills": ["testing", "playwright"]
    }
  }
}
```

---

## Deployment Model

### Hub Deployment
```bash
# Dedicated machine or main instance
docker run -d \
  --name agentgram-hub \
  -p 4000:4000 \
  -v agentgram-data:/data \
  agentgram/hub:latest
```

### Adapter Deployment (per OC-Instance)
```bash
# On each agent machine
npm install -g agentgram-adapter

agentgram-adapter \
  --agent-id "oc-minime-2" \
  --hub-url "http://hub:4000" \
  --gateway-url "ws://localhost:18789" \
  --webhook-port 3000 \
  --capabilities "vibe-coding,testing,nodejs"
```

---

## Scaling Considerations

### Phase 1: Single Hub (2-10 agents)
- SQLite database
- Single Hub instance
- Redis for message queue
- Manual agent registration

### Phase 2: Multi-Hub (10-50 agents)
- PostgreSQL database
- 2-3 Hub instances behind load balancer
- RabbitMQ for message queue
- Auto-discovery via heartbeat

### Phase 3: Federation (50+ agents)
- Regional Hubs
- Inter-hub communication
- Distributed consensus (Raft)
- Auto-scaling based on load

---

## Why This Works

| Problem | Previous Attempt | AgentGram Solution |
|---------|------------------|-------------------|
| Event triggering | Redis/WebSocket persistent connection | HTTP POST webhook (fire-and-forget) |
| Session context | Spawn run session (one-shot) | Thread-based sessions (like Telegram) |
| Agent discovery | Hardcoded IPs | Service registry with heartbeat |
| Task routing | Manual assignment | Capability-based auto-routing |
| Dependencies | N/A | DAG workflow engine |
| Multi-instance | Single point | Distributed with Hub |

---

## MVP Scope (2 weeks)

**Week 1:**
- Hub with HTTP API
- Agent registration
- Task submission
- Basic routing

**Week 2:**
- Adapter on 2 machines
- Thread-based sessions
- Dependency resolution
- Simple workflow execution

**Test:**
- Submit workflow with 3 tasks
- Verify dependencies work
- Check agent utilization

---

## Open Questions

1. **Conflict resolution:** Two agents edit same file?
2. **Secrets:** How do agents share API keys securely?
3. **Debugging:** How to trace a workflow across agents?
4. **Cost tracking:** Who pays for which LLM calls?

Want me to detail the MVP architecture?
