'use strict';

const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM        = 'SatsFlo <info@satsflo.app>';
const BRAND_COLOR = '#FF4081';
const YEAR        = new Date().getFullYear();

// ─── Shared layout ─────────────────────────────────────────────────────────────

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

function divider() {
  return `<hr style="border:none;border-top:1px solid #F3F4F6;margin:24px 0;" />`;
}

// ─── Send helper ───────────────────────────────────────────────────────────────

async function send({ to, subject, html }) {
  const { error } = await resend.emails.send({
    from: FROM,
    to: [to],
    subject,
    html,
  });
  if (error) {
    const err = new Error(error.message || 'Email send failed');
    throw err;
  }
}

// ─── 1. OTP email (forgot-password) ───────────────────────────────────────────

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
      Your password reset code
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${name}</strong>,<br/><br/>
      Use the code below to reset your SatsFlo password.
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

  await send({
    to: email,
    subject: 'Your SatsFlo password reset code',
    html: layout('Your SatsFlo password reset code', body),
  });
};

// ─── 2. Verification email ─────────────────────────────────────────────────────

const sendVerificationEmail = async (email, name, verificationUrl) => {
  const firstName = name ? name.split(' ')[0] : name;

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">
      Verify your email address
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${firstName}</strong>,<br/><br/>
      Please verify your email address to secure your SatsFlo account.
      Click the button below — this link expires in 24 hours.
    </p>

    <!-- CTA button -->
    <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
      <tr>
        <td style="background:${BRAND_COLOR};border-radius:10px;">
          <a href="${verificationUrl}"
             style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;
                    color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
            Verify My Email
          </a>
        </td>
      </tr>
    </table>

    ${divider()}
    <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;">
      If you did not create a SatsFlo account, you can safely ignore this email.
    </p>
  `;

  await send({
    to: email,
    subject: 'Verify your SatsFlo email address',
    html: layout('Verify your SatsFlo email address', body),
  });
};

// ─── 3. Welcome email ──────────────────────────────────────────────────────────

const sendWelcomeEmail = async (email, name) => {
  const firstName = name ? name.split(' ')[0] : name;

  const body = `
    <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;color:#111827;">
      Hi ${firstName}, welcome to SatsFlo!
    </h1>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
      We're so glad you're here. SatsFlo helps you track your cycle, understand your body,
      and earn Bitcoin Lightning rewards for staying consistent with your health journey.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
      Here's what you can do next:
    </p>
    <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;">
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">
          <p style="margin:0;font-size:14px;color:#111827;font-weight:600;">Log your last period</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6B7280;">Set your cycle profile so we can start tracking for you.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;">
          <p style="margin:0;font-size:14px;color:#111827;font-weight:600;">Add your Lightning address</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6B7280;">Receive Bitcoin rewards directly to your wallet for logging consistently.</p>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 0;">
          <p style="margin:0;font-size:14px;color:#111827;font-weight:600;">Join the community</p>
          <p style="margin:4px 0 0;font-size:13px;color:#6B7280;">Connect with others and share your health journey.</p>
        </td>
      </tr>
    </table>
    ${divider()}
    <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.6;text-align:center;">
      Your health, your data, your rewards.<br/>
      <strong style="color:#111827;">The SatsFlo Team</strong>
    </p>
  `;

  await send({
    to: email,
    subject: `Welcome to SatsFlo, ${firstName}!`,
    html: layout('Welcome to SatsFlo', body),
  });
};

module.exports = {
  sendOTPEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  // alias used by forgotPassword service
  sendPasswordResetEmail: sendOTPEmail,
  initialize: () => Promise.resolve(),
};
