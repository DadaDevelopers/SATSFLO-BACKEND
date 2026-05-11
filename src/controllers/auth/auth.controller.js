/**
 * Auth Controller
 */

const authService = require('../../services/auth.service');
const userService = require('../../services/user.service');
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
 * GET /api/v1/auth/verify-email/:token
 * No auth required — user clicks this link in their email client.
 * Returns an HTML page, not JSON.
 */
const verifyEmail = async (req, res) => {
  const { token } = req.params;

  const successPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email Verified - SatsFlo</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 40px 16px; background: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .card { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 16px; padding: 48px 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); text-align: center; }
    .logo { display: inline-block; background: #FF4081; color: #fff; font-size: 20px; font-weight: 700; padding: 8px 18px; border-radius: 10px; margin-bottom: 32px; letter-spacing: -0.5px; }
    .icon { width: 64px; height: 64px; background: #ECFDF5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 32px; color: #059669; line-height: 64px; }
    h1 { margin: 0 0 12px; font-size: 24px; font-weight: 700; color: #111827; }
    p { margin: 0; font-size: 15px; color: #6B7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">SatsFlo</div>
    <div class="icon">&#10003;</div>
    <h1>Email Verified</h1>
    <p>Your SatsFlo account is now verified.<br/>Open the SatsFlo app to continue.</p>
  </div>
</body>
</html>`;

  const errorPage = (message, showResendHint) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verification Failed - SatsFlo</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 40px 16px; background: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .card { max-width: 480px; margin: 40px auto; background: #fff; border-radius: 16px; padding: 48px 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); text-align: center; }
    .logo { display: inline-block; background: #FF4081; color: #fff; font-size: 20px; font-weight: 700; padding: 8px 18px; border-radius: 10px; margin-bottom: 32px; letter-spacing: -0.5px; }
    .icon { width: 64px; height: 64px; background: #FEF2F2; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 28px; color: #DC2626; line-height: 64px; }
    h1 { margin: 0 0 12px; font-size: 24px; font-weight: 700; color: #111827; }
    p { margin: 0 0 8px; font-size: 15px; color: #6B7280; line-height: 1.6; }
    .hint { margin-top: 20px; font-size: 13px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">SatsFlo</div>
    <div class="icon">&#10007;</div>
    <h1>Verification Failed</h1>
    <p>${message}</p>
    ${showResendHint ? '<p class="hint">Open the SatsFlo app and tap <strong>Resend verification email</strong> to get a new link.</p>' : ''}
  </div>
</body>
</html>`;

  try {
    await authService.verifyEmail(token);
    return res.setHeader('Content-Type', 'text/html').send(successPage);
  } catch (error) {
    const message = error.code === 'EXPIRED_TOKEN'
      ? 'This verification link has expired. Links are valid for 24 hours.'
      : 'This verification link is invalid or has already been used.';
    return res.status(400).setHeader('Content-Type', 'text/html').send(errorPage(message, true));
  }
};

/**
 * POST /api/v1/auth/resend-verification
 * Requires Bearer token — user must be logged in.
 * Generates a new token and resends the verification email.
 */
const resendVerification = async (req, res, next) => {
  try {
    const result = await authService.resendVerification(req.user.id);
    return ApiResponse.success(res, null, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/auth/me
 */
const getCurrentUser = async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.id);
    return ApiResponse.success(res, {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      avatar: profile.avatar_url,
      avatar_url: profile.avatar_url,
      emailVerified: profile.email_verified
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
  verifyEmail,
  resendVerification,
  getCurrentUser
};
