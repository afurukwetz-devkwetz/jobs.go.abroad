const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // strict limit for auth routes
  message: { error: 'Too many attempts, please try again after 15 minutes.' }
});

// Separate instance so register hits don't consume admin login quota
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again after 15 minutes.' }
});

module.exports = { authLimiter, loginLimiter };
