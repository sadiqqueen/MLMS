'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const Specialty = require('../models/Specialty');
const Distribution = require('../models/Distribution');
const Rotation = require('../models/Rotation');
const Report = require('../models/Report');
const Evaluation = require('../models/Evaluation');
const Certificate = require('../models/Certificate');

const DRY_RUN = process.env.DRY_RUN !== 'false';
const CONFIRMED = process.env.CONFIRM_RESEED === 'true';

const DEMO_PASSWORD = '123456';
const PASSWORDS = {
  super_admin: DEMO_PASSWORD,
  dio: DEMO_PASSWORD,
  president: DEMO_PASSWORD,
  program_director: DEMO_PASSWORD,
  secretary: DEMO_PASSWORD,
  supervisor: DEMO_PASSWORD,
  trainee: DEMO_PASSWORD
};

const HOSPITALS = [
  { name: 'Baghdad Teaching Hospital', city: 'Baghdad', governorate: 'Baghdad', address: 'Medical City, Baghdad', phone: '+964-770-410-0001', email: 'baghdad.teaching@mtms.com' },
  { name: 'Al-Yarmouk Teaching Hospital', city: 'Baghdad', governorate: 'Baghdad', address: 'Al-Yarmouk District, Baghdad', phone: '+964-770-410-0002', email: 'yarmouk.teaching@mtms.com' },
  { name: 'Al-Kindi Teaching Hospital', city: 'Baghdad', governorate: 'Baghdad', address: 'Palestine Street, Baghdad', phone: '+964-770-410-0003', email: 'kindi.teaching@mtms.com' },
  { name: 'Medical City Teaching Hospital', city: 'Baghdad', governorate: 'Baghdad', address: 'Bab Al-Moatham, Baghdad', phone: '+964-770-410-0004', email: 'medical.city@mtms.com' },
  { name: 'Al-Imamain Al-Kadhimain Medical City', city: 'Baghdad', governorate: 'Baghdad', address: 'Kadhimiya, Baghdad', phone: '+964-770-410-0005', email: 'kadhimain.medical@mtms.com' }
];

const SPECIALTIES = [
  'Internal Medicine',
  'General Surgery',
  'Pediatrics',
  'Emergency Medicine',
  'Obstetrics and Gynecology'
];

const PROGRAM_DIRECTORS = [
  { name: 'Dr. Hassan Al-Saadi', email: 'pd.baghdad@mtms.com', phone: '+964-770-510-0001' },
  { name: 'Dr. Fatima Al-Rubaie', email: 'pd.yarmouk@mtms.com', phone: '+964-770-510-0002' },
  { name: 'Dr. Omar Al-Jubouri', email: 'pd.kindi@mtms.com', phone: '+964-770-510-0003' },
  { name: 'Dr. Noor Al-Hamdani', email: 'pd.medcity@mtms.com', phone: '+964-770-510-0004' },
  { name: 'Dr. Kareem Al-Dulaimi', email: 'pd.kadhimain@mtms.com', phone: '+964-770-510-0005' }
];

const SECRETARIES = [
  { name: 'Zainab Karim Al-Bayati', email: 'sec.internal@mtms.com', phone: '+964-770-520-0001' },
  { name: 'Maha Ali Al-Samarrai', email: 'sec.surgery@mtms.com', phone: '+964-770-520-0002' },
  { name: 'Rasha Mahdi Al-Janabi', email: 'sec.pediatrics@mtms.com', phone: '+964-770-520-0003' },
  { name: 'Huda Nabeel Al-Tamimi', email: 'sec.emergency@mtms.com', phone: '+964-770-520-0004' },
  { name: 'Abeer Saad Al-Khazraji', email: 'sec.obgyn@mtms.com', phone: '+964-770-520-0005' }
];

const SUPERVISORS = [
  ['Dr. Zainab Al-Hamdani', 'sup.internal.bgh@mtms.com', 'Internal Medicine'],
  ['Dr. Ahmed Al-Rashidi', 'sup.surgery.bgh@mtms.com', 'General Surgery'],
  ['Dr. Sara Al-Tamimi', 'sup.pediatrics.bgh@mtms.com', 'Pediatrics'],
  ['Dr. Laith Al-Khafaji', 'sup.emergency.yarmouk@mtms.com', 'Emergency Medicine'],
  ['Dr. Rana Al-Moussawi', 'sup.obgyn.yarmouk@mtms.com', 'Obstetrics and Gynecology'],
  ['Dr. Mustafa Al-Azzawi', 'sup.internal.yarmouk@mtms.com', 'Internal Medicine'],
  ['Dr. Salma Al-Rubaie', 'sup.surgery.kindi@mtms.com', 'General Surgery'],
  ['Dr. Ammar Al-Hilli', 'sup.pediatrics.kindi@mtms.com', 'Pediatrics'],
  ['Dr. Dalia Al-Qaisi', 'sup.emergency.kindi@mtms.com', 'Emergency Medicine'],
  ['Dr. Hayder Al-Saadi', 'sup.obgyn.medcity@mtms.com', 'Obstetrics and Gynecology'],
  ['Dr. Mariam Al-Hashimi', 'sup.internal.medcity@mtms.com', 'Internal Medicine'],
  ['Dr. Saif Al-Jubouri', 'sup.surgery.medcity@mtms.com', 'General Surgery'],
  ['Dr. Luma Al-Karkhi', 'sup.pediatrics.kadhimain@mtms.com', 'Pediatrics'],
  ['Dr. Yasser Al-Mansouri', 'sup.emergency.kadhimain@mtms.com', 'Emergency Medicine'],
  ['Dr. Haneen Al-Obaidi', 'sup.obgyn.kadhimain@mtms.com', 'Obstetrics and Gynecology']
];

const TRAINEE_NAMES = [
  'Ali Mohammed Al-Saeedi', 'Mariam Khalid Al-Janabi', 'Hussein Adel Al-Fahdawi',
  'Raya Samer Al-Mousawi', 'Mohammed Talib Al-Shammari', 'Lina Jasim Al-Hasnawi',
  'Omar Saad Al-Rubaie', 'Fatima Naji Al-Zubaidi', 'Yousif Mahdi Al-Bermani',
  'Zainab Haider Al-Asadi', 'Ahmed Firas Al-Karim', 'Noor Sabah Al-Darraji',
  'Mustafa Riyadh Al-Tamimi', 'Sarah Qasim Al-Hilli', 'Karrar Adnan Al-Khafaji',
  'Ban Saad Al-Bayati', 'Hassan Nizar Al-Mansouri', 'Dina Abbas Al-Obaidi',
  'Mahdi Talal Al-Kazemi', 'Hiba Kareem Al-Samarrai', 'Laith Anwar Al-Azzawi',
  'Shahad Ali Al-Qaisi', 'Amir Fadhil Al-Moussawi', 'Raneem Zuhair Al-Rashidi',
  'Sajjad Khalil Al-Dulaimi', 'Aya Muthanna Al-Hamdani', 'Bilal Raad Al-Jubouri',
  'Mina Faris Al-Khazraji', 'Taha Samer Al-Karkhi', 'Hanin Omar Al-Hashimi'
];

const PROFESSIONAL_USER_EMAILS = new Set([
  'sadeq@mtms.com',
  'dio@mtms.com',
  'president@mtms.com',
  ...PROGRAM_DIRECTORS.map(u => u.email),
  ...SECRETARIES.map(u => u.email),
  ...SUPERVISORS.map(u => u[1]),
  ...Array.from({ length: 30 }, (_, i) => `trainee${String(i + 1).padStart(2, '0')}@mtms.com`)
]);

const actions = [];

function logAction(message) {
  actions.push(message);
  console.log(`${DRY_RUN ? '[DRY RUN]' : '[APPLY]'} ${message}`);
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  d.setHours(12, 0, 0, 0);
  return d;
}

function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

function initials(name) {
  return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function isObjectIdEqual(a, b) {
  return a && b && a.toString() === b.toString();
}

async function saveDoc(doc, message) {
  logAction(message);
  if (!DRY_RUN) await doc.save();
  return doc;
}

async function upsertHospital(data) {
  let doc = await Hospital.findOne({ name: data.name });
  if (!doc) doc = new Hospital(data);
  Object.assign(doc, data, { isActive: true });
  return saveDoc(doc, `upsert hospital: ${data.name}`);
}

async function upsertSpecialty(name) {
  let doc = await Specialty.findOne({ name });
  if (!doc) doc = new Specialty({ name });
  doc.name = name;
  doc.isActive = true;
  return saveDoc(doc, `upsert specialty: ${name}`);
}

async function upsertUser(email, data, password) {
  let doc = await User.findOne({ email });
  const isNew = !doc;
  if (!doc) doc = new User({ email, password });

  Object.assign(doc, data, {
    email,
    isActive: true,
    deletedAt: null,
    locked: false,
    lockUntil: null,
    loginAttempts: 0,
    initials: data.initials || initials(data.name)
  });

  doc.password = password;

  return saveDoc(doc, `${isNew ? 'create' : 'update'} ${data.role}: ${data.name} <${email}>`);
}

async function upsertDistribution({ supervisor, hospital, specialty }) {
  let doc = await Distribution.findOne({ supervisorId: supervisor._id });
  if (!doc) doc = new Distribution({ supervisorId: supervisor._id });
  Object.assign(doc, {
    supervisorId: supervisor._id,
    doctor: supervisor._id,
    hospitalId: hospital._id,
    hospital: hospital._id,
    specialtyId: specialty._id,
    specialty: specialty.name,
    status: 'active',
    traineeId: null,
    student: null,
    startDate: null,
    endDate: null,
    durationWeeks: null
  });
  return saveDoc(doc, `upsert active supervisor distribution: ${supervisor.email}`);
}

async function upsertRotation({ trainee, hospital, supervisor, specialty, status, startDate, endDate }) {
  let doc = await Rotation.findOne({
    traineeId: trainee._id,
    status,
    startDate: normalizeDate(startDate),
    endDate: normalizeDate(endDate)
  });
  if (!doc) doc = new Rotation({ traineeId: trainee._id, student: trainee._id, startDate: normalizeDate(startDate), endDate: normalizeDate(endDate) });
  Object.assign(doc, {
    traineeId: trainee._id,
    student: trainee._id,
    hospitalId: hospital._id,
    hospital: hospital._id,
    supervisorId: supervisor._id,
    doctor: supervisor._id,
    specialtyId: specialty._id,
    startDate: normalizeDate(startDate),
    endDate: normalizeDate(endDate),
    status
  });
  return saveDoc(doc, `upsert ${status} rotation: ${trainee.email} at ${hospital.name}`);
}

async function upsertReport({ trainee, rotation, hospital, type, title, date, status, score, grade, gradedBy, gradedByRole }) {
  let doc = await Report.findOne({ student: trainee._id, rotation: rotation._id, type, title });
  if (!doc) doc = new Report({ student: trainee._id, rotation: rotation._id, type, title, date });
  Object.assign(doc, {
    student: trainee._id,
    rotation: rotation._id,
    hospital: hospital._id,
    title,
    type,
    date,
    status,
    score: score ?? null,
    grade: grade || null,
    gradedBy: gradedBy?._id || null,
    gradedByRole: gradedByRole || '',
    gradedAt: status === 'graded' ? date : null,
    reviewNote: status === 'rejected' ? 'Please revise the reflection and resubmit.' : 'Professional training progress reviewed.',
    assessorComments: status === 'graded' ? 'Meets expected milestone for this rotation.' : ''
  });
  return saveDoc(doc, `upsert ${type} report (${status}): ${trainee.email}`);
}

async function upsertEvaluation({ trainee, rotation, hospital, supervisor, specialty, evaluator, evaluatorRole, index, totalScore, finalized }) {
  const evaluationType = evaluatorRole === 'dio' ? 'DIO Progress Review' : index % 2 ? 'Mini-CEX' : 'CBD';
  let doc = await Evaluation.findOne({
    traineeId: trainee._id,
    rotationId: rotation._id,
    evaluatorRole,
    evaluationType
  });
  if (!doc) doc = new Evaluation({ student: trainee._id, traineeId: trainee._id, rotationId: rotation._id, evaluationType });
  Object.assign(doc, {
    student: trainee._id,
    traineeId: trainee._id,
    rotationId: rotation._id,
    doctor: supervisor?._id || evaluator._id,
    supervisorId: supervisor?._id || null,
    hospital: hospital._id,
    specialty: specialty.name,
    evaluatorId: evaluator._id,
    evaluatorRole,
    createdBy: evaluator._id,
    createdByRole: evaluatorRole,
    date: addMonths(new Date(), evaluatorRole === 'dio' ? -1 : -2),
    grade: totalScore >= 85 ? 'above' : totalScore >= 70 ? 'meets' : 'needs-improvement',
    status: finalized ? 'completed' : 'pending',
    scores: { professionalism: totalScore - 2, clinicalJudgment: totalScore, communication: totalScore + 1 },
    totalScore,
    notes: `${evaluatorRole === 'dio' ? 'DIO' : 'Supervisor'} evaluation for ${trainee.name}.`,
    comments: 'Performance reviewed against MTMS training milestones.',
    isFinalized: finalized,
    sentToTraineeAt: finalized ? new Date() : null
  });
  return saveDoc(doc, `upsert ${evaluatorRole} evaluation: ${trainee.email}`);
}

async function upsertCertificate({ trainee, rotation, hospital, supervisor, specialty, issuedBy, index, revoked }) {
  const code = `MTMS-CERT-2026-${String(index + 1).padStart(3, '0')}`;
  let doc = await Certificate.findOne({ verifyCode: code });
  if (!doc) doc = new Certificate({ student: trainee._id, verifyCode: code });
  Object.assign(doc, {
    student: trainee._id,
    traineeId: trainee._id,
    rotation: rotation._id,
    hospital: hospital._id,
    specialty: specialty.name,
    type: 'Completion',
    doctor: supervisor._id,
    supervisor: supervisor._id,
    issuedBy: issuedBy._id,
    issueDate: addMonths(new Date(), -1),
    notes: 'Professional MTMS training certificate.',
    revokedAt: revoked ? new Date() : null
  });
  return saveDoc(doc, `upsert ${revoked ? 'revoked' : 'valid'} certificate: ${code}`);
}

async function deactivateOldRecords(professional) {
  await deactivateOldUsers();
  await deactivateOldHospitals(professional.hospitals);
  await deactivateOldSpecialties(professional.specialties);
  await deactivateOldDistributions(professional.distributions);
  await cancelOldRotations(professional.rotations);
}

async function deactivateOldUsers() {
  const oldUsers = await User.find({
    email: { $nin: Array.from(PROFESSIONAL_USER_EMAILS) },
    isActive: { $ne: false },
    track: { $ne: 'basic' } // never touch Basic-track accounts
  });
  for (const user of oldUsers) {
    user.isActive = false;
    user.deletedAt = user.deletedAt || new Date();
    await saveDoc(user, `soft-deactivate old user: ${user.email} (${user.role})`);
  }
}

async function deactivateOldHospitals(professionalHospitals) {
  const names = professionalHospitals.map(h => h.name);
  const oldHospitals = await Hospital.find({ name: { $nin: names }, isActive: { $ne: false }, track: { $ne: 'basic' } });
  for (const hospital of oldHospitals) {
    hospital.isActive = false;
    await saveDoc(hospital, `deactivate old hospital: ${hospital.name}`);
  }
}

async function deactivateOldSpecialties(professionalSpecialties) {
  const names = professionalSpecialties.map(s => s.name);
  const oldSpecialties = await Specialty.find({ name: { $nin: names }, isActive: { $ne: false }, track: { $ne: 'basic' } });
  for (const specialty of oldSpecialties) {
    specialty.isActive = false;
    await saveDoc(specialty, `deactivate old specialty: ${specialty.name}`);
  }
}

async function deactivateOldDistributions(professionalDistributions) {
  const ids = professionalDistributions.map(d => d._id);
  const oldDistributions = await Distribution.find({ _id: { $nin: ids }, status: 'active', track: { $ne: 'basic' } });
  for (const dist of oldDistributions) {
    dist.status = 'inactive';
    await saveDoc(dist, `inactivate old distribution: ${dist._id}`);
  }
}

async function cancelOldRotations(professionalRotations) {
  const ids = professionalRotations.map(r => r._id);
  const oldRotations = await Rotation.find({ _id: { $nin: ids }, status: { $ne: 'cancelled' }, track: { $ne: 'basic' } });
  for (const rotation of oldRotations) {
    rotation.status = 'cancelled';
    await saveDoc(rotation, `cancel old rotation: ${rotation._id}`);
  }
}

async function buildProfessionalData() {
  const now = new Date();
  const completedStart = addMonths(now, -6);
  const completedEnd = addMonths(now, -3);
  const currentStart = addMonths(now, -1);
  const currentEnd = addMonths(now, 2);
  const upcomingStart = addMonths(now, 2);
  const upcomingEnd = addMonths(now, 5);

  const hospitals = [];
  for (const hospitalData of HOSPITALS) hospitals.push(await upsertHospital(hospitalData));

  const specialties = [];
  for (const name of SPECIALTIES) specialties.push(await upsertSpecialty(name));

  const specialtyByName = Object.fromEntries(specialties.map(s => [s.name, s]));
  const hospitalByIndex = i => hospitals[i % hospitals.length];

  const superAdmin = await upsertUser('sadeq@mtms.com', {
    name: 'ENG. Sadeq Kareem',
    role: 'super_admin',
    phone: '+964-770-500-0001',
    city: 'Baghdad',
    gender: 'male'
  }, PASSWORDS.super_admin);

  const dio = await upsertUser('dio@mtms.com', {
    name: 'Dr. Jawad Ibrahim',
    role: 'dio',
    phone: '+964-770-500-0002',
    city: 'Baghdad',
    gender: 'male'
  }, PASSWORDS.dio);

  const president = await upsertUser('president@mtms.com', {
    name: 'Dr. Abdulrahman Al-Kazemi',
    role: 'president',
    phone: '+964-770-500-0003',
    city: 'Baghdad',
    gender: 'male'
  }, PASSWORDS.president);

  const programDirectors = [];
  for (let i = 0; i < PROGRAM_DIRECTORS.length; i++) {
    const pd = PROGRAM_DIRECTORS[i];
    const hospital = hospitalByIndex(i);
    programDirectors.push(await upsertUser(pd.email, {
      name: pd.name,
      role: 'program_director',
      phone: pd.phone,
      hospitalId: hospital._id,
      hospital: hospital._id,
      specialtyId: null,
      specialty: '',
      department: 'Clinical Training'
    }, PASSWORDS.program_director));
  }

  const secretaries = [];
  for (let i = 0; i < SECRETARIES.length; i++) {
    const sec = SECRETARIES[i];
    const specialty = specialties[i];
    const hospital = hospitalByIndex(i);
    secretaries.push(await upsertUser(sec.email, {
      name: sec.name,
      role: 'secretary',
      phone: sec.phone,
      hospitalId: hospital._id,
      hospital: hospital._id,
      specialtyId: specialty._id,
      specialty: specialty.name,
      department: 'Training Coordination'
    }, PASSWORDS.secretary));
  }

  const supervisors = [];
  for (let i = 0; i < SUPERVISORS.length; i++) {
    const [name, email, specialtyName] = SUPERVISORS[i];
    const hospital = hospitalByIndex(Math.floor(i / 3));
    const specialty = specialtyByName[specialtyName];
    supervisors.push(await upsertUser(email, {
      name,
      role: 'supervisor',
      phone: `+964-770-530-${String(i + 1).padStart(4, '0')}`,
      hospitalId: hospital._id,
      hospital: hospital._id,
      specialtyId: specialty._id,
      specialty: specialty.name,
      department: specialty.name
    }, PASSWORDS.supervisor));
  }

  for (let i = 0; i < hospitals.length; i++) {
    hospitals[i].dioId = dio._id;
    hospitals[i].presidentId = president._id;
    hospitals[i].programDirector = programDirectors[i]._id;
    hospitals[i].supervisors = supervisors.slice(i * 3, i * 3 + 3).map(s => s._id);
    hospitals[i].specialties = SPECIALTIES;
    await saveDoc(hospitals[i], `link hospital leadership: ${hospitals[i].name}`);
  }

  for (let i = 0; i < specialties.length; i++) {
    specialties[i].secretaryId = secretaries[i]._id;
    await saveDoc(specialties[i], `link specialty secretary: ${specialties[i].name}`);
  }

  const distributions = [];
  for (let i = 0; i < supervisors.length; i++) {
    distributions.push(await upsertDistribution({
      supervisor: supervisors[i],
      hospital: hospitals[Math.floor(i / 3)],
      specialty: specialties.find(s => isObjectIdEqual(s._id, supervisors[i].specialtyId))
    }));
  }

  const trainees = [];
  for (let i = 0; i < TRAINEE_NAMES.length; i++) {
    const specialty = specialties[Math.floor(i / 6)];
    const supervisor = supervisors.find(s => isObjectIdEqual(s.specialtyId, specialty._id)) || supervisors[i % supervisors.length];
    const hospital = hospitals[i % hospitals.length];
    trainees.push(await upsertUser(`trainee${String(i + 1).padStart(2, '0')}@mtms.com`, {
      name: TRAINEE_NAMES[i],
      role: 'trainee',
      phone: `+964-770-540-${String(i + 1).padStart(4, '0')}`,
      studentId: `MTMS-TR-2026-${String(i + 1).padStart(3, '0')}`,
      year: (i % 4) + 1,
      enrolledSince: addMonths(now, -10),
      specialtyId: specialty._id,
      specialty: specialty.name,
      hospitalId: hospital._id,
      hospital: hospital._id,
      supervisorId: supervisor._id,
      supervisor: supervisor._id,
      city: ['Baghdad', 'Basra', 'Najaf', 'Mosul', 'Karbala'][i % 5],
      gender: i % 3 === 0 ? 'female' : 'male'
    }, PASSWORDS.trainee));
  }

  const rotations = [];
  for (let i = 0; i < trainees.length; i++) {
    const trainee = trainees[i];
    const specialty = specialties.find(s => isObjectIdEqual(s._id, trainee.specialtyId));
    const matchingSupervisors = supervisors.filter(s => isObjectIdEqual(s.specialtyId, specialty._id));
    const completedHospital = hospitals[i % hospitals.length];
    const currentHospital = hospitals[(i + 1) % hospitals.length];
    const upcomingHospital = hospitals[(i + 2) % hospitals.length];
    const completedSupervisor = matchingSupervisors.find(s => isObjectIdEqual(s.hospitalId, completedHospital._id)) || matchingSupervisors[0];
    const currentSupervisor = matchingSupervisors.find(s => isObjectIdEqual(s.hospitalId, currentHospital._id)) || matchingSupervisors[0];
    const upcomingSupervisor = matchingSupervisors.find(s => isObjectIdEqual(s.hospitalId, upcomingHospital._id)) || matchingSupervisors[0];

    rotations.push(await upsertRotation({ trainee, hospital: completedHospital, supervisor: completedSupervisor, specialty, status: 'completed', startDate: completedStart, endDate: completedEnd }));
    rotations.push(await upsertRotation({ trainee, hospital: currentHospital, supervisor: currentSupervisor, specialty, status: 'current', startDate: currentStart, endDate: currentEnd }));
    rotations.push(await upsertRotation({ trainee, hospital: upcomingHospital, supervisor: upcomingSupervisor, specialty, status: 'upcoming', startDate: upcomingStart, endDate: upcomingEnd }));
  }

  for (let i = 0; i < trainees.length; i++) {
    const trainee = trainees[i];
    const traineeRotations = rotations.filter(r => isObjectIdEqual(r.traineeId, trainee._id));
    const completed = traineeRotations.find(r => r.status === 'completed');
    const current = traineeRotations.find(r => r.status === 'current');
    const supervisor = supervisors.find(s => isObjectIdEqual(s._id, current.supervisorId));
    const hospital = hospitals.find(h => isObjectIdEqual(h._id, current.hospitalId));
    const specialty = specialties.find(s => isObjectIdEqual(s._id, trainee.specialtyId));

    await upsertReport({ trainee, rotation: current, hospital, type: 'weekly', title: 'Weekly Clinical Reflection', date: addMonths(now, -1), status: i % 3 === 0 ? 'graded' : 'pending', score: 72 + (i % 20), grade: i % 3 === 0 ? 'Competent' : null, gradedBy: supervisor, gradedByRole: 'supervisor' });
    await upsertReport({ trainee, rotation: current, hospital, type: 'monthly', title: 'Monthly Progress Report', date: addMonths(now, -1), status: i % 4 === 0 ? 'rejected' : 'graded', score: 70 + (i % 22), grade: i % 4 === 0 ? null : 'Competent', gradedBy: supervisor, gradedByRole: 'supervisor' });
    if (i % 2 === 0) {
      const completedHospital = hospitals.find(h => isObjectIdEqual(h._id, completed.hospitalId));
      await upsertReport({ trainee, rotation: completed, hospital: completedHospital, type: 'final', title: 'Final Rotation Report', date: addMonths(now, -3), status: 'graded', score: 75 + (i % 18), grade: 'Pass', gradedBy: programDirectors[i % programDirectors.length], gradedByRole: 'program_director' });
    }

    await upsertEvaluation({ trainee, rotation: current, hospital, supervisor, specialty, evaluator: supervisor, evaluatorRole: 'supervisor', index: i, totalScore: 70 + (i % 25), finalized: true });
    if (i % 3 === 0) {
      await upsertEvaluation({ trainee, rotation: current, hospital, supervisor, specialty, evaluator: dio, evaluatorRole: 'dio', index: i, totalScore: 76 + (i % 18), finalized: true });
    }

    if (i < 10) {
      const completedSupervisor = supervisors.find(s => isObjectIdEqual(s._id, completed.supervisorId));
      const completedHospital = hospitals.find(h => isObjectIdEqual(h._id, completed.hospitalId));
      await upsertCertificate({ trainee, rotation: completed, hospital: completedHospital, supervisor: completedSupervisor, specialty, issuedBy: dio, index: i, revoked: i === 0 });
    }
  }

  return { hospitals, specialties, superAdmin, dio, president, programDirectors, secretaries, supervisors, distributions, trainees, rotations };
}

async function countPlanned(professional) {
  const bySpecialty = {};
  for (const specialty of professional.specialties) {
    bySpecialty[specialty.name] = professional.trainees.filter(t => isObjectIdEqual(t.specialtyId, specialty._id)).length;
  }

  const byHospitalSupervisors = {};
  for (const hospital of professional.hospitals) {
    byHospitalSupervisors[hospital.name] = professional.supervisors.filter(s => isObjectIdEqual(s.hospitalId, hospital._id)).length;
  }

  const currentRotationCounts = new Map();
  for (const rotation of professional.rotations.filter(r => r.status === 'current')) {
    const key = (rotation.traineeId || rotation.student).toString();
    currentRotationCounts.set(key, (currentRotationCounts.get(key) || 0) + 1);
  }

  return {
    superAdmin: professional.superAdmin?.name === 'ENG. Sadeq Kareem' ? 1 : 0,
    dio: professional.dio?.name === 'Dr. Jawad Ibrahim' ? 1 : 0,
    hospitals: professional.hospitals.length,
    specialties: professional.specialties.length,
    programDirectors: professional.programDirectors.length,
    secretaries: professional.secretaries.length,
    supervisors: professional.supervisors.length,
    trainees: professional.trainees.length,
    distributions: professional.distributions.length,
    rotations: professional.rotations.length,
    bySpecialty,
    byHospitalSupervisors,
    duplicateCurrentTrainees: Array.from(currentRotationCounts.values()).filter(count => count > 1).length,
    legacyRolesPlanned: professional.trainees.concat(professional.supervisors, professional.programDirectors, professional.secretaries, [professional.superAdmin, professional.dio, professional.president])
      .filter(u => ['doctor', 'student', 'professor', 'director', 'admin'].includes(u.role)).length
  };
}

function printValidation(summary) {
  console.log('\nFinal expected professional counts:');
  console.log(`  super_admin named ENG. Sadeq Kareem: ${summary.superAdmin}`);
  console.log(`  dio named Dr. Jawad Ibrahim: ${summary.dio}`);
  console.log(`  hospitals: ${summary.hospitals}`);
  console.log(`  specialties: ${summary.specialties}`);
  console.log(`  program_directors: ${summary.programDirectors}`);
  console.log(`  secretaries: ${summary.secretaries}`);
  console.log(`  supervisors: ${summary.supervisors}`);
  console.log(`  trainees: ${summary.trainees}`);
  console.log(`  active supervisor distributions: ${summary.distributions}`);
  console.log(`  trainee rotations: ${summary.rotations}`);
  console.log(`  duplicate current rotations planned: ${summary.duplicateCurrentTrainees}`);
  console.log(`  legacy roles planned: ${summary.legacyRolesPlanned}`);
  console.log('  trainees by specialty:', summary.bySpecialty);
  console.log('  supervisors by hospital:', summary.byHospitalSupervisors);
}

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('ERROR: MONGO_URI is required in backend/.env');
    process.exit(1);
  }

  if (!DRY_RUN && !CONFIRMED) {
    console.error('ERROR: Apply mode requires CONFIRM_RESEED=true');
    console.error('Use: DRY_RUN=false CONFIRM_RESEED=true node backend/migrations/reseedProfessionalData.js');
    process.exit(1);
  }

  console.log(`Professional MTMS reseed starting. DRY_RUN=${DRY_RUN} CONFIRM_RESEED=${CONFIRMED}`);
  console.log(`Demo password for all generated users: ${DEMO_PASSWORD}`);
  console.log('Passwords are assigned through the User model and hashes are never printed.');
  await mongoose.connect(process.env.MONGO_URI);

  const professional = await buildProfessionalData();
  await deactivateOldRecords(professional);
  const summary = await countPlanned(professional);
  printValidation(summary);

  console.log(`\nPlanned major actions: ${actions.length}`);
  console.log('\nExact apply command:');
  console.log('  DRY_RUN=false CONFIRM_RESEED=true node backend/migrations/reseedProfessionalData.js');
  console.log('\nRisks: old users/hospitals/specialties are deactivated, old active distributions are inactivated, and old non-cancelled rotations are cancelled. Uploads are not touched. Users are not hard-deleted.');

  await mongoose.disconnect();
}

main().catch(async err => {
  console.error('Professional reseed failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
