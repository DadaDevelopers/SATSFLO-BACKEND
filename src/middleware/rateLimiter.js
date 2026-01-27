/**
 * Rate Limiting Middleware
 *
 * Protects API from abuse and brute force attacks
 */

const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/response');

/**
 * General API rate limiter
 * Applied to all routes
 */
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests',
  handler: (req, res) => {
    ApiResponse.error(res, 'Rate limit exceeded. Please try again later.', 429);
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/v1/health';
  }
});

/**
 * Stricter limiter for authentication endpoints
 * Prevents brute force login attempts
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts',
  handler: (req, res) => {
    ApiResponse.error(
      res,
      'Too many authentication attempts. Please try again in 15 minutes.',
      429
    );
  }
});

/**
 * Password reset limiter
 * Prevents email bombing
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many password reset attempts',
  handler: (req, res) => {
    ApiResponse.error(
      res,
      'Too many password reset attempts. Please try again in an hour.',
      429
    );
  }
});

/**
 * Sensitive data access limiter
 * For endpoints returning encrypted health data
 */
const sensitiveDataLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: 'Too many requests for sensitive data',
  handler: (req, res) => {
    ApiResponse.error(res, 'Please slow down your requests.', 429);
  }
});

/**
 * Registration limiter
 * Prevents mass account creation
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 accounts per hour per IP
  message: 'Too many accounts created',
  handler: (req, res) => {
    ApiResponse.error(
      res,
      'Too many accounts created from this IP. Please try again later.',
      429
    );
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  sensitiveDataLimiter,
  registrationLimiter
};
