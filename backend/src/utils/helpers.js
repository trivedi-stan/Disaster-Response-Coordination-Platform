const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * Generate a unique ID
 */
const generateId = () => {
  return uuidv4();
};

/**
 * Validate coordinates
 */
const isValidCoordinates = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

/**
 * Convert coordinates to PostGIS POINT format
 */
const coordinatesToPoint = (lat, lng) => {
  if (!isValidCoordinates(lat, lng)) {
    throw new Error('Invalid coordinates provided');
  }
  return `POINT(${lng} ${lat})`;
};

/**
 * Parse PostGIS POINT to coordinates
 */
const pointToCoordinates = (point) => {
  if (!point) return null;
  
  try {
    // Handle different point formats
    if (typeof point === 'string') {
      const match = point.match(/POINT\(([^)]+)\)/);
      if (match) {
        const [lng, lat] = match[1].split(' ').map(Number);
        return { lat, lng };
      }
    } else if (point.coordinates) {
      const [lng, lat] = point.coordinates;
      return { lat, lng };
    }
    
    return null;
  } catch (error) {
    logger.error('Error parsing point to coordinates:', error);
    return null;
  }
};

/**
 * Calculate distance between two points in kilometers
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Sanitize text input
 */
const sanitizeText = (text) => {
  if (typeof text !== 'string') return '';
  return text.trim().replace(/[<>]/g, '');
};

/**
 * Validate disaster tags
 */
const validateTags = (tags) => {
  if (!Array.isArray(tags)) return false;
  
  const validTags = [
    'flood', 'earthquake', 'hurricane', 'tornado', 'wildfire',
    'tsunami', 'volcano', 'landslide', 'drought', 'blizzard',
    'heatwave', 'storm', 'emergency', 'urgent', 'medical',
    'shelter', 'food', 'water', 'rescue', 'evacuation'
  ];
  
  return tags.every(tag => 
    typeof tag === 'string' && 
    tag.length > 0 && 
    tag.length <= 50 &&
    validTags.includes(tag.toLowerCase())
  );
};

/**
 * Create audit trail entry
 */
const createAuditEntry = (action, userId, details = {}) => {
  return {
    action,
    userId,
    timestamp: new Date().toISOString(),
    details
  };
};

/**
 * Add audit entry to existing trail
 */
const addAuditEntry = (existingTrail, action, userId, details = {}) => {
  const trail = Array.isArray(existingTrail) ? existingTrail : [];
  const newEntry = createAuditEntry(action, userId, details);
  return [...trail, newEntry];
};

/**
 * Format response with consistent structure
 */
const formatResponse = (success, data = null, message = '', errors = []) => {
  return {
    success,
    data,
    message,
    errors: Array.isArray(errors) ? errors : [errors].filter(Boolean),
    timestamp: new Date().toISOString()
  };
};

/**
 * Format error response
 */
const formatErrorResponse = (message, errors = [], statusCode = 500) => {
  return {
    success: false,
    data: null,
    message,
    errors: Array.isArray(errors) ? errors : [errors].filter(Boolean),
    statusCode,
    timestamp: new Date().toISOString()
  };
};

/**
 * Paginate results
 */
const paginate = (page = 1, limit = 10) => {
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 items per page
  const offset = (pageNum - 1) * limitNum;
  
  return {
    page: pageNum,
    limit: limitNum,
    offset
  };
};

/**
 * Format pagination metadata
 */
const formatPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

/**
 * Delay execution (for rate limiting)
 */
const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 */
const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      const delayTime = baseDelay * Math.pow(2, i);
      logger.warn(`Retry attempt ${i + 1} failed, retrying in ${delayTime}ms`, { error: error.message });
      await delay(delayTime);
    }
  }
  
  throw lastError;
};

/**
 * Extract location names from text using simple regex patterns
 */
const extractLocationPatterns = (text) => {
  const patterns = [
    // City, State format
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+)/g,
    // Street addresses
    /\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln)/gi,
    // Neighborhoods or areas
    /(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g
  ];
  
  const locations = [];
  
  patterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match[1]) {
        locations.push(match[1].trim());
      }
      if (match[0] && !match[1]) {
        locations.push(match[0].trim());
      }
    }
  });
  
  // Remove duplicates and return
  return [...new Set(locations)];
};

/**
 * Validate disaster priority based on tags and content
 */
const calculateDisasterPriority = (tags, description) => {
  const urgentTags = ['urgent', 'emergency', 'sos', 'critical', 'immediate'];
  const highPriorityTags = ['medical', 'rescue', 'evacuation', 'trapped'];
  const disasterTypes = ['earthquake', 'tsunami', 'tornado', 'hurricane'];
  
  let priority = 1; // Default priority
  
  // Check for urgent keywords
  const text = (description || '').toLowerCase();
  if (urgentTags.some(tag => text.includes(tag) || tags.includes(tag))) {
    priority = Math.max(priority, 5);
  }
  
  // Check for high priority situations
  if (highPriorityTags.some(tag => text.includes(tag) || tags.includes(tag))) {
    priority = Math.max(priority, 4);
  }
  
  // Check for major disaster types
  if (disasterTypes.some(type => tags.includes(type))) {
    priority = Math.max(priority, 3);
  }
  
  return Math.min(5, priority); // Cap at 5
};

module.exports = {
  generateId,
  isValidCoordinates,
  coordinatesToPoint,
  pointToCoordinates,
  calculateDistance,
  isValidEmail,
  sanitizeText,
  validateTags,
  createAuditEntry,
  addAuditEntry,
  formatResponse,
  formatErrorResponse,
  paginate,
  formatPaginationMeta,
  delay,
  retryWithBackoff,
  extractLocationPatterns,
  calculateDisasterPriority
};
