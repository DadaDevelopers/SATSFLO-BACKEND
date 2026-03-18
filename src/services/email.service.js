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

transporter.verify((error) => {
  if (error) {
    console.error('Email service error:', error.message);
  } else {
    console.log('Email service ready');
  }
});

const FROM        = 'SatsFlo <info@satsflo.app>';
const DEEP_LINK   = process.env.DEEP_LINK_URL || process.env.FRONTEND_URL || 'https://satsflo.app';
const BRAND_COLOR = '#FF4081';
const YEAR        = new Date().getFullYear();

// ─── Shared layout ────────────────────────────────────────────────────────────

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:${BRAND_COLOR};border-radius:12px;padding:10px 20px;">
                    <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">
                      SatsFlo
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px 40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 0 0;">
              <p style="margin:0 0 4px;font-size:12px;color:#9CA3AF;">
                SatsFlo &middot; Period Tracking with Bitcoin Lightning Rewards
              </p>
              <p style="margin:0;font-size:12px;color:#9CA3AF;">
                &copy; ${YEAR} SatsFlo. All rights reserved.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#D1D5DB;">
                You received this email because you have an account with SatsFlo.<br/>
                If you did not create an account, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href, label) {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
      <tr>
        <td style="background:${BRAND_COLOR};border-radius:10px;">
          <a href="${href}"
             style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;
                    font-weight:600;text-decoration:none;letter-spacing:0.2px;">
            ${label}
          </a>
        </td>
      </tr>
    </table>`;
}

function divider() {
  return `<hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;" />`;
}

function smallLink(label, href) {
  return `<p style="margin:8px 0 0;font-size:13px;color:#6B7280;">
    Or copy this link into your browser:<br/>
    <a href="${href}" style="color:${BRAND_COLOR};word-break:break-all;font-size:12px;">${href}</a>
  </p>`;
}

// ─── 1. Verification email (link-based) ─────────────────────────────────────

const sendVerificationEmail = async (email, name, token) => {
  const link = `${DEEP_LINK}/verify-email?token=${token}`;

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">
      Verify your email address
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${name}</strong>, welcome to SatsFlo! <br/><br/>
      You're one step away from tracking your cycle and earning Bitcoin rewards.
      Please verify your email address to activate your account.
    </p>
    ${button(link, 'Verify My Email')}
    ${smallLink('Verify my email', link)}
    ${divider()}
    <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
      This link expires in <strong>24 hours</strong>. If you didn't create a SatsFlo account,
      you can safely ignore this email.
    </p>
  `;

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Verify your SatsFlo email address',
    html: layout('Verify your SatsFlo email', body)
  });
};

// ─── 2. OTP email (6-digit code) ────────────────────────────────────────────

const sendOTPEmail = async (email, name, otp) => {
  const digits = String(otp).split('');

  const digitBoxes = digits.map(d =>
    `<td style="width:44px;height:52px;background:#FFF7ED;border:2px solid #FED7AA;
                border-radius:10px;text-align:center;vertical-align:middle;
                font-size:28px;font-weight:700;color:${BRAND_COLOR};
                font-family:monospace;padding:0 6px;">${d}</td>
     <td style="width:8px;"></td>`
  ).join('');

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">
      Your verification code
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${name}</strong>,<br/><br/>
      Use the code below to verify your SatsFlo account.
      Enter it in the app within the next 10 minutes.
    </p>

    <!-- OTP digit boxes -->
    <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      <tr>${digitBoxes}</tr>
    </table>

    <p style="margin:0 0 4px;font-size:14px;color:#374151;font-weight:500;">
      Code: <span style="letter-spacing:6px;font-size:20px;font-weight:700;color:${BRAND_COLOR};">${otp}</span>
    </p>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
      This code expires in <strong>10 minutes</strong>. Do not share it with anyone —
      SatsFlo will never ask for your code over the phone or email.
    </p>
  `;

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Your SatsFlo verification code',
    html: layout('Your SatsFlo verification code', body)
  });
};

// ─── 3. Password reset ───────────────────────────────────────────────────────

const sendPasswordResetEmail = async (email, name, token) => {
  const link = `${DEEP_LINK}/reset-password?token=${token}`;

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">
      Reset your password
    </h1>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${name}</strong>,<br/><br/>
      We received a request to reset the password for your SatsFlo account.
      Click the button below to choose a new password.
    </p>
    ${button(link, 'Reset My Password')}
    ${smallLink('Reset my password', link)}
    ${divider()}
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#FFF7ED;border-radius:10px;margin-top:4px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#92400E;">
            Security notice
          </p>
          <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
            This link expires in <strong>1 hour</strong>.
            If you did not request a password reset, please ignore this email —
            your password will remain unchanged and your account is safe.
          </p>
        </td>
      </tr>
    </table>
  `;

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Reset your SatsFlo password',
    html: layout('Reset your SatsFlo password', body)
  });
};

// ─── 4. Welcome email (post-verification) ───────────────────────────────────

const sendWelcomeEmail = async (email, name) => {
  const steps = [
    ['🌸', 'Log your last period', 'Set up your cycle profile so SatsFlo can track your health journey.'],
    ['⚡', 'Connect your Bitcoin wallet', 'Add your Lightning address to receive sats rewards for logging consistently.'],
    ['💬', 'Join the community', 'Connect with others, share insights, and support each other anonymously.'],
  ].map(([icon, title, desc]) => `
    <tr>
      <td style="padding:0 0 20px;">
        <table cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td style="width:44px;vertical-align:top;">
              <div style="width:40px;height:40px;background:#FFF7ED;border-radius:10px;
                          text-align:center;line-height:40px;font-size:20px;">${icon}</div>
            </td>
            <td style="padding-left:14px;vertical-align:top;">
              <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111827;">${title}</p>
              <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.5;">${desc}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">
      You're all set, ${name}! 🎉
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
      Your email is verified and your SatsFlo account is ready.
      Here's how to get the most out of the app:
    </p>

    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F9FAFB;border-radius:12px;padding:20px 20px 0;">
      <tr><td><table cellpadding="0" cellspacing="0" style="width:100%;">${steps}</table></td></tr>
    </table>

    ${divider()}
    <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;text-align:center;">
      Your health, your data, your rewards.<br/>
      <strong style="color:#111827;">Welcome to SatsFlo.</strong>
    </p>
  `;

  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: 'Welcome to SatsFlo — you\'re all set!',
    html: layout('Welcome to SatsFlo', body)
  });
};

module.exports = {
  sendVerificationEmail,
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  initialize: () => Promise.resolve()
};
