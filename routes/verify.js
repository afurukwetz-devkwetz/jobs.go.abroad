const express = require('express');
const router = express.Router();
const Applicant = require('../models/Applicant');
const Otp = require('../models/Otp');
const { sendOtpEmail } = require('../middleware/emailService');

// POST /api/verify/send-otp
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Check if applicant already exists
    const existing = await Applicant.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'An application with this email already exists.' });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Upsert OTP in database
    await Otp.findOneAndUpdate(
      { email: email.toLowerCase() },
      { otp: otpCode, createdAt: Date.now() },
      { upsert: true, returnDocument: 'after' }
    );

    // Send email
    await sendOtpEmail({ email: email.toLowerCase(), otp: otpCode });

    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (err) {
    console.error('❌ [OTP Error]:', err);
    res.status(500).json({ error: 'Failed to send OTP. Please try again later.' });
  }
});

// GET /api/verify/:token
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const applicant = await Applicant.findOne({ verificationToken: token });

    if (!applicant) {
      return res.status(400).send(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h2 style="color: #ef5350;">Verification Failed</h2>
          <p>Invalid or expired verification token.</p>
          <a href="/" style="color: #1565c0;">Go back to home</a>
        </div>
      `);
    }

    applicant.isVerified = true;
    applicant.verificationToken = undefined; // Clear the token
    await applicant.save();

    res.send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h2 style="color: #4caf50;">Email Verified!</h2>
        <p>Thank you, ${applicant.firstName}. Your email has been successfully verified.</p>
        <p>You can now track your application status using your reference number: <strong>${applicant.refNumber}</strong></p>
        <a href="/" style="display: inline-block; background-color: #1565c0; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 20px;">Go to Website</a>
      </div>
    `);

  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).send('Server error during verification.');
  }
});

module.exports = router;
