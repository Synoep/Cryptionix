const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

let loggerInstance = null;

// Setup logger with file and console transports
function setupLogger() {
  if (loggerInstance) {
    return loggerInstance;
  }

  const logLevel = process.env.LOG_LEVEL || 'info';
  const logFile = process.env.LOG_FILE || 'logs/trading-system.log';

  // Create a format for console output
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  );

  // Create a format for file output
  const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  );

  // Create the logger
  loggerInstance = winston.createLogger({
    level: logLevel,
    transports: [
      new winston.transports.Console({
        format: consoleFormat
      }),
      new winston.transports.File({
        filename: logFile,
        format: fileFormat
      })
    ]
  });

  // Add performance logging method
  loggerInstance.performance = (operation, durationMs) => {
    loggerInstance.debug(`PERF: ${operation} completed in ${durationMs.toFixed(2)}ms`);
  };

  return loggerInstance;
}

// Get the existing logger instance or create a new one
function getLogger() {
  if (!loggerInstance) {
    return setupLogger();
  }
  return loggerInstance;
}

module.exports = {
  setupLogger,
  logger: getLogger()
};