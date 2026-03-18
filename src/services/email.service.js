'use strict';

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 465,
  secure: true,
  auth: {
    user: 'resend',
    pass: process.env.RESEND_API_KEY || process.env.SMTP_PASS
  }
});

// Verify connection on startup (non-fatal)
transporter.verify((error) => {
  if (error) {
    console.error('❌ Email service error:', error.message);
  } else {
    console.log('✅ Email service ready');
  }
});

const FROM = 'SatsFlo <onboarding@resend.dev>';
const DEEP_LINK = process.env.DEEP_LINK_URL || process.env.FRONTEND_URL;

// ─── Verification email (link-based) ────────────────────────────────────────

const sendVerificationEmail = async (email, name, token) => {
  const link = `${DEEP_LINK}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Verify your SatsFlo account 🌸',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#F97316">Welcome to SatsFlo, ${name}! 🌸</h2>
        <p>Thanks for signing up. Please verify your email to get started:</p>
        <a href="${link}"
           style="background:#F97316;color:white;padding:12px 24px;
                  border-radius:8px;text-decoration:none;
                  display:inline-block;margin:16px 0">
          Verify Email
        </a>
        <p>Or copy this link:</p>
        <p style="color:#888;font-size:12px;word-break:break-all">${link}</p>
        <p style="color:#888;font-size:12px;margin-top:24px">Link expires in 24 hours.</p>
      </div>
    `
  });
};

// ─── OTP email (6-digit code) ────────────────────────────────────────────────

const sendOTPEmail = async (email, name, otp) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Your SatsFlo verification code',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#F97316">Hi ${name},</h2>
        <p>Your verification code is:</p>
        <h1 style="font-size:52px;letter-spacing:12px;color:#F97316;margin:24px 0">
          ${otp}
        </h1>
        <p style="color:#888;font-size:12px">
          Expires in 10 minutes. Do not share this code.
        </p>
      </div>
    `
  });
};

// ─── Password reset ──────────────────────────────────────────────────────────

const sendPasswordResetEmail = async (email, name, token) => {
  const link = `${DEEP_LINK}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Reset your SatsFlo password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#F97316">Password Reset</h2>
        <p>Hi ${name}, click below to reset your password:</p>
        <a href="${link}"
           style="background:#F97316;color:white;padding:12px 24px;
                  border-radius:8px;text-decoration:none;
                  display:inline-block;margin:16px 0">
          Reset Password
        </a>
        <p>Or copy this link:</p>
        <p style="color:#888;font-size:12px;word-break:break-all">${link}</p>
        <p style="color:#888;font-size:12px;margin-top:24px">
          Expires in 1 hour. If you didn't request this, ignore this email.
        </p>
      </div>
    `
  });
};

// ─── Welcome email (post-verification) ──────────────────────────────────────

const sendWelcomeEmail = async (email, name) => {
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Welcome to SatsFlo! 🎉',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#F97316">You're all set, ${name}! 🎉</h2>
        <p>Your email is verified. Start by logging your last period date in the app.</p>
        <p style="color:#888;font-size:12px;margin-top:24px">Your health, your data — SatsFlo.</p>
      </div>
    `
  });
};

module.exports = {
  sendVerificationEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  // no-op kept for backwards compat with server.js initialize() call
  initialize: () => Promise.resolve()
};
