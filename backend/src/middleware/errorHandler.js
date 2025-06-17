const logger = require('../utils/logger');
const { formatErrorResponse } = require('../utils/helpers');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Unhandled error occurred', err, {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let errors = [];

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    errors = Object.values(err.errors).map(error => error.message);
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid data format';
    errors = [`Invalid ${err.path}: ${err.value}`];
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'Duplicate entry';
    const field = Object.keys(err.keyValue)[0];
    errors = [`${field} already exists`];
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errors = ['Authentication token is invalid'];
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errors = ['Authentication token has expired'];
  } else if (err.name === 'SyntaxError' && err.status === 400 && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON';
    errors = ['Request body contains invalid JSON'];
  } else if (err.status || err.statusCode) {
    statusCode = err.status || err.statusCode;
    message = err.message || message;
  } else if (err.message) {
    message = err.message;
  }

  // Handle Supabase errors
  if (err.code && typeof err.code === 'string') {
    switch (err.code) {
      case 'PGRST116':
        statusCode = 404;
        message = 'Resource not found';
        errors = ['The requested resource does not exist'];
        break;
      case 'PGRST301':
        statusCode = 400;
        message = 'Invalid request';
        errors = ['Request contains invalid parameters'];
        break;
      case '23505':
        statusCode = 409;
        message = 'Duplicate entry';
        errors = ['A record with this data already exists'];
        break;
      case '23503':
        statusCode = 400;
        message = 'Foreign key constraint violation';
        errors = ['Referenced resource does not exist'];
        break;
      case '23502':
        statusCode = 400;
        message = 'Required field missing';
        errors = ['One or more required fields are missing'];
        break;
    }
  }

  // Handle external API errors
  if (err.response && err.response.status) {
    statusCode = 502;
    message = 'External service error';
    errors = [`External API returned status ${err.response.status}`];
    
    if (err.response.data && err.response.data.message) {
      errors.push(err.response.data.message);
    }
  }

  // Handle network errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    statusCode = 503;
    message = 'Service unavailable';
    errors = ['External service is currently unavailable'];
  }

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
    errors = ['Something went wrong. Please try again later.'];
  }

  // Send error response
  res.status(statusCode).json(formatErrorResponse(message, errors, statusCode));
};

/**
 * Handle 404 errors for undefined routes
 */
const notFoundHandler = (req, res) => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    ip: req.ip
  });

  res.status(404).json(formatErrorResponse(
    'Route not found',
    [`Cannot ${req.method} ${req.originalUrl}`],
    404
  ));
};

/**
 * Async error wrapper to catch async errors in route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
const validationErrorHandler = (errors) => {
  const formattedErrors = errors.array().map(error => ({
    field: error.param,
    message: error.msg,
    value: error.value
  }));

  return {
    success: false,
    message: 'Validation failed',
    errors: formattedErrors,
    timestamp: new Date().toISOString()
  };
};

/**
 * Database error handler
 */
const databaseErrorHandler = (error) => {
  logger.error('Database error:', error);

  let message = 'Database operation failed';
  let statusCode = 500;

  if (error.code === '23505') {
    message = 'Duplicate entry';
    statusCode = 409;
  } else if (error.code === '23503') {
    message = 'Referenced resource not found';
    statusCode = 400;
  } else if (error.code === '23502') {
    message = 'Required field missing';
    statusCode = 400;
  }

  return formatErrorResponse(message, [error.message], statusCode);
};

/**
 * External API error handler
 */
const externalApiErrorHandler = (error, serviceName) => {
  logger.error(`${serviceName} API error:`, error);

  let message = `${serviceName} service error`;
  let statusCode = 502;

  if (error.response) {
    statusCode = error.response.status === 429 ? 429 : 502;
    message = error.response.status === 429 
      ? `${serviceName} rate limit exceeded` 
      : `${serviceName} service error`;
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    statusCode = 503;
    message = `${serviceName} service unavailable`;
  }

  return formatErrorResponse(message, [error.message], statusCode);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationErrorHandler,
  databaseErrorHandler,
  externalApiErrorHandler
};
