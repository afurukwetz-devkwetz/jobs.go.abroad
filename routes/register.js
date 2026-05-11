const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const bcrypt    = require('bcryptjs');
const Applicant = require('../models/Applicant');
const Batch     = require('../models/Batch');
const nodemailer = require('nodemailer');
const crypto    = require('crypto');

const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary storage for CVs
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'cosnurses_cvs',
    resource_type: 'auto',
    allowed_formats: ['pdf', 'doc', 'docx']
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/register
router.post('/', upload.single('cvFile'), async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, dob, gender,
      profession, experience, country, qualification, bio, password
    } = req.body;

    if (!firstName || !lastName || !email || !password || !profession)
      return res.status(400).json({ error: 'Required fields missing.' });

    // Check duplicate email
    if (await Applicant.findOne({ email: email.toLowerCase() }))
      return res.status(400).json({ error: 'This email is already registered.' });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Generate unique reference number
    const refNumber = 'COS-' + Date.now().toString().slice(-8);

    // ── BATCH ASSIGNMENT ──
    // Get or create the current open batch for this profession
    const batch = await Batch.getOrCreate(profession.toLowerCase());
    // Add this applicant to the batch (increments count, marks full if limit hit)
    await Batch.addMember(batch._id);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Save applicant
    const applicant = new Applicant({
      firstName, lastName, email, phone, dob, gender,
      profession, experience, country, qualification, bio,
      password: hashed,
      cvFile:   req.file ? req.file.path : null,
      refNumber,
      batchId:   batch._id,
      batchCode: batch.batchCode,
      verificationToken
    });

    await applicant.save();

    // ── SEND VERIFICATION EMAIL ──
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const verifyUrl = `${process.env.FRONTEND_URL || 'https://jobs-go-abroad.onrender.com'}/api/verify/${verificationToken}`;

      const mailOptions = {
        from: `"CoSNurses Team" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify Your Email - CoSNurses Registration',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
            <h2 style="color: #1565c0;">Welcome to CoSNurses, ${firstName}!</h2>
            <p>Thank you for registering. To complete your application and ensure your account is secure, please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="background-color: #1565c0; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email Address</a>
            </div>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verifyUrl}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">If you did not register for an account, please ignore this email.</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
    } catch (mailErr) {
      console.error('❌ [Email] Failed to send verification email:', mailErr);
      // We don't fail registration if email fails, but we should log it
    }

    res.status(201).json({
      success:   true,
      refNumber,
      batchCode: batch.batchCode,
      message:   `Registration successful! Please check your email to verify your account.`
    });

  } catch (err) {
    console.error('❌ [Register] Error:', err);
    res.status(500).json({ 
      error: 'Server error. Please try again.',
      details: err.message
    });
  }
});

module.exports = router;
