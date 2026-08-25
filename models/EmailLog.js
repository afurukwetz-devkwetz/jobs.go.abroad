const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  applicantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Applicant',
    required: true
  },
  templateName: {
    type: String, // E.g., 'Application Received' or 'Custom Email'
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  sentBy: {
    type: String, // Admin email or ID
    default: 'System'
  },
  openedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('EmailLog', emailLogSchema);
