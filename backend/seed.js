// Run with: node seed.js  (from the server/ folder)
// Wipes all collections and re-creates fresh sample data for every feature.

require('dotenv').config();
const mongoose     = require('mongoose');
const bcrypt       = require('bcryptjs');
const User         = require('./models/User');
const Hospital     = require('./models/Hospital');
const University   = require('./models/University');
const Specialty    = require('./models/Specialty');
const Distribution = require('./models/Distribution');
const Evaluation   = require('./models/Evaluation');
const Rotation     = require('./models/Rotation');
const Report       = require('./models/Report');
const Notification = require('./models/Notification');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // ── CLEAR ALL ──────────────────────────────────────────────────────────────
  await Promise.all([
    User.deleteMany({}),
    Hospital.deleteMany({}),
    University.deleteMany({}),
    Specialty.deleteMany({}),
    Distribution.deleteMany({}),
    Evaluation.deleteMany({}),
    Rotation.deleteMany({}),
    Report.deleteMany({}),
    Notification.deleteMany({})
  ]);
  console.log('Cleared all collections');

  const hash = pw => bcrypt.hash(pw, 12);

  // ── HOSPITALS ──────────────────────────────────────────────────────────────
  const [h1, h2, h3] = await Hospital.insertMany([
    {
      name:        'Ibn Sina Hospital',
      city:        'Baghdad',
      address:     'Medical City, Baghdad',
      specialties: ['Surgery', 'Neurology', 'Orthopedics']
    },
    {
      name:        'Al Kindi Hospital',
      city:        'Baghdad',
      address:     'Al-Kindi Street, Baghdad',
      specialties: ['Pediatrics', 'Cardiology', 'Dermatology']
    },
    {
      name:        'Al Yarmouk Hospital',
      city:        'Baghdad',
      address:     'Al Yarmouk District, Baghdad',
      specialties: ['Internal Medicine', 'Cardiology', 'Endocrinology']
    }
  ]);

  const specialtyDocs = await Specialty.insertMany([
    { name: 'Surgery', isActive: true },
    { name: 'Internal Medicine', isActive: true },
    { name: 'Pediatrics', isActive: true },
    { name: 'Cardiology', isActive: true },
    { name: 'Orthopedics', isActive: true },
  ]);
  const specialtyByName = Object.fromEntries(specialtyDocs.map(s => [s.name, s]));

  // ── USERS ──────────────────────────────────────────────────────────────────
  const [, , , d1, d2, d3, d4, d5, s1, s2] = await User.insertMany([
    {
      name: 'Sadeq Queen', email: 'superadmin@medlearn.com',
      password: await hash('123456'), role: 'super_admin',
      initials: 'SQ', gender: 'male', city: 'Baghdad'
    },
    {
      name: 'Ahmed Queen', email: 'admin@medlearn.com',
      password: await hash('123456'), role: 'super_admin',
      initials: 'AQ', gender: 'male', city: 'Baghdad'
    },
    {
      name: 'Prof. Jawad Al-Sharafi', email: 'professor@medlearn.com',
      password: await hash('123456'), role: 'dio',
      initials: 'JA', department: 'Medicine', gender: 'male', city: 'Baghdad'
    },
    {
      name: 'Dr. Fatima Al-Zahra', email: 'doctor1@medlearn.com',
      password: await hash('123456'), role: 'supervisor',
      initials: 'FA', specialty: 'Surgery', specialtyId: specialtyByName.Surgery._id,
      gender: 'female', city: 'Baghdad', hospital: h1._id, hospitalId: h1._id
    },
    {
      name: 'Dr. Omar Khalid', email: 'doctor2@medlearn.com',
      password: await hash('123456'), role: 'supervisor',
      initials: 'OK', specialty: 'Internal Medicine', specialtyId: specialtyByName['Internal Medicine']._id,
      gender: 'male', city: 'Baghdad', hospital: h3._id, hospitalId: h3._id
    },
    {
      name: 'Dr. Ali Hassan', email: 'doctor3@medlearn.com',
      password: await hash('123456'), role: 'supervisor',
      initials: 'AH', specialty: 'Pediatrics', specialtyId: specialtyByName.Pediatrics._id,
      gender: 'male', city: 'Baghdad', hospital: h2._id, hospitalId: h2._id
    },
    {
      name: 'Dr. Sara Mohammed', email: 'doctor4@medlearn.com',
      password: await hash('123456'), role: 'supervisor',
      initials: 'SM', specialty: 'Cardiology', specialtyId: specialtyByName.Cardiology._id,
      gender: 'female', city: 'Basra', hospital: h2._id, hospitalId: h2._id
    },
    {
      name: 'Dr. Kareem Abbas', email: 'doctor5@medlearn.com',
      password: await hash('123456'), role: 'supervisor',
      initials: 'KA', specialty: 'Orthopedics', specialtyId: specialtyByName.Orthopedics._id,
      gender: 'male', city: 'Baghdad', hospital: h1._id, hospitalId: h1._id
    },
    {
      name: 'Ahmed Hassan', email: 'student@medlearn.com',
      password: await hash('123456'), role: 'trainee',
      initials: 'AH', year: 2, studentId: 'MED-2024-001',
      enrolledSince: new Date('2024-09-01'),
      gender: 'male', city: 'Baghdad', phone: '+964 770 123 4567',
      hospital: h1._id, hospitalId: h1._id, specialty: 'Surgery',
      specialtyId: specialtyByName.Surgery._id, supervisorId: d1._id, supervisor: d1._id
    },
    {
      name: 'Lina Mustafa', email: 'student2@medlearn.com',
      password: await hash('123456'), role: 'trainee',
      initials: 'LM', year: 3, studentId: 'MED-2024-002',
      enrolledSince: new Date('2023-09-01'),
      gender: 'female', city: 'Basra', phone: '+964 770 987 6543',
      hospital: h3._id, hospitalId: h3._id, specialty: 'Internal Medicine',
      specialtyId: specialtyByName['Internal Medicine']._id, supervisorId: d2._id, supervisor: d2._id
    }
  ]);

  // Link assigned doctors to hospitals
  await Hospital.findByIdAndUpdate(h1._id, { assignedDoctor: d1._id });
  await Hospital.findByIdAndUpdate(h2._id, { assignedDoctor: d3._id });
  await Hospital.findByIdAndUpdate(h3._id, { assignedDoctor: d2._id });

  // ── SUPERVISOR DISTRIBUTIONS + TRAINEE ROTATIONS ──────────────────────────
  await Distribution.insertMany([
    {
      supervisorId: d1._id, specialtyId: specialtyByName.Surgery._id, hospitalId: h1._id,
      doctor: d1._id, hospital: h1._id, specialty: 'Surgery', status: 'active'
    },
    {
      supervisorId: d2._id, specialtyId: specialtyByName['Internal Medicine']._id, hospitalId: h3._id,
      doctor: d2._id, hospital: h3._id, specialty: 'Internal Medicine', status: 'active'
    },
    {
      supervisorId: d3._id, specialtyId: specialtyByName.Pediatrics._id, hospitalId: h2._id,
      doctor: d3._id, hospital: h2._id, specialty: 'Pediatrics', status: 'active'
    },
    {
      supervisorId: d4._id, specialtyId: specialtyByName.Cardiology._id, hospitalId: h2._id,
      doctor: d4._id, hospital: h2._id, specialty: 'Cardiology', status: 'active'
    },
    {
      supervisorId: d5._id, specialtyId: specialtyByName.Orthopedics._id, hospitalId: h1._id,
      doctor: d5._id, hospital: h1._id, specialty: 'Orthopedics', status: 'active'
    }
  ]);

  await Rotation.insertMany([
    {
      traineeId: s1._id, student: s1._id, supervisorId: d1._id, doctor: d1._id,
      specialtyId: specialtyByName.Surgery._id, hospitalId: h1._id, hospital: h1._id,
      startDate: new Date('2025-01-01'), endDate: new Date('2025-06-30'), status: 'completed'
    },
    {
      traineeId: s1._id, student: s1._id, supervisorId: d2._id, doctor: d2._id,
      specialtyId: specialtyByName['Internal Medicine']._id, hospitalId: h3._id, hospital: h3._id,
      startDate: new Date('2025-07-01'), endDate: new Date('2025-12-31'), status: 'completed'
    },
    {
      traineeId: s2._id, student: s2._id, supervisorId: d3._id, doctor: d3._id,
      specialtyId: specialtyByName.Pediatrics._id, hospitalId: h2._id, hospital: h2._id,
      startDate: new Date('2025-02-01'), endDate: new Date('2025-07-31'), status: 'completed'
    },
    {
      traineeId: s2._id, student: s2._id, supervisorId: d4._id, doctor: d4._id,
      specialtyId: specialtyByName.Cardiology._id, hospitalId: h2._id, hospital: h2._id,
      startDate: new Date('2025-08-01'), endDate: new Date('2026-01-31'), status: 'completed'
    }
  ]);

  // ── EVALUATIONS ────────────────────────────────────────────────────────────
  await Evaluation.insertMany([
    {
      student: s1._id, doctor: d1._id, hospital: h1._id,
      specialty: 'Surgery', date: new Date('2025-03-10'),
      grade: 'A', status: 'completed'
    },
    {
      student: s1._id, doctor: d2._id, hospital: h3._id,
      specialty: 'Internal Medicine', date: new Date('2025-03-20'),
      grade: 'B+', status: 'completed'
    },
    {
      student: s1._id, doctor: d3._id, hospital: h2._id,
      specialty: 'Pediatrics', date: new Date('2025-04-05'),
      grade: '', status: 'pending'
    },
    {
      student: s2._id, doctor: d1._id, hospital: h1._id,
      specialty: 'Surgery', date: new Date('2025-03-15'),
      grade: 'B', status: 'completed'
    },
    {
      student: s2._id, doctor: d4._id, hospital: h2._id,
      specialty: 'Cardiology', date: new Date('2025-04-01'),
      grade: '', status: 'pending'
    },
    {
      student: s1._id, doctor: d5._id, hospital: h1._id,
      specialty: 'Orthopedics', date: new Date('2025-04-10'),
      grade: '', status: 'pending'
    },
    {
      student: s2._id, doctor: d2._id, hospital: h3._id,
      specialty: 'Internal Medicine', date: new Date('2025-04-12'),
      grade: 'A-', status: 'completed'
    },
    {
      student: s2._id, doctor: d3._id, hospital: h2._id,
      specialty: 'Pediatrics', date: new Date('2025-04-15'),
      grade: '', status: 'pending'
    }
  ]);

  console.log('\n✅ Seed complete!\n');
  console.log('Login credentials (all passwords: 123456):');
  console.log('  superadmin@medlearn.com  — Sadeq Queen (Super Admin)');
  console.log('  admin@medlearn.com       — Ahmed Queen (Admin)');
  console.log('  professor@medlearn.com   — Prof. Jawad Al-Sharafi');
  console.log('  doctor1@medlearn.com     — Dr. Fatima (Surgery)');
  console.log('  doctor2@medlearn.com     — Dr. Omar (Internal Medicine)');
  console.log('  doctor3@medlearn.com     — Dr. Ali (Pediatrics)');
  console.log('  doctor4@medlearn.com     — Dr. Sara (Cardiology)');
  console.log('  doctor5@medlearn.com     — Dr. Kareem (Orthopedics)');
  console.log('  student@medlearn.com     — Ahmed Hassan');
  console.log('  student2@medlearn.com    — Lina Mustafa\n');

  await mongoose.disconnect();
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
