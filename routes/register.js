const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const bcrypt     = require('bcryptjs');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const Applicant  = require('../models/Applicant');
const Batch      = require('../models/Batch');

// ── STORAGE STRATEGY ─────────────────────────────────────────────────────────
// Use Cloudinary only when real credentials are provided; fall back to local disk.
const CLOUDINARY_CONFIGURED =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name' &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_KEY !== 'your_api_key' &&
  process.env.CLOUDINARY_API_SECRET &&
  process.env.CLOUDINARY_API_SECRET !== 'your_api_secret';

let upload;

if (CLOUDINARY_CONFIGURED) {
  console.log('☁️  [Storage] Cloudinary configured — CVs will be stored in the cloud.');
  const cloudinary           = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const cloudStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder:           'cosnurses_cvs',
      resource_type:    'raw',          // required for PDF/DOC/DOCX
      allowed_formats:  ['pdf', 'doc', 'docx'],
    },
  });

  upload = multer({
    storage: cloudStorage,
    limits:  { fileSize: 5 * 1024 * 1024 },
  });
} else {
  console.warn('⚠️  [Storage] Cloudinary NOT configured — falling back to local disk (/uploads).');

  // Ensure local uploads folder exists
  const uploadDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const diskStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename:    (_req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    },
  });

  upload = multer({
    storage: diskStorage,
    limits:  { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['.pdf', '.doc', '.docx'];
      if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF, DOC, and DOCX files are allowed.'));
      }
    },
  });
}

// ── POST /api/register ────────────────────────────────────────────────────────
router.post('/', upload.single('cvFile'), async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, dob, gender,
      profession, experience, country, qualification, bio, password,
    } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !password || !profession)
      return res.status(400).json({ error: 'Required fields missing.' });

    // Duplicate-email check
    if (await Applicant.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ error: 'This email is already registered.' });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Unique reference number
    const refNumber = 'GJB-' + Date.now().toString().slice(-8);

    // Batch assignment
    const batch = await Batch.getOrCreate(profession.toLowerCase());
    await Batch.addMember(batch._id);

    // Verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Resolve CV path/URL
    let cvFile = null;
    if (req.file) {
      // Cloudinary returns .path as the secure URL; disk returns a local path
      cvFile = req.file.path || req.file.filename || null;
    }

    // Save applicant
    const applicant = new Applicant({
      firstName, lastName, email, phone, dob, gender,
      profession, experience, country, qualification, bio,
      password: hashed,
      cvFile,
      refNumber,
      batchId:   batch._id,
      batchCode: batch.batchCode,
      verificationToken,
    });

    await applicant.save();

    // ── SEND VERIFICATION EMAIL ──────────────────────────────────────────────
    try {
      console.log('📧 [Email] Sending verification email to:', email);

      const transporter = nodemailer.createTransport({
        host:   'smtp.gmail.com',
        port:   465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.verify();
      console.log('✅ [Email] SMTP connection verified');

      const verifyUrl =
        `${process.env.FRONTEND_URL || 'https://jobs-go-abroad-3pbi.onrender.com'}/api/verify/${verificationToken}`;

      await transporter.sendMail({
        from:    `"Global Job Connect Team" <${process.env.EMAIL_USER}>`,
        to:      email,
        subject: 'Verify Your Email – Global Job Connect Registration',
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #eee;padding:20px;border-radius:10px;">
            <h2 style="color:#1565c0;">Welcome to Global Job Connect, ${firstName}!</h2>
            <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
            <div style="text-align:center;margin:30px 0;">
              <a href="${verifyUrl}"
                 style="background-color:#1565c0;color:white;padding:12px 25px;text-decoration:none;border-radius:5px;font-weight:bold;">
                Verify Email Address
              </a>
            </div>
            <p>If the button doesn't work, copy and paste this link:</p>
            <p style="word-break:break-all;color:#666;">${verifyUrl}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <p style="font-size:12px;color:#999;">If you did not register, please ignore this email.</p>
          </div>
        `,
      });

      console.log('🚀 [Email] Verification email sent to:', email);
    } catch (mailErr) {
      // Email failure must NOT prevent successful registration
      console.error('❌ [Email] Failed to send verification email:', mailErr.message);
    }

    res.status(201).json({
      success:   true,
      refNumber,
      batchCode: batch.batchCode,
      message:   'Registration successful! Please check your email to verify your account.',
    });

  } catch (err) {
    console.error('❌ [Register] Unexpected error:', err);
    res.status(500).json({
      error:   'Server error. Please try again.',
      details: err.message,
    });
  }
});

module.exports = router;
