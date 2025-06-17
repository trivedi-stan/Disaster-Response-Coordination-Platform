const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'disaster-response-api' },
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// If we're not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
      })
    )
  }));
}

// Create structured logging functions
const structuredLogger = {
  info: (message, meta = {}) => {
    logger.info(message, { ...meta, timestamp: new Date().toISOString() });
  },
  
  error: (message, error = null, meta = {}) => {
    const errorMeta = error ? {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      }
    } : {};
    
    logger.error(message, { 
      ...meta, 
      ...errorMeta, 
      timestamp: new Date().toISOString() 
    });
  },
  
  warn: (message, meta = {}) => {
    logger.warn(message, { ...meta, timestamp: new Date().toISOString() });
  },
  
  debug: (message, meta = {}) => {
    logger.debug(message, { ...meta, timestamp: new Date().toISOString() });
  },
  
  // Disaster-specific logging
  disasterAction: (action, disasterId, userId, meta = {}) => {
    logger.info(`Disaster ${action}`, {
      action,
      disasterId,
      userId,
      ...meta,
      category: 'disaster_management',
      timestamp: new Date().toISOString()
    });
  },
  
  // API request logging
  apiRequest: (method, path, userId, responseTime, statusCode, meta = {}) => {
    logger.info(`API Request`, {
      method,
      path,
      userId,
      responseTime,
      statusCode,
      ...meta,
      category: 'api_request',
      timestamp: new Date().toISOString()
    });
  },
  
  // External service logging
  externalService: (service, action, success, responseTime, meta = {}) => {
    const level = success ? 'info' : 'error';
    logger[level](`External Service ${action}`, {
      service,
      action,
      success,
      responseTime,
      ...meta,
      category: 'external_service',
      timestamp: new Date().toISOString()
    });
  },
  
  // Geospatial query logging
  geospatialQuery: (queryType, location, radius, resultCount, responseTime, meta = {}) => {
    logger.info(`Geospatial Query`, {
      queryType,
      location,
      radius,
      resultCount,
      responseTime,
      ...meta,
      category: 'geospatial',
      timestamp: new Date().toISOString()
    });
  },
  
  // Cache operation logging
  cacheOperation: (operation, key, hit, meta = {}) => {
    logger.info(`Cache ${operation}`, {
      operation,
      key,
      hit,
      ...meta,
      category: 'cache',
      timestamp: new Date().toISOString()
    });
  },
  
  // WebSocket logging
  websocket: (event, socketId, data, meta = {}) => {
    logger.info(`WebSocket ${event}`, {
      event,
      socketId,
      data,
      ...meta,
      category: 'websocket',
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = structuredLogger;
