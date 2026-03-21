/**
 * Auth Controller
 */

const authService = require('../../services/auth.service');
const ApiResponse = require('../../utils/response');

/**
 * POST /api/v1/auth/register
 * Body: { name, email, password, confirm_password }
 */
const register = async (req, res, next) => {
  try {
    const { email, password, confirm_password, name } = req.body;

    if (!name || !email || !password || !confirm_password) {
      return ApiResponse.validationError(res, [
        { field: 'required', message: 'name, email, password, and confirm_password are required' }
      ]);
    }

    if (password !== confirm_password) {
      return ApiResponse.validationError(res, [
        { field: 'confirm_password', message: 'Passwords do not match' }
      ]);
    }

    const result = await authService.register({ email, password, name });

    return ApiResponse.created(res, result, 'Account created successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/login
 * Body: { email, password }
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
 * POST /api/v1/auth/refresh
 * Body: { refreshToken }
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
 * POST /api/v1/auth/logout
 * Body: { refreshToken }
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
 * POST /api/v1/auth/forgot-password
 * Body: { email }
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
 * POST /api/v1/auth/verify-otp
 * Body: { email, otp }
 * Returns: { reset_token }
 */
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return ApiResponse.validationError(res, [
        { field: 'required', message: 'email and otp are required' }
      ]);
    }

    const result = await authService.verifyOtp(email, String(otp));

    return ApiResponse.success(res, result, 'OTP verified. Use the reset_token to set your new password.');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/reset-password/:token
 * Body: { password, confirm_password }
 */
const resetPassword = async (req, res, next) => {
  try {
    const token = req.params.token;
    const { password, confirm_password } = req.body;

    if (!token || !password || !confirm_password) {
      return ApiResponse.validationError(res, [
        { field: 'required', message: 'token, password, and confirm_password are required' }
      ]);
    }

    if (password !== confirm_password) {
      return ApiResponse.validationError(res, [
        { field: 'confirm_password', message: 'Passwords do not match' }
      ]);
    }

    const result = await authService.resetPassword(token, password);

    return ApiResponse.success(res, result, 'Password reset successfully. Please log in.');
  } catch (error) {
    next(error);
  }
};

/**
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
  forgotPassword,
  verifyOtp,
  resetPassword,
  getCurrentUser
};
