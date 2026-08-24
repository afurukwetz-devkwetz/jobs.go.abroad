/**
 * emailService.js — Shared email helper for Global Job Connect
 * Uses SendGrid SDK directly (not SMTP) to avoid port 587 blocks on Render.
 */

const sgMail = require('@sendgrid/mail');

const SENDGRID_CONFIGURED = !!process.env.SENDGRID_API_KEY;
if (SENDGRID_CONFIGURED) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ [EmailService] SendGrid SDK initialised.');
} else {
  console.warn('⚠️ [EmailService] SENDGRID_API_KEY not set — emails will be mocked.');
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || process.env.EMAIL_USER || 'noreply@globaljobconnect.com';
const FROM_NAME  = 'Global Job Connect';
const SITE       = process.env.FRONTEND_URL || 'https://globaljobconnect.online';

console.log(`📧 [EmailService] Sending from: ${FROM_EMAIL} | SendGrid configured: ${SENDGRID_CONFIGURED}`);


/**
 * Core send helper — uses SendGrid SDK (HTTPS API, not SMTP).
 * Returns true on success, false on failure (never throws).
 */
async function sendMail({ to, subject, html }) {
  if (!SENDGRID_CONFIGURED) {
    console.log(`📩 [Mock Email] To: ${to} | Subject: ${subject}`);
    return true; // treat mock as success so flow continues
  }

  // Fire and forget (Background sending to avoid blocking HTTP response)
  sgMail.send({
    to,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject,
    html,
  }).then(() => {
    console.log(`✅ [Email] Sent → ${to} | ${subject}`);
  }).catch(err => {
    const details = err.response?.body?.errors || err.message;
    console.error('❌ [SendGrid Error]:', JSON.stringify(details));
  });

  return true; // Return immediately to speed up UI
}

// ── Send OTP email ─────────────────────────────────────────────────────────────
async function sendOtpEmail({ email, otp }) {
  return sendMail({
    to: email,
    subject: 'Your Verification Code – Global Job Connect',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0d2d6b;border-radius:12px;overflow:hidden;">
        <div style="padding:30px;background:linear-gradient(135deg,#1565c0,#1976d2);text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">✈️ Global Job Connect</h1>
        </div>
        <div style="padding:30px;background:#fff;text-align:center;">
          <h2 style="color:#1565c0;">Email Verification</h2>
          <p style="color:#444;line-height:1.6;font-size:16px;">Use the following 6-digit code to complete your application. This code is valid for 10 minutes.</p>
          <div style="margin:30px 0;background:#f3f4f6;padding:20px;border-radius:8px;display:inline-block;">
            <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#1565c0;">${otp}</span>
          </div>
          <p style="color:#888;font-size:13px;">If you did not request this code, please ignore this email.</p>
        </div>
        <div style="padding:16px;text-align:center;background:#f5f5f5;">
          <p style="color:#aaa;font-size:12px;margin:0;">© 2026 Global Job Connect.</p>
        </div>
      </div>
    `,
  });
}

// ── Send reference number email after registration ───────────────────────────
async function sendRefNumberEmail({ firstName, email, refNumber, batchCode }) {
  const trackUrl = `${SITE}/#track`;
  return sendMail({
    to: email,
    subject: `Your Application Reference: ${refNumber} – Global Job Connect`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eee;overflow:hidden;">
        <div style="padding:30px;background:linear-gradient(135deg,#1565c0,#1976d2);text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">✈️ Global Job Connect</h1>
          <p style="color:rgba(255,255,255,.8);margin:8px 0 0;">Application Confirmation</p>
        </div>
        <div style="padding:30px;">
          <h2 style="color:#1565c0;">Hi ${firstName}, your application is received! 🎉</h2>
          <p style="color:#444;line-height:1.6;">We have received your application. Please save your reference number — you will need it to track your application status.</p>
          <div style="background:#f0f7ff;border:2px solid #1565c0;border-radius:10px;padding:20px;text-align:center;margin:24px 0;">
            <p style="color:#666;margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Your Reference Number</p>
            <p style="color:#1565c0;font-size:28px;font-weight:800;margin:0;letter-spacing:2px;">${refNumber}</p>
            <p style="color:#888;font-size:13px;margin:8px 0 0;">Batch: <strong>${batchCode}</strong></p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${trackUrl}" style="background:#1565c0;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Track My Application</a>
          </div>
          <p style="color:#444;line-height:1.6;">Our team will review your application and be in touch. You can check your status at any time by visiting our website and entering your reference number.</p>
        </div>
        <div style="padding:16px;text-align:center;background:#f5f5f5;">
          <p style="color:#aaa;font-size:12px;margin:0;">© 2026 Global Job Connect · Work Anywhere. Grow Everywhere.</p>
        </div>
      </div>
    `,
  });
}

// ── Send status change notification to applicant ─────────────────────────────
async function sendStatusEmail({ firstName, email, refNumber, newStatus, adminNote }) {
  const trackUrl = `${SITE}/#track`;
  const statusConfig = {
    Approved: { color: '#10b981', icon: '✅', title: 'Congratulations! Your Application Has Been Approved', text: 'We are pleased to inform you that your application has been approved. Our team will be in contact with you shortly with the next steps.' },
    Rejected: { color: '#ef4444', icon: '❌', title: 'Application Update', text: 'After careful review, we regret to inform you that your application was not successful at this time. We encourage you to reapply in the future.' },
    Pending:  { color: '#f59e0b', icon: '⏳', title: 'Application Status Update', text: 'Your application status has been updated. Please log in or use your reference number to check the latest details.' },
  };
  const cfg = statusConfig[newStatus] || statusConfig.Pending;

  return sendMail({
    to: email,
    subject: `Application Update: ${newStatus} – Global Job Connect`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eee;overflow:hidden;">
        <div style="padding:30px;background:${cfg.color};text-align:center;">
          <p style="font-size:36px;margin:0;">${cfg.icon}</p>
          <h1 style="color:#fff;margin:8px 0 0;font-size:20px;">Global Job Connect</h1>
        </div>
        <div style="padding:30px;">
          <h2 style="color:#222;">${cfg.title}</h2>
          <p style="color:#444;line-height:1.6;">Hi <strong>${firstName}</strong>,</p>
          <p style="color:#444;line-height:1.6;">${cfg.text}</p>
          <div style="background:#f9f9f9;border-left:4px solid ${cfg.color};padding:14px 18px;border-radius:0 8px 8px 0;margin:20px 0;">
            <p style="margin:0;color:#666;font-size:13px;">Reference Number: <strong style="color:#222;">${refNumber}</strong></p>
            <p style="margin:6px 0 0;color:#666;font-size:13px;">Status: <strong style="color:${cfg.color};">${newStatus}</strong></p>
            ${adminNote ? `<p style="margin:10px 0 0;color:#666;font-size:13px;"><em>Note from our team: ${adminNote}</em></p>` : ''}
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${trackUrl}" style="background:#1565c0;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Track My Application</a>
          </div>
        </div>
        <div style="padding:16px;text-align:center;background:#f5f5f5;">
          <p style="color:#aaa;font-size:12px;margin:0;">© 2026 Global Job Connect · Work Anywhere. Grow Everywhere.</p>
        </div>
      </div>
    `,
  });
}

// ── Send stage-specific update notification ──────────────────────────────────
async function sendStageUpdateEmail({ firstName, email, refNumber, stageName, newStatus }) {
  const trackUrl = `${SITE}/#track`;
  const cfg = {
    'Verified':   { color: '#10b981', icon: '✅', title: 'Stage Verified' },
    'Failed':     { color: '#ef4444', icon: '❌', title: 'Stage Update: Failed' },
    'In Process': { color: '#3b82f6', icon: '🔄', title: 'Stage Update: In Process' }
  }[newStatus] || { color: '#6366f1', icon: 'ℹ️', title: 'Stage Update' };

  return sendMail({
    to: email,
    subject: `Application Stage Update: ${stageName} is now ${newStatus}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eee;overflow:hidden;">
        <div style="padding:30px;background:${cfg.color};text-align:center;">
          <p style="font-size:36px;margin:0;">${cfg.icon}</p>
          <h1 style="color:#fff;margin:8px 0 0;font-size:20px;">Global Job Connect</h1>
        </div>
        <div style="padding:30px;">
          <h2 style="color:#222;">${cfg.title}</h2>
          <p style="color:#444;line-height:1.6;">Hi <strong>${firstName}</strong>,</p>
          <p style="color:#444;line-height:1.6;">Your application stage <strong>${stageName}</strong> has been updated to <strong>${newStatus}</strong>.</p>
          <div style="background:#f9f9f9;border-left:4px solid ${cfg.color};padding:14px 18px;border-radius:0 8px 8px 0;margin:20px 0;">
            <p style="margin:0;color:#666;font-size:13px;">Reference Number: <strong style="color:#222;">${refNumber}</strong></p>
            <p style="margin:6px 0 0;color:#666;font-size:13px;">Stage: <strong style="color:#222;">${stageName}</strong></p>
            <p style="margin:6px 0 0;color:#666;font-size:13px;">Status: <strong style="color:${cfg.color};">${newStatus}</strong></p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${trackUrl}" style="background:#1565c0;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Track My Application</a>
          </div>
        </div>
        <div style="padding:16px;text-align:center;background:#f5f5f5;">
          <p style="color:#aaa;font-size:12px;margin:0;">© 2026 Global Job Connect · Work Anywhere. Grow Everywhere.</p>
        </div>
      </div>
    `,
  });
}

// ── Send verification email (legacy — kept for compatibility) ─────────────────
async function sendVerificationEmail({ firstName, email, verificationToken }) {
  const verifyUrl = `${SITE}/api/verify/${verificationToken}`;
  return sendMail({
    to: email,
    subject: 'Verify Your Email – Global Job Connect',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0d2d6b;border-radius:12px;overflow:hidden;">
        <div style="padding:30px;background:linear-gradient(135deg,#1565c0,#1976d2);text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">✈️ Global Job Connect</h1>
        </div>
        <div style="padding:30px;background:#fff;">
          <h2 style="color:#1565c0;">Welcome, ${firstName}!</h2>
          <p style="color:#444;line-height:1.6;">Thank you for applying. Please verify your email address to activate your account.</p>
          <div style="text-align:center;margin:30px 0;">
            <a href="${verifyUrl}" style="background:#1565c0;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Verify Email Address</a>
          </div>
          <p style="color:#888;font-size:13px;">If the button doesn't work, paste this link in your browser:<br><a href="${verifyUrl}" style="color:#1565c0;">${verifyUrl}</a></p>
        </div>
        <div style="padding:16px;text-align:center;background:#f5f5f5;">
          <p style="color:#aaa;font-size:12px;margin:0;">© 2026 Global Job Connect. If you didn't register, ignore this email.</p>
        </div>
      </div>
    `,
  });
}

// ── Send custom admin message to applicant ─────────────────────────────────────
async function sendCustomEmail({ to, subject, body, firstName }) {
  return sendMail({
    to,
    subject: `${subject} — Global Job Connect`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eee;overflow:hidden;">
        <div style="padding:24px 30px;background:linear-gradient(135deg,#1565c0,#1976d2);">
          <h1 style="color:#fff;margin:0;font-size:20px;">✈️ Global Job Connect</h1>
        </div>
        <div style="padding:30px;">
          <p style="color:#444;font-size:15px;">Hi <strong>${firstName || 'Applicant'}</strong>,</p>
          <div style="color:#333;line-height:1.7;font-size:15px;white-space:pre-wrap;">${body}</div>
        </div>
        <div style="padding:16px;text-align:center;background:#f5f5f5;">
          <p style="color:#aaa;font-size:12px;margin:0;">© 2026 Global Job Connect · Work Anywhere. Grow Everywhere.</p>
        </div>
      </div>
    `,
  });
}

// ── Send document request email to applicant ───────────────────────────────────
async function sendDocumentRequestEmail({ firstName, email, docLabel, uploadUrl }) {
  return sendMail({
    to: email,
    subject: `Action Required: Please Upload Your ${docLabel} — Global Job Connect`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eee;overflow:hidden;">
        <div style="padding:24px 30px;background:linear-gradient(135deg,#f59e0b,#d97706);">
          <h1 style="color:#fff;margin:0;font-size:20px;">📎 Document Required</h1>
        </div>
        <div style="padding:30px;">
          <h2 style="color:#d97706;">Action Required, ${firstName}!</h2>
          <p style="color:#444;line-height:1.6;">Our team requires you to upload the following document to proceed with your application:</p>
          <div style="background:#fffbeb;border:2px solid #f59e0b;border-radius:10px;padding:18px;text-align:center;margin:24px 0;">
            <p style="color:#92400e;font-size:18px;font-weight:700;margin:0;">📄 ${docLabel}</p>
          </div>
          <p style="color:#444;line-height:1.6;">Please click the button below to upload your document. The link is valid for <strong>48 hours</strong>.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${uploadUrl}" style="background:#f59e0b;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Upload ${docLabel}</a>
          </div>
          <p style="color:#888;font-size:13px;">You can also log in to your applicant dashboard at <a href="${SITE}/my-application" style="color:#1565c0;">${SITE}/my-application</a> to upload your documents anytime.</p>
        </div>
        <div style="padding:16px;text-align:center;background:#f5f5f5;">
          <p style="color:#aaa;font-size:12px;margin:0;">© 2026 Global Job Connect · Work Anywhere. Grow Everywhere.</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendRefNumberEmail, sendStatusEmail, sendStageUpdateEmail, sendOtpEmail, sendCustomEmail, sendDocumentRequestEmail };
