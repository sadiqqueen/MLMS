const router      = require('express').Router();
const mongoose    = require('mongoose');
const Certificate = require('../models/Certificate');
const Notification = require('../models/Notification');
const AuditLog    = require('../models/AuditLog');
const auth        = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');

const CERT_READ  = ['program_director', 'president', 'super_admin', 'dio'];
const CERT_WRITE = ['program_director', 'super_admin', 'dio'];

const populate = q => q
  .populate('student',  'name initials photoUrl studentId year')
  .populate('traineeId', 'name initials photoUrl studentId year')
  .populate('doctor',   'name specialty initials')
  .populate('supervisor', 'name specialty initials')
  .populate('hospital', 'name city')
  .populate('issuedBy', 'name role')
  .populate('rotation', 'startDate endDate status')
  .populate('distributionId', 'startDate endDate status hospitalId specialtyId');

function publicVerifyUrl(req, cert) {
  const origin = process.env.FRONTEND_URL?.split(',')[0]?.trim()
    || `${req.protocol}://${req.get('host')}`;
  return `${origin.replace(/\/$/, '')}/verify/${cert.verifyCode}`;
}

function formatCertificateForPrint(req, certDoc) {
  const cert = certDoc.toObject ? certDoc.toObject() : certDoc;
  const trainee = cert.student || cert.traineeId || {};
  const startDate = cert.rotation?.startDate || cert.distributionId?.startDate || null;
  const endDate = cert.rotation?.endDate || cert.distributionId?.endDate || null;
  return {
    _id: cert._id,
    certificateId: cert._id,
    code: cert.verifyCode,
    verifyCode: cert.verifyCode,
    verificationCode: cert.verifyCode,
    verificationUrl: cert.verifyCode ? publicVerifyUrl(req, cert) : '',
    trainee: {
      _id: trainee._id,
      fullName: trainee.name || '',
      name: trainee.name || '',
      studentId: trainee.studentId || '',
      year: trainee.year || null
    },
    traineeFullName: trainee.name || '',
    traineeId: trainee.studentId || '',
    specialty: cert.specialty || '',
    hospital: cert.hospital || null,
    trainingSite: cert.hospital?.name || '',
    programDates: { startDate, endDate },
    rotationDates: { startDate, endDate },
    issueDate: cert.issueDate,
    issuedBy: cert.issuedBy || null,
    issuedByName: cert.issuedBy?.name || '',
    status: cert.revokedAt ? 'revoked' : 'valid',
    revokedAt: cert.revokedAt || null,
    type: cert.type || 'Completion',
    notes: cert.notes || '',
    fileUrl: cert.fileUrl || ''
  };
}

async function audit(req, action, targetId, metadata = {}) {
  await AuditLog.create({
    userId: req.user._id,
    action,
    targetId,
    targetModel: 'Certificate',
    metadata,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown'
  }).catch(err => console.error('[AuditLog] Failed to write certificate audit:', err.message));
}

function getHospital(user) {
  const hospital = user.hospitalId || user.hospital || null;
  return hospital?._id || hospital;
}

function sameId(a, b) {
  if (!a || !b) return false;
  const left = a?._id || a;
  const right = b?._id || b;
  return left.toString() === right.toString();
}

// super_admin and dio are system-wide certificate overseers (no hospital scope);
// every other reader (program_director, president) is scoped to its own hospital.
function isCertificateOverseer(user) {
  return user.role === 'super_admin' || user.role === 'dio';
}

function scopedCertificateQuery(req, res) {
  if (isCertificateOverseer(req.user)) return {};
  const hospitalId = getHospital(req.user);
  if (!hospitalId) {
    res.status(403).json({ success: false, message: 'Account is not assigned to a hospital' });
    return false;
  }
  return { hospital: hospitalId };
}

function ensureCertificateScope(req, res, cert) {
  if (req.user.role === 'super_admin') return true;
  const hospitalId = getHospital(req.user);
  if (!hospitalId) {
    res.status(403).json({ success: false, message: 'Account is not assigned to a hospital' });
    return false;
  }
  if (sameId(cert.hospital, hospitalId)) return true;
  res.status(403).json({ success: false, message: 'Access denied: certificate belongs to a different hospital' });
  return false;
}

// READ scope: overseers (super_admin, dio) may open/print ANY certificate; other
// roles fall back to hospital scoping. Used only by the GET read endpoints —
// the WRITE guard (ensureCertificateScope) is intentionally left untouched.
function ensureCertificateReadScope(req, res, cert) {
  if (isCertificateOverseer(req.user)) return true;
  return ensureCertificateScope(req, res, cert);
}

// GET /api/certificates
router.get('/', auth, allowRoles(...CERT_READ), async (req, res) => {
  try {
    const query = scopedCertificateQuery(req, res);
    if (query === false) return;
    const certs = await populate(Certificate.find(query).sort({ createdAt: -1 }));
    res.json(certs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/certificates/:id
router.get('/:id', auth, allowRoles(...CERT_READ), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid certificate id' });
    }
    const cert = await populate(Certificate.findById(req.params.id));
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found' });
    if (!ensureCertificateReadScope(req, res, cert)) return;
    res.json({ success: true, data: formatCertificateForPrint(req, cert) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/certificates/:id/print
router.get('/:id/print', auth, allowRoles(...CERT_READ), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid certificate id' });
    }
    const cert = await populate(Certificate.findById(req.params.id));
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found' });
    if (!ensureCertificateReadScope(req, res, cert)) return;
    await audit(req, 'view_certificate_print', cert._id, { status: cert.revokedAt ? 'revoked' : 'valid' });
    res.json({ success: true, data: formatCertificateForPrint(req, cert) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/certificates
router.post('/', auth, allowRoles(...CERT_WRITE), async (req, res) => {
  try {
    const ALLOWED_CREATE = ['student', 'traineeId', 'rotation', 'distributionId',
                            'specialty', 'type', 'doctor', 'supervisor',
                            'hospital', 'issueDate', 'notes', 'fileUrl'];
    const data = {};
    ALLOWED_CREATE.forEach(k => { if (req.body[k] !== undefined) data[k] = req.body[k]; });
    data.issuedBy = req.user._id;
    if (req.user.role !== 'super_admin') {
      const hospitalId = getHospital(req.user);
      if (!hospitalId) return res.status(403).json({ success: false, message: 'Account is not assigned to a hospital' });
      if (data.hospital && !sameId(data.hospital, hospitalId)) {
        return res.status(403).json({ success: false, message: 'Cannot issue a certificate for another hospital' });
      }
      data.hospital = hospitalId;
    }

    const cert = await Certificate.create(data);
    const populated = await populate(Certificate.findById(cert._id));
    await audit(req, 'issue_certificate', cert._id, { student: cert.student, traineeId: cert.traineeId, type: cert.type });

    const hospitalName = populated.hospital?.name || 'your hospital';
    const specialty = populated.specialty ? ` in ${populated.specialty}` : '';
    const recipient = populated.student?._id || populated.traineeId?._id || cert.student || cert.traineeId;
    if (recipient) {
      await Notification.create({
        user: recipient,
        message: `A certificate has been issued for you${specialty} at ${hospitalName}.`,
      }).catch(err => console.error('[Notification] Failed to write certificate notice:', err.message));
    }

    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/certificates/:id
router.delete('/:id', auth, allowRoles(...CERT_WRITE), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid certificate id' });
    }
    const cert = await Certificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ success: false, message: 'Certificate not found' });
    if (!ensureCertificateScope(req, res, cert)) return;
    await cert.deleteOne();
    await audit(req, 'delete_certificate', cert._id, { student: cert.student, traineeId: cert.traineeId });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
