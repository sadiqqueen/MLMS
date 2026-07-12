// backend/utils/feedbackValidateResponse.js
// Server-side validation of an attendee submission against a published form
// version. The mobile client is NEVER trusted: unknown fields are stripped,
// hidden (showIf) fields are ignored, required fields are enforced, and every
// value is type-coerced and range/length-checked. Returns cleaned answers ready
// to store plus a per-field snapshot for durable rendering.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CAPS = {
  short_text: 500,
  long_text: 5000,
  email: 254,
  generic: 1000,
  multiChoiceMax: 50,
};

// Normalize a raw submitted value for a field into a comparable/storable form,
// without raising errors (used first so showIf can be evaluated consistently).
function normalize(field, raw) {
  switch (field.type) {
    case 'yes_no': {
      if (raw === true || raw === 1 || raw === '1') return 'yes';
      if (raw === false || raw === 0 || raw === '0') return 'no';
      const s = String(raw ?? '').trim().toLowerCase();
      if (s === 'yes' || s === 'no') return s;
      return '';
    }
    case 'rating': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case 'multi_choice': {
      const arr = Array.isArray(raw) ? raw : (raw == null || raw === '' ? [] : [raw]);
      return arr.map(v => String(v));
    }
    case 'single_choice':
    case 'short_text':
    case 'long_text':
    case 'email':
    case 'date':
      return raw == null ? '' : String(raw);
    default:
      return raw;
  }
}

function isEmpty(field, val) {
  if (field.type === 'multi_choice') return !Array.isArray(val) || val.length === 0;
  if (field.type === 'rating') return val == null;
  return val == null || String(val).trim() === '';
}

// Evaluate a field's showIf against the normalized answer map.
function isVisible(field, norm) {
  const cond = field.showIf;
  if (!cond || !cond.fieldId) return true;
  const other = norm[cond.fieldId];
  switch (cond.op) {
    case 'equals':     return String(other) === String(cond.value);
    case 'not_equals': return String(other) !== String(cond.value);
    case 'in':         return Array.isArray(cond.value) && cond.value.map(String).includes(String(other));
    case 'truthy':     return other != null && other !== '' && other !== 'no' && other !== '0' && other !== false;
    default:           return true;
  }
}

function optionValues(field) {
  const set = new Set();
  (field.options || []).forEach(o => {
    if (o.value != null && o.value !== '') set.add(String(o.value));
    if (o.id != null && o.id !== '') set.add(String(o.id));
  });
  return set;
}

/**
 * @param {Array} fields  the published version's fields
 * @param {Object} submitted  raw { fieldId: value } from the client
 * @returns {{ ok, errors, answers, snapshot, contact }}
 */
function validateResponse(fields, submitted) {
  submitted = (submitted && typeof submitted === 'object') ? submitted : {};
  const inputFields = (fields || []).filter(f => f && f.type !== 'section_header' && f.id);

  // Pass 1 — normalize every input field's raw value.
  const norm = {};
  for (const f of inputFields) norm[f.id] = normalize(f, submitted[f.id]);

  const errors = {};
  const answers = {};
  const snapshot = {};
  const contact = { email: '', name: '' };

  // Pass 2 — validate visible fields, coerce, and collect clean answers.
  for (const f of inputFields) {
    snapshot[f.id] = { label: f.label || '', type: f.type, section: f.section || '' };

    if (!isVisible(f, norm)) continue;           // hidden → never required, never stored
    const val = norm[f.id];

    if (isEmpty(f, val)) {
      if (f.required) errors[f.id] = 'This field is required';
      continue;                                   // nothing to store for empty optional fields
    }

    switch (f.type) {
      case 'short_text':
      case 'long_text': {
        const s = String(val).slice(0, CAPS[f.type]);
        answers[f.id] = s;
        break;
      }
      case 'email': {
        const s = String(val).trim().slice(0, CAPS.email);
        if (!EMAIL_RE.test(s)) { errors[f.id] = 'Enter a valid email address'; break; }
        answers[f.id] = s;
        if (!contact.email) contact.email = s;
        break;
      }
      case 'date': {
        const s = String(val).trim().slice(0, CAPS.generic);
        if (Number.isNaN(Date.parse(s))) { errors[f.id] = 'Enter a valid date'; break; }
        answers[f.id] = s;
        break;
      }
      case 'yes_no': {
        if (val !== 'yes' && val !== 'no') { errors[f.id] = 'Choose Yes or No'; break; }
        answers[f.id] = val;
        break;
      }
      case 'rating': {
        const min = f.rating?.min ?? 1;
        const max = f.rating?.max ?? 5;
        if (!Number.isInteger(val) || val < min || val > max) { errors[f.id] = 'Invalid rating'; break; }
        answers[f.id] = val;
        break;
      }
      case 'single_choice': {
        const allowed = optionValues(f);
        const s = String(val);
        if (allowed.size && !allowed.has(s)) { errors[f.id] = 'Invalid selection'; break; }
        answers[f.id] = s;
        break;
      }
      case 'multi_choice': {
        const allowed = optionValues(f);
        let arr = Array.from(new Set(val.map(String))).slice(0, CAPS.multiChoiceMax);
        if (allowed.size) arr = arr.filter(v => allowed.has(v));
        if (arr.length === 0) { if (f.required) errors[f.id] = 'Choose at least one option'; break; }
        answers[f.id] = arr;
        break;
      }
      default:
        break;
    }
  }

  return { ok: Object.keys(errors).length === 0, errors, answers, snapshot, contact };
}

module.exports = { validateResponse };
