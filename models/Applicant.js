const mongoose = require('mongoose');

const ApplicantSchema = new mongoose.Schema({
  firstName:     { type: String, required: true },
  lastName:      { type: String, required: true },
  email:         { type: String, required: true, unique: true, lowercase: true },
  phone:         { type: String },
  dob:           { type: Date },
  gender:        { type: String },
  profession:    { type: String, required: true },
  experience:    { type: String },
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

  // Nurse Qualification Assessment
  destinations:      { type: [String], default: [] },
  destOther:         { type: String, default: '' },
  englishQuals:      { type: [String], default: [] },
  professionalRegs:  { type: [String], default: [] },
  germanLevel:       { type: [String], default: [] },
  docsAvailable:     { type: [String], default: [] },
  qualDeclarations:  { type: [String], default: [] },

  // Admin internal note
  adminNote:     { type: String, default: '' },

  // Requested documents (admin asks applicant to upload specific files)
  requestedDocuments: [{
    label:       { type: String },
    uploadedUrl: { type: String, default: null },
    requestedAt: { type: Date, default: Date.now }
  }],

  createdAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('Applicant', ApplicantSchema);
