/**
 * Authentication Middleware
 *
 * JWT token verification and role-based authorization
 */

const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');
const ApiResponse = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Verify JWT token and attach user to request
 * Required for protected routes
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return ApiResponse.unauthorized(res, 'Access token required');
    }

    jwt.verify(token, jwtConfig.secret, jwtConfig.options, (err, decoded) => {
      if (err) {
        logger.warn('Token verification failed', {
          error: err.message,
          ip: req.ip,
        });

        if (err.name === 'TokenExpiredError') {
          return ApiResponse.unauthorized(res, 'Token expired');
        }
        return ApiResponse.unauthorized(res, 'Invalid token');
      }

      // Attach user data to request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };

      next();
    });
  } catch (error) {
    logger.error('Auth middleware error', error);
    return ApiResponse.error(res, 'Authentication failed', 500);
  }
};

/**
 * Role-based authorization
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return ApiResponse.unauthorized(res, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Authorization failed', {
        userId: req.user.id,
        requiredRoles: roles,
        userRole: req.user.role,
      });
      return ApiResponse.forbidden(res, 'Insufficient permissions');
    }

    next();
  };
};

/**
 * Optional authentication
 * Doesn't fail if no token, but attaches user if valid token present
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  jwt.verify(token, jwtConfig.secret, jwtConfig.options, (err, decoded) => {
    if (!err) {
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    }
    next();
  });
};

/**
 * Verify user owns the resource or is admin
 * @param {Function} getResourceUserId - Function to extract user ID from request
 */
const verifyOwnership = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      const resourceUserId = await getResourceUserId(req);

      if (req.user.role === 'admin') {
        return next();
      }

      if (req.user.id !== resourceUserId) {
        return ApiResponse.forbidden(res, 'Access denied to this resource');
      }

      next();
    } catch (error) {
      logger.error('Ownership verification error', error);
      return ApiResponse.error(res, 'Authorization check failed', 500);
    }
  };
};

module.exports = {
  authenticateToken,
  authorize,
  optionalAuth,
  verifyOwnership,
};
