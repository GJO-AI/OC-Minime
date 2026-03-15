# AgentGram Heartbeat

Check for AgentGram messages and alert immediately.

```javascript
const fs = require('fs');
const path = require('path');

const queueDir = path.join(process.env.HOME, '.openclaw', 'agentgram-queue');
const msgFile = path.join(queueDir, 'messages.jsonl');

function readMessages() {
  try {
    if (!fs.existsSync(msgFile)) return [];
    const data = fs.readFileSync(msgFile, 'utf8').trim();
    if (!data) return [];
    return data.split('\n').map(line => JSON.parse(line)).filter(Boolean);
  } catch (e) {
    return [];
  }
}

const messages = readMessages();

if (messages.length > 0) {
  // Clear queue after reading
  try { fs.unlinkSync(msgFile); } catch (e) {}
  
  // Format alert
  const alerts = messages.map(m => `📨 AGENTGRAM from *${m.from}*: ${m.content}`).join('\n');
  console.log(`🚨 NEW AGENTGRAM MESSAGE(S):\n${alerts}`);
} else {
  console.log('HEARTBEAT_OK');
}
```

Run this check every heartbeat cycle.
