const logger = require('../utils/logger');
const { formatErrorResponse } = require('../utils/helpers');

// Mock users for demonstration
const mockUsers = {
  'netrunnerX': {
    id: 'netrunnerX',
    name: 'Emergency Coordinator',
    role: 'admin',
    permissions: ['create', 'read', 'update', 'delete', 'manage_users', 'verify_images']
  },
  'reliefAdmin': {
    id: 'reliefAdmin',
    name: 'Relief Administrator',
    role: 'contributor',
    permissions: ['create', 'read', 'update', 'verify_reports']
  },
  'citizen1': {
    id: 'citizen1',
    name: 'Citizen Reporter',
    role: 'reporter',
    permissions: ['create', 'read']
  },
  'responder1': {
    id: 'responder1',
    name: 'First Responder',
    role: 'responder',
    permissions: ['read', 'update', 'create_reports']
  }
};

/**
 * Mock authentication middleware
 * In a real application, this would validate JWT tokens or session cookies
 */
const authMiddleware = (req, res, next) => {
  try {
    // Check for user ID in headers (mock authentication)
    const userId = req.headers['x-user-id'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!userId) {
      logger.warn('Authentication failed: No user ID provided', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(401).json(
        formatErrorResponse('Authentication required. Please provide x-user-id header.', [], 401)
      );
    }
    
    // Check if user exists in mock database
    const user = mockUsers[userId];
    if (!user) {
      logger.warn('Authentication failed: Invalid user ID', {
        userId,
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(401).json(
        formatErrorResponse('Invalid user credentials.', [], 401)
      );
    }
    
    // Add user information to request object
    req.user = user;
    req.userId = user.id;
    
    logger.info('User authenticated successfully', {
      userId: user.id,
      role: user.role,
      path: req.path,
      method: req.method
    });
    
    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json(
      formatErrorResponse('Authentication service error.', [], 500)
    );
  }
};

/**
 * Authorization middleware to check permissions
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json(
          formatErrorResponse('Authentication required.', [], 401)
        );
      }
      
      if (!req.user.permissions.includes(permission)) {
        logger.warn('Authorization failed: Insufficient permissions', {
          userId: req.user.id,
          requiredPermission: permission,
          userPermissions: req.user.permissions,
          path: req.path,
          method: req.method
        });
        
        return res.status(403).json(
          formatErrorResponse('Insufficient permissions for this action.', [], 403)
        );
      }
      
      next();
    } catch (error) {
      logger.error('Authorization middleware error:', error);
      return res.status(500).json(
        formatErrorResponse('Authorization service error.', [], 500)
      );
    }
  };
};

/**
 * Role-based authorization middleware
 */
const requireRole = (roles) => {
  const roleArray = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json(
          formatErrorResponse('Authentication required.', [], 401)
        );
      }
      
      if (!roleArray.includes(req.user.role)) {
        logger.warn('Authorization failed: Insufficient role', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: roleArray,
          path: req.path,
          method: req.method
        });
        
        return res.status(403).json(
          formatErrorResponse('Insufficient role for this action.', [], 403)
        );
      }
      
      next();
    } catch (error) {
      logger.error('Role authorization middleware error:', error);
      return res.status(500).json(
        formatErrorResponse('Authorization service error.', [], 500)
      );
    }
  };
};

/**
 * Resource ownership middleware
 * Checks if user owns the resource or has admin privileges
 */
const requireOwnership = (req, res, next) => {
  try {
    const resourceOwnerId = req.resource?.owner_id;
    const currentUserId = req.user?.id;
    const isAdmin = req.user?.role === 'admin';
    
    if (!resourceOwnerId) {
      // If no owner is set, allow the action
      return next();
    }
    
    if (resourceOwnerId === currentUserId || isAdmin) {
      return next();
    }
    
    logger.warn('Authorization failed: Resource ownership required', {
      userId: currentUserId,
      resourceOwnerId,
      userRole: req.user?.role,
      path: req.path,
      method: req.method
    });
    
    return res.status(403).json(
      formatErrorResponse('You can only modify resources you own.', [], 403)
    );
  } catch (error) {
    logger.error('Ownership middleware error:', error);
    return res.status(500).json(
      formatErrorResponse('Authorization service error.', [], 500)
    );
  }
};

/**
 * Get current user information
 */
const getCurrentUser = (req) => {
  return req.user || null;
};

/**
 * Check if user has specific permission
 */
const hasPermission = (user, permission) => {
  return user && user.permissions && user.permissions.includes(permission);
};

/**
 * Check if user has specific role
 */
const hasRole = (user, role) => {
  return user && user.role === role;
};

/**
 * Get all available users (for testing purposes)
 */
const getAvailableUsers = () => {
  return Object.keys(mockUsers).map(userId => ({
    id: userId,
    name: mockUsers[userId].name,
    role: mockUsers[userId].role
  }));
};

module.exports = {
  authMiddleware,
  requirePermission,
  requireRole,
  requireOwnership,
  getCurrentUser,
  hasPermission,
  hasRole,
  getAvailableUsers,
  mockUsers
};
