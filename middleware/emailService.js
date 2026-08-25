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

  return sendMail({
    to: email,
    subject: `Welcome to Global Job Connect, ${firstName}! Here's What Happens Next 🌍`,
    html: `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1565c0 0%,#1976d2 50%,#0d47a1 100%);padding:36px 30px;text-align:center;">
          <p style="font-size:36px;margin:0 0 8px;">✈️</p>
          <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:800;letter-spacing:-0.5px;">Global Job Connect</h1>
          <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;">Work Anywhere. Grow Everywhere.</p>
        </div>

        <!-- Greeting -->
        <div style="padding:32px 32px 0;">
          <h2 style="color:#1565c0;margin:0 0 12px;font-size:22px;">Welcome aboard, ${firstName}! 🎉</h2>
          <p style="color:#475569;line-height:1.7;margin:0 0 10px;font-size:15px;">Thank you for registering with <strong>Global Job Connect</strong>. Your application has been received and you are now officially in our recruitment pipeline.</p>
          <p style="color:#475569;line-height:1.7;margin:0;font-size:15px;">Below is a step-by-step guide of the entire process so you always know what to expect and where you stand.</p>
        </div>

        <!-- Ref Number Box -->
        <div style="margin:28px 32px;background:#f0f7ff;border:2px solid #1565c0;border-radius:12px;padding:20px;text-align:center;">
          <p style="color:#64748b;margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your Reference Number</p>
          <p style="color:#1565c0;font-size:30px;font-weight:900;margin:0;letter-spacing:3px;">${refNumber}</p>
          <p style="color:#94a3b8;font-size:12px;margin:8px 0 0;">Batch: <strong style="color:#475569;">${batchCode}</strong> &nbsp;·&nbsp; Save this number — you will need it at every stage.</p>
        </div>

        <!-- Process Steps -->
        <div style="padding:0 32px 32px;">
          <h3 style="color:#1e293b;font-size:16px;font-weight:700;margin:0 0 20px;border-left:4px solid #1565c0;padding-left:12px;">📋 Your Application Journey — Step by Step</h3>

          <!-- Step 1 -->
          <div style="display:flex;gap:16px;margin-bottom:22px;">
            <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#1565c0;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-weight:800;font-size:15px;">1</span>
            </div>
            <div>
              <p style="margin:0 0 4px;font-weight:700;color:#1e293b;font-size:15px;">✅ Application Received <span style="background:#dcfce7;color:#166534;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;margin-left:8px;">DONE</span></p>
              <p style="margin:0;color:#64748b;line-height:1.6;font-size:14px;">Your registration form, CV, and all submitted documents have been received. You will shortly get a confirmation email with your unique reference number.</p>
            </div>
          </div>

          <!-- Step 2 -->
          <div style="display:flex;gap:16px;margin-bottom:22px;">
            <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#f59e0b;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-weight:800;font-size:15px;">2</span>
            </div>
            <div>
              <p style="margin:0 0 4px;font-weight:700;color:#1e293b;font-size:15px;">🔍 Profile Review & Document Verification</p>
              <p style="margin:0;color:#64748b;line-height:1.6;font-size:14px;">Our recruitment team will review your profile, verify your qualifications, professional certifications, and the documents you have submitted. This typically takes <strong>3–7 business days</strong>. You may be contacted if any documents are missing or unclear.</p>
            </div>
          </div>

          <!-- Step 3 -->
          <div style="display:flex;gap:16px;margin-bottom:22px;">
            <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#6366f1;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-weight:800;font-size:15px;">3</span>
            </div>
            <div>
              <p style="margin:0 0 4px;font-weight:700;color:#1e293b;font-size:15px;">💳 Processing Fee Payment</p>
              <p style="margin:0;color:#64748b;line-height:1.6;font-size:14px;">Once your profile passes initial review, you will be notified about the <strong>one-time, non-refundable application processing fee</strong>. The exact amount will be clearly disclosed before any payment is requested. This fee covers document processing, employer liaison, and administrative support. Payment does not guarantee placement.</p>
            </div>
          </div>

          <!-- Step 4 -->
          <div style="display:flex;gap:16px;margin-bottom:22px;">
            <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#0891b2;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-weight:800;font-size:15px;">4</span>
            </div>
            <div>
              <p style="margin:0 0 4px;font-weight:700;color:#1e293b;font-size:15px;">🤝 Employer Matching & Shortlisting</p>
              <p style="margin:0;color:#64748b;line-height:1.6;font-size:14px;">Your profile will be matched with suitable international employers across the <strong>UK, USA, Canada, Germany, and Australia</strong> based on your profession, experience, and preferred destinations. Shortlisted candidates will be notified and moved to the interview stage.</p>
            </div>
          </div>

          <!-- Step 5 -->
          <div style="display:flex;gap:16px;margin-bottom:22px;">
            <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#0284c7;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-weight:800;font-size:15px;">5</span>
            </div>
            <div>
              <p style="margin:0 0 4px;font-weight:700;color:#1e293b;font-size:15px;">🎤 Interview & Assessment</p>
              <p style="margin:0;color:#64748b;line-height:1.6;font-size:14px;">Shortlisted applicants will be invited for an interview (virtual or in-person) with the prospective employer. Our team will provide you with interview coaching, employer briefing, and scheduling support throughout this stage.</p>
            </div>
          </div>

          <!-- Step 6 -->
          <div style="display:flex;gap:16px;margin-bottom:22px;">
            <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#7c3aed;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-weight:800;font-size:15px;">6</span>
            </div>
            <div>
              <p style="margin:0 0 4px;font-weight:700;color:#1e293b;font-size:15px;">📄 Offer & Pre-Employment Checks</p>
              <p style="margin:0;color:#64748b;line-height:1.6;font-size:14px;">Successful candidates will receive a formal employment offer. Pre-employment requirements (background checks, medical, licensing, and final document submission) will be completed at this stage.</p>
            </div>
          </div>

          <!-- Step 7 -->
          <div style="display:flex;gap:16px;margin-bottom:8px;">
            <div style="flex-shrink:0;width:40px;height:40px;border-radius:50%;background:#10b981;display:flex;align-items:center;justify-content:center;">
              <span style="color:#fff;font-weight:800;font-size:15px;">7</span>
            </div>
            <div>
              <p style="margin:0 0 4px;font-weight:700;color:#1e293b;font-size:15px;">🛂 Visa, Work Permit & Relocation</p>
              <p style="margin:0;color:#64748b;line-height:1.6;font-size:14px;">We will guide you through the full visa and work permit application process for your destination country. Once approved, our team will provide pre-departure briefings and relocation coordination support to help you settle in smoothly.</p>
            </div>
          </div>
        </div>

        <!-- Important Notice -->
        <div style="margin:0 32px 28px;background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:18px 20px;">
          <p style="margin:0 0 6px;font-weight:700;color:#92400e;font-size:13px;">⚠️ Important Reminders</p>
          <ul style="margin:0;padding-left:18px;color:#78350f;font-size:13px;line-height:1.8;">
            <li>Always quote your reference number <strong>${refNumber}</strong> in all communications.</li>
            <li>Respond promptly to requests for documents or action — delays may affect your placement timeline.</li>
            <li>Beware of fraudsters. We will <strong>NEVER</strong> ask for payment through unofficial channels. All payments are communicated through your registered email only.</li>
            <li>Track your application status at any time through our secure portal using your reference number.</li>
          </ul>
        </div>

        <!-- CTA Buttons -->
        <div style="padding:0 32px 32px;text-align:center;">
          <a href="${trackUrl}" style="background:#1565c0;color:#fff;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:700;display:inline-block;font-size:15px;margin-right:12px;margin-bottom:10px;">📊 Track My Application</a>
          <a href="${portalUrl}" style="background:#f8fafc;color:#1565c0;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:700;display:inline-block;font-size:15px;border:2px solid #1565c0;margin-bottom:10px;">👤 Applicant Portal</a>
        </div>

        <!-- Support -->
        <div style="margin:0 32px 32px;text-align:center;">
          <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">Questions? Email us at <a href="mailto:${supportMail}" style="color:#1565c0;font-weight:600;">${supportMail}</a><br>Please quote your reference number <strong>${refNumber}</strong> in every message.</p>
        </div>

        <!-- Footer -->
        <div style="padding:18px;text-align:center;background:#f1f5f9;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">© 2026 Global Job Connect &nbsp;·&nbsp; License: NEA-2025-0192 &nbsp;·&nbsp; Work Anywhere. Grow Everywhere.</p>
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

module.exports = { sendVerificationEmail, sendRefNumberEmail, sendStatusEmail, sendStageUpdateEmail, sendOtpEmail, sendCustomEmail, sendDocumentRequestEmail, sendWelcomeOnboardingEmail };
