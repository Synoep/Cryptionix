// Deribit Trading System - Node.js Prototype
// NOTE: This is a Node.js prototype for demonstration.
// The actual implementation should be in C++ as per requirements.

require('dotenv').config();
const { startProtoServer } = require('./src/server');
const { initializeAPI } = require('./src/api/deribit_api');
const { setupLogger } = require('./src/utils/logger');
const { displayWelcomeMessage } = require('./src/ui/welcome');

// Initialize components
const logger = setupLogger();
logger.info('Starting Deribit Trading System...');
displayWelcomeMessage();

// Check API credentials
if (!process.env.DERIBIT_API_KEY || !process.env.DERIBIT_API_SECRET) {
  logger.error('API credentials not found. Please set DERIBIT_API_KEY and DERIBIT_API_SECRET in .env file');
  console.error('\nERROR: API credentials not found!');
  console.error('Please create a .env file with your Deribit API credentials:');
  console.error('DERIBIT_API_KEY=your_api_key');
  console.error('DERIBIT_API_SECRET=your_api_secret\n');
  process.exit(1);
}

// Main async function to handle initialization
async function main() {
  try {
    // Initialize the API client
    const api = await initializeAPI({
      apiKey: process.env.DERIBIT_API_KEY,
      apiSecret: process.env.DERIBIT_API_SECRET,
      testnet: true
    });

    // Start the server
    await startProtoServer(api);
  } catch (error) {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});

// Display C++ implementation information
console.log('\n📝 NOTE: This is a Node.js prototype for demonstration purposes.');
console.log('The actual implementation should be in C++ as per requirements.');
console.log('Please refer to the /cpp directory for the C++ implementation structure.\n');