// backend/utils/trainingYear.js
// Computed training year for an advanced trainee — never stored. Year 1 starts
// on the enrolment date and each anniversary advances the year, clamped to 1..6.
// Years are counted on calendar anniversaries (not a 365.25-day approximation).
// Dependency-free; returns null when there is no enrolment/creation date.

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Whole years elapsed between `from` and now, counted on anniversaries: start
// from the calendar-year difference, then step back one when this year's
// anniversary has not arrived yet.
function yearsSince(from) {
  const start = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  const anniversary = new Date(now.getFullYear(), start.getMonth(), start.getDate());
  if (now < anniversary) years -= 1;
  return years;
}

function trainingYear(user) {
  if (!user) return null;
  const date = user.enrolledSince || user.createdAt;
  if (!date) return null;
  const elapsed = yearsSince(date);
  if (elapsed === null) return null;
  return clamp(1 + Math.floor(elapsed), 1, 6);
}

module.exports = { trainingYear };
