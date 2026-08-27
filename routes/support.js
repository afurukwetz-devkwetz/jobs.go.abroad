const express   = require('express');
const router    = express.Router();
const jwt       = require('jsonwebtoken');
const SupportTicket = require('../models/SupportTicket');
const Applicant     = require('../models/Applicant');
const { sendSupportReplyEmail, sendSupportClosedEmail } = require('../middleware/emailService');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getApplicantFromToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const d = jwt.verify(token, process.env.JWT_SECRET);
    return d.role === 'applicant' ? d : null;
  } catch { return null; }
}

function getAdminFromToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    const d = jwt.verify(token, process.env.JWT_SECRET);
    return d.role === 'admin' ? d : null;
  } catch { return null; }
}

// ── APPLICANT: send message (creates ticket if none open) ─────────────────────
// POST /api/support/send
router.post('/send', async (req, res) => {
  try {
    const user = getApplicantFromToken(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });

    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Message text is required.' });

    const applicant = await Applicant.findById(user.id).select('firstName lastName email');
    if (!applicant) return res.status(404).json({ error: 'Applicant not found.' });

    // Find or create open ticket
    let ticket = await SupportTicket.findOne({ applicantId: user.id, status: 'open' });
    if (!ticket) {
      ticket = new SupportTicket({
        applicantId:    user.id,
        applicantName:  `${applicant.firstName} ${applicant.lastName}`,
        applicantEmail: applicant.email,
      });
    }

    ticket.messages.push({ sender: 'applicant', text: text.trim() });
    ticket.unreadByAdmin  += 1;
    ticket.lastMessageAt   = new Date();
    await ticket.save();

    res.json({ success: true, ticketId: ticket._id });
  } catch (err) {
    console.error('[Support /send]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── APPLICANT: get own open ticket ───────────────────────────────────────────
// GET /api/support/my
router.get('/my', async (req, res) => {
  try {
    const user = getApplicantFromToken(req);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });

    const ticket = await SupportTicket.findOne({ applicantId: user.id, status: 'open' });
    if (!ticket) return res.json({ ticket: null });

    // Mark admin messages as read
    let changed = false;
    ticket.messages.forEach(m => {
      if (m.sender === 'admin' && !m.readByOther) { m.readByOther = true; changed = true; }
    });
    if (changed) {
      ticket.unreadByApplicant = 0;
      await ticket.save();
    }

    res.json({ ticket });
  } catch (err) {
    console.error('[Support /my]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── ADMIN: list all tickets ───────────────────────────────────────────────────
// GET /api/support/tickets
router.get('/tickets', async (req, res) => {
  try {
    if (!getAdminFromToken(req)) return res.status(401).json({ error: 'Admin auth required.' });

    const tickets = await SupportTicket.find()
      .sort({ lastMessageAt: -1 })
      .select('-messages');   // lightweight list

    res.json({ tickets });
  } catch (err) {
    console.error('[Support /tickets]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── ADMIN: total unread count (for nav badge) ─────────────────────────────────
// GET /api/support/unread-count
router.get('/unread-count', async (req, res) => {
  try {
    if (!getAdminFromToken(req)) return res.status(401).json({ error: 'Admin auth required.' });
    const result = await SupportTicket.aggregate([
      { $match: { status: 'open' } },
      { $group: { _id: null, total: { $sum: '$unreadByAdmin' } } }
    ]);
    res.json({ count: result[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── ADMIN: get full ticket thread ─────────────────────────────────────────────
// GET /api/support/tickets/:id
router.get('/tickets/:id', async (req, res) => {
  try {
    if (!getAdminFromToken(req)) return res.status(401).json({ error: 'Admin auth required.' });

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    // Mark applicant messages as read
    let changed = false;
    ticket.messages.forEach(m => {
      if (m.sender === 'applicant' && !m.readByOther) { m.readByOther = true; changed = true; }
    });
    if (changed) {
      ticket.unreadByAdmin = 0;
      await ticket.save();
    }

    res.json({ ticket });
  } catch (err) {
    console.error('[Support /tickets/:id]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── ADMIN: reply to ticket ────────────────────────────────────────────────────
// POST /api/support/tickets/:id/reply
router.post('/tickets/:id/reply', async (req, res) => {
  try {
    if (!getAdminFromToken(req)) return res.status(401).json({ error: 'Admin auth required.' });

    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Reply text is required.' });

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
    if (ticket.status === 'closed') return res.status(400).json({ error: 'Ticket is closed.' });

    ticket.messages.push({ sender: 'admin', text: text.trim() });
    ticket.unreadByApplicant += 1;
    ticket.lastMessageAt      = new Date();
    await ticket.save();

    // Email notification to applicant
    const applicant = await Applicant.findById(ticket.applicantId).select('firstName');
    sendSupportReplyEmail({
      firstName:    applicant?.firstName || ticket.applicantName.split(' ')[0],
      email:        ticket.applicantEmail,
      adminMessage: text.trim()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Support /reply]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── ADMIN: close ticket ───────────────────────────────────────────────────────
// PUT /api/support/tickets/:id/close
router.put('/tickets/:id/close', async (req, res) => {
  try {
    if (!getAdminFromToken(req)) return res.status(401).json({ error: 'Admin auth required.' });

    const ticket = await SupportTicket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

    ticket.status   = 'closed';
    ticket.closedAt = new Date();
    await ticket.save();

    // Email notification to applicant
    const applicant = await Applicant.findById(ticket.applicantId).select('firstName');
    sendSupportClosedEmail({
      firstName: applicant?.firstName || ticket.applicantName.split(' ')[0],
      email:     ticket.applicantEmail
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Support /close]:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
