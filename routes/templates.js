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
      // ─── Application ────────────────────────────────────────────────────────────
      {
        category: 'Application', name: 'Application Received',
        subject: 'Application Received – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nThank you for submitting your application for [Position]. We confirm that your application has been received and is currently under review.\n\nWe will contact you regarding the next stage of the process.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Application', name: 'Application Under Review',
        subject: 'Application Under Review – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nYour application for [Position] is currently under review by our recruitment team. We appreciate your patience and will provide an update once the review is complete.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Application', name: 'Application Shortlisted',
        subject: 'Congratulations – Application Shortlisted | [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nCongratulations! Your application for [Position] has been shortlisted. Your application will now proceed to the next stage of the recruitment process.\n\nFurther instructions will follow shortly.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Application', name: 'Application Unsuccessful',
        subject: 'Update on Your Application – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nThank you for your interest in [Position]. After careful consideration, we regret to inform you that your application will not proceed to the next stage at this time.\n\nWe appreciate your time and wish you success in your future career.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Documents ───────────────────────────────────────────────────────────────
      {
        category: 'Documents', name: 'Documents Required',
        subject: 'Action Required: Documents Needed – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nTo continue processing your application for [Position], please submit the following documents:\n\n[Documents]\n\nPlease provide them by [Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Documents', name: 'Missing Documents',
        subject: 'Action Required: Outstanding Documents – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nOur review shows that the following documents are still outstanding:\n\n[Documents]\n\nPlease submit them by [Deadline] to avoid delays in processing your application.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Documents', name: 'Document Resubmission',
        subject: 'Action Required: Document Resubmission – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nThe [Document Name] submitted with your application could not be accepted because [Reason].\n\nPlease provide a clear and valid replacement by [Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Documents', name: 'Documents Accepted',
        subject: 'Documents Accepted – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe confirm that the documents submitted for your application have been received and reviewed successfully.\n\nYour application will now proceed to the next stage.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Documents', name: 'Passport/ID Request',
        subject: 'Action Required: Passport/ID Verification – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nPlease provide a clear copy of your valid [Passport/ID] for verification. Ensure that all details are visible and the document is not expired.\n\nDeadline: [Deadline]\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Documents', name: 'Qualification Verification',
        subject: 'Action Required: Qualification Verification – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nAs part of our verification process, please provide [Qualification/Certificate/Transcript] for review.\n\nPlease submit the requested documents by [Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Documents', name: 'Verification Completed',
        subject: 'Verification Completed – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe confirm that the initial verification of your submitted documents has been completed successfully.\n\nYour application will now proceed to the next stage.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Payments ────────────────────────────────────────────────────────────────
      {
        category: 'Payments', name: 'Processing Fee Request',
        subject: 'Payment Required – Processing Fee | [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nYour application has progressed to the next stage. A processing fee of [Amount] [Currency] is applicable for [Purpose].\n\nPayment should be completed by [Deadline]. Please use the approved payment instructions provided by our team.\n\nAfter payment, please forward your official payment confirmation for verification.\n\nNote: Payment does not guarantee employment, visa approval, or placement.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Payments', name: 'Payment Reminder',
        subject: 'Reminder: Outstanding Payment – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nThis is a reminder that the [Fee Type] payment of [Amount] [Currency] remains outstanding.\n\nPlease complete the payment by [Deadline] and submit your official payment confirmation.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Payments', name: 'Payment Received',
        subject: 'Payment Confirmed – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe confirm receipt of your payment of [Amount] [Currency] for [Purpose].\n\nYour payment has been recorded against Application ID [Application ID]. We will now proceed with the next stage.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Payments', name: 'Payment Verification',
        subject: 'Action Required: Payment Verification – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe are currently unable to verify the payment submitted for [Purpose].\n\nPlease provide the official payment receipt or transaction confirmation for review.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Assessment ──────────────────────────────────────────────────────────────
      {
        category: 'Assessment', name: 'Assessment Invitation',
        subject: 'Assessment Invitation – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nYou are invited to complete the [Assessment Name] as part of your application for [Position].\n\nPlease complete the assessment by [Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Interview ───────────────────────────────────────────────────────────────
      {
        category: 'Interview', name: 'Interview Invitation',
        subject: 'Interview Invitation – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe are pleased to invite you for an interview for [Position].\n\nDate: [Interview Date]\nTime: [Interview Time]\nLocation/Platform: [Interview Location]\n\nPlease confirm your availability at your earliest convenience.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Interview', name: 'Interview Reminder',
        subject: 'Interview Reminder – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nThis is a reminder that your interview for [Position] is scheduled for [Interview Date] at [Interview Time] via [Interview Location].\n\nWe look forward to speaking with you.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Interview', name: 'Interview Rescheduled',
        subject: 'Interview Rescheduled – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nPlease note that your interview for [Position] has been rescheduled to [Interview Date] at [Interview Time].\n\nWe apologize for any inconvenience and appreciate your understanding.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Interview', name: 'Interview Follow-Up',
        subject: 'Interview Follow-Up – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nThank you for attending your interview for [Position]. We appreciate your time and interest.\n\nYour application remains under consideration, and we will contact you with an update.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Selection ───────────────────────────────────────────────────────────────
      {
        category: 'Selection', name: 'Candidate Selected',
        subject: 'Congratulations – Selected for [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nCongratulations! We are pleased to inform you that you have been selected for [Position] with [Employer].\n\nFurther information regarding your offer and next steps will follow.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Offer & Acceptance ──────────────────────────────────────────────────────
      {
        category: 'Offer & Acceptance', name: 'Employment Offer',
        subject: 'Employment Offer – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe are pleased to offer you the position of [Position] with [Employer].\n\nPlease review the attached offer letter and confirm your acceptance by [Deadline].\n\nCongratulations!\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Offer & Acceptance', name: 'Offer Acceptance',
        subject: 'Offer Acceptance Confirmed – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe confirm receipt of your signed offer for [Position]. Congratulations, and welcome to the next stage of the process.\n\nFurther onboarding instructions will follow.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Offer & Acceptance', name: 'Offer Expiry Reminder',
        subject: 'Urgent: Offer Expiring Soon – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nThis is a reminder that your offer for [Position] is due to expire on [Deadline].\n\nPlease confirm your acceptance before the stated deadline to avoid the offer being withdrawn.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Pre-Employment ──────────────────────────────────────────────────────────
      {
        category: 'Pre-Employment', name: 'Pre-Employment Requirements',
        subject: 'Action Required: Pre-Employment Requirements – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nBefore your employment can be finalized, please complete the following requirements:\n\n[Requirements]\n\nPlease complete them by [Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Pre-Employment', name: 'Background Verification',
        subject: 'Action Required: Background Verification – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nYour application has progressed to the verification stage. Please provide the information/documents required for [Background Check/Verification] by [Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Pre-Employment', name: 'Medical/Other Check',
        subject: 'Action Required: Medical Check – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nPlease complete the required [Medical/Other Check] as part of the pre-employment process.\n\nFollow the instructions provided and complete this requirement by [Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Onboarding ──────────────────────────────────────────────────────────────
      {
        category: 'Onboarding', name: 'Onboarding Instructions',
        subject: 'Onboarding Details – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWelcome to [Company Name]!\n\nYour onboarding details are:\n\nPosition: [Position]\nStart Date: [Start Date]\nLocation: [Interview Location]\nReporting Time: [Interview Time]\n\nPlease bring [Documents] on your first day.\n\nWe look forward to welcoming you!\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Onboarding', name: 'Welcome Email',
        subject: 'Welcome to the Team – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWelcome to [Company Name]! We are pleased to have you joining us as [Position].\n\nYour start date is [Start Date]. We look forward to welcoming you to the team.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Visa & Work Permit ──────────────────────────────────────────────────────
      {
        category: 'Visa & Work Permit', name: 'Visa/Work Permit Documents',
        subject: 'Action Required: Visa/Work Permit Documents – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nYour application has progressed to the visa/work permit stage. Please provide the required documents listed below by [Deadline]:\n\n[Documents]\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Visa & Work Permit', name: 'Visa/Work Permit Update',
        subject: 'Visa/Work Permit Update – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe would like to update you on your [Visa Status] application.\n\nCurrent status: [Visa Status]\n\nWe will provide further information when the next update is available.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Travel & Relocation ─────────────────────────────────────────────────────
      {
        category: 'Travel & Relocation', name: 'Travel/Relocation Information',
        subject: 'Travel & Relocation Details – [Country] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nAs you prepare to relocate to [Country], please review the following details:\n\nTravel Date: [Start Date]\nDestination: [Country]\nReporting Date: [Start Date]\n\nPlease ensure you have all required documents before departure.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Follow-Up ───────────────────────────────────────────────────────────────
      {
        category: 'Follow-Up', name: 'Processing Delay',
        subject: 'Processing Delay Update – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe would like to inform you that there is a delay in processing your application due to [Reason]. Your application remains active, and we will provide an update as soon as possible.\n\nWe appreciate your patience.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Follow-Up', name: 'Applicant Follow-Up',
        subject: 'Follow-Up – Outstanding Requirement | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe are following up regarding your application for [Position]. We are still awaiting [Documents].\n\nPlease provide the outstanding item by [Deadline].\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Follow-Up', name: 'Final Reminder',
        subject: 'Final Reminder: Action Required – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nThis is a final reminder regarding the outstanding [Documents]. Please complete the required action by [Deadline].\n\nFailure to respond may result in your application being placed on hold or closed.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Application Hold ─────────────────────────────────────────────────────────
      {
        category: 'Application Hold', name: 'Application On Hold',
        subject: 'Application On Hold – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nYour application for [Position] has been placed on hold pending [Reason]. We will contact you once the outstanding matter has been resolved.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Application Closure ─────────────────────────────────────────────────────
      {
        category: 'Application Closure', name: 'Application Withdrawal',
        subject: 'Application Withdrawn – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe confirm receipt of your request to withdraw your application for [Position]. Your application has now been closed.\n\nWe appreciate your interest in [Company Name] and wish you all the best.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Application Closure', name: 'Application Closed',
        subject: 'Application Closed – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nYour application for [Position] has now been closed due to [Reason].\n\nThank you for your interest in [Company Name], and we wish you success in your future career.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Application Closure', name: 'Recruitment Process Completed',
        subject: 'Recruitment Process Completed – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe are pleased to confirm that all required recruitment stages for [Position] have been completed successfully.\n\nThank you for your cooperation and patience throughout the process.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── Final Placement ──────────────────────────────────────────────────────────
      {
        category: 'Final Placement', name: 'Placement Confirmation',
        subject: 'Placement Confirmed – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nCongratulations! We are pleased to confirm the successful completion of your recruitment process for [Position] with [Employer] in [Country].\n\nYour next steps: [Documents]\n\nWe wish you every success in your new role.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Final Placement', name: 'Candidate Feedback',
        subject: 'We Value Your Feedback – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe value your experience with our recruitment process. Please take a few minutes to provide your feedback.\n\nYour comments help us improve our services.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Final Placement', name: 'Talent Pool',
        subject: 'Talent Pool Invitation – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nAlthough your application for [Position] was not selected at this time, we were impressed by your profile.\n\nWith your permission, we would like to retain your details for consideration for suitable future opportunities.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      // ─── General / Other ──────────────────────────────────────────────────────────
      {
        category: 'Application', name: 'Change in Position',
        subject: 'Update: Change in Position – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe would like to inform you of an update to your application. The position has changed from [Position] to [Position].\n\nPlease review the updated details and confirm your acceptance.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Application', name: 'Change in Start Date',
        subject: 'Update: Change in Start Date – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nPlease note that your expected start date has been changed from [Start Date] to [Start Date].\n\nWe apologize for any inconvenience and appreciate your understanding.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Application', name: 'Change in Employer/Location',
        subject: 'Update: Change in Employer/Location – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe would like to inform you of an update regarding your placement. Your employer/location has changed to [Employer] / [Country].\n\nPlease review the updated information and contact us with any questions.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Application', name: 'Applicant Information Update',
        subject: 'Action Required: Information Update – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nPlease review your applicant information and confirm whether the following details are correct:\n\n[Documents]\n\nIf any information has changed, please provide the updated details at your earliest convenience.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Documents', name: 'Deadline Extension',
        subject: 'Deadline Extended – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nWe have extended the deadline for submitting [Documents] to [Deadline].\n\nPlease ensure that the outstanding requirement is completed by the new deadline.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Application', name: 'Compliance Notice',
        subject: 'Important: Compliance Notice – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nPlease ensure that all documents and information submitted during the recruitment process are accurate, complete, and genuine.\n\nAny discrepancies may affect the processing of your application.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Application', name: 'Recruitment Contact Information',
        subject: 'Your Recruitment Contact Details – Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nFor questions regarding your application, please contact [HR Officer] at [Contact Information].\n\nPlease quote Application ID [Application ID] in all correspondence.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      },
      {
        category: 'Application', name: 'General Status Update',
        subject: 'Application Status Update – [Position] | Ref: [Application ID]',
        body: 'Dear [Applicant Name],\n\nYour application for [Position] is currently at the [Stage] stage. We are continuing to process your application and will contact you when further action is required.\n\nKind regards,\n[HR Officer]\n[Company Name]\n[Contact Information]'
      }
    ];

    await Template.insertMany(initialTemplates);
    res.json({ success: true, message: initialTemplates.length + ' templates seeded successfully' });
  } catch (err) {
    console.error('Error seeding templates:', err);
    res.status(500).json({ success: false, error: 'Server error seeding templates' });
  }
});

module.exports = router;
