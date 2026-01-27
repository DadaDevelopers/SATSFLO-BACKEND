/**
 * Authentication Service
 *
 * Handles user registration, login, tokens, and password management
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const { supabaseAdmin, dbConfig } = require('../config/database');
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
    const { data: existingUser } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existingUser) {
      const error = new Error('Email already registered');
      error.statusCode = 409;
      throw error;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const { data: user, error } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name,
        date_of_birth: dateOfBirth,
        verification_token: verificationToken,
        verification_expires: verificationExpires.toISOString(),
        role: 'user',
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select('id, email, name, role, created_at')
      .single();

    if (error) {
      logger.error('User creation failed', error);
      throw error;
    }

    // Create default health profile
    await supabaseAdmin
      .from(dbConfig.tables.HEALTH_PROFILES)
      .insert({
        user_id: user.id,
        average_cycle_length: 28,
        average_period_length: 5,
        created_at: new Date().toISOString()
      });

    // Send verification email
    await emailService.sendVerificationEmail(email, verificationToken, name);

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Store refresh token
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
    // Find user
    const { data: user, error } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select('id, email, name, password_hash, role, status, email_verified')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    // Check account status
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

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    // Update last login
    await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Store refresh token
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
    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret);
    } catch (err) {
      const error = new Error('Invalid refresh token');
      error.statusCode = 401;
      throw error;
    }

    // Check if token exists in database
    const { data: storedToken } = await supabaseAdmin
      .from(dbConfig.tables.REFRESH_TOKENS)
      .select('*')
      .eq('token', refreshToken)
      .eq('user_id', decoded.userId)
      .eq('revoked', false)
      .single();

    if (!storedToken) {
      const error = new Error('Refresh token not found or revoked');
      error.statusCode = 401;
      throw error;
    }

    // Check expiration
    if (new Date(storedToken.expires_at) < new Date()) {
      const error = new Error('Refresh token expired');
      error.statusCode = 401;
      throw error;
    }

    // Get user
    const { data: user } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select('id, email, name, role, status')
      .eq('id', decoded.userId)
      .single();

    if (!user || user.status !== 'active') {
      const error = new Error('User not found or inactive');
      error.statusCode = 401;
      throw error;
    }

    // Revoke old refresh token
    await supabaseAdmin
      .from(dbConfig.tables.REFRESH_TOKENS)
      .update({ revoked: true })
      .eq('id', storedToken.id);

    // Generate new tokens
    const tokens = this.generateTokens(user);

    // Store new refresh token
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  /**
   * Logout user (revoke refresh token)
   */
  async logout(userId, refreshToken) {
    await supabaseAdmin
      .from(dbConfig.tables.REFRESH_TOKENS)
      .update({ revoked: true })
      .eq('user_id', userId)
      .eq('token', refreshToken);

    logger.info('User logged out', { userId });
  }

  /**
   * Logout from all devices
   */
  async logoutAll(userId) {
    await supabaseAdmin
      .from(dbConfig.tables.REFRESH_TOKENS)
      .update({ revoked: true })
      .eq('user_id', userId);

    logger.info('User logged out from all devices', { userId });
  }

  /**
   * Verify email
   */
  async verifyEmail(token) {
    const { data: user, error } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select('id, email, name, verification_expires')
      .eq('verification_token', token)
      .single();

    if (error || !user) {
      const err = new Error('Invalid verification token');
      err.statusCode = 400;
      throw err;
    }

    if (new Date(user.verification_expires) < new Date()) {
      const err = new Error('Verification token expired');
      err.statusCode = 400;
      throw err;
    }

    // Update user
    await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .update({
        email_verified: true,
        verification_token: null,
        verification_expires: null
      })
      .eq('id', user.id);

    // Send welcome email
    await emailService.sendWelcomeEmail(user.email, user.name);

    logger.info('Email verified', { userId: user.id });

    return { message: 'Email verified successfully' };
  }

  /**
   * Resend verification email
   */
  async resendVerification(email) {
    const { data: user } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select('id, email, name, email_verified')
      .eq('email', email.toLowerCase())
      .single();

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If an account exists, a verification email has been sent' };
    }

    if (user.email_verified) {
      const error = new Error('Email already verified');
      error.statusCode = 400;
      throw error;
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .update({
        verification_token: verificationToken,
        verification_expires: verificationExpires.toISOString()
      })
      .eq('id', user.id);

    await emailService.sendVerificationEmail(user.email, verificationToken, user.name);

    return { message: 'Verification email sent' };
  }

  /**
   * Request password reset
   */
  async forgotPassword(email) {
    const { data: user } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select('id, email, name')
      .eq('email', email.toLowerCase())
      .single();

    // Always return same message to prevent email enumeration
    const response = { message: 'If an account exists, a password reset email has been sent' };

    if (!user) {
      return response;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token
    await supabaseAdmin
      .from(dbConfig.tables.PASSWORD_RESETS)
      .insert({
        user_id: user.id,
        token: resetToken,
        expires_at: resetExpires.toISOString(),
        created_at: new Date().toISOString()
      });

    await emailService.sendPasswordResetEmail(user.email, resetToken, user.name);

    logger.info('Password reset requested', { userId: user.id });

    return response;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    const { data: resetRecord } = await supabaseAdmin
      .from(dbConfig.tables.PASSWORD_RESETS)
      .select('user_id, expires_at, used')
      .eq('token', token)
      .single();

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

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password
    await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .update({ password_hash: passwordHash })
      .eq('id', resetRecord.user_id);

    // Mark token as used
    await supabaseAdmin
      .from(dbConfig.tables.PASSWORD_RESETS)
      .update({ used: true })
      .eq('token', token);

    // Revoke all refresh tokens
    await this.logoutAll(resetRecord.user_id);

    logger.info('Password reset completed', { userId: resetRecord.user_id });

    return { message: 'Password reset successfully' };
  }

  /**
   * Change password (authenticated user)
   */
  async changePassword(userId, currentPassword, newPassword) {
    const { data: user } = await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .select('password_hash')
      .eq('id', userId)
      .single();

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

    await supabaseAdmin
      .from(dbConfig.tables.USERS)
      .update({ password_hash: passwordHash })
      .eq('id', userId);

    // Revoke all refresh tokens except current
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

    return {
      accessToken,
      refreshToken,
      expiresIn: jwtConfig.expiresIn
    };
  }

  /**
   * Store refresh token in database
   */
  async storeRefreshToken(userId, token) {
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    await supabaseAdmin.from(dbConfig.tables.REFRESH_TOKENS).insert({
      user_id: userId,
      token,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString()
    });
  }
}

module.exports = new AuthService();
