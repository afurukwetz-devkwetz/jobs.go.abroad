const express   = require('express');
const router    = express.Router();
const Applicant = require('../models/Applicant');
const Batch     = require('../models/Batch');
const { requireAdmin } = require('../middleware/auth');

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

    const query = ref ? { refNumber: ref.trim().toUpperCase() } : { email: email.trim().toLowerCase() };
    const applicant = await Applicant.findOne(query).select('-password');
    if (!applicant) return res.status(404).json({ found: false });

    res.json({
      found:       true,
      name:        `${applicant.firstName} ${applicant.lastName}`,
      ref:         applicant.refNumber,
      profession:  applicant.profession,
      batchCode:   applicant.batchCode,
      currentStep: applicant.progressStep,
      stageName:   STAGES[applicant.progressStep].label,
      stageDesc:   STAGES[applicant.progressStep].desc,
      note:        applicant.progressNote,
      status:      applicant.status,
      stages:      STAGES
    });

  } catch (err) {
    console.error('❌ [Track] Error:', err);
    res.status(500).json({ error: 'Server error.', details: err.message });
  }
});

// PUT /api/track/update — admin updates a single applicant's progress
// Body: { refNumber, step (0-4), note, status }
router.put('/update', requireAdmin, async (req, res) => {
  try {
    const { refNumber, step, note, status } = req.body;
    
    let updateFields = {};
    if (step !== undefined && step >= 0 && step <= 4) {
        updateFields.progressStep = step;
    }
    if (note !== undefined) updateFields.progressNote = note;
    if (status) updateFields.status = status;

    const applicant = await Applicant.findOneAndUpdate(
      { refNumber: refNumber.trim().toUpperCase() },
      updateFields,
      { new: true }
    );
    if (!applicant) return res.status(404).json({ error: 'Applicant not found.' });

    res.json({
      success:   true,
      name:      `${applicant.firstName} ${applicant.lastName}`,
      refNumber: applicant.refNumber,
      step:      applicant.progressStep,
      status:    applicant.status,
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

module.exports = router;
