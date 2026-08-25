const express   = require('express');
const router    = express.Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const Applicant = require('../models/Applicant');
const { authLimiter } = require('../middleware/rateLimiter');

// POST /api/applicant/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required.' });

    const applicant = await Applicant.findOne({ email: email.toLowerCase().trim() });
    if (!applicant)
      return res.status(401).json({ error: 'No application found with this email address.' });

    const match = await bcrypt.compare(password, applicant.password);
    if (!match)
      return res.status(401).json({ error: 'Incorrect password.' });

    if (!process.env.JWT_SECRET)
      return res.status(500).json({ error: 'Server configuration error.' });

    // Update last login
    applicant.lastLoginAt = new Date();
    await applicant.save();

    const token = jwt.sign(
      { id: applicant._id, email: applicant.email, role: 'applicant' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ success: true, token });
  } catch (err) {
    console.error('❌ [Applicant Login]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/applicant/me  — returns own profile (JWT required)
router.get('/me', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
      return res.status(401).json({ error: 'Authentication required.' });

    const token = auth.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    if (decoded.role !== 'applicant')
      return res.status(403).json({ error: 'Access denied.' });

    const applicant = await Applicant.findById(decoded.id).select('-password -verificationToken');
    if (!applicant) return res.status(404).json({ error: 'Applicant not found.' });

    res.json(applicant);
  } catch (err) {
    console.error('❌ [Applicant /me]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/applicant/upload-doc — applicant uploads a requested document
router.post('/upload-doc', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required.' });

    const jwt = require('jsonwebtoken');
    let decoded;
    try { decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET); }
    catch { return res.status(401).json({ error: 'Session expired.' }); }

    if (decoded.role !== 'applicant') return res.status(403).json({ error: 'Access denied.' });

    // Set up multer dynamically
    const multer = require('multer');
    const path   = require('path');
    let upload;

    const CLOUDINARY_OK = process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;
    if (CLOUDINARY_OK) {
      const cloudinary  = require('../config/cloudinary');
      const { CloudinaryStorage } = require('multer-storage-cloudinary');
      const storage = new CloudinaryStorage({ cloudinary, params: { folder: 'cosnurses_docs', resource_type: 'auto' } });
      upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
    } else {
      upload = multer({ dest: 'uploads/', limits: { fileSize: 5 * 1024 * 1024 } });
    }

    upload.single('file')(req, res, async function(err) {
      if (err) return res.status(400).json({ error: 'File upload error: ' + err.message });
      if (!req.file) return res.status(400).json({ error: 'No file provided.' });

      const { docId } = req.body;
      const fileUrl = req.file.path || req.file.filename;

      const applicant = await Applicant.findById(decoded.id);
      if (!applicant) return res.status(404).json({ error: 'Applicant not found.' });

      const doc = applicant.requestedDocuments.id(docId);
      if (!doc) return res.status(404).json({ error: 'Document request not found.' });

      await Applicant.updateOne(
        { _id: applicant._id, 'requestedDocuments._id': docId },
        { $set: {
          'requestedDocuments.$.uploadedUrl': fileUrl,
          'requestedDocuments.$.status': 'Pending',
          'requestedDocuments.$.adminNote': ''
        }}
      );

      res.json({ success: true, url: fileUrl });
    });
  } catch (err) {
    console.error('❌ [Upload Doc]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
