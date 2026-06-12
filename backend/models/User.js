// backend/models/User.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    // V2: updated role enum — 7 app roles + ASG.1/ASG.2 (consultant memo)
    role: {
      type: String,
      enum: ['super_admin', 'secretary', 'dio', 'supervisor', 'trainee', 'president', 'program_director', 'asg1', 'asg2'],
      required: true,
      index: true
    },

    // Existing fields — keep all
    initials:      { type: String, default: '' },
    phone:         { type: String, default: '' },
    gender:        { type: String, enum: ['male', 'female', ''], default: '' },
    city:          { type: String, default: '' },
    photoUrl:      { type: String, default: '' },
    locked:        { type: Boolean, default: false },

    // trainee-only (was student-only)
    year:          { type: Number, default: null },
    studentId:     { type: String, default: '' },
    enrolledSince: { type: Date },

    // supervisor / program_director (was doctor / professor)
    department:    { type: String, default: '' },
    specialty:     { type: String, default: '' },
    hospital:      { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null },
    doctor:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    supervisor:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    supervisorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // V2 NEW FIELDS
    hospitalId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    specialtyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Specialty', default: null },
    universityId:  { type: mongoose.Schema.Types.ObjectId, ref: 'University' },
    isActive:      { type: Boolean, default: true },
    deletedAt:     { type: Date, default: null },
    lastLogin:     { type: Date },
    loginAttempts: { type: Number, default: 0 },
    lockUntil:     { type: Date, default: null }
  },
  { timestamps: true }
);

// Hash password on save
userSchema.pre('save', async function (next) {
  if (this.name && !this.initials) {
    this.initials = this.name
      .trim()
      .split(/\s+/)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Helper: check if account is currently locked
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > new Date();
};

// Helper: increment login attempts and lock if >= 5
userSchema.methods.incrementLoginAttempts = async function () {
  this.loginAttempts = (this.loginAttempts || 0) + 1;
  if (this.loginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }
  await this.save();
};

// Helper: reset login attempts on successful login
userSchema.methods.resetLoginAttempts = async function () {
  this.loginAttempts = 0;
  this.lockUntil = null;
  this.lastLogin = new Date();
  await this.save();
};

module.exports = mongoose.model('User', userSchema);
