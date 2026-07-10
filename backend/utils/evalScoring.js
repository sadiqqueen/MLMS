// backend/utils/evalScoring.js
// Shared evaluation scoring / WPBA helpers used by the DIO and Program Director
// evaluation-create flows. Single source of truth so the WPBA form list and the
// once-per-month cap can never drift between routes.
const Evaluation = require('../models/Evaluation');

function averageScore(scores) {
  if (!scores || typeof scores !== 'object') return null;
  const values = Object.values(scores).map(Number).filter(n => Number.isFinite(n));
  return values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null;
}

// Structured WPBA forms shared with the supervisor flow (evalForms.js). Free-
// form quick evaluations (from the trainee-detail screen) are NOT in this set
// and are therefore exempt from the once-per-month cap below.
const WPBA_FORMS = ['Mini-CEX', 'CBD', 'DOPS', 'Academic Supervisor Report', 'FITER'];
function isWpbaForm(type) {
  return WPBA_FORMS.includes(type) || String(type || '').startsWith('MSF-360');
}

// A given evaluator may file each WPBA form type at most once per subject per
// calendar month — matched per-evaluator so each evaluator's caps are
// independent (mirrors supervisor.js).
async function wpbaAlreadyThisMonth(evaluatorId, subjectId, evaluationType) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Evaluation.countDocuments({
    $and: [
      { $or: [{ evaluateeId: subjectId }, { traineeId: subjectId }, { student: subjectId }] },
      { $or: [{ evaluatorId }, { doctor: evaluatorId }] },
      { evaluationType },
      { createdAt: { $gte: monthStart, $lt: monthEnd } },
    ],
  });
}

module.exports = { averageScore, WPBA_FORMS, isWpbaForm, wpbaAlreadyThisMonth };
