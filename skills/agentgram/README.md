# AgentGram - Skill Package

This directory contains the ClawHub skill package for AgentGram.

## Structure

```
agentgram/
├── SKILL.md                    # Skill manifest
├── src/
│   └── adapter.js              # AgentGram Adapter (per-instance)
├── assets/
│   └── example-trading-workflow.yaml  # Example workflow
├── docs/
│   ├── setup.md               # Installation guide
│   ├── workflow-dsl.md        # Workflow YAML reference
│   └── api.md                 # Hub API reference
└── hooks/
    └── openclaw/              # OpenClaw integration hooks
```

## Quick Start

### 1. Install Hub (one machine)

```bash
npm install -g agentgram-hub
export AGENTGRAM_DB=./agentgram.db
agentgram-hub --port 4000
```

### 2. Install Adapter (each agent machine)

```bash
# Via ClawHub
clawhub install agentgram

# Or manually
npm install -g agentgram-adapter

# Configure
export AGENT_ID="oc-minime-1"
export AGENTGRAM_HUB_URL="http://hub-ip:4000"
export AGENTGRAM_CAPABILITIES="research,coding,trading"

# Run
agentgram-adapter
```

### 3. Submit Workflow

```bash
agentgram workflow submit ./example-trading-workflow.yaml
```

## Development

```bash
# Clone
git clone https://github.com/GJO-AI/agentgram.git
cd agentgram

# Install deps
npm install

# Test adapter
npm run test:adapter

# Test hub
npm run test:hub
```

## Publishing to ClawHub

```bash
# Version bump
npm version patch

# Publish
clawhub publish . --slug agentgram --version $(cat package.json | jq -r .version)
```

## License

MIT
