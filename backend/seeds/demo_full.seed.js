require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

// ── IMPORT MODELS ──────────────────────────────────────────────────────────────
const User         = require('../models/User');
const Hospital     = require('../models/Hospital');
const Specialty    = require('../models/Specialty');
const Distribution = require('../models/Distribution');
const Rotation     = require('../models/Rotation');
const Report       = require('../models/Report');
const Evaluation   = require('../models/Evaluation');

const DEMO_SEED_PASSWORD = process.env.MTMS_DEMO_SEED_PASSWORD;

function requireLocalDemoSeed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production.');
  }
  if (process.env.ALLOW_LOCAL_DEMO_SEED !== 'true' || process.env.CONFIRM_LOCAL_DEMO_SEED !== 'true') {
    throw new Error('Demo seed requires ALLOW_LOCAL_DEMO_SEED=true and CONFIRM_LOCAL_DEMO_SEED=true.');
  }
  if (!DEMO_SEED_PASSWORD || DEMO_SEED_PASSWORD.length < 12) {
    throw new Error('MTMS_DEMO_SEED_PASSWORD is required and must be at least 12 characters.');
  }
}

// ── REAL IRAQI HOSPITALS ───────────────────────────────────────────────────────
const HOSPITALS_DATA = [
  {
    name:        'Baghdad Teaching Hospital',
    city:        'Baghdad',
    governorate: 'Baghdad',
    address:     'Bab Al-Moatham, Baghdad Medical City, Baghdad',
    phone:       '+964-1-416-0345',
    email:       'info@baghdadteaching.iq',
  },
  {
    name:        'Al-Yarmouk Teaching Hospital',
    city:        'Baghdad',
    governorate: 'Baghdad',
    address:     'Jinub Street, Al-Yarmouk, Al-Karkh, Baghdad',
    phone:       '+964-1-537-0000',
    email:       'info@yarmouk.iq',
  },
  {
    name:        'Al-Kindi General Teaching Hospital',
    city:        'Baghdad',
    governorate: 'Baghdad',
    address:     'Palestine Street, Rusafa, Baghdad',
    phone:       '+964-1-422-0000',
    email:       'info@alkindi.iq',
  },
];

// ── PROGRAM DIRECTORS ──────────────────────────────────────────────────────────
const PD_DATA = [
  { name: 'Dr. Hassan Al-Saadi',   email: 'pd.baghdad@mtms.com', department: 'Medical Education',  phone: '+964-770-100-0001' },
  { name: 'Dr. Fatima Al-Rubaie',  email: 'pd.yarmouk@mtms.com', department: 'Clinical Training',  phone: '+964-770-100-0002' },
  { name: 'Dr. Omar Al-Jubouri',   email: 'pd.kindi@mtms.com',   department: 'Residency Programs', phone: '+964-770-100-0003' },
];

// ── SUPERVISORS ────────────────────────────────────────────────────────────────
const SUP_DATA = [
  { name: 'Dr. Zainab Al-Hamdani',  email: 'sup.internal@mtms.com',  department: 'Internal Medicine',       specialty: 'Internal Medicine',       phone: '+964-770-200-0001' },
  { name: 'Dr. Ahmed Al-Rashidi',   email: 'sup.surgery@mtms.com',   department: 'General Surgery',         specialty: 'Surgery',                  phone: '+964-770-200-0002' },
  { name: 'Dr. Sara Al-Tamimi',     email: 'sup.pediatrics@mtms.com',department: 'Pediatrics',              specialty: 'Pediatrics',               phone: '+964-770-200-0003' },
  { name: 'Dr. Kareem Al-Dulaimi',  email: 'sup.obs@mtms.com',       department: 'Obstetrics & Gynecology', specialty: 'Obstetrics & Gynecology',  phone: '+964-770-200-0004' },
  { name: 'Dr. Nour Al-Bayati',     email: 'sup.emergency@mtms.com', department: 'Emergency Medicine',      specialty: 'Emergency Medicine',       phone: '+964-770-200-0005' },
];

// ── TRAINEES ───────────────────────────────────────────────────────────────────
const TRAINEE_DATA = [
  { name: 'Ali Mohammed Al-Saeedi',     email: 'trainee1@mtms.com',  studentId: 'STD-001', year: 1, specialty: 'Internal Medicine',       gender: 'male',   city: 'Baghdad',  phone: '+964-770-300-0001' },
  { name: 'Mariam Khalid Al-Janabi',    email: 'trainee2@mtms.com',  studentId: 'STD-002', year: 1, specialty: 'Internal Medicine',       gender: 'female', city: 'Baghdad',  phone: '+964-770-300-0002' },
  { name: 'Hussein Adel Al-Fahdawi',    email: 'trainee3@mtms.com',  studentId: 'STD-003', year: 2, specialty: 'Surgery',                 gender: 'male',   city: 'Fallujah', phone: '+964-770-300-0003' },
  { name: 'Raya Samer Al-Mousawi',      email: 'trainee4@mtms.com',  studentId: 'STD-004', year: 2, specialty: 'Surgery',                 gender: 'female', city: 'Baghdad',  phone: '+964-770-300-0004' },
  { name: 'Mohammed Talib Al-Shimmari', email: 'trainee5@mtms.com',  studentId: 'STD-005', year: 1, specialty: 'Pediatrics',             gender: 'male',   city: 'Mosul',    phone: '+964-770-300-0005' },
  { name: 'Lina Jasim Al-Hasnawi',      email: 'trainee6@mtms.com',  studentId: 'STD-006', year: 3, specialty: 'Pediatrics',             gender: 'female', city: 'Baghdad',  phone: '+964-770-300-0006' },
  { name: 'Omar Saad Al-Rubaie',        email: 'trainee7@mtms.com',  studentId: 'STD-007', year: 2, specialty: 'Obstetrics & Gynecology',gender: 'male',   city: 'Karbala',  phone: '+964-770-300-0007' },
  { name: 'Fatima Naji Al-Zubaidi',     email: 'trainee8@mtms.com',  studentId: 'STD-008', year: 1, specialty: 'Obstetrics & Gynecology',gender: 'female', city: 'Baghdad',  phone: '+964-770-300-0008' },
  { name: 'Yousif Mahdi Al-Bermani',    email: 'trainee9@mtms.com',  studentId: 'STD-009', year: 3, specialty: 'Emergency Medicine',     gender: 'male',   city: 'Basra',    phone: '+964-770-300-0009' },
  { name: 'Zainab Haider Al-Asadi',     email: 'trainee10@mtms.com', studentId: 'STD-010', year: 2, specialty: 'Emergency Medicine',     gender: 'female', city: 'Baghdad',  phone: '+964-770-300-0010' },
];

// ── HELPER: skip existing ──────────────────────────────────────────────────────
async function findOrCreate(Model, findQuery, createData) {
  const existing = await Model.findOne(findQuery);
  if (existing) return { doc: existing, created: false };
  const doc = await Model.create(createData);
  return { doc, created: true };
}

// ── MAIN SEED ──────────────────────────────────────────────────────────────────
async function seed() {
  requireLocalDemoSeed();

  await mongoose.connect(process.env.MONGO_URI);
  console.log('\n✅ Connected to MongoDB\n');

  const today = new Date();

  // Date helpers
  const monthsAgo   = n => { const d = new Date(today); d.setMonth(d.getMonth() - n); return d; };
  const monthsAhead = n => { const d = new Date(today); d.setMonth(d.getMonth() + n); return d; };

  // ── 1. HOSPITALS ─────────────────────────────────────────────────────────────
  console.log('── Creating hospitals...');
  const hospitals = [];
  for (const h of HOSPITALS_DATA) {
    const { doc, created } = await findOrCreate(Hospital, { name: h.name }, h);
    hospitals.push(doc);
    console.log(`  ${created ? '✅' : '⏭ '} ${doc.name}`);
  }

  // ── 2. SPECIALTIES ────────────────────────────────────────────────────────────
  console.log('\n── Fetching/creating specialties...');
  const specialtyNames = ['Internal Medicine', 'Surgery', 'Pediatrics', 'Obstetrics & Gynecology', 'Emergency Medicine'];
  const specialtyMap = {};
  for (const name of specialtyNames) {
    const { doc, created } = await findOrCreate(Specialty, { name }, { name, isActive: true });
    specialtyMap[name] = doc;
    console.log(`  ${created ? '✅' : '⏭ '} ${name}`);
  }

  // ── 3. PROGRAM DIRECTORS ──────────────────────────────────────────────────────
  console.log('\n── Creating program directors...');
  const programDirectors = [];
  for (let i = 0; i < PD_DATA.length; i++) {
    const pd   = PD_DATA[i];
    const hosp = hospitals[i];
    const { doc, created } = await findOrCreate(
      User,
      { email: pd.email },
      {
        name:       pd.name,
        email:      pd.email,
        // Plain password is hashed by the User pre-save hook.
        password:   DEMO_SEED_PASSWORD,
        role:       'program_director',
        department: pd.department,
        phone:      pd.phone,
        hospitalId: hosp._id,
        hospital:   hosp._id,
        isActive:   true,
      }
    );
    programDirectors.push(doc);
    console.log(`  ${created ? '✅' : '⏭ '} ${doc.name} → ${hosp.name}`);
  }

  // ── 4. SUPERVISORS ────────────────────────────────────────────────────────────
  console.log('\n── Creating supervisors...');
  const supervisors = [];
  for (const sup of SUP_DATA) {
    const hosp    = hospitals[0];
    const specDoc = specialtyMap[sup.specialty];
    const { doc, created } = await findOrCreate(
      User,
      { email: sup.email },
      {
        name:        sup.name,
        email:       sup.email,
        password:    DEMO_SEED_PASSWORD,
        role:        'supervisor',
        department:  sup.department,
        phone:       sup.phone,
        specialty:   sup.specialty,
        specialtyId: specDoc?._id || null,
        hospitalId:  hosp._id,
        hospital:    hosp._id,
        isActive:    true,
      }
    );
    supervisors.push({ doc, specialty: sup.specialty });
    console.log(`  ${created ? '✅' : '⏭ '} ${doc.name} → ${sup.specialty}`);
  }

  // ── 5. TRAINEES ───────────────────────────────────────────────────────────────
  console.log('\n── Creating trainees...');
  const trainees = [];
  for (const t of TRAINEE_DATA) {
    const specDoc  = specialtyMap[t.specialty];
    const supEntry = supervisors.find(s => s.specialty === t.specialty);
    const supDoc   = supEntry?.doc;
    const hosp     = hospitals[0];

    const { doc, created } = await findOrCreate(
      User,
      { email: t.email },
      {
        name:         t.name,
        email:        t.email,
        password:     DEMO_SEED_PASSWORD,
        role:         'trainee',
        studentId:    t.studentId,
        year:         t.year,
        gender:       t.gender,
        city:         t.city,
        phone:        t.phone,
        specialty:    t.specialty,
        specialtyId:  specDoc?._id || null,
        hospitalId:   hosp._id,
        hospital:     hosp._id,
        supervisorId: supDoc?._id || null,
        supervisor:   supDoc?._id || null,
        isActive:     true,
      }
    );
    trainees.push({ doc, specialty: t.specialty });
    console.log(`  ${created ? '✅' : '⏭ '} ${t.studentId} ${doc.name} → ${t.specialty}`);
  }

  // ── 6. UPDATE HOSPITALS with PD + supervisors ─────────────────────────────────
  console.log('\n── Updating hospitals with program directors and supervisors...');
  const allSupIds = supervisors.map(s => s.doc._id);
  for (let i = 0; i < hospitals.length; i++) {
    await Hospital.findByIdAndUpdate(hospitals[i]._id, {
      programDirector: programDirectors[i]._id,
      supervisors:     allSupIds,
    });
    console.log(`  ✅ ${hospitals[i].name} → PD: ${programDirectors[i].name}`);
  }

  // ── 7. DISTRIBUTIONS / ROTATIONS ─────────────────────────────────────────────
  // Distribution status enum: 'active' | 'completed' | 'cancelled'  (no 'upcoming')
  console.log('\n── Creating rotations (3 per trainee)...');
  let placementCount = 0;
  for (const { doc: supDoc, specialty } of supervisors) {
    const specDoc = specialtyMap[specialty];
    if (!specDoc) continue;
    const exists = await Distribution.findOne({ supervisorId: supDoc._id });
    if (!exists) {
      await Distribution.create({
        supervisorId: supDoc._id,
        doctor:       supDoc._id,
        specialtyId:  specDoc._id,
        specialty,
        hospitalId:   supDoc.hospitalId,
        hospital:     supDoc.hospitalId,
        status:       'active',
        createdBy:    supDoc._id,
      });
      placementCount++;
    }
  }
  console.log(`  ✅ ${placementCount} supervisor distributions created`);

  let rotationCount = 0;

  for (const { doc: trainee, specialty } of trainees) {
    const specDoc  = specialtyMap[specialty];
    const supEntry = supervisors.find(s => s.specialty === specialty);
    const supDoc   = supEntry?.doc;

    if (!specDoc || !supDoc) {
      console.log(`  ⚠️  Skipping rotations for ${trainee.name} — missing specialty or supervisor`);
      continue;
    }

    const rotations = [
      {
        hospitalId:    hospitals[0]._id,
        startDate:     monthsAgo(4),
        endDate:       monthsAgo(2),
        durationWeeks: 8,
        status:        'completed',
      },
      {
        hospitalId:    hospitals[1]._id,
        startDate:     monthsAgo(2),
        endDate:       monthsAhead(1),
        durationWeeks: 12,
        status:        'current',
      },
      {
        hospitalId:    hospitals[2]._id,
        startDate:     monthsAhead(1),
        endDate:       monthsAhead(4),
        durationWeeks: 12,
        status:        'upcoming',
      },
    ];

    for (const rot of rotations) {
      const exists = await Rotation.findOne({
        traineeId:  trainee._id,
        hospitalId: rot.hospitalId,
        startDate:  rot.startDate,
        endDate:    rot.endDate,
      });
      if (!exists) {
        await Rotation.create({
          traineeId:    trainee._id,
          student:      trainee._id,
          supervisorId: supDoc._id,
          doctor:       supDoc._id,
          specialtyId:  specDoc._id,
          hospitalId:   rot.hospitalId,
          hospital:     rot.hospitalId,
          startDate:    rot.startDate,
          endDate:      rot.endDate,
          status:       rot.status,
        });
        rotationCount++;
      }
    }
  }
  console.log(`  ✅ ${rotationCount} rotations created`);

  // ── 8. REPORTS ────────────────────────────────────────────────────────────────
  // Report schema: student (required), hospital, title (required), type (required), date (required), status, grade, reviewNote
  console.log('\n── Creating sample reports...');
  let reportCount = 0;
  const GRADES = ['A', 'A-', 'B+', 'B', 'B+', 'A-', 'B', 'A', 'B+', 'A-'];

  for (let i = 0; i < trainees.length; i++) {
    const { doc: trainee } = trainees[i];
    const hosp  = hospitals[0];
    const grade = GRADES[i];

    const reportsToCreate = [
      {
        title:  'Weekly Report — Week 1',
        type:   'weekly',
        status: 'graded',
        grade,
        date:   monthsAgo(3),
        reviewNote: 'Good progress in clinical skills.',
      },
      {
        title:  'Weekly Report — Week 2',
        type:   'weekly',
        status: 'pending',
        date:   monthsAgo(1),
      },
      {
        title:  'Monthly Report — Month 1',
        type:   'monthly',
        status: 'graded',
        grade,
        date:   monthsAgo(3),
        reviewNote: 'Satisfactory performance.',
      },
      {
        title:  'Final Report — Rotation 1',
        type:   'final',
        status: 'pending',
        date:   monthsAgo(2),
      },
    ];

    for (const r of reportsToCreate) {
      const exists = await Report.findOne({ student: trainee._id, title: r.title });
      if (!exists) {
        await Report.create({
          student:  trainee._id,
          hospital: hosp._id,
          ...r,
        });
        reportCount++;
      }
    }
  }
  console.log(`  ✅ ${reportCount} reports created`);

  // ── 9. EVALUATIONS ────────────────────────────────────────────────────────────
  // Evaluation schema: student (required), doctor, evaluationType, grade, notes, scores, totalScore, isFinalized, sentToTraineeAt
  console.log('\n── Creating sample evaluations...');
  let evalCount = 0;
  const EVAL_TYPES   = ['Mini-CEX', 'DOPS', 'CbD'];
  const EVAL_RATINGS = ['meets', 'above', 'meets'];
  const EVAL_SCORES  = [75, 88, 70];

  for (const { doc: trainee, specialty } of trainees) {
    const supEntry = supervisors.find(s => s.specialty === specialty);
    const supDoc   = supEntry?.doc;
    if (!supDoc) continue;

    for (let i = 0; i < 3; i++) {
      const exists = await Evaluation.findOne({
        student:        trainee._id,
        evaluationType: EVAL_TYPES[i],
      });
      if (!exists) {
        await Evaluation.create({
          // required field
          student:        trainee._id,
          // legacy alias
          doctor:         supDoc._id,
          // V2 aliases
          traineeId:      trainee._id,
          supervisorId:   supDoc._id,
          // evaluation data
          evaluationType: EVAL_TYPES[i],
          grade:          EVAL_RATINGS[i],
          scores:         { overall: EVAL_RATINGS[i] },
          totalScore:     EVAL_SCORES[i],
          notes:          `${EVAL_TYPES[i]} evaluation for ${trainee.name} — ${EVAL_RATINGS[i] === 'above' ? 'Excellent performance' : 'Satisfactory performance'}`,
          isFinalized:    i < 2,
          sentToTraineeAt: i < 2 ? monthsAgo(2) : null,
          date:           monthsAgo(2 - i),
          status:         i < 2 ? 'completed' : 'pending',
        });
        evalCount++;
      }
    }
  }
  console.log(`  ✅ ${evalCount} evaluations created`);

  // ── 10. FINAL SUMMARY ─────────────────────────────────────────────────────────
  const counts = {
    hospitals:     await Hospital.countDocuments(),
    trainees:      await User.countDocuments({ role: 'trainee' }),
    supervisors:   await User.countDocuments({ role: 'supervisor' }),
    programDirs:   await User.countDocuments({ role: 'program_director' }),
    distributions: await Distribution.countDocuments(),
    rotations:     await Rotation.countDocuments(),
    reports:       await Report.countDocuments(),
    evaluations:   await Evaluation.countDocuments(),
  };

  console.log(`
════════════════════════════════════════════════════════════════
MTMS V2 — Demo Data Seed Complete ✅
════════════════════════════════════════════════════════════════

HOSPITALS (${counts.hospitals}):
  ✅ Baghdad Teaching Hospital     — Bab Al-Moatham, Baghdad
  ✅ Al-Yarmouk Teaching Hospital  — Al-Karkh, Baghdad
  ✅ Al-Kindi Teaching Hospital    — Rusafa, Baghdad

PROGRAM DIRECTORS: ${counts.programDirs}
SUPERVISORS:       ${counts.supervisors}
TRAINEES:          ${counts.trainees}

DATABASE TOTALS:
  Hospitals:     ${counts.hospitals}
  Trainees:      ${counts.trainees}
  Supervisors:   ${counts.supervisors}
  Program Dirs:  ${counts.programDirs}
  Distributions: ${counts.distributions}
  Rotations:     ${counts.rotations}
  Reports:       ${counts.reports}
  Evaluations:   ${counts.evaluations}

Demo user passwords were read from MTMS_DEMO_SEED_PASSWORD and were not printed.
════════════════════════════════════════════════════════════════
  `);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('\n❌ Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
