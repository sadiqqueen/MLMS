const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },

    role: {
      type:     String,
      enum:     ['super_admin', 'admin', 'professor', 'doctor', 'student', 'director'],
      required: true
    },

    initials:      { type: String },
    phone:         { type: String, default: '' },
    gender:        { type: String, enum: ['male', 'female', ''], default: '' },
    city:          { type: String, default: '' },
    photoUrl:      { type: String, default: '' },
    locked:        { type: Boolean, default: false },

    // student-only
    year:          { type: Number },
    studentId:     { type: String },
    enrolledSince: { type: Date },

    // doctor / professor
    department:    { type: String, default: '' },
    specialty:     { type: String, default: '' },
    hospital:      { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' },
    doctor:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (this.name && !this.initials) {
    const parts = this.name.trim().split(' ');
    this.initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
