const express = require('express');
const router = express.Router();
const Template = require('../models/Template');

// ─── GET all templates (grouped by category) ─────────────────────────────
router.get('/', async (req, res) => {
  try {
    const templates = await Template.find({ isActive: true }).sort({ category: 1, name: 1 });
    // Group by category
    const grouped = templates.reduce((acc, template) => {
      if (!acc[template.category]) acc[template.category] = [];
      acc[template.category].push(template);
      return acc;
    }, {});
    res.json({ success: true, templates, grouped });
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ success: false, error: 'Server error fetching templates' });
  }
});

// ─── GET a single template by ID ─────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, template });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ─── POST create a new template ─────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { name, category, subject, body } = req.body;
    if (!name || !category || !subject || !body) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }
    
    const existing = await Template.findOne({ name });
    if (existing) return res.status(400).json({ success: false, error: 'A template with this name already exists' });

    const template = new Template({ name, category, subject, body });
    await template.save();
    res.json({ success: true, template });
  } catch (err) {
    console.error('Error creating template:', err);
    res.status(500).json({ success: false, error: 'Server error creating template' });
  }
});

// ─── PUT update an existing template ─────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { name, category, subject, body } = req.body;
    
    // Check if name is being taken by another template
    if (name) {
      const existing = await Template.findOne({ name, _id: { $ne: req.params.id } });
      if (existing) return res.status(400).json({ success: false, error: 'A template with this name already exists' });
    }

    const template = await Template.findByIdAndUpdate(
      req.params.id, 
      { $set: { name, category, subject, body } }, 
      { new: true }
    );
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    
    res.json({ success: true, template });
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ success: false, error: 'Server error updating template' });
  }
});

// ─── DELETE (soft delete / archive) a template ───────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const template = await Template.findByIdAndUpdate(req.params.id, { isActive: false });
    if (!template) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, message: 'Template archived' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error archiving template' });
  }
});

// ─── SEED the initial 40+ templates ──────────────────────────────────────
router.post('/seed', async (req, res) => {
  try {
    const count = await Template.countDocuments();
    if (count > 0) return res.json({ success: true, message: 'Templates already seeded' });

    const initialTemplates = [
      { category: 'Application', name: 'Application Received', subject: 'Application Received – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nThank you for applying for the position of [Position] with [Company Name].\n\nWe confirm that your application has been received and is currently under review.\n\nIf your application meets the requirements for the next stage, we will contact you with further instructions.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Application', name: 'Application Under Review', subject: 'Application Under Review – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe would like to inform you that your application for [Position] is currently under review.\n\nOur recruitment team is assessing your qualifications and supporting documents. We will contact you once the review has been completed.\n\nThank you for your patience.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Application', name: 'Application Shortlisted', subject: 'Application Shortlisted – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe are pleased to inform you that your application for [Position] has been shortlisted.\n\nYou have successfully met the initial requirements, and your application will now proceed to the next stage of the recruitment process.\n\nFurther instructions will be provided shortly.\n\nCongratulations, and we look forward to working with you.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Application', name: 'Application Unsuccessful', subject: 'Update on Your Application – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nThank you for your interest in [Position] and for taking the time to submit your application.\n\nAfter careful consideration, we regret to inform you that your application will not proceed to the next stage at this time.\n\nWe appreciate your interest in [Company Name] and wish you every success in your future career.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Documents', name: 'Request for Documents', subject: 'Request for Documents – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nTo proceed with your application, please provide the following documents:\n\n[List Required Documents Here]\n\nPlease submit clear and valid copies by [Document Deadline].\n\nKindly reply to this email with the required documents attached.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Documents', name: 'Missing Documents', subject: 'Action Required: Missing Documents – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nFollowing our review of your application, we note that the following documents are still outstanding:\n\n[List Outstanding Documents Here]\n\nPlease provide the outstanding documents by [Document Deadline] to avoid delays in processing your application.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Documents', name: 'Document Resubmission', subject: 'Action Required: Document Resubmission – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe have received the documents submitted with your application. However, [Document Name] could not be properly verified because [Reason – unclear/expired/incomplete].\n\nPlease provide a clear and valid copy of the document by [Document Deadline].\n\nThank you for your cooperation.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Documents', name: 'Document Accepted', subject: 'Documents Accepted – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe are pleased to confirm that the documents you submitted have been accepted and successfully verified.\n\nYour application will now proceed to the next stage of the recruitment process.\n\nWe will contact you if any additional information is required.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Documents', name: 'Document Rejected', subject: 'Document Rejected – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe regret to inform you that the document [Document Name] you submitted does not meet our requirements and has been rejected.\n\nReason: [Rejection Reason]\n\nPlease arrange to submit a valid version of this document by [Document Deadline] to continue with your application.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Documents', name: 'Passport/ID Request', subject: 'Action Required: Passport/ID Verification – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nAs part of the verification process, please provide a clear copy of your valid Passport or National ID.\n\nPlease ensure that all relevant information is clearly visible and that the document is valid.\n\nKindly submit it by [Document Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Assessment', name: 'Assessment Invitation', subject: 'Assessment Invitation – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nYou have been invited to complete an assessment as part of the recruitment process for [Position].\n\nDate: [Interview Date]\nTime: [Interview Time]\nLocation/Platform: [Interview Location]\n\nPlease complete the assessment within the specified timeframe.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Assessment', name: 'Qualification Verification', subject: 'Credential Verification – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nAs part of our verification process, we are currently reviewing your academic and/or professional qualifications.\n\nPlease provide the following information/documents:\n\n- [Certificate/Diploma/Degree]\n- [Transcript]\n- [Professional Registration/License]\n\nPlease ensure that the information provided is accurate and complete by [Document Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Assessment', name: 'Verification Completed', subject: 'Verification Completed – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe are pleased to confirm that the initial verification of your submitted documents and qualifications has been completed successfully.\n\nYour application will now proceed to the next stage of the recruitment process.\n\nWe will contact you if any additional information is required.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Payments', name: 'Processing Fee Request', subject: 'Payment Required: Processing Fee – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nYour application has progressed to the next stage.\n\nThe following fee is applicable:\n\nFee: Processing/Recruitment Fee\nAmount: [Currency] [Amount]\nDue Date: [Payment Deadline]\n\nPayment instructions are provided below:\n\n[Insert Payment Instructions]\n\nAfter completing the payment, please reply to this email with the official payment confirmation/receipt. Please note that payment does not guarantee employment or placement.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Payments', name: 'Payment Reminder', subject: 'Payment Reminder – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nThis is a friendly reminder that the payment of [Currency] [Amount] for [Purpose] remains outstanding.\n\nPlease complete the payment by [Payment Deadline] to prevent delays in the processing of your application.\n\nIf you have already made the payment, kindly forward the official receipt or payment confirmation to us.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Payments', name: 'Payment Received', subject: 'Payment Received – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe confirm receipt of your payment of [Currency] [Amount].\n\nYour payment has been recorded against application reference [Application ID].\n\nWe will now proceed with the relevant stage of your application.\n\nThank you.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Payments', name: 'Payment Verification', subject: 'Action Required: Payment Verification – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe are currently unable to verify the payment submitted for [Purpose].\n\nPlease provide the official payment receipt/confirmation showing:\n\n- Transaction/reference number\n- Amount paid\n- Date of payment\n- Payment method\n\nOnce received, our team will review and update your application.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Interview', name: 'Interview Invitation', subject: 'Interview Invitation – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe are pleased to invite you for an interview for the position of [Position].\n\nDate: [Interview Date]\nTime: [Interview Time]\nLocation/Platform: [Interview Location]\n\nPlease confirm your availability by [Document Deadline].\n\nWe look forward to speaking with you.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Interview', name: 'Interview Reminder', subject: 'Interview Reminder – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nThis is a friendly reminder that your interview for [Position] is scheduled as follows:\n\nDate: [Interview Date]\nTime: [Interview Time]\nLocation/Platform: [Interview Location]\n\nPlease ensure that you are available and ready at the scheduled time.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Interview', name: 'Interview Rescheduling', subject: 'Interview Rescheduling – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nPlease note that your interview for [Position] has been rescheduled.\n\nNew Date: [Interview Date]\nNew Time: [Interview Time]\nLocation/Platform: [Interview Location]\n\nWe apologize for any inconvenience and appreciate your understanding.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Interview', name: 'Interview Follow-Up', subject: 'Interview Follow-Up – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nThank you for attending the interview for [Position].\n\nWe appreciate the time you took to discuss your qualifications and experience with our team.\n\nYour application remains under consideration, and we will contact you once a decision has been made.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Selection', name: 'Candidate Selected', subject: 'Congratulations! Selected for [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe are pleased to inform you that you have been selected for the position of [Position] with [Employer].\n\nCongratulations on successfully progressing through the recruitment process.\n\nFurther information regarding your offer, employment conditions, and next steps will be provided separately.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Offer & Acceptance', name: 'Employment Offer', subject: 'Employment Offer – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe are pleased to formally offer you the position of [Position] with [Employer] in [Country].\n\nThe key details of the offer are:\n\nPosition: [Position]\nEmployer: [Employer]\nLocation: [Country]\nStart Date: [Start Date]\n\nPlease review the attached offer letter and return the signed copy by [Document Deadline].\n\nCongratulations!\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Offer & Acceptance', name: 'Offer Acceptance', subject: 'Offer Acceptance Confirmation – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nThank you for returning your signed offer letter.\n\nWe confirm that your acceptance has been received and recorded.\n\nWe will now proceed with the remaining pre-employment and onboarding requirements.\n\nFurther instructions will follow.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Offer & Acceptance', name: 'Offer Expiry Reminder', subject: 'Urgent: Offer Expiry Reminder – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nThis is a final reminder that your employment offer for [Position] with [Employer] requires your response.\n\nPlease sign and return the offer letter by [Document Deadline]. If we do not hear from you by this time, we will assume you are no longer interested and the offer will be withdrawn.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Pre-Employment', name: 'Pre-Employment Requirements', subject: 'Action Required: Pre-Employment Requirements – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nAs you prepare to join [Employer], please complete the following requirements:\n\n- [Requirement 1]\n- [Requirement 2]\n\nPlease complete these requirements by [Document Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Pre-Employment', name: 'Background Verification', subject: 'Action Required: Background Verification – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nAs part of the pre-employment process, you are required to complete a background verification check.\n\nPlease follow the instructions provided below:\n\n[Insert Instructions]\n\nKindly complete this requirement by [Document Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Pre-Employment', name: 'Medical/Other Checks', subject: 'Action Required: Medical Check – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nAs part of the pre-employment process, you are required to complete a medical examination.\n\nPlease follow the instructions provided below to schedule your appointment:\n\n[Insert Instructions/Clinic Details]\n\nKindly complete this requirement by [Document Deadline] and forward the results to us.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Onboarding', name: 'Onboarding Instructions', subject: 'Onboarding Instructions – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe are pleased to welcome you to [Company Name].\n\nYour onboarding details are as follows:\n\nPosition: [Position]\nStart Date: [Start Date]\nReporting Time: [Interview Time]\nLocation: [Interview Location]\nReporting To: [Department]\n\nPlease bring [List any required items] on your first day.\n\nWe look forward to welcoming you.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Onboarding', name: 'Welcome Email', subject: 'Welcome to the Team! – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nCongratulations once again on successfully completing the recruitment process.\n\nWe are extremely pleased to welcome you to [Employer] as [Position].\n\nWe look forward to having you join the team and are excited to see you thrive in your new role.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Visa & Work Permit', name: 'Visa/Work Permit Documents', subject: 'Action Required: Visa/Work Permit Documents – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nYour application has progressed to the visa/work permit stage for [Country].\n\nTo begin the relevant process, please provide the following documents:\n\n- Valid passport\n- [Employment/Offer Letter]\n- [Other required documents]\n\nPlease submit the documents by [Document Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Visa & Work Permit', name: 'Visa/Work Permit Status Update', subject: 'Update on Visa/Work Permit – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe would like to provide you with an update regarding your visa/work permit process.\n\nCurrent Status: [Visa Status]\n\nThe next expected step is [Next Step]. We will provide further updates as they become available.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Travel & Relocation', name: 'Travel/Relocation Information', subject: 'Travel & Relocation Details – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nAs you prepare for your relocation to [Country], please review the following information:\n\nExpected Travel Date: [Start Date]\nDestination: [Country]\nAccommodation: [Details, if applicable]\nContact Person: [HR Officer]\n\nPlease ensure that all required travel and employment documents are available before departure.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Follow-Up', name: 'Applicant Follow-Up', subject: 'Follow-Up Regarding Your Application – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe previously contacted you regarding [Documents/Payment/Interview/Requirement], but we have not yet received a response.\n\nPlease provide the requested information by [Document Deadline].\n\nIf we do not hear from you by the stated deadline, your application may be placed on hold.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Follow-Up', name: 'Final Reminder', subject: 'Final Reminder: Action Required – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nThis is our final reminder regarding the outstanding [Requirement/Payment/Document] for your application.\n\nIf we do not receive this by [Document Deadline], your application will be automatically closed.\n\nPlease treat this with urgency.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Application Hold', name: 'Application On Hold', subject: 'Update: Application On Hold – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nPlease be advised that your application for [Position] has been placed on hold pending [Outstanding requirement/Review/Availability].\n\nYour application may resume once the outstanding matter has been resolved.\n\nWe will contact you when there is a further update.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Application Hold', name: 'Processing Delay', subject: 'Processing Delay Update – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe would like to inform you that there is currently a delay in processing your application due to unforeseen circumstances.\n\nYour application remains active, and our team is continuing to work on the next stage. We appreciate your patience and will provide an update as soon as possible.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Application Closure', name: 'Application Withdrawn', subject: 'Application Withdrawn – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe confirm receipt of your request to withdraw your application for [Position].\n\nYour application has now been closed in our recruitment system.\n\nWe appreciate your interest in [Company Name] and wish you all the best.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Application Closure', name: 'Application Closed', subject: 'Application Closed – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe are writing to inform you that your application for [Position] has now been closed due to [Reason, e.g., missing documents, missed deadlines, position filled].\n\nThank you for your interest in [Company Name] and for participating in our recruitment process. We wish you success in your future career.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Application Closure', name: 'Recruitment Process Completed', subject: 'Recruitment Process Completed – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nThis email is to officially notify you that the recruitment process for [Position] is now completed.\n\nAll candidate selections have been finalized. Thank you for your participation and patience throughout this cycle.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      
      { category: 'Final Placement', name: 'Placement Confirmation', subject: 'Final Placement Confirmation – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nWe are thrilled to confirm your final placement as [Position] at [Employer] in [Country].\n\nAll formalities have been completed successfully. We wish you immense success in this new chapter of your career!\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' },
      { category: 'Final Placement', name: 'Candidate Feedback Request', subject: 'We Value Your Feedback – [Position] | [Application ID]', body: 'Dear [Applicant Name],\n\nNow that your recruitment process has concluded, we would love to hear your thoughts on your experience with [Company Name].\n\nPlease let us know how we did and if there is any area we can improve.\n\nThank you for your time and feedback!\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]' }
    ];

    await Template.insertMany(initialTemplates);
    res.json({ success: true, message: 'Seeded successfully' });
  } catch (err) {
    console.error('Error seeding templates:', err);
    res.status(500).json({ success: false, error: 'Server error seeding templates' });
  }
});

module.exports = router;
