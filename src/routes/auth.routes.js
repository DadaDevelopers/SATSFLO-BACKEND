/**
 * Auth Routes
 */

const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth/auth.controller');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validator');
const {
  authLimiter,
  passwordResetLimiter,
  registrationLimiter,
  resendVerificationLimiter,
} = require('../middleware/rateLimiter');
const {
  registerValidation,
  loginValidation,
  googleAuthValidation,
  refreshTokenValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
} = require('../validators/auth.validator');

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password, confirm_password }
 */
router.post(
  '/register',
  registrationLimiter,
  registerValidation,
  validate,
  authController.register
);

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
 */
router.post('/login', authLimiter, loginValidation, validate, authController.login);

/**
 * POST /api/v1/auth/google
 * Body: { idToken } — Google ID token from the mobile Google Sign-In SDK
 */
router.post('/google', authLimiter, googleAuthValidation, validate, authController.googleAuth);

/**
 * POST /api/v1/auth/forgot-password
 * Body: { email } — sends 4-digit OTP to email
 */
router.post(
  '/forgot-password',
  passwordResetLimiter,
  forgotPasswordValidation,
  validate,
  authController.forgotPassword
);

/**
 * POST /api/v1/auth/verify-otp
 * Body: { email, otp } — verifies 6-digit OTP, returns { reset_token }
 */
router.post('/verify-otp', authLimiter, authController.verifyOtp);

/**
 * POST /api/v1/auth/reset-password/:token
 * Body: { password, confirm_password }
 */
router.post(
  '/reset-password/:token',
  resetPasswordValidation,
  validate,
  authController.resetPassword
);

/**
 * POST /api/v1/auth/refresh
 * Body: { refreshToken }
 */
router.post('/refresh', refreshTokenValidation, validate, authController.refreshToken);

/**
 * POST /api/v1/auth/logout
 * Body: { refreshToken }
 */
router.post('/logout', authenticateToken, authController.logout);

/**
 * POST /api/v1/auth/logout-all
 */
router.post('/logout-all', authenticateToken, authController.logoutAll);

/**
 * GET /api/v1/auth/verify-email/:token
 * No auth required — user arrives here by clicking the link in their email.
 * Returns an HTML page.
 */
router.get('/verify-email/:token', authController.verifyEmail);

/**
 * POST /api/v1/auth/resend-verification
 * Requires Bearer token. Generates a new token and resends the verification email.
 */
router.post(
  '/resend-verification',
  authenticateToken,
  resendVerificationLimiter,
  authController.resendVerification
);

/**
 * GET /api/v1/auth/me
 */
router.get('/me', authenticateToken, authController.getCurrentUser);

module.exports = router;
