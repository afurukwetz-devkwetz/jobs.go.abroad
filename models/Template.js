const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Application', 'Documents', 'Payments', 'Assessment', 'Interview',
      'Selection', 'Offer & Acceptance', 'Pre-Employment', 'Onboarding',
      'Visa & Work Permit', 'Travel & Relocation', 'Follow-Up',
      'Application Hold', 'Application Closure', 'Final Placement'
    ]
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Template', templateSchema);
