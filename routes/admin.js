const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Setting = require('../models/Setting');
const { loginLimiter } = require('../middleware/rateLimiter');

// Middleware: verify admin JWT
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// POST /api/admin/login
router.post('/login', loginLimiter, (req, res) => {
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

// GET /api/admin/settings — fetch current settings (admin only)
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settings = await Setting.find();
    const config = {};
    settings.forEach(s => { config[s.key] = s.value; });
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings — update one or more settings (admin only)
router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const updates = req.body;
    for (const [key, value] of Object.entries(updates)) {
      await Setting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
    }
    res.json({ success: true, message: 'Settings updated' });
  } catch (err) {
    console.error('[Admin Settings]', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
