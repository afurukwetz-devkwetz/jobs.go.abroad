const mongoose = require('mongoose');

const ApplicantSchema = new mongoose.Schema({
  firstName:     { type: String, required: true },
  lastName:      { type: String, required: true },
  email:         { type: String, required: true, unique: true, lowercase: true },
  phone:         { type: String },
  dob:           { type: Date },
  gender:        { type: String },
  profession:    { type: String, required: true },
  experience:    { type: Number },
  country:       { type: String },
  qualification: { type: String },
  bio:           { type: String },
  cvFile:        { type: String },
  password:      { type: String, required: true },

  refNumber:     { type: String, unique: true },

  // Batch assignment
  batchId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  batchCode:     { type: String },   // e.g. "NRS-B001"

  // Progress: 0=Received 1=DocVerify 2=Background 3=Interview 4=Decision
  progressStep:  { type: Number, default: 0 },
  progressNote:  { type: String, default: '' },
  status:        { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  
  // Verification
  isVerified:    { type: Boolean, default: false },
  verificationToken: { type: String },

  createdAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('Applicant', ApplicantSchema);
