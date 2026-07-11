// components/evaluations/EvalModal.jsx
//
// Shared workplace-based-assessment (WPBA) evaluation modal + structured form,
// extracted from SupervisorEvaluations so both the supervisor flow and the new
// DIO evaluation flow reuse identical UI and form logic.
//
// The modal is transport-agnostic: the parent injects `submitEval(payload,ctx)`
// (returns the created evaluation, throws Error on failure) and optionally
// `finalize(id)` (returns the finalized evaluation). When `finalize` is omitted
// the Finalize button is hidden — this is how DIO evaluations, which are
// finalized on create, drop the pending→finalize step with zero special-casing.
import { useState, useEffect } from 'react';
import { IconCheck, IconClock } from '../icons';
import { EVAL_FORMS, FORM_TYPES, getForm, SCORE_SCALE } from '../../data/evalForms';
import { printEvaluation } from '../../utils/printEvaluation';

// One of each form type per subject per month.
export const MONTHLY_CAP = FORM_TYPES.length;
const MONTH_LABEL = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const LABEL_STYLE = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
};

const gridCell = {
  border: '1px solid var(--border)', padding: '7px 8px', textAlign: 'center', verticalAlign: 'middle',
};

// ── Shared helpers (exported for the pages' counts/filters) ────────────────
export function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr), now = new Date();
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function safeArr(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

// The person being evaluated — supports supervisor evals (evaluateeId) as well
// as trainee evals (traineeId / student).
export function evalSubjectId(ev) {
  return (ev?.evaluateeId?._id || ev?.traineeId?._id || ev?.student?._id
    || ev?.evaluateeId || ev?.traineeId || ev?.student)?.toString();
}

export function evalType(ev) {
  return ev?.evaluationType || ev?.type || '';
}

// Collapses a multi-part form type ('MSF-360 · Form A') to its base type
// ('MSF-360') so a subject's monthly form-completion count matches the modal's
// checklist (one MSF-360 counts once, not five). Used by both the modal and the
// list pages so their "X/N forms this month" can never disagree.
export function baseEvalType(ev) {
  return String(evalType(ev) || '').split(' · ')[0];
}

export function Avatar({ user, size = 32 }) {
  if (user?.photoUrl)
    return (
      <img
        src={user.photoUrl} alt=""
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: 'var(--info-bg)',
      color: 'var(--link)', fontWeight: 700, fontSize: size * 0.38,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {user?.initials || user?.name?.[0] || '?'}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Structured WPBA form (Mini-CEX / CbD / DOPS / MSF-360 / …)
   ───────────────────────────────────────────────────────────── */
function StructuredForm({ form, trainee, assessorName, onCancel, onSubmit, submitting, error, t }) {
  const [header,     setHeader]     = useState({});
  const [domains,    setDomains]    = useState({});
  const [times,      setTimes]      = useState({});
  const [feedback,   setFeedback]   = useState({});
  const [overall,    setOverall]    = useState('');
  const [supervision,setSupervision]= useState('');
  const [localErr,   setLocalErr]   = useState('');
  const [partIdx,    setPartIdx]    = useState(0);

  const def   = form.parts ? { ...form, ...form.parts[partIdx] } : form;
  const scale = def.scale || SCORE_SCALE;

  useEffect(() => {
    setHeader({}); setDomains({}); setTimes({}); setFeedback({}); setOverall(''); setSupervision('');
  }, [partIdx]);

  function rateDomain(key, value) {
    setDomains(p => ({ ...p, [key]: p[key] === value ? undefined : value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const missing = (def.domains || []).filter(d => domains[d.key] === undefined || domains[d.key] === '');
    if (missing.length) {
      setLocalErr(t('rateAllDomains'));
      return;
    }
    if (def.overall && !overall) {
      setLocalErr(`${t('pleaseSelect')} ${def.overall.label.toLowerCase()}.`);
      return;
    }
    setLocalErr('');

    const scores = {};
    (def.domains || []).forEach(d => {
      const v = domains[d.key];
      if (v !== 'na' && v !== undefined && v !== '') scores[d.key] = Number(v);
    });

    const comments = (def.feedback || [])
      .map(f => feedback[f.key] ? `${f.label}: ${feedback[f.key]}` : '')
      .filter(Boolean)
      .join('\n');

    const part = form.parts ? form.parts[partIdx].code : null;
    onSubmit({
      evaluationType: form.type + (part ? ` · Form ${part}` : ''),
      scores,
      grade: overall,
      comments,
      formData: { header, domains, times, supervisionLevel: supervision, globalRating: overall, feedback, part },
    });
  }

  const isComplete = (def.domains || []).every(d => domains[d.key] !== undefined && domains[d.key] !== '') && (!def.overall || !!overall);

  function handlePrint() {
    const part = form.parts ? form.parts[partIdx].code : null;
    printEvaluation(
      {
        evaluationType: form.type + (part ? ` · Form ${part}` : ''),
        grade: overall,
        date: new Date(),
        formData: { header, domains, times, supervisionLevel: supervision, globalRating: overall, feedback, part },
      },
      { traineeName: trainee?.name, assessorName }
    );
  }

  const fieldBox = {
    width: '100%', padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 8,
    fontSize: 13, color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit',
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10,
        background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', marginBottom: 18,
      }}>
        {[
          [t('trainee'), trainee?.name || '—'],
          [t('assessor'), assessorName || '—'],
          [t('date'), fmtDate(new Date())],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>

      {form.parts && (
        <>
          <SectionTitle>Select form part</SectionTitle>
          <select
            value={partIdx}
            onChange={e => setPartIdx(Number(e.target.value))}
            style={{ ...fieldBox, marginBottom: 20, fontWeight: 600 }}
          >
            {form.parts.map((p, i) => <option key={p.code} value={i}>{p.label}</option>)}
          </select>
        </>
      )}

      {def.header?.length > 0 && (
        <>
          <SectionTitle>{t('caseDetails')}</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 20 }}>
            {def.header.map(f => (
              <div key={f.key}>
                <label style={LABEL_STYLE}>{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    value={header[f.key] || ''}
                    onChange={e => setHeader(p => ({ ...p, [f.key]: e.target.value }))}
                    style={fieldBox}
                  >
                    <option value="">{t('select')}</option>
                    {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={header[f.key] || ''}
                    onChange={e => setHeader(p => ({ ...p, [f.key]: e.target.value }))}
                    style={fieldBox}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>{t('competencyRatings')}</SectionTitle>
      <div style={{ overflowX: 'auto', marginBottom: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...gridCell, background: 'var(--brand-secondary)', color: 'var(--on-brand)', textAlign: 'left', minWidth: 180 }}>
                Competency / Domain
              </th>
              {scale.map(s => (
                <th key={s.value} style={{ ...gridCell, background: 'var(--brand-secondary)', color: 'var(--on-brand)', width: 46 }}>
                  {s.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(def.domains || []).flatMap((d, i, arr) => {
              const prev = arr[i - 1];
              const showSection = d.section && (!prev || prev.section !== d.section);
              const rows = [];
              if (showSection) rows.push(
                <tr key={d.key + '_sec'}>
                  <td colSpan={scale.length + 1} style={{ ...gridCell, textAlign: 'left', background: 'var(--surface-2)', fontWeight: 700, fontSize: 11.5, color: 'var(--text-2)' }}>
                    {d.section}
                  </td>
                </tr>
              );
              rows.push(
                <tr key={d.key}>
                  <td style={{ ...gridCell, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{d.label}</div>
                    {d.hint && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>{d.hint}</div>}
                  </td>
                  {scale.map(s => {
                    const active = String(domains[d.key]) === String(s.value);
                    return (
                      <td
                        key={s.value}
                        onClick={() => rateDomain(d.key, s.value)}
                        title={s.label}
                        style={{
                          ...gridCell, cursor: 'pointer', fontSize: 16, fontWeight: 700,
                          background: active ? s.bg : 'var(--surface)',
                          color: active ? s.color : 'var(--text-muted)',
                        }}
                      >
                        {active ? '☑' : '☐'}
                      </td>
                    );
                  })}
                </tr>
              );
              return rows;
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 20 }}>
        {def.scaleNote || `${t('scale')}: ${scale.map(s => s.label).join('  ·  ')}`}
      </div>

      {def.supervision && (
        <>
          <SectionTitle>{def.supervision.label}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
            {def.supervision.options.map(o => {
              const active = supervision === o;
              return (
                <button
                  key={o} type="button"
                  onClick={() => setSupervision(active ? '' : o)}
                  style={{
                    textAlign: 'left', padding: '9px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500,
                    cursor: 'pointer', transition: 'background-color .12s ease, border-color .12s ease, color .12s ease',
                    border: active ? '2px solid var(--success)' : '1.5px solid var(--border)',
                    background: active ? 'var(--success-bg)' : 'var(--surface)',
                    color: active ? 'var(--success-fg)' : 'var(--text-2)',
                  }}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </>
      )}

      {def.times?.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {def.times.map(tm => (
            <div key={tm.key} style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>{tm.label}</label>
              <input
                type="number" min="0"
                value={times[tm.key] || ''}
                onChange={e => setTimes(p => ({ ...p, [tm.key]: e.target.value }))}
                style={fieldBox}
              />
            </div>
          ))}
        </div>
      )}

      {def.overall && (
        <>
          <SectionTitle>{def.overall.label}</SectionTitle>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {def.overall.options.map(o => {
              const active = overall === o;
              return (
                <button
                  key={o} type="button"
                  onClick={() => setOverall(active ? '' : o)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                    cursor: 'pointer', transition: 'background-color .12s ease, border-color .12s ease, color .12s ease',
                    border: active ? `2px solid ${def.accent}` : '1.5px solid var(--border)',
                    background: active ? `${def.accent}14` : 'var(--surface)',
                    color: active ? def.accent : 'var(--text-2)',
                  }}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </>
      )}

      {def.feedback?.length > 0 && (
        <>
          <SectionTitle>{t('feedback')}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
            {def.feedback.map(f => (
              <div key={f.key}>
                <label style={LABEL_STYLE}>{f.label}</label>
                <textarea
                  value={feedback[f.key] || ''}
                  onChange={e => setFeedback(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ ...fieldBox, minHeight: 60, resize: 'vertical' }}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {(localErr || error) && (
        <div style={{
          background: 'var(--danger-bg)', borderRadius: 8, padding: '9px 13px',
          fontSize: 13, color: 'var(--danger-fg)', marginBottom: 14,
        }}>
          {localErr || error}
        </div>
      )}

      <div style={{
        display: 'flex', gap: 10, justifyContent: 'flex-end',
        position: 'sticky', bottom: 0, background: 'var(--surface)', paddingTop: 12, paddingBottom: 2,
        borderTop: '1px solid var(--border-soft)',
      }}>
        <button
          type="button" onClick={onCancel}
          style={{
            padding: '9px 20px', borderRadius: 8, background: 'var(--surface-2)',
            color: 'var(--text-2)', border: 'none', fontWeight: 500, fontSize: 13, cursor: 'pointer',
          }}
        >
          {t('back')}
        </button>
        <button
          type="button" onClick={handlePrint} disabled={!isComplete}
          title={isComplete ? t('printThisForm') : t('completeToPrint')}
          style={{
            padding: '9px 18px', borderRadius: 8, background: 'var(--surface)',
            color: isComplete ? 'var(--text)' : 'var(--text-muted)',
            border: `1.5px solid ${isComplete ? 'var(--text)' : 'var(--border)'}`,
            fontWeight: 600, fontSize: 13,
            cursor: isComplete ? 'pointer' : 'not-allowed',
          }}
        >
          🖨 {t('print')}
        </button>
        <button
          type="submit" disabled={submitting}
          style={{
            padding: '9px 22px', borderRadius: 8, background: 'var(--accent)',
            color: '#fff', border: 'none', fontWeight: 600, fontSize: 13,
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,107,53,.35)',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? t('submitting') : `${t('submit')} ${form.title}`}
        </button>
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────────
   Evaluation modal — monthly checklist + form entry.
   Transport injected via submitEval(payload, {trainee, dist}) / finalize(id).
   ───────────────────────────────────────────────────────────── */
export function EvalModal({
  item, evals, assessorName, onClose, onSubmitted, onFinalized,
  isReadOnly, t, forms = EVAL_FORMS, submitEval, finalize,
}) {
  const { trainee = {}, dist = {} } = item || {};
  const monthlyCap   = forms.length;
  const traineeEvals = safeArr(evals).filter(ev => evalSubjectId(ev) === trainee?._id?.toString());
  const monthEvals   = traineeEvals.filter(ev => isThisMonth(ev?.date || ev?.createdAt));
  // Only count types that are still selectable in THIS list, so a removed form
  // (e.g. a legacy FITER this month) or a supervisor subject can't push the
  // progress count past the cap (e.g. "6 / 5" or "1 / 0").
  const doneTypes    = new Set(monthEvals.map(baseEvalType).filter(tp => forms.some(f => f.type === tp)));

  const [activeType, setActiveType] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(null);
  const [error,      setError]      = useState('');

  const activeForm = activeType ? getForm(activeType) : null;

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') { activeType ? setActiveType(null) : onClose(); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose, activeType]);

  async function handleSubmit(payload) {
    setError('');
    setSubmitting(true);
    try {
      const newEval = await submitEval(payload, { trainee, dist });
      if (newEval && typeof newEval === 'object') onSubmitted(newEval);
      setActiveType(null);
    } catch (err) {
      setError(err?.message || t('submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinalize(evalId) {
    if (!evalId || !finalize) return;
    setFinalizing(evalId);
    try {
      const finalized = await finalize(evalId);
      onFinalized(evalId, finalized || {});
    } catch (err) {
      setError(err?.message || t('finalizeFailed'));
    } finally {
      setFinalizing(null);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
        zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, overflowY: 'auto', animation: 'fadeIn .22s ease-out',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 680,
        boxShadow: '0 20px 60px rgba(0,0,0,.2)',
        maxHeight: '92vh', overflowY: 'auto',
        animation: 'modalIn .22s ease-out',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar user={trainee} size={40} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{trainee.name || '—'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {trainee.studentId ? `${t('idLabel')}: ${trainee.studentId} · ` : ''}
                {activeForm ? activeForm.fullName : `${t('monthlyEvaluations')} · ${MONTH_LABEL}`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%', background: 'var(--surface-2)',
              border: 'none', fontSize: 18, color: 'var(--text-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        <div style={{ padding: '20px 24px' }}>

          {activeForm && !isReadOnly ? (
            <StructuredForm
              form={activeForm}
              trainee={trainee}
              assessorName={assessorName}
              onCancel={() => { setActiveType(null); setError(''); }}
              onSubmit={handleSubmit}
              submitting={submitting}
              error={error}
              t={t}
            />
          ) : (
          <>
            {forms.length > 0 ? (
            <>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface-2)', borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>{MONTH_LABEL} {t('monthProgress')}</div>
              <div style={{
                fontSize: 13, fontWeight: 700,
                color: doneTypes.size >= monthlyCap ? 'var(--success)' : 'var(--warning)',
              }}>
                {doneTypes.size} / {monthlyCap} {t('forms')}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {forms.map(f => {
                const done = doneTypes.has(f.type);
                return (
                  <div
                    key={f.type}
                    style={{
                      border: `1px solid ${done ? 'var(--success)' : 'var(--border)'}`,
                      background: done ? 'var(--success-bg)' : 'var(--surface)',
                      borderRadius: 12, padding: '14px 16px',
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                      background: `${f.accent}14`, color: f.accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800,
                    }}>
                      {f.title}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{f.fullName}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {f.parts ? `${f.parts.length} forms (A–E)` : `${f.domains.length} ${t('competencyDomains')}`}
                      </div>
                    </div>
                    {done ? (
                      <span className="status-ic status-ic-green" title={t('doneThisMonth')}>
                        <IconCheck size={15} />
                      </span>
                    ) : isReadOnly ? (
                      <span className="status-ic status-ic-amber" title={t('notSubmitted')}>
                        <IconClock size={15} />
                      </span>
                    ) : (
                      <button
                        onClick={() => { setActiveType(f.type); setError(''); }}
                        style={{
                          padding: '8px 18px', borderRadius: 8, background: f.accent,
                          color: '#fff', border: 'none', fontWeight: 600, fontSize: 12,
                          cursor: 'pointer', flexShrink: 0,
                        }}
                      >
                        {t('start')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            </>
            ) : (
              <div style={{
                background: 'var(--surface-2)', borderRadius: 10, padding: '16px 14px',
                marginBottom: 16, fontSize: 13, color: 'var(--text-muted)', textAlign: 'center',
              }}>
                {t('noFormsAvailable')}
              </div>
            )}

            {traineeEvals.length > 0 ? (
              <div>
                <SectionTitle>{t('submittedEvaluations')} ({traineeEvals.length})</SectionTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {traineeEvals.map(ev => {
                    const noteText = safeText(ev?.comments || ev?.notes);
                    const label    = evalType(ev) || t('evaluation');
                    const overall  = ev?.grade || ev?.formData?.globalRating || ev?.scores?.overall || '';
                    return (
                      <div
                        key={ev?._id || `${evalSubjectId(ev)}-${ev?.createdAt || 'row'}`}
                        style={{
                          border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: ev?.isFinalized ? 'var(--success-bg)' : 'var(--surface)',
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                              background: 'var(--info-bg)', color: 'var(--info-fg)',
                            }}>{label}</span>
                            {overall && (
                              <span style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                                background: 'var(--warning-bg)', color: 'var(--warning-fg)', fontWeight: 600,
                              }}>{overall}</span>
                            )}
                            {ev?.totalScore != null && (
                              <span style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                                background: 'var(--info-bg)', color: 'var(--link)', fontWeight: 700,
                              }}>avg {Math.round(ev.totalScore * 10) / 10}</span>
                            )}
                            {ev?.isFinalized && (
                              <span className="status-ic status-ic-green" title={t('sentToGrades')}>
                                <IconCheck size={15} />
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {fmtDate(ev?.date || ev?.createdAt)}
                            {noteText ? ` · ${noteText.replace(/\n/g, ' · ').slice(0, 60)}${noteText.length > 60 ? '…' : ''}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => printEvaluation(ev, { traineeName: trainee?.name, assessorName })}
                          title={t('printTitle')}
                          style={{
                            padding: '6px 12px', borderRadius: 8,
                            background: 'var(--surface)', color: 'var(--text)',
                            border: '1.5px solid var(--border)', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', flexShrink: 0,
                          }}
                        >
                          🖨 {t('print')}
                        </button>
                        {finalize && !ev?.isFinalized && (
                          <button
                            onClick={() => handleFinalize(ev?._id)}
                            disabled={finalizing === ev?._id || !ev?._id}
                            style={{
                              padding: '6px 14px', borderRadius: 8,
                              background: 'var(--brand-secondary)', color: 'var(--on-brand)',
                              border: 'none', fontSize: 12, fontWeight: 600,
                              cursor: 'pointer', flexShrink: 0,
                              opacity: finalizing === ev?._id ? 0.7 : 1,
                            }}
                          >
                            {finalizing === ev?._id ? t('sending') : t('finalize')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t('noEvalsYet')}</div>
              </div>
            )}

            {error && (
              <div style={{
                background: 'var(--danger-bg)', borderRadius: 8, padding: '9px 13px',
                fontSize: 13, color: 'var(--danger-fg)', marginTop: 14,
              }}>
                {error}
              </div>
            )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}
