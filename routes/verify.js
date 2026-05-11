const express = require('express');
const router = express.Router();
const Applicant = require('../models/Applicant');

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
