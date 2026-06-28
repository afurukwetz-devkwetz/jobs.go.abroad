const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const Applicant = require('../models/Applicant');
const Batch     = require('../models/Batch');
const { requireAdmin } = require('../middleware/auth');
const { sendStatusEmail, sendCustomEmail, sendDocumentRequestEmail } = require('../middleware/emailService');
const { sendWhatsAppMessage } = require('../middleware/whatsappService');

const STAGES = [
  { label: 'Application Received',   desc: 'Your application was submitted successfully.' },
  { label: 'Document Verification',  desc: 'Our team is verifying your uploaded documents.' },
  { label: 'Background Check',       desc: 'A standard background screening is in progress.' },
  { label: 'Interview / Assessment', desc: 'You will be contacted to schedule an interview.' },
  { label: 'Final Decision',         desc: 'A placement decision will be communicated to you.' }
];

// POST /api/track  — applicant looks up own status
router.post('/', async (req, res) => {
  try {
    const { ref, email } = req.body;
    if (!ref && !email)
      return res.status(400).json({ error: 'Provide a reference number or email.' });

    const query = ref
      ? { refNumber: ref.trim().toUpperCase() }
      : { email: email.trim().toLowerCase() };

    const applicant = await Applicant.findOne(query).select('-password');
    if (!applicant) return res.json({ found: false });

    // Guard: clamp progressStep to valid STAGES range
    const step = Math.min(Math.max(Number(applicant.progressStep) || 0, 0), STAGES.length - 1);

    res.json({
      found:       true,
      name:        `${applicant.firstName} ${applicant.lastName}`,
      ref:         applicant.refNumber,
      profession:  applicant.profession,
      batchCode:   applicant.batchCode  || 'N/A',
      currentStep: step,
      stageName:   STAGES[step].label,
      stageDesc:   STAGES[step].desc,
      note:        applicant.progressNote || '',
      status:      applicant.status      || 'Pending',
      stages:      STAGES
    });

  } catch (err) {
    console.error('❌ [Track] Error:', err);
    res.status(500).json({ error: 'Server error.', details: err.message });
  }
});

// PUT /api/track/update — admin updates a single applicant's progress
// Body: { refNumber, step (0-4), note, status, adminNote }
router.put('/update', requireAdmin, async (req, res) => {
  try {
    const { refNumber, step, note, status, adminNote } = req.body;

    let updateFields = {};
    if (step !== undefined && step >= 0 && step <= 4) {
        updateFields.progressStep = step;
    }
    if (note     !== undefined) updateFields.progressNote = note;
    if (status)                updateFields.status        = status;
    if (adminNote !== undefined) updateFields.adminNote   = adminNote;

    const applicant = await Applicant.findOneAndUpdate(
      { refNumber: refNumber.trim().toUpperCase() },
      updateFields,
      { returnDocument: 'after' }
    );
    if (!applicant) return res.status(404).json({ error: 'Applicant not found.' });

    // Send status notification email (non-blocking)
    if (status && applicant.email) {
      setImmediate(async () => {
        try {
          await sendStatusEmail({
            firstName: applicant.firstName,
            email:     applicant.email,
            refNumber: applicant.refNumber,
            newStatus: status,
            adminNote: adminNote || '',
          });
          console.log(`✅ [Email] Status email (${status}) sent to:`, applicant.email);
        } catch (e) {
          console.error('❌ [Email] Status email failed:', e.message);
        }
        // Send WhatsApp notification if phone available
        if (applicant.phone) {
          const msgMap = {
            Approved: `✅ Hi ${applicant.firstName}, your Global Job Connect application (${applicant.refNumber}) has been *APPROVED*! Our team will contact you shortly with next steps. 🎉`,
            Rejected: `❌ Hi ${applicant.firstName}, we regret to inform you that your application (${applicant.refNumber}) was not successful. We encourage you to reapply in the future.`,
            Pending:  `⏳ Hi ${applicant.firstName}, your application (${applicant.refNumber}) is back in review. We'll update you soon.`,
            Review:   `🔍 Hi ${applicant.firstName}, your application (${applicant.refNumber}) is currently *Under Review* by our team. We'll be in touch shortly.`,
          };
          try {
            await sendWhatsAppMessage({ to: applicant.phone, message: msgMap[status] || msgMap.Pending });
          } catch (e) {
            console.error('❌ [WhatsApp] Failed:', e.message);
          }
        }
      });
    }

    res.json({
      success:   true,
      name:      `${applicant.firstName} ${applicant.lastName}`,
      refNumber: applicant.refNumber,
      step:      applicant.progressStep,
      status:    applicant.status
    });
  } catch (err) {
    console.error('❌ [Track Single Update] Error:', err);
    res.status(500).json({ error: 'Server error.', details: err.message });
  }
});

// PUT /api/track/update-batch — admin bulk-updates all in a batch to a new step
// Body: { batchCode, step, note }
router.put('/update-batch', requireAdmin, async (req, res) => {
  try {
    const { batchCode, step, note } = req.body;
    if (step === undefined || step < 0 || step > 4)
      return res.status(400).json({ error: 'Step must be between 0 and 4.' });

    const result = await Applicant.updateMany(
      { batchCode: batchCode.trim().toUpperCase() },
      { progressStep: step, progressNote: note || '' }
    );

    res.json({
      success:  true,
      batchCode,
      updated:  result.modifiedCount,
      step,
      stageName: STAGES[step].label
    });

  } catch (err) {
    console.error('❌ [Track Batch Update] Error:', err);
    res.status(500).json({ error: 'Server error.', details: err.message });
  }
});

// GET /api/track/applicants — list all applicants (admin dashboard)
router.get('/applicants', requireAdmin, async (req, res) => {
  try {
    const applicants = await Applicant.find().sort({ createdAt: -1 });
    res.json(applicants);
  } catch (err) {
    console.error('❌ [Track List Applicants] Error:', err);
    res.status(500).json({ error: 'Server error.', details: err.message });
  }
});

// GET /api/track/batches — list all batches (admin dashboard)
router.get('/batches', requireAdmin, async (req, res) => {
  try {
    const batches = await Batch.find().sort({ profession: 1, batchNumber: 1 });
    const result  = await Promise.all(batches.map(async b => {
      const members = await Applicant.find({ batchCode: b.batchCode })
        .select('firstName lastName refNumber progressStep createdAt');
      return { ...b.toObject(), members };
    }));
    res.json(result);
  } catch (err) {
    console.error('❌ [Track List Batches] Error:', err);
    res.status(500).json({ error: 'Server error.', details: err.message });
  }
});


// POST /api/track/send-email — admin sends custom email to applicant
router.post('/send-email', requireAdmin, async (req, res) => {
  try {
    const { refNumber, subject, body } = req.body;
    if (!refNumber || !subject || !body)
      return res.status(400).json({ error: 'refNumber, subject, and body are required.' });

    const applicant = await Applicant.findOne({ refNumber: refNumber.trim().toUpperCase() });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found.' });

    await sendCustomEmail({
      to: applicant.email,
      subject,
      body,
      firstName: applicant.firstName,
    });

    res.json({ success: true, message: `Email sent to ${applicant.email}` });
  } catch (err) {
    console.error('❌ [Send Email]:', err);
    res.status(500).json({ error: 'Failed to send email.', details: err.message });
  }
});

// POST /api/track/request-document — admin requests a specific document from applicant
router.post('/request-document', requireAdmin, async (req, res) => {
  try {
    const { refNumber, docLabel } = req.body;
    if (!refNumber || !docLabel)
      return res.status(400).json({ error: 'refNumber and docLabel are required.' });

    const applicant = await Applicant.findOne({ refNumber: refNumber.trim().toUpperCase() });
    if (!applicant) return res.status(404).json({ error: 'Applicant not found.' });

    // Add the document request to the applicant
    applicant.requestedDocuments.push({ label: docLabel });
    await applicant.save();

    // Send email — applicant uploads via /my-application dashboard
    const uploadUrl = `${process.env.FRONTEND_URL || 'https://jobs-go-abroad-3pbi.onrender.com'}/my-application`;
    setImmediate(async () => {
      try {
        await sendDocumentRequestEmail({
          firstName: applicant.firstName,
          email: applicant.email,
          docLabel,
          uploadUrl,
        });
      } catch (e) {
        console.error('❌ [DocRequest Email]:', e.message);
      }
    });

    res.json({ success: true, message: `Document request for "${docLabel}" sent to ${applicant.email}` });
  } catch (err) {
    console.error('❌ [Request Document]:', err);
    res.status(500).json({ error: 'Server error.', details: err.message });
  }
});

// POST /api/track/batch/close — admin closes a batch (no new applicants)
router.post('/batch/close', requireAdmin, async (req, res) => {
  try {
    const { batchCode } = req.body;
    if (!batchCode) return res.status(400).json({ error: 'batchCode is required.' });

    const batch = await Batch.findOneAndUpdate(
      { batchCode: batchCode.trim().toUpperCase() },
      { isClosed: true, isFull: true, closedAt: new Date() },
      { returnDocument: 'after' }
    );
    if (!batch) return res.status(404).json({ error: 'Batch not found.' });

    res.json({ success: true, message: `Batch ${batchCode} is now closed.`, batch });
  } catch (err) {
    console.error('❌ [Close Batch]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/track/batch/export/:batchCode — export batch as CSV
router.get('/batch/export/:batchCode', requireAdmin, async (req, res) => {
  try {
    const batchCode = req.params.batchCode.toUpperCase();
    const applicants = await Applicant.find({ batchCode }).select('-password -verificationToken').lean();

    if (!applicants.length) return res.status(404).json({ error: 'No applicants found in this batch.' });

    const headers = ['Ref Number','First Name','Last Name','Email','Phone','Profession','Experience','Country','Qualification','Status','Verified','Applied Date'];
    const rows = applicants.map(a => [
      a.refNumber, a.firstName, a.lastName, a.email, a.phone || '',
      a.profession, a.experience || '', a.country || '', a.qualification || '',
      a.status || 'Pending', a.isVerified ? 'Yes' : 'No',
      a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${batchCode}-applicants.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('❌ [Export CSV]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/track/analytics — admin analytics data
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    const all = await Applicant.find().select('status profession country createdAt isVerified').lean();

    const total     = all.length;
    const approved  = all.filter(a => a.status === 'Approved').length;
    const rejected  = all.filter(a => a.status === 'Rejected').length;
    const pending   = all.filter(a => a.status === 'Pending').length;
    const verified  = all.filter(a => a.isVerified).length;

    // Last 30 days daily counts
    const now = Date.now();
    const daily = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      daily[d.toISOString().slice(0,10)] = 0;
    }
    all.forEach(a => {
      const day = new Date(a.createdAt).toISOString().slice(0,10);
      if (daily[day] !== undefined) daily[day]++;
    });

    // Country distribution (top 10)
    const countryMap = {};
    all.forEach(a => { if (a.country) countryMap[a.country] = (countryMap[a.country] || 0) + 1; });
    const countries = Object.entries(countryMap).sort((a,b) => b[1]-a[1]).slice(0,10)
      .map(([country, count]) => ({ country, count }));

    // Profession split
    const profMap = {};
    all.forEach(a => { profMap[a.profession] = (profMap[a.profession] || 0) + 1; });
    const professions = Object.entries(profMap).map(([profession, count]) => ({ profession, count }));

    res.json({
      total, approved, rejected, pending, verified,
      approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0,
      daily: { labels: Object.keys(daily), data: Object.values(daily) },
      countries,
      professions,
    });
  } catch (err) {
    console.error('❌ [Analytics]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
