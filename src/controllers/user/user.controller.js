/**
 * User Controller
 *
 * Handles user profile, health profile, and preferences endpoints
 */

const userService = require('../../services/user.service');
const ApiResponse = require('../../utils/response');
const logger = require('../../utils/logger');
const { uploadBuffer } = require('../../config/cloudinary');

/**
 * Get current user profile
 * GET /api/v1/users/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.id);
    return ApiResponse.success(res, profile);
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user profile
 * PUT /api/v1/users/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const profile = await userService.updateProfile(req.user.id, req.body);
    return ApiResponse.success(res, profile, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get health profile
 * GET /api/v1/users/health-profile
 */
const getHealthProfile = async (req, res, next) => {
  try {
    const healthProfile = await userService.getHealthProfile(req.user.id);
    return ApiResponse.success(res, healthProfile);
  } catch (error) {
    next(error);
  }
};

/**
 * Update health profile
 * PUT /api/v1/users/health-profile
 */
const updateHealthProfile = async (req, res, next) => {
  try {
    const healthProfile = await userService.updateHealthProfile(req.user.id, req.body);
    return ApiResponse.success(res, healthProfile, 'Health profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get user preferences
 * GET /api/v1/users/preferences
 */
const getPreferences = async (req, res, next) => {
  try {
    const preferences = await userService.getPreferences(req.user.id);
    return ApiResponse.success(res, preferences);
  } catch (error) {
    next(error);
  }
};

/**
 * Update user preferences
 * PUT /api/v1/users/preferences
 */
const updatePreferences = async (req, res, next) => {
  try {
    const preferences = await userService.updatePreferences(req.user.id, req.body);
    return ApiResponse.success(res, preferences, 'Preferences updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Upload avatar
 * POST /api/v1/users/avatar          — JSON body { avatar: base64string|url }
 * POST /api/v1/users/profile/avatar  — multipart/form-data { file } OR JSON { avatar }
 */
const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return ApiResponse.validationError(res, [
        {
          field: 'file',
          message: 'Provide an image file (multipart/form-data with field "file")',
        },
      ]);
    }

    const uploaded = await uploadBuffer(req.file.buffer, {
      folder: 'satsflo/avatars',
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    });

    const result = await userService.updateAvatar(req.user.id, uploaded.secure_url);
    return ApiResponse.success(res, { avatar_url: result.avatar_url }, 'Avatar updated');
  } catch (error) {
    next(error);
  }
};

/**
 * Delete account
 * DELETE /api/v1/users/account
 */
const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    const result = await userService.deleteAccount(req.user.id, password);
    return ApiResponse.success(res, result, 'Account deleted successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Export user data (GDPR)
 * GET /api/v1/users/export
 */
const exportData = async (req, res, next) => {
  try {
    const data = await userService.exportUserData(req.user.id);
    return ApiResponse.success(res, data, 'Data export generated');
  } catch (error) {
    next(error);
  }
};

/**
 * Save FCM device token
 * POST /api/v1/users/device-token
 */
const saveDeviceToken = async (req, res, next) => {
  try {
    const { token, platform } = req.body;
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return ApiResponse.validationError(res, [{ field: 'token', message: 'token is required' }]);
    }
    if (!platform || !['ios', 'android'].includes(platform)) {
      return ApiResponse.validationError(res, [
        { field: 'platform', message: 'platform must be ios or android' },
      ]);
    }
    await userService.saveDeviceToken(req.user.id, token.trim(), platform);
    return ApiResponse.success(res, null, 'Device token saved');
  } catch (error) {
    next(error);
  }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * Get user by ID (admin)
 * GET /api/v1/users/:userId
 */
const getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.userId);
    return ApiResponse.success(res, user);
  } catch (error) {
    next(error);
  }
};

/**
 * Search users (admin)
 * GET /api/v1/users
 */
const searchUsers = async (req, res, next) => {
  try {
    const { q, page, limit } = req.query;
    const result = await userService.searchUsers({
      query: q,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    });
    return ApiResponse.paginated(res, result.users, result.pagination);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  getHealthProfile,
  updateHealthProfile,
  getPreferences,
  updatePreferences,
  saveDeviceToken,
  deleteAccount,
  exportData,
  getUserById,
  searchUsers,
};
