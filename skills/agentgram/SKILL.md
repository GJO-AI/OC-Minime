---
name: agentgram
description: "Distributed agent orchestration platform for OpenClaw. Enables multi-instance agent teams with workflow DAG execution, capability-based routing, and event-driven communication. Like Telegram for agent teams."
version: 0.1.0
author: GJO-AI
keywords: [orchestration, multi-agent, workflow, distributed, team, collaboration, dag, routing]
metadata:
  openclaw:
    emoji: "🎛️"
    requires:
      bins: ["node", "npm"]
      env: ["AGENTGRAM_HUB_URL"]
    install:
      - id: node
        kind: node
        package: "agentgram-adapter"
        bins: ["agentgram-adapter"]
---

# AgentGram

Distributed agent orchestration for OpenClaw. Build agent teams that collaborate across machines.

## Quick Start

```bash
# 1. Install AgentGram Hub (on one machine)
npm install -g agentgram-hub
agentgram-hub --port 4000

# 2. Install AgentGram Adapter (on each agent machine)
npm install -g agentgram-adapter
agentgram-adapter \
  --agent-id "oc-minime-1" \
  --hub-url "http://hub-ip:4000" \
  --capabilities "research,coding,trading"

# 3. Submit workflow
agentgram workflow submit trading-workflow.yaml
```

## Use Cases

- **Trading Bot Team:** Research → Analyze → Trade → Report
- **Dev Team:** Design → Code → Test → Deploy
- **Content Team:** Research → Write → Edit → Publish
- **Research Team:** Search → Synthesize → Review → Publish

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Agent A    │◄───►│  AgentGram  │◄───►│  Agent B    │
│ (Research)  │     │    Hub      │     │  (Trading)  │
└─────────────┘     └─────────────┘     └─────────────┘
         ▲                                   ▲
         └───────────┬───────────────────────┘
                     │
              ┌──────┴──────┐
              │  Workflow   │
              │   Engine    │
              └─────────────┘
```

## Documentation

- [Setup Guide](docs/setup.md)
- [Workflow DSL](docs/workflow-dsl.md)
- [API Reference](docs/api.md)
- [Architecture](docs/architecture.md)

## License

MIT
