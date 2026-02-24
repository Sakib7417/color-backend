/**
 * Logger Utility
 * Simple logging utility for the application
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const CURRENT_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

const logger = {
  error: (message, ...args) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.ERROR) {
      console.error(`[ERROR] ${new Date().toISOString()}:`, message, ...args);
    }
  },

  warn: (message, ...args) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(`[WARN] ${new Date().toISOString()}:`, message, ...args);
    }
  },

  info: (message, ...args) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.INFO) {
      console.log(`[INFO] ${new Date().toISOString()}:`, message, ...args);
    }
  },

  debug: (message, ...args) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG] ${new Date().toISOString()}:`, message, ...args);
    }
  },

  // Game specific logging
  game: (message, ...args) => {
    console.log(`[GAME] ${new Date().toISOString()}:`, message, ...args);
  },

  // Database logging
  db: (message, ...args) => {
    if (CURRENT_LOG_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(`[DB] ${new Date().toISOString()}:`, message, ...args);
    }
  },
};

module.exports = logger;
