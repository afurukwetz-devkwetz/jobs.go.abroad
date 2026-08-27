const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender:      { type: String, enum: ['applicant', 'admin'], required: true },
  text:        { type: String, required: true },
  timestamp:   { type: Date, default: Date.now },
  readByOther: { type: Boolean, default: false }
}, { _id: true });

const SupportTicketSchema = new mongoose.Schema({
  applicantId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true },
  applicantName:     { type: String, required: true },
  applicantEmail:    { type: String, required: true },
  status:            { type: String, enum: ['open', 'closed'], default: 'open' },
  unreadByAdmin:     { type: Number, default: 0 },
  unreadByApplicant: { type: Number, default: 0 },
  lastMessageAt:     { type: Date, default: Date.now },
  messages:          [messageSchema],
  createdAt:         { type: Date, default: Date.now },
  closedAt:          { type: Date }
});

module.exports = mongoose.model('SupportTicket', SupportTicketSchema);
