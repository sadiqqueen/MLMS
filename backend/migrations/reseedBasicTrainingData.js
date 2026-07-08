'use strict';

// Seeds the BASIC-TRAINING portal with its own hospitals, specialties, staff
// (b_* roles), trainees and training records — all tagged track:'basic'.
//
// Safety:
//   • Gated behind DRY_RUN (default true) + CONFIRM_RESEED_BASIC=true.
//   • Creates SEPARATE basic hospitals/specialties (keyed by {name, track}) so
//     the Advanced data is never overwritten.
//   • Only ever deactivates stale track:'basic' users; Advanced users, hospitals,
//     specialties and records are never touched.
//
// Apply:
//   DRY_RUN=false CONFIRM_RESEED_BASIC=true node backend/migrations/reseedBasicTrainingData.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose     = require('mongoose');
const User         = require('../models/User');
const Hospital     = require('../models/Hospital');
const Specialty    = require('../models/Specialty');
const Distribution = require('../models/Distribution');
const Rotation     = require('../models/Rotation');
const Report       = require('../models/Report');
const Evaluation   = require('../models/Evaluation');
const Certificate  = require('../models/Certificate');

const DRY_RUN   = process.env.DRY_RUN !== 'false';
const CONFIRMED = process.env.CONFIRM_RESEED_BASIC === 'true';
const TRACK     = 'basic';

const DEMO_PASSWORD = process.env.BASIC_DEMO_PASSWORD || '123456';

const HOSPITALS = [
  { name: 'Baghdad Teaching Hospital', city: 'Baghdad', governorate: 'Baghdad', address: 'Medical City, Baghdad', phone: '+964-771-410-0001', email: 'b.baghdad.teaching@mtms.com' },
  { name: 'Al-Yarmouk Teaching Hospital', city: 'Baghdad', governorate: 'Baghdad', address: 'Al-Yarmouk District, Baghdad', phone: '+964-771-410-0002', email: 'b.yarmouk.teaching@mtms.com' },
];

const SPECIALTIES = ['Internal Medicine', 'General Surgery', 'Pediatrics'];

const PROGRAM_DIRECTORS = [
  { name: 'Dr. Basim Al-Saadi', email: 'b.pd1@mtms.com', phone: '+964-771-510-0001' },
  { name: 'Dr. Widad Al-Rubaie', email: 'b.pd2@mtms.com', phone: '+964-771-510-0002' },
];

const SECRETARIES = [
  { name: 'Suha Karim Al-Bayati', email: 'b.sec.internal@mtms.com', phone: '+964-771-520-0001' },
  { name: 'Nour Ali Al-Samarrai', email: 'b.sec.surgery@mtms.com', phone: '+964-771-520-0002' },
  { name: 'Rana Mahdi Al-Janabi', email: 'b.sec.pediatrics@mtms.com', phone: '+964-771-520-0003' },
];

const SUPERVISORS = [
  ['Dr. Kadhim Al-Hamdani', 'b.sup.internal.1@mtms.com', 'Internal Medicine'],
  ['Dr. Israa Al-Rashidi', 'b.sup.internal.2@mtms.com', 'Internal Medicine'],
  ['Dr. Tariq Al-Tamimi', 'b.sup.surgery.1@mtms.com', 'General Surgery'],
  ['Dr. Sundus Al-Khafaji', 'b.sup.surgery.2@mtms.com', 'General Surgery'],
  ['Dr. Firas Al-Moussawi', 'b.sup.pediatrics.1@mtms.com', 'Pediatrics'],
  ['Dr. Zahra Al-Azzawi', 'b.sup.pediatrics.2@mtms.com', 'Pediatrics'],
];

const TRAINEE_NAMES = [
  'Ahmed Salim Al-Saeedi', 'Duaa Khalid Al-Janabi', 'Karrar Adel Al-Fahdawi',
  'Noor Samer Al-Mousawi', 'Yousif Talib Al-Shammari', 'Hala Jasim Al-Hasnawi',
  'Mustafa Saad Al-Rubaie', 'Sara Naji Al-Zubaidi', 'Hassan Mahdi Al-Bermani',
  'Zahraa Haider Al-Asadi',
];

const BASIC_USER_EMAILS = new Set([
  'b.dio@mtms.com',
  'b.president@mtms.com',
  ...PROGRAM_DIRECTORS.map(u => u.email),
  ...SECRETARIES.map(u => u.email),
  ...SUPERVISORS.map(u => u[1]),
  ...Array.from({ length: TRAINEE_NAMES.length }, (_, i) => `b.trainee${String(i + 1).padStart(2, '0')}@mtms.com`),
]);

const actions = [];
function logAction(message) {
  actions.push(message);
  console.log(`${DRY_RUN ? '[DRY RUN]' : '[APPLY]'} ${message}`);
}

function addMonths(date, months) {
  const d = new Date(date); d.setMonth(d.getMonth() + months); d.setHours(12, 0, 0, 0); return d;
}
function normalizeDate(date) { const d = new Date(date); d.setHours(12, 0, 0, 0); return d; }
function initials(name) { return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase(); }
function idEq(a, b) { return a && b && a.toString() === b.toString(); }

async function saveDoc(doc, message) {
  logAction(message);
  if (!DRY_RUN) await doc.save();
  return doc;
}

async function upsertHospital(data) {
  let doc = await Hospital.findOne({ name: data.name, track: TRACK });
  if (!doc) doc = new Hospital({ ...data, track: TRACK });
  Object.assign(doc, data, { isActive: true, track: TRACK });
  return saveDoc(doc, `upsert basic hospital: ${data.name}`);
}

async function upsertSpecialty(name) {
  let doc = await Specialty.findOne({ name, track: TRACK });
  if (!doc) doc = new Specialty({ name, track: TRACK });
  doc.name = name; doc.isActive = true; doc.track = TRACK;
  return saveDoc(doc, `upsert basic specialty: ${name}`);
}

async function upsertUser(email, data, password) {
  let doc = await User.findOne({ email });
  const isNew = !doc;
  if (!doc) doc = new User({ email, password });
  Object.assign(doc, data, {
    email, isActive: true, deletedAt: null, locked: false, lockUntil: null,
    loginAttempts: 0, initials: data.initials || initials(data.name),
  });
  doc.password = password; // track is derived from role by the User pre-save hook
  return saveDoc(doc, `${isNew ? 'create' : 'update'} ${data.role}: ${data.name} <${email}>`);
}

async function upsertDistribution({ supervisor, hospital, specialty }) {
  let doc = await Distribution.findOne({ supervisorId: supervisor._id });
  if (!doc) doc = new Distribution({ supervisorId: supervisor._id });
  Object.assign(doc, {
    supervisorId: supervisor._id, doctor: supervisor._id,
    hospitalId: hospital._id, hospital: hospital._id,
    specialtyId: specialty._id, specialty: specialty.name,
    status: 'active', track: TRACK,
    traineeId: null, student: null, startDate: null, endDate: null, durationWeeks: null,
  });
  return saveDoc(doc, `upsert basic distribution: ${supervisor.email}`);
}

async function upsertRotation({ trainee, hospital, supervisor, specialty, status, startDate, endDate }) {
  let doc = await Rotation.findOne({ traineeId: trainee._id, status, startDate: normalizeDate(startDate), endDate: normalizeDate(endDate) });
  if (!doc) doc = new Rotation({ traineeId: trainee._id, student: trainee._id, startDate: normalizeDate(startDate), endDate: normalizeDate(endDate) });
  Object.assign(doc, {
    traineeId: trainee._id, student: trainee._id,
    hospitalId: hospital._id, hospital: hospital._id,
    supervisorId: supervisor._id, doctor: supervisor._id,
    specialtyId: specialty._id, track: TRACK,
    startDate: normalizeDate(startDate), endDate: normalizeDate(endDate), status,
  });
  return saveDoc(doc, `upsert ${status} basic rotation: ${trainee.email}`);
}

async function upsertReport({ trainee, rotation, hospital, type, title, date, status, score, grade, gradedBy, gradedByRole }) {
  let doc = await Report.findOne({ student: trainee._id, rotation: rotation._id, type, title });
  if (!doc) doc = new Report({ student: trainee._id, rotation: rotation._id, type, title, date });
  Object.assign(doc, {
    student: trainee._id, rotation: rotation._id, hospital: hospital._id,
    title, type, date, status, track: TRACK,
    score: score ?? null, grade: grade || null,
    gradedBy: gradedBy?._id || null, gradedByRole: gradedByRole || '',
    gradedAt: status === 'graded' ? date : null,
    reviewNote: status === 'rejected' ? 'Please revise and resubmit.' : 'Basic training progress reviewed.',
    assessorComments: status === 'graded' ? 'Meets expected milestone for the internship rotation.' : '',
  });
  return saveDoc(doc, `upsert ${type} basic report (${status}): ${trainee.email}`);
}

async function upsertEvaluation({ trainee, rotation, hospital, supervisor, specialty, evaluator, evaluatorRole, index, totalScore, finalized }) {
  const evaluationType = evaluatorRole === 'dio' ? 'DIO Progress Review' : index % 2 ? 'Mini-CEX' : 'CBD';
  let doc = await Evaluation.findOne({ traineeId: trainee._id, rotationId: rotation._id, evaluatorRole, evaluationType });
  if (!doc) doc = new Evaluation({ student: trainee._id, traineeId: trainee._id, rotationId: rotation._id, evaluationType });
  Object.assign(doc, {
    student: trainee._id, traineeId: trainee._id, rotationId: rotation._id,
    doctor: supervisor?._id || evaluator._id, supervisorId: supervisor?._id || null,
    hospital: hospital._id, specialty: specialty.name, track: TRACK,
    evaluatorId: evaluator._id, evaluatorRole, createdBy: evaluator._id, createdByRole: evaluatorRole,
    date: addMonths(new Date(), evaluatorRole === 'dio' ? -1 : -2),
    grade: totalScore >= 85 ? 'above' : totalScore >= 70 ? 'meets' : 'needs-improvement',
    status: finalized ? 'completed' : 'pending',
    scores: { professionalism: totalScore - 2, clinicalJudgment: totalScore, communication: totalScore + 1 },
    totalScore, notes: `${evaluatorRole === 'dio' ? 'DIO' : 'Supervisor'} evaluation for ${trainee.name}.`,
    comments: 'Performance reviewed against basic-training milestones.',
    isFinalized: finalized, sentToTraineeAt: finalized ? new Date() : null,
  });
  return saveDoc(doc, `upsert ${evaluatorRole} basic evaluation: ${trainee.email}`);
}

async function upsertCertificate({ trainee, rotation, hospital, supervisor, specialty, issuedBy, index, revoked }) {
  const code = `MTMS-BCERT-2026-${String(index + 1).padStart(3, '0')}`;
  let doc = await Certificate.findOne({ verifyCode: code });
  if (!doc) doc = new Certificate({ student: trainee._id, verifyCode: code });
  Object.assign(doc, {
    student: trainee._id, traineeId: trainee._id, rotation: rotation._id,
    hospital: hospital._id, specialty: specialty.name, type: 'Completion', track: TRACK,
    doctor: supervisor._id, supervisor: supervisor._id, issuedBy: issuedBy._id,
    issueDate: addMonths(new Date(), -1),
    notes: 'Basic MTMS internship training certificate.',
    revokedAt: revoked ? new Date() : null,
  });
  return saveDoc(doc, `upsert ${revoked ? 'revoked' : 'valid'} basic certificate: ${code}`);
}

// Only deactivate stale BASIC users — Advanced accounts are never touched.
async function deactivateStaleBasicUsers() {
  const stale = await User.find({
    track: TRACK,
    email: { $nin: Array.from(BASIC_USER_EMAILS) },
    isActive: { $ne: false },
  });
  for (const user of stale) {
    user.isActive = false;
    user.deletedAt = user.deletedAt || new Date();
    await saveDoc(user, `soft-deactivate stale basic user: ${user.email} (${user.role})`);
  }
}

async function buildBasicData() {
  const now = new Date();
  const completedStart = addMonths(now, -6), completedEnd = addMonths(now, -3);
  const currentStart   = addMonths(now, -1), currentEnd   = addMonths(now, 2);
  const upcomingStart  = addMonths(now, 2),  upcomingEnd  = addMonths(now, 5);

  const hospitals = [];
  for (const h of HOSPITALS) hospitals.push(await upsertHospital(h));

  const specialties = [];
  for (const name of SPECIALTIES) specialties.push(await upsertSpecialty(name));

  const specialtyByName = Object.fromEntries(specialties.map(s => [s.name, s]));
  const hospitalByIndex = i => hospitals[i % hospitals.length];

  const dio = await upsertUser('b.dio@mtms.com', {
    name: 'Dr. Basic DIO Ibrahim', role: 'b_dio', phone: '+964-771-500-0002', city: 'Baghdad', gender: 'male',
    hospitalId: hospitals[0]._id, hospital: hospitals[0]._id,
  }, DEMO_PASSWORD);

  const president = await upsertUser('b.president@mtms.com', {
    name: 'Dr. Basic President Al-Kazemi', role: 'b_president', phone: '+964-771-500-0003', city: 'Baghdad', gender: 'male',
  }, DEMO_PASSWORD);

  const programDirectors = [];
  for (let i = 0; i < PROGRAM_DIRECTORS.length; i++) {
    const pd = PROGRAM_DIRECTORS[i]; const hospital = hospitalByIndex(i);
    programDirectors.push(await upsertUser(pd.email, {
      name: pd.name, role: 'b_program_director', phone: pd.phone,
      hospitalId: hospital._id, hospital: hospital._id, department: 'Basic Clinical Training',
    }, DEMO_PASSWORD));
  }

  const secretaries = [];
  for (let i = 0; i < SECRETARIES.length; i++) {
    const sec = SECRETARIES[i]; const specialty = specialties[i]; const hospital = hospitalByIndex(i);
    secretaries.push(await upsertUser(sec.email, {
      name: sec.name, role: 'b_secretary', phone: sec.phone,
      hospitalId: hospital._id, hospital: hospital._id,
      specialtyId: specialty._id, specialty: specialty.name, department: 'Training Coordination',
    }, DEMO_PASSWORD));
  }

  const supervisors = [];
  for (let i = 0; i < SUPERVISORS.length; i++) {
    const [name, email, specialtyName] = SUPERVISORS[i];
    const hospital = hospitalByIndex(Math.floor(i / 3));
    const specialty = specialtyByName[specialtyName];
    supervisors.push(await upsertUser(email, {
      name, role: 'b_supervisor', phone: `+964-771-530-${String(i + 1).padStart(4, '0')}`,
      hospitalId: hospital._id, hospital: hospital._id,
      specialtyId: specialty._id, specialty: specialty.name, department: specialty.name,
    }, DEMO_PASSWORD));
  }

  for (let i = 0; i < hospitals.length; i++) {
    hospitals[i].dioId = dio._id;
    hospitals[i].presidentId = president._id;
    hospitals[i].programDirector = programDirectors[i % programDirectors.length]._id;
    hospitals[i].supervisors = supervisors.filter((_, idx) => idx % hospitals.length === i).map(s => s._id);
    hospitals[i].specialties = SPECIALTIES;
    await saveDoc(hospitals[i], `link basic hospital leadership: ${hospitals[i].name}`);
  }

  for (let i = 0; i < specialties.length; i++) {
    specialties[i].secretaryId = secretaries[i]._id;
    await saveDoc(specialties[i], `link basic specialty secretary: ${specialties[i].name}`);
  }

  const distributions = [];
  for (let i = 0; i < supervisors.length; i++) {
    distributions.push(await upsertDistribution({
      supervisor: supervisors[i],
      hospital: hospitalByIndex(Math.floor(i / 3)),
      specialty: specialties.find(s => idEq(s._id, supervisors[i].specialtyId)),
    }));
  }

  const trainees = [];
  for (let i = 0; i < TRAINEE_NAMES.length; i++) {
    const specialty = specialties[i % specialties.length];
    const supervisor = supervisors.find(s => idEq(s.specialtyId, specialty._id)) || supervisors[i % supervisors.length];
    const hospital = hospitals[i % hospitals.length];
    trainees.push(await upsertUser(`b.trainee${String(i + 1).padStart(2, '0')}@mtms.com`, {
      name: TRAINEE_NAMES[i], role: 'b_trainee', phone: `+964-771-540-${String(i + 1).padStart(4, '0')}`,
      studentId: `MTMS-BTR-2026-${String(i + 1).padStart(3, '0')}`, year: (i % 2) + 1,
      enrolledSince: addMonths(now, -8),
      specialtyId: specialty._id, specialty: specialty.name,
      hospitalId: hospital._id, hospital: hospital._id,
      supervisorId: supervisor._id, supervisor: supervisor._id,
      city: ['Baghdad', 'Basra', 'Najaf', 'Mosul', 'Karbala'][i % 5],
      gender: i % 3 === 0 ? 'female' : 'male',
    }, DEMO_PASSWORD));
  }

  const rotations = [];
  for (let i = 0; i < trainees.length; i++) {
    const trainee = trainees[i];
    const specialty = specialties.find(s => idEq(s._id, trainee.specialtyId));
    const matching = supervisors.filter(s => idEq(s.specialtyId, specialty._id));
    const completedHospital = hospitals[i % hospitals.length];
    const currentHospital   = hospitals[(i + 1) % hospitals.length];
    const sup = matching[0] || supervisors[i % supervisors.length];
    rotations.push(await upsertRotation({ trainee, hospital: completedHospital, supervisor: sup, specialty, status: 'completed', startDate: completedStart, endDate: completedEnd }));
    rotations.push(await upsertRotation({ trainee, hospital: currentHospital, supervisor: sup, specialty, status: 'current', startDate: currentStart, endDate: currentEnd }));
    rotations.push(await upsertRotation({ trainee, hospital: currentHospital, supervisor: sup, specialty, status: 'upcoming', startDate: upcomingStart, endDate: upcomingEnd }));
  }

  for (let i = 0; i < trainees.length; i++) {
    const trainee = trainees[i];
    const tRot = rotations.filter(r => idEq(r.traineeId, trainee._id));
    const completed = tRot.find(r => r.status === 'completed');
    const current = tRot.find(r => r.status === 'current');
    const supervisor = supervisors.find(s => idEq(s._id, current.supervisorId));
    const hospital = hospitals.find(h => idEq(h._id, current.hospitalId));
    const specialty = specialties.find(s => idEq(s._id, trainee.specialtyId));

    await upsertReport({ trainee, rotation: current, hospital, type: 'weekly', title: 'Weekly Clinical Reflection', date: addMonths(now, -1), status: i % 3 === 0 ? 'graded' : 'pending', score: 72 + (i % 20), grade: i % 3 === 0 ? 'Competent' : null, gradedBy: supervisor, gradedByRole: 'b_supervisor' });
    await upsertReport({ trainee, rotation: current, hospital, type: 'monthly', title: 'Monthly Progress Report', date: addMonths(now, -1), status: i % 4 === 0 ? 'rejected' : 'graded', score: 70 + (i % 22), grade: i % 4 === 0 ? null : 'Competent', gradedBy: supervisor, gradedByRole: 'b_supervisor' });
    if (i % 2 === 0) {
      const cHosp = hospitals.find(h => idEq(h._id, completed.hospitalId));
      await upsertReport({ trainee, rotation: completed, hospital: cHosp, type: 'final', title: 'Final Rotation Report', date: addMonths(now, -3), status: 'graded', score: 75 + (i % 18), grade: 'Pass', gradedBy: programDirectors[i % programDirectors.length], gradedByRole: 'b_program_director' });
    }

    await upsertEvaluation({ trainee, rotation: current, hospital, supervisor, specialty, evaluator: supervisor, evaluatorRole: 'b_supervisor', index: i, totalScore: 70 + (i % 25), finalized: true });
    if (i % 3 === 0) {
      await upsertEvaluation({ trainee, rotation: current, hospital, supervisor, specialty, evaluator: dio, evaluatorRole: 'b_dio', index: i, totalScore: 76 + (i % 18), finalized: true });
    }

    if (i < 5) {
      const cSup = supervisors.find(s => idEq(s._id, completed.supervisorId)) || supervisor;
      const cHosp = hospitals.find(h => idEq(h._id, completed.hospitalId));
      await upsertCertificate({ trainee, rotation: completed, hospital: cHosp, supervisor: cSup, specialty, issuedBy: dio, index: i, revoked: i === 0 });
    }
  }

  return { hospitals, specialties, dio, president, programDirectors, secretaries, supervisors, distributions, trainees, rotations };
}

function printLogins() {
  console.log('\nBasic-track demo logins (password for all): ' + DEMO_PASSWORD);
  console.log('  b_dio             b.dio@mtms.com');
  console.log('  b_president       b.president@mtms.com');
  console.log('  b_program_director b.pd1@mtms.com, b.pd2@mtms.com');
  console.log('  b_secretary       b.sec.internal@mtms.com, b.sec.surgery@mtms.com, b.sec.pediatrics@mtms.com');
  console.log('  b_supervisor      b.sup.internal.1@mtms.com … b.sup.pediatrics.2@mtms.com');
  console.log('  b_trainee         b.trainee01@mtms.com … b.trainee10@mtms.com');
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is required in backend/.env');
    process.exit(1);
  }
  if (!DRY_RUN && !CONFIRMED) {
    console.error('ERROR: Apply mode requires CONFIRM_RESEED_BASIC=true');
    console.error('Use: DRY_RUN=false CONFIRM_RESEED_BASIC=true node backend/migrations/reseedBasicTrainingData.js');
    process.exit(1);
  }

  console.log(`Basic-training reseed starting. DRY_RUN=${DRY_RUN} CONFIRM_RESEED_BASIC=${CONFIRMED}`);
  await mongoose.connect(process.env.MONGO_URI);

  const basic = await buildBasicData();
  await deactivateStaleBasicUsers();

  console.log('\nPlanned major actions:', actions.length);
  console.log(`  basic hospitals:   ${basic.hospitals.length}`);
  console.log(`  basic specialties: ${basic.specialties.length}`);
  console.log(`  b_program_director:${basic.programDirectors.length}  b_secretary:${basic.secretaries.length}  b_supervisor:${basic.supervisors.length}  b_trainee:${basic.trainees.length}`);
  printLogins();
  console.log('\nExact apply command:');
  console.log('  DRY_RUN=false CONFIRM_RESEED_BASIC=true node backend/migrations/reseedBasicTrainingData.js');
  console.log('\nAdvanced-track data is never modified by this script.');

  await mongoose.disconnect();
}

main().catch(async err => {
  console.error('Basic-training reseed failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
