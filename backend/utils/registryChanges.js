// backend/utils/registryChanges.js
// The redesign clerk/CS → Data-Analyzer approval engine. A single source of
// truth for: which fields each registry target allows on an approval-gated
// edit, how to render a change diff, and how to APPLY an approved edit/delete
// (re-validating references, exactly like the direct-write routes would).
//
// Two pipelines coexist on the ChangeRequest model. The legacy secretary/CS →
// DIO/ODIO flow (routeKey trainees/supervisors, reviewerRole 'dio') is applied
// by utils/applyChangeRequest.js. THIS module handles reviewerRole
// 'data_analyzer' requests for the registry entities the clerk and central
// secretary edit.
const User         = require('../models/User');
const Hospital     = require('../models/Hospital');
const Program      = require('../models/Program');
const Country      = require('../models/Country');
const Specialty    = require('../models/Specialty');
const Notification = require('../models/Notification');

// Center program cap — shared with routes/programs.js and routes/registry.js so
// the ceiling is enforced identically on direct create and on an approved move.
const MAX_PROGRAMS_PER_CENTER = 100;

// routeKey → target descriptor. `model` selects the collection; `role` (User
// targets only) constrains which account the routeKey may touch; `fields` is the
// edit allowlist; `labels` renders the diff.
const ROUTE_TARGETS = {
  trainees: {
    model: 'User', role: 'trainee', label: 'Trainee',
    fields: ['name', 'email', 'phone', 'city', 'gender', 'pdId'],
  },
  dios: {
    model: 'User', role: 'dio_view', label: 'DIO',
    fields: ['name', 'email', 'phone', 'city', 'countryId'],
  },
  odios: {
    model: 'User', role: 'dio', label: 'ODIO',
    fields: ['name', 'email', 'phone'],
  },
  sub_dios: {
    model: 'User', role: 'sub_dio', label: 'Sub-DIO',
    fields: ['name', 'email', 'phone'],
  },
  pds: {
    model: 'User', role: 'program_director', label: 'Program Director',
    fields: ['name', 'email', 'phone', 'city'],
  },
  sub_pds: {
    model: 'User', role: 'sub_pd', label: 'Sub-PD',
    fields: ['name', 'email', 'phone'],
  },
  clerks: {
    model: 'User', role: 'data_entry', label: 'Data Entry Clerk',
    fields: ['name', 'email', 'phone'],
  },
  central_secretaries: {
    model: 'User', role: 'central_secretary', label: 'Central Secretary',
    fields: ['name', 'email', 'phone'],
  },
  hocs: {
    model: 'User', role: 'hoc', label: 'Head of Council',
    fields: ['name', 'email', 'phone'],
  },
  centers: {
    model: 'Hospital', role: null, label: 'Training Center',
    fields: ['name', 'city', 'address', 'governorate', 'phone', 'email', 'countryId',
      'idNumber', 'accreditationNumber', 'accreditationGrantDate', 'accreditationExpiry',
      'accreditationWithdrawn', 'dioId', 'subDioId'],
  },
  programs: {
    model: 'Program', role: null, label: 'Program',
    fields: ['name', 'trainingCenterId', 'specialtyId', 'programDirectorId', 'subProgramDirectorId',
      'accreditationType', 'accreditationGrantDate', 'accreditationNumber', 'accreditationWithdrawn',
      'yearlyCapacity', 'trainingStartDate', 'durationYears', 'renewalApplicationDate'],
  },
  countries: {
    model: 'Country', role: null, label: 'Country',
    fields: ['name', 'code', 'isActive'],
  },
};

const MODELS = { User, Hospital, Program, Country };

const FIELD_LABELS = {
  name: 'Name', email: 'Email', phone: 'Phone', city: 'City', gender: 'Gender',
  address: 'Address', governorate: 'Governorate', code: 'Code', isActive: 'Active',
  countryId: 'Country', dioId: 'DIO', subDioId: 'Sub-DIO', pdId: 'Program Director',
  programId: 'Program', programDirectorId: 'Program Director',
  subProgramDirectorId: 'Sub-PD', trainingCenterId: 'Training Center',
  specialtyId: 'Specialty', idNumber: 'ID',
  accreditationNumber: 'Accreditation ID', accreditationGrantDate: 'Accreditation Date',
  accreditationExpiry: 'Accreditation Expiry', accreditationWithdrawn: 'Accreditation Withdrawn',
  yearlyCapacity: 'Yearly Capacity', durationYears: 'Duration (years)',
  trainingStartDate: 'Training Start Date', renewalApplicationDate: 'Renewal Application Date',
};

// Reference fields whose stored ObjectId should render as a human name in the diff.
const NAME_REFS = {
  countryId: [Country, 'name'], dioId: [User, 'name'], subDioId: [User, 'name'],
  pdId: [User, 'name'], programId: [Program, 'name'], programDirectorId: [User, 'name'],
  subProgramDirectorId: [User, 'name'], trainingCenterId: [Hospital, 'name'],
  specialtyId: [Specialty, 'name'],
};

function pick(body, allowed) {
  const out = {};
  allowed.forEach(k => { if (body[k] !== undefined) out[k] = body[k]; });
  return out;
}

// Render a single field value to a human label for the analyzer's diff view.
async function displayValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (NAME_REFS[key]) {
    const [Model, field] = NAME_REFS[key];
    const id = value && value._id ? value._id : value;
    const doc = await Model.findById(id).select(field).catch(() => null);
    return (doc && doc[field]) || String(id);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

// Build { before, display } for a set of changed fields against the current doc.
async function buildRegistryChangePayload(fields, existing) {
  const before = {};
  const display = [];
  for (const key of Object.keys(fields)) {
    const raw = existing[key];
    before[key] = (raw && raw._id) ? raw._id : (raw === undefined ? null : raw);
    display.push({
      label: FIELD_LABELS[key] || key,
      from: await displayValue(key, before[key]),
      to: await displayValue(key, fields[key]),
    });
  }
  return { before, display };
}

// Add/remove a center on a DIO's assignedCenterIds so center-scope keeps working
// after the training-center form assigns/reassigns its DIO (RULINGS §F27).
async function syncCenterDioAssignment(centerId, newDioId, prevDioId) {
  const nId = newDioId && newDioId._id ? newDioId._id : newDioId;
  const pId = prevDioId && prevDioId._id ? prevDioId._id : prevDioId;
  if (String(pId || '') !== String(nId || '')) {
    if (pId) await User.updateOne({ _id: pId, role: 'dio_view' }, { $pull: { assignedCenterIds: centerId } }).catch(() => {});
    // Keep trainees' denormalized dioId snapshot in step with their centre's DIO
    // (re-point on reassignment; null it when the centre loses/deletes its DIO).
    await User.updateMany({ hospitalId: centerId, role: 'trainee' }, { $set: { dioId: nId || null } }).catch(() => {});
  }
  if (nId) await User.updateOne({ _id: nId, role: 'dio_view' }, { $addToSet: { assignedCenterIds: centerId } }).catch(() => {});
}

// Notify every active Data Analyzer that a request is awaiting review. The word
// "approval" keeps the Navbar notifLink routing intact.
async function notifyAnalyzers(message) {
  const analyzers = await User.find({ role: 'data_analyzer', isActive: { $ne: false } }).select('_id');
  await Promise.all(analyzers.map(a =>
    Notification.create({ user: a._id, message, category: 'promotions' }).catch(() => {})));
}

// Notify every active Head AD that a clerk request is awaiting review. Same
// contract as notifyAnalyzers (keep "approval" in the message for notifLink).
async function notifyHeadAds(message) {
  const heads = await User.find({ role: 'head_ad', isActive: { $ne: false } }).select('_id');
  await Promise.all(heads.map(a =>
    Notification.create({ user: a._id, message, category: 'promotions' }).catch(() => {})));
}

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Re-validate the reference fields present in an edit payload (state may have
// drifted between request and approval).
async function validateRefs(routeKey, fields, targetId) {
  if (fields.countryId) {
    if (!(await Country.findById(fields.countryId).select('_id'))) throw httpError('Country not found', 400);
  }
  if (fields.pdId) {
    const pd = await User.findOne({ _id: fields.pdId, role: 'program_director', isActive: { $ne: false } }).select('_id');
    if (!pd) throw httpError('Program director not found or inactive', 400);
  }
  if (routeKey === 'centers') {
    if (fields.dioId) {
      const d = await User.findOne({ _id: fields.dioId, role: 'dio_view', isActive: { $ne: false } }).select('_id');
      if (!d) throw httpError('Assigned DIO not found or inactive', 400);
    }
    if (fields.subDioId) {
      const s = await User.findOne({ _id: fields.subDioId, role: 'sub_dio', isActive: { $ne: false } }).select('_id');
      if (!s) throw httpError('Assigned Sub-DIO not found or inactive', 400);
    }
  }
  if (routeKey === 'programs') {
    if (fields.specialtyId && !(await Specialty.findById(fields.specialtyId).select('_id'))) {
      throw httpError('Specialty not found', 400);
    }
    if (fields.programDirectorId) {
      const pd = await User.findOne({ _id: fields.programDirectorId, role: 'program_director', isActive: { $ne: false } }).select('_id');
      if (!pd) throw httpError('Program director not found or inactive', 400);
      // TODO(fable): the direct programs.js path also enforces one active program
      // per PD (validateProgramDirector). This approval applier only checks the PD
      // exists — confirm whether an approved program-PD reassignment should also
      // re-run the one-program-per-PD clash check (drift between submit & approve).
    }
    if (fields.trainingCenterId) {
      const center = await Hospital.findById(fields.trainingCenterId).select('_id isActive');
      if (!center || center.isActive === false) throw httpError('Training center not found', 400);
    }
  }
}

// Apply an approved analyzer (reviewerRole 'data_analyzer') edit/delete request.
// Returns the updated document. Throws { status } on a re-validation failure.
async function applyRegistryChange(cr) {
  const target = ROUTE_TARGETS[cr.routeKey];
  if (!target) throw httpError(`Unsupported change target: ${cr.routeKey}`, 400);
  const Model = MODELS[target.model];

  // Load + role-check the current document.
  const query = { _id: cr.targetId };
  if (target.role) query.role = target.role;
  const existing = await Model.findOne(query);
  if (!existing) throw httpError('Target record no longer exists', 409);

  // ── DELETE (soft) ──────────────────────────────────────────────────────────
  if (cr.requestType === 'delete') {
    const patch = target.model === 'User'
      ? { isActive: false, deletedAt: new Date() }
      : { isActive: false };
    const updated = await Model.findByIdAndUpdate(cr.targetId, patch, { new: true }).select('-password');
    // Detach a deleted center from its DIO's assigned set.
    if (cr.routeKey === 'centers') await syncCenterDioAssignment(cr.targetId, null, existing.dioId);
    return updated;
  }

  // ── EDIT ────────────────────────────────────────────────────────────────────
  const fields = pick(cr.changes || {}, target.fields);
  if (!Object.keys(fields).length) throw httpError('No applicable changes', 400);
  await validateRefs(cr.routeKey, fields, cr.targetId);

  // Re-check the destination center's program cap on a program move.
  if (cr.routeKey === 'programs' && fields.trainingCenterId
      && String(fields.trainingCenterId) !== String(existing.trainingCenterId)) {
    const count = await Program.countDocuments({ trainingCenterId: fields.trainingCenterId, isActive: { $ne: false } });
    if (count >= MAX_PROGRAMS_PER_CENTER) {
      throw httpError(`Destination center already has the maximum of ${MAX_PROGRAMS_PER_CENTER} programs`, 409);
    }
  }

  // Email on a sparse-unique index: clearing must $unset, never store ''.
  const update = { ...fields };
  let unset = null;
  if ('email' in update) {
    const em = update.email == null ? '' : String(update.email).trim();
    if (em) update.email = em; else { delete update.email; unset = { email: 1 }; }
  }

  const prevDioId = cr.routeKey === 'centers' ? existing.dioId : null;
  const finalUpdate = unset ? { ...update, $unset: unset } : update;

  let updated;
  try {
    updated = await Model.findByIdAndUpdate(cr.targetId, finalUpdate, { new: true, runValidators: true }).select('-password');
  } catch (e) {
    if (e.code === 11000) throw httpError('A record with this value already exists', 409);
    throw e;
  }

  // Training-center DIO dual-write (RULINGS §F27).
  if (cr.routeKey === 'centers' && 'dioId' in fields) {
    await syncCenterDioAssignment(cr.targetId, fields.dioId || null, prevDioId);
  }
  return updated;
}

module.exports = {
  MAX_PROGRAMS_PER_CENTER,
  ROUTE_TARGETS,
  FIELD_LABELS,
  pick,
  buildRegistryChangePayload,
  syncCenterDioAssignment,
  notifyAnalyzers,
  notifyHeadAds,
  applyRegistryChange,
};
