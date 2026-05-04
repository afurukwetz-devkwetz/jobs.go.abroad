const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// POST /api/admin/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check against environment variables (trimming to avoid space errors)
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const adminPass  = (process.env.ADMIN_PASSWORD || '').trim();

    if (email.trim().toLowerCase() === adminEmail && password.trim() === adminPass) {
      if (!process.env.JWT_SECRET) {
        console.error('❌ JWT_SECRET is missing in environment variables');
        return res.status(500).json({ error: 'Server configuration error: Missing JWT_SECRET' });
      }

      // Generate JWT
      const token = jwt.sign(
        { role: 'admin', email: email },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );

      return res.json({ success: true, token });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login', details: err.message });
  }
});

module.exports = router;
