/**
 * Authentication Service
 *
 * Register → bcrypt hash → store in users
 * Login → bcrypt compare → issue JWT access + refresh token
 * Protected routes → verify JWT
 * Refresh → swap refresh token for new access token
 * Logout → revoke refresh token in DB
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { pool } = require('../config/database');
const jwtConfig = require('../config/jwt');
const emailService = require('./email.service');
const logger = require('../utils/logger');

const SALT_ROUNDS = 12;

class AuthService {
  /**
   * Register a new user
   */
  async register({ email, password, name }) {
    // Check if user exists
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existing.rows[0]) {
      const error = new Error('Email already registered');
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, status, email_verified, created_at)
       VALUES ($1, $2, $3, 'user', 'active', true, NOW())
       RETURNING id, email, name, role, created_at`,
      [email.toLowerCase(), passwordHash, name]
    );
    const user = result.rows[0];

    if (!user) {
      throw new Error('User creation failed');
    }

    // Create default health profile
    await pool.query(
      `INSERT INTO health_profiles (user_id, average_cycle_length, average_period_length, created_at)
       VALUES ($1, 28, 5, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id]
    );

    await emailService.sendWelcomeEmail(email, name);

    const tokens = this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    logger.info('User registered', { userId: user.id, email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: true
      },
      ...tokens
    };
  }

  /**
   * Login user
   */
  async login({ email, password }) {
    const result = await pool.query(
      `SELECT id, email, name, password_hash, role, status, email_verified
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    const user = result.rows[0];

    if (!user) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    if (user.status === 'suspended') {
      const err = new Error('Account suspended. Please contact support.');
      err.statusCode = 403;
      throw err;
    }

    if (user.status === 'deleted') {
      const err = new Error('Account not found');
      err.statusCode = 404;
      throw err;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const tokens = this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    logger.info('User logged in', { userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.email_verified
      },
      ...tokens
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
    } catch (err) {
      const error = new Error('Invalid refresh token');
      error.statusCode = 401;
      throw error;
    }

    const tokenResult = await pool.query(
      `SELECT * FROM refresh_tokens
       WHERE token = $1 AND user_id = $2 AND revoked = false`,
      [refreshToken, decoded.userId]
    );
    const storedToken = tokenResult.rows[0];

    if (!storedToken) {
      const error = new Error('Refresh token not found or revoked');
      error.statusCode = 401;
      throw error;
    }

    if (new Date(storedToken.expires_at) < new Date()) {
      const error = new Error('Refresh token expired');
      error.statusCode = 401;
      throw error;
    }

    const userResult = await pool.query(
      'SELECT id, email, name, role, status FROM users WHERE id = $1',
      [decoded.userId]
    );
    const user = userResult.rows[0];

    if (!user || user.status !== 'active') {
      const error = new Error('User not found or inactive');
      error.statusCode = 401;
      throw error;
    }

    await pool.query('UPDATE refresh_tokens SET revoked = true WHERE id = $1', [storedToken.id]);

    const tokens = this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(userId, refreshToken) {
    await pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND token = $2',
      [userId, refreshToken]
    );
    logger.info('User logged out', { userId });
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId) {
    await pool.query(
      'UPDATE refresh_tokens SET revoked = true WHERE user_id = $1',
      [userId]
    );
    logger.info('User logged out from all devices', { userId });
  }

  /**
   * Verify OTP — used only in the forgot-password flow.
   * Checks users.email_otp, clears it, returns a 15-min reset_token.
   */
  async verifyOtp(email, otp) {
    const result = await pool.query(
      'SELECT id, email_otp, email_otp_expires FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];
    if (!user) {
      const err = new Error('Invalid OTP'); err.statusCode = 400; throw err;
    }

    if (!user.email_otp || user.email_otp !== String(otp)) {
      const err = new Error('Invalid OTP'); err.statusCode = 400; throw err;
    }

    if (new Date(user.email_otp_expires) < new Date()) {
      const err = new Error('OTP has expired. Please request a new one.'); err.statusCode = 400; throw err;
    }

    // Clear OTP and issue a short-lived reset token
    await pool.query(
      'UPDATE users SET email_otp = NULL, email_otp_expires = NULL WHERE id = $1',
      [user.id]
    );

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Invalidate previous reset tokens then store new one
    await pool.query(
      'UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false',
      [user.id]
    );
    await pool.query(
      'INSERT INTO password_resets (user_id, token, expires_at, created_at) VALUES ($1, $2, $3, NOW())',
      [user.id, resetToken, resetExpires]
    );

    return { reset_token: resetToken };
  }

  /**
   * Forgot password — generates a 4-digit OTP stored on the user row.
   */
  async forgotPassword(email) {
    const result = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];

    // Always return same message (security: don't reveal if email exists)
    const response = { message: 'If an account exists, an OTP has been sent to your email', email };
    if (!user) return response;

    const otp = String(Math.floor(1000 + Math.random() * 9000));
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET email_otp = $1, email_otp_expires = $2 WHERE id = $3',
      [otp, otpExpires, user.id]
    );

    await emailService.sendPasswordResetEmail(user.email, user.name, otp);

    logger.info('Password reset OTP sent', { userId: user.id });
    return response;
  }

  /**
   * Reset password using the secure token from verifyResetOtp.
   */
  async resetPassword(token, newPassword) {
    const result = await pool.query(
      'SELECT user_id, expires_at, used FROM password_resets WHERE token = $1',
      [token]
    );
    const resetRecord = result.rows[0];

    if (!resetRecord) {
      const error = new Error('Invalid or expired reset token');
      error.statusCode = 400;
      throw error;
    }

    if (resetRecord.used) {
      const error = new Error('Reset token already used');
      error.statusCode = 400;
      throw error;
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      const error = new Error('Reset token expired');
      error.statusCode = 400;
      throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, resetRecord.user_id]);

    await pool.query('UPDATE password_resets SET used = true WHERE token = $1', [token]);

    await this.logoutAll(resetRecord.user_id);

    logger.info('Password reset completed', { userId: resetRecord.user_id });
    return { message: 'Password reset successfully' };
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(userId, currentPassword, newPassword) {
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    const user = result.rows[0];

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      const error = new Error('Current password is incorrect');
      error.statusCode = 401;
      throw error;
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);

    await this.logoutAll(userId);

    logger.info('Password changed', { userId });
    return { message: 'Password changed successfully' };
  }

  /**
   * Generate access and refresh tokens
   */
  generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(payload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
      ...jwtConfig.options
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn }
    );

    return { accessToken, refreshToken, expiresIn: jwtConfig.expiresIn };
  }

  /**
   * Store refresh token in database
   */
  async storeRefreshToken(userId, token) {
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userId, token, expiresAt]
    );
  }
}

module.exports = new AuthService();
