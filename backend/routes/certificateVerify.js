// backend/routes/certificateVerify.js
// Public endpoint — no auth required.
// Mounted at /api/certificates/verify in server.js.
// Used by QR codes and public verification links to confirm a certificate is real.
const router      = require('express').Router();
const Certificate = require('../models/Certificate');

// GET /api/certificates/verify/:code
// Accepts the UUID verifyCode and returns safe public certificate data.
// Returns 404 if not found, 410 if revoked.
router.get('/:code', async (req, res) => {
  try {
    const cert = await Certificate.findOne({ verifyCode: req.params.code })
      .populate('student',   'name initials')
      .populate('traineeId', 'name initials')
      .populate('hospital',  'name city')
      .populate('issuedBy',  'name');

    if (!cert) {
      return res.status(404).json({
        valid:   false,
        message: 'Certificate not found. This code is invalid.'
      });
    }

    if (cert.revokedAt) {
      return res.status(410).json({
        valid:     false,
        revokedAt: cert.revokedAt,
        message:   'This certificate has been revoked.'
      });
    }

    // Return only the public-safe fields — never return internal IDs or sensitive data
    const holder = cert.student || cert.traineeId;
    res.json({
      valid:     true,
      verifyCode: cert.verifyCode,
      holder:    holder?.name    || 'Unknown',
      hospital:  cert.hospital?.name || cert.hospital || '',
      specialty: cert.specialty  || '',
      issueDate: cert.issueDate,
      issuedBy:  cert.issuedBy?.name || '',
      notes:     cert.notes      || ''
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
