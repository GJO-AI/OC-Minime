#!/usr/bin/env node
/**
 * AgentGram Adapter
 * 
 * Runs on each OpenClaw instance.
 * Receives webhooks from AgentGram Hub.
 * Injects messages into OpenClaw Gateway.
 */

const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class AgentGramAdapter {
  constructor(config) {
    this.agentId = config.agentId;
    this.hubUrl = config.hubUrl;
    this.gatewayUrl = config.gatewayUrl || 'ws://localhost:18789';
    this.port = config.port || 3000;
    this.capabilities = config.capabilities || [];
    
    this.activeThreads = new Map();
    this.gatewayWs = null;
    this.heartbeatInterval = null;
  }

  async start() {
    console.log(`🎛️  AgentGram Adapter starting for ${this.agentId}...`);
    
    // 1. Connect to OpenClaw Gateway
    await this.connectToGateway();
    
    // 2. Start webhook server
    this.startWebhookServer();
    
    // 3. Register with Hub
    await this.registerWithHub();
    
    // 4. Start heartbeat
    this.startHeartbeat();
    
    console.log(`✅ Adapter ready on port ${this.port}`);
  }

  connectToGateway() {
    return new Promise((resolve, reject) => {
      this.gatewayWs = new WebSocket(this.gatewayUrl);
      
      this.gatewayWs.on('open', () => {
        console.log('✅ Connected to OpenClaw Gateway');
        resolve();
      });
      
      this.gatewayWs.on('error', (err) => {
        console.error('❌ Gateway connection error:', err.message);
        reject(err);
      });
      
      this.gatewayWs.on('close', () => {
        console.log('⚠️  Gateway connection closed, retrying...');
        setTimeout(() => this.connectToGateway(), 5000);
      });
    });
  }

  startWebhookServer() {
    const app = express();
    app.use(express.json());

    // Health check
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        agent: this.agentId,
        activeThreads: this.activeThreads.size,
        capabilities: this.capabilities
      });
    });

    // Receive task from Hub
    app.post('/webhook/task', async (req, res) => {
      try {
        const { taskId, workflowId, type, content, context, replyTo } = req.body;
        
        console.log(`📥 Received task ${taskId} (${type})`);
        
        // Acknowledge immediately
        res.json({ status: 'accepted', agent: this.agentId, taskId });
        
        // Inject into OpenClaw as incoming message
        await this.injectMessage({
          threadId: workflowId,
          taskId,
          type,
          content,
          context,
          replyTo
        });
        
      } catch (err) {
        console.error('❌ Error handling task:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // Receive direct message from Hub
    app.post('/webhook/message', async (req, res) => {
      try {
        const { threadId, content, from, context } = req.body;
        
        console.log(`📥 Message from ${from} in thread ${threadId}`);
        
        res.json({ status: 'accepted' });
        
        await this.injectMessage({
          threadId,
          content: `[From ${from}] ${content}`,
          context
        });
        
      } catch (err) {
        console.error('❌ Error handling message:', err);
        res.status(500).json({ error: err.message });
      }
    });

    // Task result callback (from agent)
    app.post('/webhook/result', async (req, res) => {
      try {
        const { taskId, result, status, artifacts } = req.body;
        
        console.log(`📤 Task ${taskId} completed with status: ${status}`);
        
        // Forward to Hub
        await axios.post(`${this.hubUrl}/api/v1/tasks/${taskId}/result`, {
          agentId: this.agentId,
          result,
          status,
          artifacts,
          completedAt: new Date().toISOString()
        });
        
        res.json({ status: 'ok' });
        
      } catch (err) {
        console.error('❌ Error forwarding result:', err);
        res.status(500).json({ error: err.message });
      }
    });

    app.listen(this.port, '0.0.0.0', () => {
      console.log(`🌐 Webhook server listening on port ${this.port}`);
    });
  }

  async injectMessage({ threadId, taskId, type, content, context, replyTo }) {
    // Create or get session for this thread
    const sessionKey = await this.getOrCreateSession(threadId);
    
    // Format message for OpenClaw
    const message = {
      type: 'inbound',
      sessionKey,
      channel: 'agentgram',
      content: this.formatMessage({ taskId, type, content, context }),
      metadata: {
        agentgram: true,
        taskId,
        workflowId: threadId,
        replyTo,
        context
      }
    };
    
    // Send to Gateway
    this.gatewayWs.send(JSON.stringify(message));
    
    console.log(`📤 Injected message to session ${sessionKey}`);
  }

  formatMessage({ taskId, type, content, context }) {
    let formatted = '';
    
    if (type) {
      formatted += `[Task: ${type}]\n`;
    }
    if (taskId) {
      formatted += `[ID: ${taskId}]\n`;
    }
    if (context?.from) {
      formatted += `[From: ${context.from}]\n`;
    }
    
    formatted += `\n${content}`;
    
    if (context?.dependencies?.length) {
      formatted += `\n\nDependencies: ${context.dependencies.join(', ')}`;
    }
    
    return formatted;
  }

  async getOrCreateSession(threadId) {
    if (this.activeThreads.has(threadId)) {
      return this.activeThreads.get(threadId);
    }
    
    // Create new session via Gateway API
    const sessionKey = `agentgram:${this.agentId}:${threadId}:${uuidv4()}`;
    this.activeThreads.set(threadId, sessionKey);
    
    console.log(`🆕 Created session ${sessionKey} for thread ${threadId}`);
    
    return sessionKey;
  }

  async registerWithHub() {
    try {
      const ip = await this.getIp();
      const webhookUrl = `http://${ip}:${this.port}`;
      
      await axios.post(`${this.hubUrl}/api/v1/agents/register`, {
        agentId: this.agentId,
        webhookUrl,
        capabilities: this.capabilities,
        capacity: 3,  // Max concurrent tasks
        metadata: {
          platform: 'openclaw',
          version: '0.1.0'
        }
      });
      
      console.log(`✅ Registered with Hub at ${this.hubUrl}`);
      
    } catch (err) {
      console.error('❌ Failed to register with Hub:', err.message);
      // Retry in 10 seconds
      setTimeout(() => this.registerWithHub(), 10000);
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await axios.post(`${this.hubUrl}/api/v1/agents/heartbeat`, {
          agentId: this.agentId,
          currentLoad: this.activeThreads.size,
          status: this.activeThreads.size > 0 ? 'busy' : 'online',
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('❌ Heartbeat failed:', err.message);
      }
    }, 30000);  // Every 30 seconds
  }

  async getIp() {
    // Get local IP
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          return net.address;
        }
      }
    }
    return 'localhost';
  }

  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.gatewayWs) {
      this.gatewayWs.close();
    }
    console.log('🛑 Adapter stopped');
  }
}

// CLI entry point
if (require.main === module) {
  const config = {
    agentId: process.env.AGENT_ID || require('os').hostname(),
    hubUrl: process.env.AGENTGRAM_HUB_URL,
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'ws://localhost:18789',
    port: parseInt(process.env.AGENTGRAM_PORT || '3000'),
    capabilities: (process.env.AGENTGRAM_CAPABILITIES || '').split(',').filter(Boolean)
  };

  if (!config.hubUrl) {
    console.error('❌ AGENTGRAM_HUB_URL environment variable required');
    process.exit(1);
  }

  const adapter = new AgentGramAdapter(config);
  
  adapter.start().catch(err => {
    console.error('❌ Failed to start adapter:', err);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => adapter.stop());
  process.on('SIGINT', () => adapter.stop());
}

module.exports = { AgentGramAdapter };
