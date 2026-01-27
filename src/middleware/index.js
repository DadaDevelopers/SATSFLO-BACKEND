/**
 * Middleware Index
 *
 * Central export for all middleware modules
 */

const { errorHandler, notFoundHandler } = require('./errorHandler');
const { authenticateToken, authorize, optionalAuth, verifyOwnership } = require('./auth');
const {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  sensitiveDataLimiter,
  registrationLimiter
} = require('./rateLimiter');
const { validate, sanitizeBody } = require('./validator');

module.exports = {
  // Error handling
  errorHandler,
  notFoundHandler,

  // Authentication
  authenticateToken,
  authorize,
  optionalAuth,
  verifyOwnership,

  // Rate limiting
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  sensitiveDataLimiter,
  registrationLimiter,

  // Validation
  validate,
  sanitizeBody
};
