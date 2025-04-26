const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const { performance } = require('perf_hooks');
const { logger } = require('./utils/logger');

const DEFAULT_PORT = 8080;
const MAX_SUBSCRIPTION_RETRIES = 5;
const SUBSCRIPTION_RETRY_DELAY = 2000;

// Create a WebSocket server for real-time data distribution
function createWsServer(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer });
  const clients = new Map();
  let clientIdCounter = 1;

  wss.on('connection', (ws) => {
    const clientId = clientIdCounter++;
    const client = {
      id: clientId,
      ws,
      subscriptions: new Set()
    };
    
    clients.set(clientId, client);
    logger.info(`Client ${clientId} connected. Total clients: ${clients.size}`);
    
    ws.on('message', (message) => {
      try {
        const startTime = performance.now();
        const data = JSON.parse(message);
        
        if (data.type === 'subscribe') {
          // Handle subscription request
          if (data.symbols && Array.isArray(data.symbols)) {
            data.symbols.forEach(symbol => {
              client.subscriptions.add(symbol);
            });
            logger.info(`Client ${clientId} subscribed to: ${Array.from(client.subscriptions).join(', ')}`);
            ws.send(JSON.stringify({
              type: 'subscribed',
              symbols: Array.from(client.subscriptions)
            }));
          }
        } else if (data.type === 'unsubscribe') {
          // Handle unsubscription request
          if (data.symbols && Array.isArray(data.symbols)) {
            data.symbols.forEach(symbol => {
              client.subscriptions.delete(symbol);
            });
            logger.info(`Client ${clientId} unsubscribed from: ${data.symbols.join(', ')}`);
            ws.send(JSON.stringify({
              type: 'unsubscribed',
              symbols: data.symbols
            }));
          }
        }
        
        const endTime = performance.now();
        logger.performance('Message processing', endTime - startTime);
      } catch (error) {
        logger.error(`Error processing message from client ${clientId}: ${error.message}`);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
    
    ws.on('close', () => {
      clients.delete(clientId);
      logger.info(`Client ${clientId} disconnected. Total clients: ${clients.size}`);
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: `Connected to Deribit Trading System. Your client ID is ${clientId}.`
    }));
  });
  
  // Function to broadcast data to subscribed clients
  function broadcast(symbol, data) {
    const startTime = performance.now();
    let recipientCount = 0;
    
    clients.forEach(client => {
      if (client.subscriptions.has(symbol) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'update',
          symbol,
          data,
          timestamp: Date.now()
        }));
        recipientCount++;
      }
    });
    
    const endTime = performance.now();
    if (recipientCount > 0) {
      logger.performance(`Broadcast to ${recipientCount} clients`, endTime - startTime);
    }
    
    return recipientCount;
  }
  
  return {
    wss,
    broadcast
  };
}

// Start the prototype server
async function startProtoServer(api) {
  const app = express();
  const port = process.env.WS_PORT || DEFAULT_PORT;
  
  // Create HTTP server
  const server = http.createServer(app);
  
  // Create WebSocket server
  const { wss, broadcast } = createWsServer(server);
  
  // Basic routes
  app.get('/', (req, res) => {
    res.send('Deribit Trading System API Server');
  });
  
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      connections: wss.clients.size
    });
  });

  async function subscribeWithRetry(channel, retryCount = 0) {
    try {
      // Check if API is ready
      if (!api || !api.ws || api.ws.readyState !== WebSocket.OPEN) {
        throw new Error('API WebSocket connection not open');
      }

      await api.subscribe(channel, (err, data) => {
        if (err) {
          logger.error(`Subscription error: ${err.message}`);
          return;
        }
        broadcast('BTC-PERPETUAL', data);
      });

      logger.info(`Successfully subscribed to channel: ${channel}`);
    } catch (error) {
      if (retryCount >= MAX_SUBSCRIPTION_RETRIES) {
        throw new Error(`Failed to subscribe after ${MAX_SUBSCRIPTION_RETRIES} attempts: ${error.message}`);
      }

      logger.warn(`Subscription attempt ${retryCount + 1} failed. Retrying in ${SUBSCRIPTION_RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, SUBSCRIPTION_RETRY_DELAY));
      return subscribeWithRetry(channel, retryCount + 1);
    }
  }
  
  // Start the server
  server.listen(port, async () => {
    logger.info(`Server running on port ${port}`);
    logger.info(`WebSocket server available at ws://localhost:${port}`);
    
    try {
      // Subscribe to BTC-PERPETUAL orderbook with retry mechanism
      await subscribeWithRetry('book.BTC-PERPETUAL.100ms');
      logger.info('Successfully subscribed to example channels');
    } catch (error) {
      logger.error(`Failed to subscribe to example channels: ${error.message}`);
      // Close the server if initialization fails
      server.close();
      process.exit(1);
    }
  });
  
  return server;
}

module.exports = {
  startProtoServer
};