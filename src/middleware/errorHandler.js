/**
 * Global Error Handler Middleware
 *
 * Catches all errors and returns consistent error responses
 */

const logger = require('../utils/logger');
const ApiResponse = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  // Log error details
  logger.error('Error caught by handler', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    user: req.user?.id
  });

  // Supabase/PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        return ApiResponse.conflict(res, 'Resource already exists');

      case '23503': // Foreign key violation
        return ApiResponse.error(res, 'Referenced resource not found', 400);

      case '23502': // Not null violation
        return ApiResponse.error(res, 'Required field is missing', 400);

      case '23514': // Check constraint violation
        return ApiResponse.error(res, 'Invalid data provided', 400);

      case 'PGRST116': // Row not found
        return ApiResponse.notFound(res, 'Resource not found');
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.unauthorized(res, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return ApiResponse.unauthorized(res, 'Token expired');
  }

  // Validation errors from express-validator
  if (err.name === 'ValidationError' || err.type === 'validation') {
    return ApiResponse.validationError(res, err.errors);
  }

  // Custom application errors
  if (err.statusCode) {
    return ApiResponse.error(res, err.message, err.statusCode);
  }

  // Default to 500 for unhandled errors
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  return ApiResponse.error(res, message, 500);
};

/**
 * Not found handler for undefined routes
 */
const notFoundHandler = (req, res) => {
  return ApiResponse.notFound(res, `Route ${req.method} ${req.path} not found`);
};

module.exports = {
  errorHandler,
  notFoundHandler
};
