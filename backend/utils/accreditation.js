// backend/utils/accreditation.js
// Computed accreditation expiry + traffic-light status. Expiry is NEVER stored
// for programs — it is derived from the grant date and accreditation type
// (partly = 2 years, fully = 6 years). Training centers may carry a stored
// accreditationExpiry directly. Small and dependency-free; handles missing
// dates gracefully.

function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function addYears(date, years) {
  const d = new Date(date.getTime());
  d.setFullYear(d.getFullYear() + years);
  return d;
}

// Resolve the accreditation expiry for a program or a training center.
// Programs: grantDate + (partly ? 2 : 6) years.
// Centers (no accreditationType): the stored accreditationExpiry, or null.
function accreditationExpiry({ accreditationType, accreditationGrantDate, accreditationExpiry } = {}) {
  if (accreditationType) {
    const grant = toDate(accreditationGrantDate);
    if (!grant) return null;
    return addYears(grant, accreditationType === 'partly' ? 2 : 6);
  }
  return toDate(accreditationExpiry);
}

// Traffic-light status: 'black' (withdrawn) overrides everything; otherwise
// derived from the expiry — null when unknown, 'red' when expired, 'yellow'
// when under a year remains, 'green' otherwise.
function accreditationStatus(doc = {}) {
  if (doc && doc.accreditationWithdrawn) return 'black';
  const expiry = accreditationExpiry(doc || {});
  if (!expiry) return null;
  const now = new Date();
  if (expiry.getTime() <= now.getTime()) return 'red';
  if (expiry.getTime() < addYears(now, 1).getTime()) return 'yellow';
  return 'green';
}

module.exports = { accreditationExpiry, accreditationStatus };
