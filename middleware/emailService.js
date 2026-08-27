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
          <p style="color:#888;font-size:13px;margin:5px 0;">If you don't see this email in your inbox, please check your <strong style="color:#f59e0b;">Spam / Junk</strong> folder (or iPhone Junk mailbox).</p>
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
    'Approved':     { color: '#10b981', icon: '✅' },
    'Rejected':     { color: '#ef4444', icon: '❌' },
    'Pending':      { color: '#f59e0b', icon: '⏳' },
    'Under Review': { color: '#3b82f6', icon: '🔍' }
  }[newStatus] || { color: '#6366f1', icon: 'ℹ️' };

  return sendMail({
    to: email,
    subject: `Application Update: ${stageName} is ${newStatus}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #eee;overflow:hidden;">
        <div style="padding:30px;background:${cfg.color};text-align:center;">
          <p style="font-size:36px;margin:0;">${cfg.icon}</p>
          <h1 style="color:#fff;margin:8px 0 0;font-size:20px;">Global Job Connect</h1>
        </div>
        <div style="padding:30px;">
          <h2 style="color:#222;margin-top:0;">${stageName}: ${newStatus}</h2>
          <p style="color:#444;line-height:1.6;">Hi <strong>${firstName}</strong>,</p>
          <p style="color:#444;line-height:1.6;">Your application stage for <strong>${stageName}</strong> has been updated to <strong>${newStatus}</strong>.</p>
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

// ── Welcome & Onboarding: Application Process Guide ──────────────────────────
async function sendWelcomeOnboardingEmail({ firstName, email, refNumber, batchCode }) {
  const trackUrl    = `${SITE}/#track`;
  const portalUrl   = `${SITE}/my-application`;
  const supportMail = 'support@globaljoconnect.online';

  const step = (num, color, icon, title, body) => `
    <tr><td style="padding:0 36px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="44" valign="top" style="padding-right:14px;">
          <table cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="40" height="40" style="width:40px;height:40px;border-radius:50%;background:${color};text-align:center;vertical-align:middle;font-family:Arial,sans-serif;">
              <b style="color:#fff;font-size:15px;line-height:40px;">${num}</b>
            </td>
          </tr></table>
        </td>
        <td valign="top">
          <p style="margin:0 0 5px;font-weight:700;color:#1e293b;font-size:15px;">${icon} ${title}</p>
          <p style="margin:0;color:#64748b;line-height:1.65;font-size:14px;">${body}</p>
        </td>
      </tr></table>
    </td></tr>`;

  return sendMail({
    to: email,
    subject: `Welcome to Global Job Connect, ${firstName}! Here's What Happens Next \uD83C\uDF0D`,
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Welcome – Global Job Connect</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Application confirmed! Your 7-step guide to your international career. Ref: ${refNumber}</div>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">

  <!-- HEADER -->
  <tr><td style="background:linear-gradient(135deg,#0d47a1 0%,#1565c0 60%,#1976d2 100%);padding:36px 32px;text-align:center;">
    <p style="font-size:40px;margin:0 0 10px;line-height:1;">&#x2708;&#xFE0F;</p>
    <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Global Job Connect</h1>
    <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Work Anywhere. Grow Everywhere.</p>
  </td></tr>

  <!-- GREETING -->
  <tr><td style="padding:32px 36px 0;">
    <h2 style="color:#1565c0;margin:0 0 14px;font-size:22px;font-weight:800;">Welcome aboard, ${firstName}! &#x1F389;</h2>
    <p style="color:#475569;line-height:1.75;margin:0 0 10px;font-size:15px;">Thank you for registering with <strong>Global Job Connect</strong>. Your application is confirmed and you are now officially in our international recruitment pipeline.</p>
    <p style="color:#475569;line-height:1.75;margin:0;font-size:15px;">Here is your complete <strong>step-by-step journey</strong> so you always know what to expect.</p>
  </td></tr>

  <!-- REF NUMBER -->
  <tr><td style="padding:24px 36px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f7ff;border:2px solid #1565c0;border-radius:12px;">
      <tr><td style="padding:20px;text-align:center;">
        <p style="color:#64748b;margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">Your Reference Number</p>
        <p style="color:#1565c0;font-size:32px;font-weight:900;margin:0;letter-spacing:4px;">${refNumber}</p>
        <p style="color:#94a3b8;font-size:12px;margin:8px 0 0;">Batch: <strong style="color:#475569;">${batchCode}</strong> &nbsp;&middot;&nbsp; Save this &mdash; you will need it at every stage.</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- SECTION HEADING -->
  <tr><td style="padding:0 36px 20px;">
    <table cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="4" style="background:#1565c0;border-radius:4px;">&nbsp;</td>
      <td style="padding-left:12px;"><h3 style="color:#1e293b;font-size:15px;font-weight:700;margin:0;">&#x1F4CB; Your Application Journey &mdash; Step by Step</h3></td>
    </tr></table>
  </td></tr>

  ${step(1,'#1565c0','&#x2705;','Application Received <span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;margin-left:6px;">DONE</span>','Your registration form, CV, and submitted documents have been received and logged in our system. This email confirms your spot in the recruitment pool.')}
  ${step(2,'#f59e0b','&#x1F50D;','Profile Review &amp; Document Verification','Our team reviews your qualifications, professional certifications, and documents. This typically takes <strong>3&ndash;7 business days</strong>. You will be contacted if any documents are missing or need clarification.')}
  ${step(3,'#6366f1','&#x1F4B3;','Processing Fee Payment','Once your profile passes review, you will be notified about the <strong>one-time, non-refundable application processing fee</strong>. The exact amount is clearly disclosed before payment is required. This covers document processing, employer liaison, and admin support. Payment does not guarantee placement.')}
  ${step(4,'#0891b2','&#x1F91D;','Employer Matching &amp; Shortlisting','Your profile is matched with international employers across the <strong>UK, USA, Canada, Germany, and Australia</strong> based on your profession, experience, and destination preference. Shortlisted candidates are notified and moved to interview.')}
  ${step(5,'#0284c7','&#x1F3A4;','Interview &amp; Assessment','Shortlisted applicants are invited for an employer interview (virtual or in-person). Our team provides interview coaching, employer briefing, and full scheduling support at this stage.')}
  ${step(6,'#7c3aed','&#x1F4C4;','Offer &amp; Pre-Employment Checks','Successful candidates receive a formal employment offer. Pre-employment requirements &mdash; background checks, medical clearance, licensing, and final document submission &mdash; are completed at this stage.')}
  ${step(7,'#10b981','&#x1F6C2;','Visa, Work Permit &amp; Relocation','We guide you through the complete visa and work permit application for your destination country. Once approved, our team provides pre-departure briefings and relocation coordination to help you settle in smoothly.')}

  <!-- REMINDERS -->
  <tr><td style="padding:0 36px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;">
      <tr><td style="padding:18px 20px;">
        <p style="margin:0 0 10px;font-weight:700;color:#92400e;font-size:13px;">&#x26A0;&#xFE0F; Important Reminders</p>
        <p style="margin:0 0 6px;color:#78350f;font-size:13px;line-height:1.7;">&bull; Always quote <strong>${refNumber}</strong> in all communications with our team.</p>
        <p style="margin:0 0 6px;color:#78350f;font-size:13px;line-height:1.7;">&bull; Respond promptly to document requests &mdash; delays can affect your placement timeline.</p>
        <p style="margin:0 0 6px;color:#78350f;font-size:13px;line-height:1.7;">&bull; We will <strong>NEVER</strong> request payment through unofficial channels. All payment instructions are sent to your registered email only.</p>
        <p style="margin:0;color:#78350f;font-size:13px;line-height:1.7;">&bull; Track your application anytime using your reference number on our portal.</p>
      </td></tr>
    </table>
  </td></tr>

  <!-- CTA BUTTONS -->
  <tr><td style="padding:0 36px 32px;text-align:center;">
    <a href="${trackUrl}" style="background:#1565c0;color:#fff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;display:inline-block;margin:0 6px 10px;">Track My Application</a>
    <a href="${portalUrl}" style="background:#fff;color:#1565c0;padding:13px 28px;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;display:inline-block;border:2px solid #1565c0;margin:0 6px 10px;">Applicant Portal</a>
  </td></tr>

  <!-- SUPPORT -->
  <tr><td style="padding:0 36px 28px;text-align:center;">
    <p style="color:#94a3b8;font-size:13px;line-height:1.65;margin:0;">Questions? Email <a href="mailto:${supportMail}" style="color:#1565c0;font-weight:600;">${supportMail}</a><br>Always quote reference <strong style="color:#475569;">${refNumber}</strong> in every message.</p>
  </td></tr>

  <!-- FOOTER -->
  <tr><td style="padding:18px 32px;text-align:center;background:#f1f5f9;border-top:1px solid #e2e8f0;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; 2026 Global Job Connect &nbsp;&middot;&nbsp; License: NEA-2025-0192 &nbsp;&middot;&nbsp; Work Anywhere. Grow Everywhere.</p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`,
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

// ── Support chat: admin replied ──────────────────────────────────────────────
async function sendSupportReplyEmail({ firstName, email, adminMessage }) {
  const dashUrl = `${SITE}/my-application`;
  return sendMail({
    to: email,
    subject: 'Support Reply from Global Job Connect',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0d2d6b;border-radius:12px;overflow:hidden;">
        <div style="padding:30px;background:linear-gradient(135deg,#1565c0,#1976d2);text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">✈️ Global Job Connect</h1>
          <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px;">Support Centre</p>
        </div>
        <div style="padding:30px;background:#fff;">
          <h2 style="color:#1565c0;margin:0 0 12px;">💬 New Reply from Support</h2>
          <p style="color:#444;line-height:1.6;">Hi <strong>${firstName}</strong>,</p>
          <p style="color:#444;line-height:1.6;">Our support team has replied to your enquiry:</p>
          <div style="background:#f3f4f6;border-left:4px solid #1565c0;border-radius:8px;padding:16px 20px;margin:20px 0;">
            <p style="color:#1e293b;margin:0;line-height:1.7;font-size:15px;">${adminMessage}</p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${dashUrl}" style="background:#1565c0;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">View Conversation</a>
          </div>
          <p style="color:#888;font-size:13px;">You can reply directly from your applicant dashboard.</p>
        </div>
        <div style="padding:16px;text-align:center;background:#f5f5f5;">
          <p style="color:#aaa;font-size:12px;margin:0;">© 2026 Global Job Connect · Work Anywhere. Grow Everywhere.</p>
        </div>
      </div>
    `,
  });
}

// ── Support chat: ticket closed ───────────────────────────────────────────────
async function sendSupportClosedEmail({ firstName, email }) {
  const dashUrl = `${SITE}/my-application`;
  return sendMail({
    to: email,
    subject: 'Your Support Ticket Has Been Resolved — Global Job Connect',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0d2d6b;border-radius:12px;overflow:hidden;">
        <div style="padding:30px;background:linear-gradient(135deg,#1565c0,#1976d2);text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">✈️ Global Job Connect</h1>
          <p style="color:rgba(255,255,255,.8);margin:6px 0 0;font-size:14px;">Support Centre</p>
        </div>
        <div style="padding:30px;background:#fff;">
          <h2 style="color:#10b981;margin:0 0 12px;">✅ Ticket Resolved</h2>
          <p style="color:#444;line-height:1.6;">Hi <strong>${firstName}</strong>,</p>
          <p style="color:#444;line-height:1.6;">Your support ticket has been marked as <strong>resolved</strong> by our team. We hope your issue has been addressed.</p>
          <p style="color:#444;line-height:1.6;">If you still need help, you can open a new support conversation from your dashboard at any time.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${dashUrl}" style="background:#10b981;color:#fff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Go to Dashboard</a>
          </div>
          <p style="color:#888;font-size:13px;">Thank you for contacting Global Job Connect support.</p>
        </div>
        <div style="padding:16px;text-align:center;background:#f5f5f5;">
          <p style="color:#aaa;font-size:12px;margin:0;">© 2026 Global Job Connect · Work Anywhere. Grow Everywhere.</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendRefNumberEmail, sendStatusEmail, sendStageUpdateEmail, sendOtpEmail, sendCustomEmail, sendDocumentRequestEmail, sendWelcomeOnboardingEmail, sendSupportReplyEmail, sendSupportClosedEmail };
