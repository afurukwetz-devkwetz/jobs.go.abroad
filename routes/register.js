const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const bcrypt     = require('bcryptjs');
const crypto     = require('crypto');
const Applicant  = require('../models/Applicant');
const Otp        = require('../models/Otp');
const Batch      = require('../models/Batch');
const { sendVerificationEmail, sendRefNumberEmail } = require('../middleware/emailService');

// ── STORAGE STRATEGY ─────────────────────────────────────────────────────────
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
  const cloudinary            = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const cloudStorage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder:          'cosnurses_cvs',
      resource_type:   'raw', // 'raw' allows any non-image file type. We use 'auto' to allow both docs and images
      allowed_formats: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
    },
  });

  // Switch resource_type to auto so images can be processed natively by Cloudinary
  cloudStorage.params.resource_type = 'auto';

  upload = multer({ storage: cloudStorage, limits: { fileSize: 5 * 1024 * 1024 } });
} else {
  console.warn('⚠️  [Storage] Cloudinary NOT configured — falling back to local disk (/uploads).');
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
      const allowed = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
      if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF, DOC, DOCX, JPG, and PNG files are allowed.'));
      }
    },
  });
}

// Helper: parse multi-value fields from body (may be string or array)
function parseArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val.map(s => String(s).trim()).filter(Boolean)
                            : [String(val).trim()].filter(Boolean);
}

// ── POST /api/register ────────────────────────────────────────────────────────
router.post('/', (req, res, next) => {
  const uploadTimeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('❌ [Upload Error]: Request timed out. Cloudinary or network is hanging.');
      res.status(408).json({ error: 'File upload took too long. Please check your Cloudinary settings or try a smaller file.' });
    }
  }, 25000); // 25 second timeout

  upload.single('cvFile')(req, res, function (err) {
    clearTimeout(uploadTimeout);
    if (res.headersSent) return; // already handled by timeout
    if (err) {
      console.error('❌ [Upload Error]:', err.message);
      return res.status(400).json({ error: 'File upload failed: ' + err.message + '. Please check your file or try again later.' });
    }
    next();
  });
}, async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, dob, gender,
      profession, experience, country, qualification, bio, password,
      destinations, destOther, englishQuals, professionalRegs,
      germanLevel, docsAvailable, qualDeclarations, otp,
    } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !password || !profession || !otp)
      return res.status(400).json({ error: 'Required fields missing, including OTP.' });

    // Validate OTP
    const validOtp = await Otp.findOne({ email: email.toLowerCase(), otp });
    if (!validOtp) {
      return res.status(400).json({ error: 'Invalid or expired Verification Code.' });
    }

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

    // Resolve CV path/URL
    let cvFile = null;
    if (req.file) {
      cvFile = req.file.path || req.file.filename || null;
    }

    // Save applicant (including nurse qualification assessment data)
    const applicant = new Applicant({
      firstName: firstName.trim(), lastName: lastName.trim(),
      email, phone, dob, gender,
      profession, experience, country, qualification, bio,
      password: hashed, cvFile, refNumber,
      batchId: batch._id, batchCode: batch.batchCode,
      isVerified: true,
      destinations:     parseArray(destinations),
      destOther:        (destOther || '').trim(),
      englishQuals:     parseArray(englishQuals),
      professionalRegs: parseArray(professionalRegs),
      germanLevel:      parseArray(germanLevel),
      docsAvailable:    parseArray(docsAvailable),
      qualDeclarations: parseArray(qualDeclarations),
    });

    await applicant.save();

    // Delete OTP now that it's used
    await Otp.deleteOne({ _id: validOtp._id });

    // ── SEND EMAILS (non-blocking — runs after response) ─────────────────────
    setImmediate(async () => {
      try {
        await sendRefNumberEmail({ firstName, email, refNumber, batchCode: batch.batchCode });
        console.log('✅ [Email] Reference number email sent to:', email);
      } catch (e) {
        console.error('❌ [Email] Reference number email failed:', e.message);
      }
    });

    res.status(201).json({
      success:   true,
      refNumber,
      batchCode: batch.batchCode,
      message:   'Registration successful! Check your email for your reference number.',
    });

  } catch (err) {
    console.error('❌ [Register] Unexpected error:', err);
    res.status(500).json({ error: 'Server error. Please try again.', details: err.message });
  }
});

module.exports = router;
