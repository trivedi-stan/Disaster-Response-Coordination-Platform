const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// General API rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000),
      timestamp: new Date().toISOString()
    });
  }
});

// Strict rate limiting for external API endpoints
const externalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per minute for external API calls
  message: {
    success: false,
    message: 'Too many external API requests, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('External API rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });

    res.status(429).json({
      success: false,
      message: 'Too many external API requests, please try again later.',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

// Image verification rate limiting
const imageVerificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit each IP to 5 image verifications per 5 minutes
  message: {
    success: false,
    message: 'Too many image verification requests, please try again later.',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Image verification rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });

    res.status(429).json({
      success: false,
      message: 'Too many image verification requests, please try again later.',
      retryAfter: 300,
      timestamp: new Date().toISOString()
    });
  }
});

// Geocoding rate limiting
const geocodingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 geocoding requests per minute
  message: {
    success: false,
    message: 'Too many geocoding requests, please try again later.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Geocoding rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });

    res.status(429).json({
      success: false,
      message: 'Too many geocoding requests, please try again later.',
      retryAfter: 60,
      timestamp: new Date().toISOString()
    });
  }
});

// Social media monitoring rate limiting
const socialMediaLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 15, // limit each IP to 15 social media requests per 2 minutes
  message: {
    success: false,
    message: 'Too many social media requests, please try again later.',
    retryAfter: 120
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Social media rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });

    res.status(429).json({
      success: false,
      message: 'Too many social media requests, please try again later.',
      retryAfter: 120,
      timestamp: new Date().toISOString()
    });
  }
});

// Create disaster rate limiting (to prevent spam)
const createDisasterLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // limit each IP to 5 disaster creations per 10 minutes
  message: {
    success: false,
    message: 'Too many disaster creation requests, please try again later.',
    retryAfter: 600
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Disaster creation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userId: req.user?.id
    });

    res.status(429).json({
      success: false,
      message: 'Too many disaster creation requests, please try again later.',
      retryAfter: 600,
      timestamp: new Date().toISOString()
    });
  }
});

// User-specific rate limiting (based on user ID)
const createUserLimiter = (windowMs, max, message) => {
  const store = new Map();

  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [key, timestamps] of store.entries()) {
      const validTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
      if (validTimestamps.length === 0) {
        store.delete(key);
      } else {
        store.set(key, validTimestamps);
      }
    }

    // Get user's request timestamps
    const userTimestamps = store.get(userId) || [];
    const validTimestamps = userTimestamps.filter(timestamp => timestamp > windowStart);

    if (validTimestamps.length >= max) {
      logger.warn('User-specific rate limit exceeded', {
        userId,
        ip: req.ip,
        path: req.path,
        method: req.method,
        requestCount: validTimestamps.length,
        limit: max
      });

      return res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      });
    }

    // Add current request timestamp
    validTimestamps.push(now);
    store.set(userId, validTimestamps);

    next();
  };
};

// Export rate limiters
module.exports = {
  generalLimiter,
  externalApiLimiter,
  imageVerificationLimiter,
  geocodingLimiter,
  socialMediaLimiter,
  createDisasterLimiter,
  createUserLimiter
};
