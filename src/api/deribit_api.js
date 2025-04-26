// Deribit API Client implementation
const axios = require('axios');
const crypto = require('crypto-js');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');
const { logger } = require('../utils/logger');
const dns = require('dns').promises;
const https = require('https');

// API base URLs
const BASE_URL = 'https://test.deribit.com';
const WS_URL = 'wss://test.deribit.com/ws/api/v2';

// Authentication retry configuration
const AUTH_MAX_RETRIES = 10; // Increased from 5 to 10
const AUTH_INITIAL_RETRY_DELAY = 2000;
const AUTH_TIMEOUT = 60000; // Increased from 30s to 60s
const WS_CONNECTION_TIMEOUT = 60000; // Increased from 45s to 60s
const CONNECTIVITY_TIMEOUT = 30000; // Increased from 10s to 30s

// Circuit breaker configuration
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_RESET_TIMEOUT = 300000; // 5 minutes

// Jitter for exponential backoff
const getJitter = () => Math.random() * 1000;

class DeribitAPI {
  constructor(config) {
    this.apiKey = config.apiKey?.trim();
    this.apiSecret = config.apiSecret?.trim();
    this.testnet = config.testnet || true;
    this.proxyUrl = config.proxyUrl?.trim();
    this.accessToken = null;
    this.refreshToken = null;
    this.expiryTime = 0;
    this.ws = null;
    this.wsCallbacks = new Map();
    this.wsSubscriptions = new Set();
    this.requestId = 1;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 2000;
    this.initialized = false;
    
    // Circuit breaker state
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.circuitOpen = false;
    
    // Configure axios with improved timeout and keep-alive settings
    const axiosConfig = {
      timeout: CONNECTIVITY_TIMEOUT,
      maxRedirects: 5,
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 100,
      headers: {
        'User-Agent': 'DeribitTradingSystem/1.0',
        'Accept': 'application/json',
        'Connection': 'keep-alive'
      }
    };
    
    if (this.proxyUrl) {
      const httpsAgent = new https.Agent({
        ...axiosConfig,
        proxy: this.proxyUrl
      });
      axios.defaults.httpsAgent = httpsAgent;
    } else {
      const httpsAgent = new https.Agent(axiosConfig);
      axios.defaults.httpsAgent = httpsAgent;
    }
  }

  checkCircuitBreaker() {
    if (this.circuitOpen) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure >= CIRCUIT_BREAKER_RESET_TIMEOUT) {
        logger.info('Circuit breaker reset after timeout');
        this.circuitOpen = false;
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is open - API server is temporarily unavailable');
      }
    }
  }

  updateCircuitBreaker(success) {
    if (success) {
      this.failureCount = 0;
      this.circuitOpen = false;
    } else {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitOpen = true;
        logger.warn('Circuit breaker opened due to consecutive failures');
      }
    }
  }

  async checkConnectivity() {
    try {
      this.checkCircuitBreaker();

      // First check DNS resolution
      const startDns = performance.now();
      try {
        const dnsResult = await dns.lookup('test.deribit.com');
        logger.info(`DNS resolution successful: ${dnsResult.address}`);
      } catch (dnsError) {
        logger.error(`DNS resolution failed: ${dnsError.message}`);
        throw new Error('DNS resolution failed - Check network configuration');
      }
      const endDns = performance.now();
      logger.info(`DNS resolution completed in ${(endDns - startDns).toFixed(2)}ms`);

      // Then check API connectivity with retry logic
      const startApi = performance.now();
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          const response = await axios.get(`${BASE_URL}/api/v2/public/test`, {
            timeout: CONNECTIVITY_TIMEOUT,
            validateStatus: (status) => status === 200
          });

          if (response.status === 200) {
            const endApi = performance.now();
            logger.info(`API connectivity check completed in ${(endApi - startApi).toFixed(2)}ms`);
            logger.info('Successfully connected to Deribit API server');
            this.updateCircuitBreaker(true);
            return true;
          }
        } catch (error) {
          retries++;
          if (retries === maxRetries) {
            this.updateCircuitBreaker(false);
            throw error;
          }
          // Add exponential backoff with jitter
          const delay = Math.min(1000 * Math.pow(2, retries) + getJitter(), 10000);
          logger.warn(`Connectivity check attempt ${retries} failed, retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      const errorDetails = {
        message: error.message,
        code: error.code,
        ...(error.response && {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        })
      };
      
      logger.error('Failed to reach Deribit API server', errorDetails);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Connection refused - Check if the API server is accessible');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Connection timed out - Check network latency and firewall settings');
      } else if (error.code === 'EPROXY') {
        throw new Error('Proxy connection failed - Check proxy configuration');
      } else if (error.code === 'ECONNRESET' || error.message.includes('socket hang up')) {
        throw new Error('Connection reset - Server closed the connection unexpectedly');
      } else {
        throw new Error(`Unable to reach Deribit API server: ${error.message}`);
      }
    }
  }

  async authenticateWithRetry(retryCount = 0) {
    try {
      this.checkCircuitBreaker();
      
      // Check network connectivity before attempting authentication
      await this.checkConnectivity();
      const result = await this.authenticate();
      this.updateCircuitBreaker(true);
      return result;
    } catch (error) {
      const isSocketError = error.code === 'ECONNRESET' || 
                          error.message.includes('socket hang up') ||
                          error.code === 'ETIMEDOUT';

      if (retryCount >= AUTH_MAX_RETRIES) {
        this.updateCircuitBreaker(false);
        logger.error(`Authentication failed after ${AUTH_MAX_RETRIES} attempts: ${error.message}`);
        throw error;
      }

      // Use longer delays for socket-related errors
      const baseDelay = isSocketError ? 
        AUTH_INITIAL_RETRY_DELAY * 2 : 
        AUTH_INITIAL_RETRY_DELAY;

      const delay = baseDelay * Math.pow(2, retryCount) + getJitter();
      
      logger.info(`Authentication attempt ${retryCount + 1} failed. Retrying in ${delay}ms...`);
      logger.debug(`Authentication error details: ${error.message}`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.authenticateWithRetry(retryCount + 1);
    }
  }

  async authenticate() {
    try {
      const startTime = performance.now();
      
      logger.info(`Attempting authentication with API key: ${this.apiKey.substring(0, 4)}...`);
      
      const response = await axios.post(`${BASE_URL}/api/v2/public/auth`, {
        grant_type: 'client_credentials',
        client_id: this.apiKey,
        client_secret: this.apiSecret,
        scope: 'session:test'
      }, {
        timeout: AUTH_TIMEOUT,
        validateStatus: (status) => status === 200 // Only accept 200 status
      });
      
      const endTime = performance.now();
      
      if (!response.data?.result?.access_token) {
        logger.error('Authentication failed: Invalid response structure', response.data);
        throw new Error('Authentication failed: Invalid response structure');
      }
      
      logger.info(`Authentication completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      this.accessToken = response.data.result.access_token;
      this.refreshToken = response.data.result.refresh_token;
      this.expiryTime = Date.now() + (response.data.result.expires_in * 1000);
      return true;
    } catch (error) {
      if (error.response) {
        logger.error(`Authentication error - Status: ${error.response.status}`);
        logger.error('Error response data:', error.response.data);
        
        const errorMessage = error.response.data?.error?.message || error.response.data?.message || error.message;
        throw new Error(`Authentication failed: ${errorMessage}`);
      } else if (error.request) {
        logger.error('Authentication error - No response received from server');
        logger.error('Request details:', {
          url: `${BASE_URL}/api/v2/public/auth`,
          timeout: AUTH_TIMEOUT
        });
        throw new Error('Authentication failed: No response from server - Check API endpoint and network connection');
      } else {
        logger.error(`Authentication setup error: ${error.message}`);
        throw new Error(`Authentication failed: ${error.message}`);
      }
    }
  }

  async refreshAuth() {
    if (Date.now() >= this.expiryTime - 60000) {
      try {
        const response = await axios.post(`${BASE_URL}/api/v2/public/auth`, {
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken
        });
        
        if (!response.data || !response.data.result) {
          throw new Error('Token refresh failed: Invalid response');
        }
        
        this.accessToken = response.data.result.access_token;
        this.refreshToken = response.data.result.refresh_token;
        this.expiryTime = Date.now() + (response.data.result.expires_in * 1000);
        return true;
      } catch (error) {
        logger.error(`Token refresh error: ${error.message}`);
        await this.authenticateWithRetry();
      }
    }
    return true;
  }

  async initializeWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws) {
          this.ws.terminate();
        }
        
        this.ws = new WebSocket(WS_URL);
        
        // Add connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.ws.readyState !== WebSocket.OPEN) {
            this.ws.terminate();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 30000);
        
        this.ws.on('open', async () => {
          clearTimeout(connectionTimeout);
          logger.info('WebSocket connection established');
          try {
            await this.wsAuthenticate();
            resolve(true);
          } catch (error) {
            reject(error);
          }
        });
        
        this.ws.on('message', (data) => {
          this.handleWsMessage(data);
        });
        
        this.ws.on('error', (error) => {
          clearTimeout(connectionTimeout);
          logger.error(`WebSocket error: ${error.message}`);
          reject(error);
        });
        
        this.ws.on('close', () => {
          clearTimeout(connectionTimeout);
          logger.warn('WebSocket connection closed');
          this.reconnectWebSocket();
        });
      } catch (error) {
        logger.error(`WebSocket initialization error: ${error.message}`);
        reject(error);
      }
    });
  }

  async wsAuthenticate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    const msg = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'public/auth',
      params: {
        grant_type: 'client_credentials',
        client_id: this.apiKey,
        client_secret: this.apiSecret,
        scope: 'session:test' // Added scope for testnet
      }
    };
    
    return new Promise((resolve, reject) => {
      const id = msg.id;
      this.wsCallbacks.set(id, (error, result) => {
        if (error) {
          reject(error);
        } else {
          if (result.access_token) {
            this.accessToken = result.access_token;
            this.refreshToken = result.refresh_token;
            this.expiryTime = Date.now() + (result.expires_in * 1000);
            logger.info('WebSocket authentication successful');
            resolve(true);
          } else {
            reject(new Error('WebSocket authentication failed'));
          }
        }
      });
      
      this.ws.send(JSON.stringify(msg));
    });
  }

  reconnectWebSocket() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
      logger.info(`Attempting to reconnect WebSocket in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(async () => {
        try {
          await this.initializeWebSocket();
          // Resubscribe to all previous subscriptions
          for (const subscription of this.wsSubscriptions) {
            await this.subscribe(subscription.channel, subscription.callback);
          }
          this.reconnectAttempts = 0;
        } catch (error) {
          logger.error(`WebSocket reconnection failed: ${error.message}`);
        }
      }, delay);
    } else {
      logger.error(`Failed to reconnect WebSocket after ${this.maxReconnectAttempts} attempts`);
    }
  }

  handleWsMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Handle subscription messages
      if (message.method === 'subscription') {
        const channel = message.params.channel;
        const subscriptionCallbacks = Array.from(this.wsSubscriptions)
          .filter(sub => sub.channel === channel)
          .map(sub => sub.callback);
        
        for (const callback of subscriptionCallbacks) {
          callback(null, message.params.data);
        }
        return;
      }
      
      // Handle response messages
      if (message.id && this.wsCallbacks.has(message.id)) {
        const callback = this.wsCallbacks.get(message.id);
        if (message.error) {
          callback(message.error);
        } else {
          callback(null, message.result);
        }
        this.wsCallbacks.delete(message.id);
      }
    } catch (error) {
      logger.error(`Error parsing WebSocket message: ${error.message}`);
    }
  }

  getNextRequestId() {
    return this.requestId++;
  }

  async placeOrder(params) {
    await this.refreshAuth();
    try {
      const startTime = performance.now();
      const response = await axios.post(
        `${BASE_URL}/api/v2/private/buy`,
        params,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        }
      );
      const endTime = performance.now();
      logger.info(`Order placed in ${(endTime - startTime).toFixed(2)}ms`);
      return response.data.result;
    } catch (error) {
      logger.error(`Error placing order: ${error.message}`);
      throw error;
    }
  }

  async cancelOrder(orderId) {
    await this.refreshAuth();
    try {
      const startTime = performance.now();
      const response = await axios.post(
        `${BASE_URL}/api/v2/private/cancel`,
        { order_id: orderId },
        {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        }
      );
      const endTime = performance.now();
      logger.info(`Order canceled in ${(endTime - startTime).toFixed(2)}ms`);
      return response.data.result;
    } catch (error) {
      logger.error(`Error canceling order: ${error.message}`);
      throw error;
    }
  }

  async modifyOrder(params) {
    await this.refreshAuth();
    try {
      const startTime = performance.now();
      const response = await axios.post(
        `${BASE_URL}/api/v2/private/edit`,
        params,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        }
      );
      const endTime = performance.now();
      logger.info(`Order modified in ${(endTime - startTime).toFixed(2)}ms`);
      return response.data.result;
    } catch (error) {
      logger.error(`Error modifying order: ${error.message}`);
      throw error;
    }
  }

  async getOrderbook(instrument) {
    await this.refreshAuth();
    try {
      const startTime = performance.now();
      const response = await axios.get(
        `${BASE_URL}/api/v2/public/get_order_book?instrument_name=${instrument}`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        }
      );
      const endTime = performance.now();
      logger.info(`Orderbook retrieved in ${(endTime - startTime).toFixed(2)}ms`);
      return response.data.result;
    } catch (error) {
      logger.error(`Error getting orderbook: ${error.message}`);
      throw error;
    }
  }

  async getPositions() {
    await this.refreshAuth();
    try {
      const startTime = performance.now();
      const response = await axios.get(
        `${BASE_URL}/api/v2/private/get_positions`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` }
        }
      );
      const endTime = performance.now();
      logger.info(`Positions retrieved in ${(endTime - startTime).toFixed(2)}ms`);
      return response.data.result;
    } catch (error) {
      logger.error(`Error getting positions: ${error.message}`);
      throw error;
    }
  }

  async subscribe(channel, callback) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    const msg = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'public/subscribe',
      params: {
        channels: [channel]
      }
    };
    
    return new Promise((resolve, reject) => {
      const id = msg.id;
      this.wsCallbacks.set(id, (error, result) => {
        if (error) {
          reject(error);
        } else {
          this.wsSubscriptions.add({ channel, callback });
          logger.info(`Subscribed to channel: ${channel}`);
          resolve(result);
        }
      });
      
      this.ws.send(JSON.stringify(msg));
    });
  }

  async unsubscribe(channel) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    const msg = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'public/unsubscribe',
      params: {
        channels: [channel]
      }
    };
    
    return new Promise((resolve, reject) => {
      const id = msg.id;
      this.wsCallbacks.set(id, (error, result) => {
        if (error) {
          reject(error);
        } else {
          this.wsSubscriptions = new Set(
            Array.from(this.wsSubscriptions)
              .filter(sub => sub.channel !== channel)
          );
          logger.info(`Unsubscribed from channel: ${channel}`);
          resolve(result);
        }
      });
      
      this.ws.send(JSON.stringify(msg));
    });
  }

  async initialize() {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('API key and secret are required');
      }

      // First ensure we can authenticate
      const authenticated = await this.authenticateWithRetry();
      if (!authenticated) {
        throw new Error('Failed to authenticate with Deribit API');
      }

      logger.info('Authentication successful, initializing WebSocket connection...');
      
      // Only initialize WebSocket after successful authentication
      await this.initializeWebSocket();
      
      // Wait for WebSocket connection with a longer timeout
      await new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN && this.accessToken) {
            clearInterval(checkInterval);
            this.initialized = true;
            logger.info('Deribit API initialized successfully');
            resolve();
          }
        }, 100);

        // Extended timeout to 45 seconds
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('API initialization timeout after 45 seconds'));
        }, WS_CONNECTION_TIMEOUT);
      });
      
      return true;
    } catch (error) {
      logger.error(`Failed to initialize Deribit API: ${error.message}`);
      throw error; // Propagate the error up
    }
  }
}

// Export factory function
async function initializeAPI(config) {
  const api = new DeribitAPI(config);
  await api.initialize();
  return api;
}

module.exports = {
  initializeAPI
};