/**
 * Auth Routes
 *
 * Authentication and authorization endpoints
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth/auth.controller');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const { authLimiter, passwordResetLimiter, registrationLimiter } = require('../middleware/rateLimiter');
const {
  registerValidation,
  loginValidation,
  refreshTokenValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  changePasswordValidation,
  verifyEmailValidation
} = require('../validators/auth.validator');

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  registrationLimiter,
  registerValidation,
  validate,
  authController.register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  loginValidation,
  validate,
  authController.login
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  refreshTokenValidation,
  validate,
  authController.refreshToken
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  authenticateToken,
  authController.logout
);

/**
 * @route   POST /api/v1/auth/logout-all
 * @desc    Logout from all devices
 * @access  Private
 */
router.post(
  '/logout-all',
  authenticateToken,
  authController.logoutAll
);

/**
 * @route   GET /api/v1/auth/verify-email?token=  (deep-link / query param)
 * @route   GET /api/v1/auth/verify-email/:token  (path param — kept for backwards compat)
 * @desc    Verify email address
 * @access  Public
 */
router.get('/verify-email', authController.verifyEmail);
router.get(
  '/verify-email/:token',
  verifyEmailValidation,
  validate,
  authController.verifyEmail
);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend verification email
 * @access  Public
 */
router.post(
  '/resend-verification',
  authLimiter,
  forgotPasswordValidation, // Same validation - just email
  validate,
  authController.resendVerification
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  passwordResetLimiter,
  forgotPasswordValidation,
  validate,
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password/:token
 * @desc    Reset password with token
 * @access  Public
 */
router.post(
  '/reset-password/:token',
  resetPasswordValidation,
  validate,
  authController.resetPassword
);

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change password (authenticated)
 * @access  Private
 */
router.put(
  '/change-password',
  authenticateToken,
  changePasswordValidation,
  validate,
  authController.changePassword
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get(
  '/me',
  authenticateToken,
  authController.getCurrentUser
);

module.exports = router;
