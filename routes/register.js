const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const bcrypt    = require('bcryptjs');
const Applicant = require('../models/Applicant');
const Batch     = require('../models/Batch');

// CV file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF/DOC/DOCX allowed'));
  }
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
