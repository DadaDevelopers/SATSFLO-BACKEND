/**
 * Authentication Validators
 *
 * Input validation rules for auth endpoints
 */

const { body, param } = require('express-validator');
const { PASSWORD_REQUIREMENTS } = require('../utils/constants');

/**
 * Register validation
 */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 })
    .withMessage('Email must not exceed 255 characters'),

  body('password')
    .isLength({ min: PASSWORD_REQUIREMENTS.MIN_LENGTH, max: PASSWORD_REQUIREMENTS.MAX_LENGTH })
    .withMessage(
      `Password must be between ${PASSWORD_REQUIREMENTS.MIN_LENGTH} and ${PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`
    )
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),

  body('confirm_password')
    .notEmpty()
    .withMessage('confirm_password is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

/**
 * Login validation
 */
const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),

  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * Refresh token validation
 */
const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isLength({ min: 20 })
    .withMessage('Invalid refresh token format'),
];

/**
 * Forgot password validation
 */
const forgotPasswordValidation = [
  body('email').isEmail().withMessage('Please provide a valid email address').normalizeEmail(),
];

/**
 * Reset password validation (/:token path param)
 */
const resetPasswordValidation = [
  param('token').notEmpty().withMessage('Reset token is required'),

  body('password')
    .isLength({ min: PASSWORD_REQUIREMENTS.MIN_LENGTH, max: PASSWORD_REQUIREMENTS.MAX_LENGTH })
    .withMessage(
      `Password must be between ${PASSWORD_REQUIREMENTS.MIN_LENGTH} and ${PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`
    )
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),

  body('confirm_password')
    .notEmpty()
    .withMessage('confirm_password is required')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

/**
 * Change password validation
 */
const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: PASSWORD_REQUIREMENTS.MIN_LENGTH, max: PASSWORD_REQUIREMENTS.MAX_LENGTH })
    .withMessage(
      `Password must be between ${PASSWORD_REQUIREMENTS.MIN_LENGTH} and ${PASSWORD_REQUIREMENTS.MAX_LENGTH} characters`
    )
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),
];

/**
 * Verify email validation (link-based, path param)
 */
const verifyEmailValidation = [
  param('token').notEmpty().withMessage('Verification token is required'),
];

module.exports = {
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  verifyEmailValidation,
};
