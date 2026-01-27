/**
 * Validation Middleware
 *
 * Processes express-validator results and returns standardized errors
 */

const { validationResult } = require('express-validator');
const ApiResponse = require('../utils/response');

/**
 * Handle validation results from express-validator
 * Use after validation rules in route definitions
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value !== undefined ? err.value : undefined
    }));

    return ApiResponse.validationError(res, formattedErrors);
  }

  next();
};

/**
 * Sanitize request body by removing undefined/null values
 */
const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (req.body[key] === undefined || req.body[key] === null) {
        delete req.body[key];
      }
      // Trim strings
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  next();
};

module.exports = {
  validate,
  sanitizeBody
};
