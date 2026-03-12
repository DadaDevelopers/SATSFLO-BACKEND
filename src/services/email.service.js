/**
 * Email Service
 *
 * Handles all email communications (verification, password reset, notifications)
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
  }

  /**
   * Initialize email transporter
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verify connection in development
      if (process.env.NODE_ENV === 'development') {
        await this.transporter.verify();
        logger.info('Email service connected');
      }

      this.initialized = true;
    } catch (error) {
      logger.error('Email service initialization failed', error);
      // Don't throw - app should work without email in development
    }
  }

  /**
   * Send email
   * @param {Object} options - Email options
   */
  async sendEmail({ to, subject, html, text }) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.transporter) {
      logger.warn('Email not configured, skipping send', { to, subject });
      return { success: false, reason: 'Email not configured' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || `"Satsflow" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
        text
      });

      logger.info('Email sent', { messageId: info.messageId, to });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Failed to send email', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email, token, name = 'there') {
    const deepLinkBase = process.env.DEEP_LINK_URL || process.env.FRONTEND_URL;
    const verifyUrl = `${deepLinkBase}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF6B9D 0%, #C44569 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #FF6B9D; color: white; padding: 14px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Satsflow!</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Thanks for signing up for Satsflow! Please verify your email address to get started.</p>
            <p style="text-align: center;">
              <a href="${verifyUrl}" class="button">Verify Email</a>
            </p>
            <p>Or copy this link: <br><small>${verifyUrl}</small></p>
            <p>This link expires in 24 hours.</p>
            <p>If you didn't create an account, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Satsflow. Your health, your data.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to Satsflow!

      Hi ${name},

      Thanks for signing up! Please verify your email by visiting:
      ${verifyUrl}

      This link expires in 24 hours.

      If you didn't create an account, you can safely ignore this email.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify your Satsflow account',
      html,
      text
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, token, name = 'there') {
    const deepLinkBase = process.env.DEEP_LINK_URL || process.env.FRONTEND_URL;
    const resetUrl = `${deepLinkBase}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF6B9D 0%, #C44569 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #FF6B9D; color: white; padding: 14px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 5px; margin: 15px 0; }
          .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </p>
            <p>Or copy this link: <br><small>${resetUrl}</small></p>
            <div class="warning">
              <strong>Security notice:</strong> This link expires in 1 hour. If you didn't request this, please ignore this email or contact support if you're concerned.
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Satsflow. Your health, your data.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request

      Hi ${name},

      We received a request to reset your password. Visit this link to create a new password:
      ${resetUrl}

      This link expires in 1 hour.

      If you didn't request this, please ignore this email.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset your Satsflow password',
      html,
      text
    });
  }

  /**
   * Send period reminder notification
   */
  async sendPeriodReminderEmail(email, name, daysUntil) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF6B9D 0%, #C44569 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .highlight { font-size: 24px; color: #FF6B9D; font-weight: bold; text-align: center; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Period Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p class="highlight">Your period is expected in ${daysUntil} day${daysUntil === 1 ? '' : 's'}</p>
            <p>Based on your cycle history, we predict your next period will start soon. Remember to prepare accordingly!</p>
            <p>Open the app to see more details and log any symptoms you're experiencing.</p>
          </div>
          <div class="footer">
            <p>You can disable these reminders in your app settings.</p>
            <p>&copy; ${new Date().getFullYear()} Satsflow</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `Period reminder: ${daysUntil} day${daysUntil === 1 ? '' : 's'} away`,
      html,
      text: `Hi ${name}, your period is expected in ${daysUntil} day${daysUntil === 1 ? '' : 's'}.`
    });
  }

  /**
   * Send welcome email after verification
   */
  async sendWelcomeEmail(email, name = 'there') {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF6B9D 0%, #C44569 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .header h1 { color: white; margin: 0; font-size: 28px; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .feature { display: flex; align-items: center; margin: 15px 0; padding: 10px; background: white; border-radius: 8px; }
          .feature-icon { font-size: 24px; margin-right: 15px; }
          .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Satsflow!</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Your email is verified and you're all set! Here's what you can do with Satsflow:</p>

            <div class="feature">
              <span class="feature-icon">📅</span>
              <div><strong>Track your cycle</strong> - Log periods and get predictions</div>
            </div>

            <div class="feature">
              <span class="feature-icon">💭</span>
              <div><strong>Log symptoms & moods</strong> - Understand your patterns</div>
            </div>

            <div class="feature">
              <span class="feature-icon">⚡</span>
              <div><strong>Earn Bitcoin rewards</strong> - Get sats for healthy habits</div>
            </div>

            <div class="feature">
              <span class="feature-icon">👥</span>
              <div><strong>Join the community</strong> - Connect with others</div>
            </div>

            <p>Your health data is encrypted and only you can access it.</p>
            <p>Get started by logging your last period date in the app!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Satsflow. Your health, your data.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to Satsflow! 🎉',
      html,
      text: `Welcome to Satsflow, ${name}! Your email is verified. Start by logging your last period date in the app.`
    });
  }
}

// Export singleton instance
module.exports = new EmailService();
