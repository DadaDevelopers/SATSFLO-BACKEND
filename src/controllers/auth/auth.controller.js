/**
 * Auth Controller
 *
 * Handles authentication endpoints
 */

const authService = require('../../services/auth.service');
const ApiResponse = require('../../utils/response');
const logger = require('../../utils/logger');

/**
 * Register new user
 * POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { email, password, name, dateOfBirth } = req.body;

    const result = await authService.register({
      email,
      password,
      name,
      dateOfBirth
    });

    return ApiResponse.created(res, result, 'Registration successful. Please verify your email.');
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login({ email, password });

    return ApiResponse.success(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    const tokens = await authService.refreshToken(refreshToken);

    return ApiResponse.success(res, tokens, 'Token refreshed');
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    await authService.logout(req.user.id, refreshToken);

    return ApiResponse.success(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Logout from all devices
 * POST /api/v1/auth/logout-all
 */
const logoutAll = async (req, res, next) => {
  try {
    await authService.logoutAll(req.user.id);

    return ApiResponse.success(res, null, 'Logged out from all devices');
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email
 * GET /api/v1/auth/verify-email/:token
 */
const verifyEmail = async (req, res, next) => {
  try {
    const token = req.params.token || req.query.token;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }

    const result = await authService.verifyEmail(token);

    return ApiResponse.success(res, result, 'Email verified successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Resend verification email
 * POST /api/v1/auth/resend-verification
 */
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    const result = await authService.resendVerification(email);

    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Request password reset
 * POST /api/v1/auth/forgot-password
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const result = await authService.forgotPassword(email);

    return ApiResponse.success(res, result);
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password with token
 * POST /api/v1/auth/reset-password/:token
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const result = await authService.resetPassword(token, password);

    return ApiResponse.success(res, result, 'Password reset successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Change password (authenticated)
 * PUT /api/v1/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const result = await authService.changePassword(
      req.user.id,
      currentPassword,
      newPassword
    );

    return ApiResponse.success(res, result, 'Password changed successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user
 * GET /api/v1/auth/me
 */
const getCurrentUser = async (req, res, next) => {
  try {
    return ApiResponse.success(res, {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  logoutAll,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  getCurrentUser
};
