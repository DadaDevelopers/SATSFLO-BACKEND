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
  async register({ email, password, name, dateOfBirth }) {
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
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO users
         (email, password_hash, name, date_of_birth, verification_token,
          verification_expires, role, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'user', 'active', NOW())
       RETURNING id, email, name, role, created_at`,
      [email.toLowerCase(), passwordHash, name, dateOfBirth,
       verificationToken, verificationExpires]
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

    await emailService.sendVerificationEmail(email, verificationToken, name);

    const tokens = this.generateTokens(user);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    logger.info('User registered', { userId: user.id, email });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: false
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
   * Verify email
   */
  async verifyEmail(token) {
    const result = await pool.query(
      'SELECT id, email, name, verification_expires FROM users WHERE verification_token = $1',
      [token]
    );
    const user = result.rows[0];

    if (!user) {
      const err = new Error('Invalid verification token');
      err.statusCode = 400;
      throw err;
    }

    if (new Date(user.verification_expires) < new Date()) {
      const err = new Error('Verification token expired');
      err.statusCode = 400;
      throw err;
    }

    await pool.query(
      `UPDATE users
       SET email_verified = true, verification_token = NULL, verification_expires = NULL
       WHERE id = $1`,
      [user.id]
    );

    await emailService.sendWelcomeEmail(user.email, user.name);

    logger.info('Email verified', { userId: user.id });
    return { message: 'Email verified successfully' };
  }

  /**
   * Resend verification email
   */
  async resendVerification(email) {
    const result = await pool.query(
      'SELECT id, email, name, email_verified FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];

    if (!user) {
      return { message: 'If an account exists, a verification email has been sent' };
    }

    if (user.email_verified) {
      const error = new Error('Email already verified');
      error.statusCode = 400;
      throw error;
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await pool.query(
      'UPDATE users SET verification_token = $1, verification_expires = $2 WHERE id = $3',
      [verificationToken, verificationExpires, user.id]
    );

    await emailService.sendVerificationEmail(user.email, verificationToken, user.name);

    return { message: 'Verification email sent' };
  }

  /**
   * Request password reset
   */
  async forgotPassword(email) {
    const result = await pool.query(
      'SELECT id, email, name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = result.rows[0];

    const response = { message: 'If an account exists, a password reset email has been sent' };

    if (!user) return response;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [user.id, resetToken, resetExpires]
    );

    await emailService.sendPasswordResetEmail(user.email, resetToken, user.name);

    logger.info('Password reset requested', { userId: user.id });
    return response;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    const result = await pool.query(
      'SELECT user_id, expires_at, used FROM password_resets WHERE token = $1',
      [token]
    );
    const resetRecord = result.rows[0];

    if (!resetRecord) {
      const error = new Error('Invalid reset token');
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
