/**
 * Rate Limiting Middleware
 *
 * Protects API from abuse and brute force attacks
 */

const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/response');

const API_VERSION = process.env.API_VERSION || 'v1';
const API_HEALTH_PATH = `/${API_VERSION}/health`;
const API_HEALTH_ORIGINAL_PATH = `/api/${API_VERSION}/health`;

/**
 * General API rate limiter
 * Applied to all routes
 */
const skipInTest = () => process.env.NODE_ENV === 'test';

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
    if (skipInTest()) return true;
    return (
      req.path === '/health' ||
      req.path === API_HEALTH_PATH ||
      req.originalUrl === API_HEALTH_ORIGINAL_PATH
    );
  },
});

/**
 * Stricter limiter for authentication endpoints
 * Prevents brute force login attempts
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  skip: skipInTest,
  message: 'Too many authentication attempts',
  handler: (req, res) => {
    ApiResponse.error(
      res,
      'Too many authentication attempts. Please try again in 15 minutes.',
      429
    );
  },
});

/**
 * Password reset limiter
 * Prevents email bombing
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  skip: skipInTest,
  message: 'Too many password reset attempts',
  handler: (req, res) => {
    ApiResponse.error(res, 'Too many password reset attempts. Please try again in an hour.', 429);
  },
});

/**
 * Sensitive data access limiter
 * For endpoints returning encrypted health data
 */
const sensitiveDataLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  message: 'Too many requests for sensitive data',
  handler: (req, res) => {
    ApiResponse.error(res, 'Please slow down your requests.', 429);
  },
});

/**
 * Registration limiter
 * Prevents mass account creation
 */
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: skipInTest,
  message: 'Too many accounts created',
  handler: (req, res) => {
    ApiResponse.error(res, 'Too many accounts created from this IP. Please try again later.', 429);
  },
});

/**
 * Resend verification limiter
 * Prevents email bombing via the resend endpoint
 */
const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  skip: skipInTest,
  message: 'Too many verification email requests',
  handler: (req, res) => {
    ApiResponse.error(
      res,
      'Too many verification email requests. Please try again in an hour.',
      429
    );
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  sensitiveDataLimiter,
  registrationLimiter,
  resendVerificationLimiter,
};
