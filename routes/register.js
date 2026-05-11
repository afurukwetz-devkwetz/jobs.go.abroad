const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const bcrypt    = require('bcryptjs');
const Applicant = require('../models/Applicant');
const Batch     = require('../models/Batch');

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

    // Save applicant
    const applicant = new Applicant({
      firstName, lastName, email, phone, dob, gender,
      profession, experience, country, qualification, bio,
      password: hashed,
      cvFile:   req.file ? req.file.path : null,
      refNumber,
      batchId:   batch._id,
      batchCode: batch.batchCode
    });

    await applicant.save();

    res.status(201).json({
      success:   true,
      refNumber,
      batchCode: batch.batchCode,
      message:   `Registration successful! Ref: ${refNumber} | Batch: ${batch.batchCode}`
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
