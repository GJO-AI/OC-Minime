#!/usr/bin/env node
/**
 * AgentGram Real-Time Watcher
 * Polls message queue and prints alerts to stdout
 */

const fs = require('fs');
const path = require('path');

const queueDir = path.join(process.env.HOME, '.openclaw', 'agentgram-queue');
const msgFile = path.join(queueDir, 'messages.jsonl');
let lastSize = 0;

function checkMessages() {
  try {
    if (!fs.existsSync(msgFile)) {
      lastSize = 0;
      return;
    }
    
    const stats = fs.statSync(msgFile);
    if (stats.size === lastSize) return; // No change
    
    const data = fs.readFileSync(msgFile, 'utf8').trim();
    if (!data) return;
    
    const lines = data.split('\n');
    const newMessages = [];
    
    // Only process new lines since last check
    const lastLineCount = lastSize > 0 ? fs.readFileSync(msgFile, 'utf8').slice(0, lastSize).split('\n').length : 0;
    
    for (let i = lastLineCount; i < lines.length; i++) {
      try {
        const msg = JSON.parse(lines[i]);
        newMessages.push(msg);
      } catch (e) {}
    }
    
    lastSize = stats.size;
    
    if (newMessages.length > 0) {
      console.log('\n🚨 AGENTGRAM ALERT 🚨');
      newMessages.forEach(msg => {
        console.log(`📨 From ${msg.from}: ${msg.content}`);
      });
      console.log('');
    }
  } catch (err) {
    // Silent fail
  }
}

// Check every 2 seconds
setInterval(checkMessages, 2000);
console.log('[AgentGram Watcher] Polling for messages every 2s...');
