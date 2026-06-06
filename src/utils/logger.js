/**
 * Logger Utility
 *
 * Structured logging with file persistence for production debugging
 */

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Append log entry to file
 */
function appendToFile(filename, log) {
  try {
    const logFile = path.join(logsDir, filename);
    fs.appendFileSync(logFile, JSON.stringify(log) + '\n');
  } catch (err) {
    // Fail silently - don't crash app if logging fails
  }
}

/**
 * Format log entry with consistent structure
 */
function formatLog(level, message, meta = {}) {
  return {
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString(),
    pid: process.pid,
  };
}

const logger = {
  info: (message, meta = {}) => {
    const log = formatLog('INFO', message, { meta });
    console.log(JSON.stringify(log));
    appendToFile('app.log', log);
  },

  error: (message, error = {}) => {
    const log = formatLog('ERROR', message, {
      error: error.message || error,
      stack: error.stack,
      code: error.code,
    });
    console.error(JSON.stringify(log));
    appendToFile('error.log', log);
    appendToFile('app.log', log);
  },

  warn: (message, meta = {}) => {
    const log = formatLog('WARN', message, { meta });
    console.warn(JSON.stringify(log));
    appendToFile('app.log', log);
  },

  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      const log = formatLog('DEBUG', message, { meta });
      console.log(JSON.stringify(log));
    }
  },

  http: (message, meta = {}) => {
    const log = formatLog('HTTP', message, { meta });
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(log));
    }
    appendToFile('access.log', log);
  },
};

module.exports = logger;
