/**
 * User Routes
 *
 * Profile, health profile, and preferences endpoints
 */

const express = require('express');
const router = express.Router();

const userController = require('../controllers/user/user.controller');
const { authenticateToken, authorize } = require('../middleware/auth');
const { uploadAvatar } = require('../config/cloudinary');
const { validate } = require('../middleware/validator');
const { sensitiveDataLimiter } = require('../middleware/rateLimiter');
const {
  updateProfileValidation,
  updateHealthProfileValidation,
  updatePreferencesValidation,
  userIdParamValidation,
  searchUsersValidation,
  deleteAccountValidation,
} = require('../validators/user.validator');

// All routes require authentication
router.use(authenticateToken);

// ==================== PROFILE ====================

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', userController.getProfile);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update current user profile
 * @access  Private
 */
router.put(
  '/profile',
  updateProfileValidation,
  validate,
  userController.updateProfile
);

/**
 * @route   POST /api/v1/users/avatar
 * @desc    Upload avatar (base64 string or URL) — legacy path
 * @access  Private
 */
router.post('/avatar', userController.uploadAvatar);

/**
 * @route   POST /api/v1/users/profile/avatar
 * @desc    Upload avatar — multipart/form-data { file } or JSON { avatar }
 * @access  Private
 */
router.post('/profile/avatar', uploadAvatar.single('file'), userController.uploadAvatar);

// ==================== HEALTH PROFILE ====================

/**
 * @route   GET /api/v1/users/health-profile
 * @desc    Get health profile
 * @access  Private
 */
router.get(
  '/health-profile',
  sensitiveDataLimiter,
  userController.getHealthProfile
);

/**
 * @route   PUT /api/v1/users/health-profile
 * @desc    Update health profile
 * @access  Private
 */
router.put(
  '/health-profile',
  updateHealthProfileValidation,
  validate,
  userController.updateHealthProfile
);

// ==================== PREFERENCES ====================

/**
 * @route   GET /api/v1/users/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get('/preferences', userController.getPreferences);

/**
 * @route   PUT /api/v1/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put(
  '/preferences',
  updatePreferencesValidation,
  validate,
  userController.updatePreferences
);

// ==================== DEVICE TOKEN ====================

/**
 * @route   POST /api/v1/users/device-token
 * @desc    Store FCM push token for the authenticated user
 * @access  Private
 */
router.post('/device-token', userController.saveDeviceToken);

// ==================== ACCOUNT ====================

/**
 * @route   DELETE /api/v1/users/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete(
  '/account',
  deleteAccountValidation,
  validate,
  userController.deleteAccount
);

/**
 * @route   GET /api/v1/users/export
 * @desc    Export user data (GDPR compliance)
 * @access  Private
 */
router.get('/export', userController.exportData);

// ==================== ADMIN ====================

/**
 * @route   GET /api/v1/users
 * @desc    Search/list users (admin only)
 * @access  Admin
 */
router.get(
  '/',
  authorize('admin'),
  searchUsersValidation,
  validate,
  userController.searchUsers
);

/**
 * @route   GET /api/v1/users/:userId
 * @desc    Get user by ID (admin only)
 * @access  Admin
 */
router.get(
  '/:userId',
  authorize('admin'),
  userIdParamValidation,
  validate,
  userController.getUserById
);

module.exports = router;
