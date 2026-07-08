import { useState, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar       from '../components/Navbar';
import Toast        from '../components/Toast';
import api          from '../api/axios';
import Sk           from '../components/Skeleton';
import { IconEye, IconCheck, IconClock, IconXCircle } from '../components/icons';
import { EVAL_FORMS, FORM_TYPES, getForm, SCORE_SCALE } from '../data/evalForms';
import useBasePath from '../hooks/useBasePath';
import { printEvaluation } from '../utils/printEvaluation';

// ── Page-chrome translation (Arabic + English, follows the global toggle).
// Dynamic data (names, dates, hospitals) and evalForms-driven form content
// (domain/feedback labels, scale) are NOT translated here.
const STRINGS = {
  ar: {
    key: 'العربية',
    statTotal: 'إجمالي التقييمات',
    statThisMonth: 'هذا الشهر',
    statFinalized: 'تم الاعتماد',
    searchPlaceholder: 'ابحث باسم المتدرب أو الرقم…',
    emptyNoTrainees: 'لا يوجد متدربون معينون بعد',
    emptyNoMatch: 'لا يوجد متدربون يطابقون بحثك',
    emptyHint: 'يتم تعيين المتدربين لك من قبل السكرتارية.',
    evaluationsTotal: 'تقييم إجمالي',
    formsThisMonth: 'نماذج هذا الشهر',
    allFormsDone: 'اكتملت كل النماذج',
    view: 'عرض',
    evaluation: 'تقييم',
    evaluationsBtn: 'التقييمات',
    // modal
    idLabel: 'الرقم',
    monthlyEvaluations: 'التقييمات الشهرية',
    monthProgress: 'تقدم الشهر',
    forms: 'نماذج',
    competencyDomains: 'مجالات الكفاءة',
    doneThisMonth: 'تم هذا الشهر',
    notSubmitted: 'لم يُقدَّم',
    start: 'بدء',
    submittedEvaluations: 'التقييمات المُقدَّمة',
    sentToGrades: 'أُرسل إلى الدرجات',
    finalize: 'اعتماد',
    sending: 'جارٍ الإرسال…',
    noEvalsYet: 'لا توجد تقييمات بعد لهذا المتدرب',
    print: 'طباعة',
    printTitle: 'طباعة نموذج التقييم',
    // structured form
    trainee: 'المتدرب',
    assessor: 'المُقيِّم',
    date: 'التاريخ',
    caseDetails: 'تفاصيل الحالة',
    competencyRatings: 'تقييم الكفاءات',
    scale: 'المقياس',
    feedback: 'الملاحظات',
    select: 'اختر…',
    back: 'رجوع',
    completeToPrint: 'أكمل كل التقييمات للطباعة',
    printThisForm: 'طباعة نموذج التقييم هذا',
    submitting: 'جارٍ الإرسال…',
    submit: 'إرسال',
    rateAllDomains: 'يرجى تقييم جميع مجالات الكفاءة.',
    pleaseSelect: 'يرجى اختيار',
    // toasts
    loadFailed: 'فشل تحميل البيانات',
    submitSuccess: 'تم إرسال التقييم بنجاح',
    sentToGradesToast: 'أُرسل التقييم إلى صفحة درجات المتدرب',
    submitFailed: 'فشل إرسال التقييم.',
    finalizeFailed: 'فشل اعتماد التقييم.',
  },
  en: {
    key: 'English',
    statTotal: 'Total Evaluations',
    statThisMonth: 'This Month',
    statFinalized: 'Finalized',
    searchPlaceholder: 'Search by trainee name or ID…',
    emptyNoTrainees: 'No trainees assigned yet',
    emptyNoMatch: 'No trainees match your search',
    emptyHint: 'Trainees are assigned to you by the secretary.',
    evaluationsTotal: 'total',
    formsThisMonth: 'forms this month',
    allFormsDone: 'All forms done',
    view: 'View',
    evaluation: 'Evaluation',
    evaluationsBtn: 'Evaluations',
    // modal
    idLabel: 'ID',
    monthlyEvaluations: 'Monthly evaluations',
    monthProgress: 'progress',
    forms: 'forms',
    competencyDomains: 'competency domains',
    doneThisMonth: 'Done this month',
    notSubmitted: 'Not submitted',
    start: 'Start',
    submittedEvaluations: 'Submitted Evaluations',
    sentToGrades: 'Sent to grades',
    finalize: 'Finalize',
    sending: 'Sending…',
    noEvalsYet: 'No evaluations yet for this trainee',
    print: 'Print',
    printTitle: 'Print evaluation form',
    // structured form
    trainee: 'Trainee',
    assessor: 'Assessor',
    date: 'Date',
    caseDetails: 'Case Details',
    competencyRatings: 'Competency Ratings',
    scale: 'Scale',
    feedback: 'Feedback',
    select: 'Select…',
    back: 'Back',
    completeToPrint: 'Complete all ratings to print',
    printThisForm: 'Print this evaluation form',
    submitting: 'Submitting…',
    submit: 'Submit',
    rateAllDomains: 'Please rate all competency domains.',
    pleaseSelect: 'Please select the',
    // toasts
    loadFailed: 'Failed to load data',
    submitSuccess: 'Evaluation submitted successfully',
    sentToGradesToast: "Evaluation sent to trainee's grades page",
    submitFailed: 'Failed to submit evaluation.',
    finalizeFailed: 'Failed to finalize evaluation.',
  },
};

const MONTHLY_CAP = FORM_TYPES.length; // one of each form per trainee per month
const MONTH_LABEL = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

// Official downloadable evaluation-form documents (Advanced/residency track).
// Files live in frontend/public/evaluation-forms and are also on the landing page.
const OFFICIAL_FORMS = [
  { file: 'MSF_360_Evaluation_Form.docx',          title: 'MSF — 360° Multi-Source Feedback' },
  { file: 'Academic_Supervisor_Report_Form.docx',  title: 'Academic Supervisor Report' },
];
const officeViewUrl = file =>
  `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(window.location.origin + '/evaluation-forms/' + file)}`;

const LABEL_STYLE = {
  display:'block', fontSize:12, fontWeight:600, color:'var(--text-2)',
  marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em'
};

const gridCell = {
  border:'1px solid var(--border)', padding:'7px 8px', textAlign:'center', verticalAlign:'middle'
};

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr), now = new Date();
  if (Number.isNaN(d.getTime())) return false;
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function safeArr(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value) {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

function evalTraineeId(ev) {
  return (ev?.traineeId?._id || ev?.student?._id || ev?.traineeId || ev?.student)?.toString();
}

function evalType(ev) {
  return ev?.evaluationType || ev?.type || '';
}

function Avatar({ user, size = 32 }) {
  if (user?.photoUrl)
    return (
      <img
        src={user.photoUrl} alt=""
        style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }}
      />
    );
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%', background:'var(--info-bg)',
      color:'var(--link)', fontWeight:700, fontSize:size * 0.38,
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
    }}>
      {user?.initials || user?.name?.[0] || '?'}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Structured WPBA form (Mini-CEX / CbD / DOPS)
   ───────────────────────────────────────────────────────────── */
function StructuredForm({ form, trainee, assessorName, onCancel, onSubmit, submitting, error, t }) {
  const [header,     setHeader]     = useState({});
  const [domains,    setDomains]    = useState({});
  const [times,      setTimes]      = useState({});
  const [feedback,   setFeedback]   = useState({});
  const [overall,    setOverall]    = useState('');
  const [supervision,setSupervision]= useState('');
  const [localErr,   setLocalErr]   = useState('');

  function rateDomain(key, value) {
    setDomains(p => ({ ...p, [key]: p[key] === value ? undefined : value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Every domain must have a rating (N/A is allowed).
    const missing = form.domains.filter(d => domains[d.key] === undefined || domains[d.key] === '');
    if (missing.length) {
      setLocalErr(t('rateAllDomains'));
      return;
    }
    if (!overall) {
      setLocalErr(`${t('pleaseSelect')} ${form.overall.label.toLowerCase()}.`);
      return;
    }
    setLocalErr('');

    // Numeric scores only (excludes N/A) for the average score.
    const scores = {};
    form.domains.forEach(d => {
      const v = domains[d.key];
      if (v !== 'na' && v !== undefined && v !== '') scores[d.key] = Number(v);
    });

    const comments = form.feedback
      .map(f => feedback[f.key] ? `${f.label}: ${feedback[f.key]}` : '')
      .filter(Boolean)
      .join('\n');

    onSubmit({
      evaluationType: form.type,
      scores,
      grade: overall,
      comments,
      formData: { header, domains, times, supervisionLevel: supervision, globalRating: overall, feedback },
    });
  }

  // All domains rated and an overall rating chosen → ready to print/submit.
  const isComplete = form.domains.every(d => domains[d.key] !== undefined && domains[d.key] !== '') && !!overall;

  function handlePrint() {
    printEvaluation(
      {
        evaluationType: form.type,
        grade: overall,
        date: new Date(),
        formData: { header, domains, times, supervisionLevel: supervision, globalRating: overall, feedback },
      },
      { traineeName: trainee?.name, assessorName }
    );
  }

  const fieldBox = {
    width:'100%', padding:'8px 10px', border:'1.5px solid var(--border)', borderRadius:8,
    fontSize:13, color:'var(--text)', background:'var(--surface)', fontFamily:'inherit'
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Auto-filled identity row */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10,
        background:'var(--surface-2)', borderRadius:10, padding:'12px 14px', marginBottom:18
      }}>
        {[
          [t('trainee'), trainee?.name || '—'],
          [t('assessor'), assessorName || '—'],
          [t('date'), fmtDate(new Date())],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.05em' }}>{k}</div>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginTop:2 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Header fields */}
      <SectionTitle>{t('caseDetails')}</SectionTitle>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:20 }}>
        {form.header.map(f => (
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

      {/* Competency domains — docx-style rating grid */}
      <SectionTitle>{t('competencyRatings')}</SectionTitle>
      <div style={{ overflowX:'auto', marginBottom:8 }}>
        <table style={{ borderCollapse:'collapse', width:'100%', fontSize:12 }}>
          <thead>
            <tr>
              <th style={{ ...gridCell, background:'var(--brand-secondary)', color:'#fff', textAlign:'left', minWidth:180 }}>
                Competency / Domain
              </th>
              {SCORE_SCALE.map(s => (
                <th key={s.value} style={{ ...gridCell, background:'var(--brand-secondary)', color:'#fff', width:46 }}>
                  {s.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {form.domains.map(d => (
              <tr key={d.key}>
                <td style={{ ...gridCell, textAlign:'left' }}>
                  <div style={{ fontWeight:600, color:'var(--text)' }}>{d.label}</div>
                  {d.hint && <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:2 }}>{d.hint}</div>}
                </td>
                {SCORE_SCALE.map(s => {
                  const active = String(domains[d.key]) === String(s.value);
                  return (
                    <td
                      key={s.value}
                      onClick={() => rateDomain(d.key, s.value)}
                      title={s.label}
                      style={{
                        ...gridCell, cursor:'pointer', fontSize:16, fontWeight:700,
                        background: active ? s.bg : 'var(--surface)',
                        color: active ? s.color : 'var(--text-muted)',
                      }}
                    >
                      {active ? '☑' : '☐'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:10.5, color:'var(--text-muted)', marginBottom:20 }}>
        {t('scale')}: {SCORE_SCALE.map(s => s.label).join('  ·  ')}
      </div>

      {/* DOPS supervision level */}
      {form.supervision && (
        <>
          <SectionTitle>{form.supervision.label}</SectionTitle>
          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
            {form.supervision.options.map(o => {
              const active = supervision === o;
              return (
                <button
                  key={o} type="button"
                  onClick={() => setSupervision(active ? '' : o)}
                  style={{
                    textAlign:'left', padding:'9px 12px', borderRadius:8, fontSize:12.5, fontWeight:500,
                    cursor:'pointer', transition:'all .12s',
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

      {/* Times */}
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        {form.times.map(t => (
          <div key={t.key} style={{ flex:1 }}>
            <label style={LABEL_STYLE}>{t.label}</label>
            <input
              type="number" min="0"
              value={times[t.key] || ''}
              onChange={e => setTimes(p => ({ ...p, [t.key]: e.target.value }))}
              style={fieldBox}
            />
          </div>
        ))}
      </div>

      {/* Overall rating */}
      <SectionTitle>{form.overall.label}</SectionTitle>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {form.overall.options.map(o => {
          const active = overall === o;
          return (
            <button
              key={o} type="button"
              onClick={() => setOverall(active ? '' : o)}
              style={{
                padding:'8px 14px', borderRadius:8, fontSize:12.5, fontWeight:600,
                cursor:'pointer', transition:'all .12s',
                border: active ? `2px solid ${form.accent}` : '1.5px solid var(--border)',
                background: active ? `${form.accent}14` : 'var(--surface)',
                color: active ? form.accent : 'var(--text-2)',
              }}
            >
              {o}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      <SectionTitle>{t('feedback')}</SectionTitle>
      <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:18 }}>
        {form.feedback.map(f => (
          <div key={f.key}>
            <label style={LABEL_STYLE}>{f.label}</label>
            <textarea
              value={feedback[f.key] || ''}
              onChange={e => setFeedback(p => ({ ...p, [f.key]: e.target.value }))}
              style={{ ...fieldBox, minHeight:60, resize:'vertical' }}
            />
          </div>
        ))}
      </div>

      {(localErr || error) && (
        <div style={{
          background:'var(--danger-bg)', borderRadius:8, padding:'9px 13px',
          fontSize:13, color:'var(--danger-fg)', marginBottom:14
        }}>
          {localErr || error}
        </div>
      )}

      <div style={{
        display:'flex', gap:10, justifyContent:'flex-end',
        position:'sticky', bottom:0, background:'var(--surface)', paddingTop:12, paddingBottom:2,
        borderTop:'1px solid var(--border-soft)'
      }}>
        <button
          type="button" onClick={onCancel}
          style={{
            padding:'9px 20px', borderRadius:8, background:'var(--surface-2)',
            color:'var(--text-2)', border:'none', fontWeight:500, fontSize:13, cursor:'pointer'
          }}
        >
          {t('back')}
        </button>
        <button
          type="button" onClick={handlePrint} disabled={!isComplete}
          title={isComplete ? t('printThisForm') : t('completeToPrint')}
          style={{
            padding:'9px 18px', borderRadius:8, background:'var(--surface)',
            color: isComplete ? 'var(--text)' : 'var(--text-muted)',
            border:`1.5px solid ${isComplete ? 'var(--text)' : 'var(--border)'}`,
            fontWeight:600, fontSize:13,
            cursor: isComplete ? 'pointer' : 'not-allowed'
          }}
        >
          🖨 {t('print')}
        </button>
        <button
          type="submit" disabled={submitting}
          style={{
            padding:'9px 22px', borderRadius:8, background:'var(--accent)',
            color:'#fff', border:'none', fontWeight:600, fontSize:13,
            cursor:'pointer', boxShadow:'0 2px 8px rgba(255,107,53,.35)',
            opacity: submitting ? 0.7 : 1
          }}
        >
          {submitting ? t('submitting') : `${t('submit')} ${form.title}`}
        </button>
      </div>
    </form>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize:12, fontWeight:700, color:'var(--text-muted)',
      textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12
    }}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Evaluation modal — monthly checklist + form entry
   ───────────────────────────────────────────────────────────── */
function EvalModal({ item, evals, assessorName, onClose, onSubmitted, onFinalized, isReadOnly, t }) {
  const { trainee = {}, dist = {} } = item || {};
  const traineeEvals = safeArr(evals).filter(ev => evalTraineeId(ev) === trainee?._id?.toString());
  const monthEvals   = traineeEvals.filter(ev => isThisMonth(ev?.date || ev?.createdAt));
  const doneTypes    = new Set(monthEvals.map(evalType));

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

  async function submitEval(payload) {
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/api/supervisor/evaluations', {
        traineeId:      trainee._id,
        student:        trainee._id,
        distributionId: dist._id,
        rotation:       dist._id,
        type:           payload.evaluationType,
        date:           new Date().toISOString(),
        ...payload,
      });
      const newEval = res.data?.data || res.data;
      if (newEval && typeof newEval === 'object') onSubmitted(newEval);
      setActiveType(null);
    } catch (err) {
      setError(err.response?.data?.message || t('submitFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinalize(evalId) {
    if (!evalId) return;
    setFinalizing(evalId);
    try {
      const res = await api.patch(`/api/supervisor/evaluations/${evalId}/finalize`);
      const finalized = res.data?.data || res.data || {};
      onFinalized(evalId, finalized);
    } catch (err) {
      setError(err.response?.data?.message || t('finalizeFailed'));
    } finally {
      setFinalizing(null);
    }
  }

  return (
    <div
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.5)',
        zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center',
        padding:20, overflowY:'auto'
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background:'var(--surface)', borderRadius:16, width:'100%', maxWidth:680,
        boxShadow:'0 20px 60px rgba(0,0,0,.2)',
        maxHeight:'92vh', overflowY:'auto',
        animation:'modalIn .22s ease'
      }}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'18px 24px', borderBottom:'1px solid var(--border)',
          position:'sticky', top:0, background:'var(--surface)', zIndex:10
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Avatar user={trainee} size={40} />
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{trainee.name || '—'}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                {trainee.studentId ? `${t('idLabel')}: ${trainee.studentId} · ` : ''}
                {activeForm ? activeForm.fullName : `${t('monthlyEvaluations')} · ${MONTH_LABEL}`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width:30, height:30, borderRadius:'50%', background:'var(--surface-2)',
              border:'none', fontSize:18, color:'var(--text-muted)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center'
            }}
          >✕</button>
        </div>

        <div style={{ padding:'20px 24px' }}>

          {/* ── FORM ENTRY ── */}
          {activeForm && !isReadOnly ? (
            <StructuredForm
              form={activeForm}
              trainee={trainee}
              assessorName={assessorName}
              onCancel={() => { setActiveType(null); setError(''); }}
              onSubmit={submitEval}
              submitting={submitting}
              error={error}
              t={t}
            />
          ) : (
          <>
            {/* Monthly checklist */}
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              background:'var(--surface-2)', borderRadius:10, padding:'10px 14px', marginBottom:16
            }}>
              <div style={{ fontSize:13, color:'var(--text-2)', fontWeight:500 }}>{MONTH_LABEL} {t('monthProgress')}</div>
              <div style={{
                fontSize:13, fontWeight:700,
                color: doneTypes.size >= MONTHLY_CAP ? 'var(--success)' : 'var(--warning)'
              }}>
                {doneTypes.size} / {MONTHLY_CAP} {t('forms')}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
              {EVAL_FORMS.map(f => {
                const done = doneTypes.has(f.type);
                return (
                  <div
                    key={f.type}
                    style={{
                      border:`1px solid ${done ? 'var(--success)' : 'var(--border)'}`,
                      background: done ? 'var(--success-bg)' : 'var(--surface)',
                      borderRadius:12, padding:'14px 16px',
                      display:'flex', alignItems:'center', gap:14
                    }}
                  >
                    <div style={{
                      width:42, height:42, borderRadius:10, flexShrink:0,
                      background:`${f.accent}14`, color:f.accent,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:13, fontWeight:800
                    }}>
                      {f.title}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--text)' }}>{f.fullName}</div>
                      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{f.domains.length} {t('competencyDomains')}</div>
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
                          padding:'8px 18px', borderRadius:8, background:f.accent,
                          color:'#fff', border:'none', fontWeight:600, fontSize:12,
                          cursor:'pointer', flexShrink:0
                        }}
                      >
                        {t('start')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submitted evaluations */}
            {traineeEvals.length > 0 ? (
              <div>
                <SectionTitle>{t('submittedEvaluations')} ({traineeEvals.length})</SectionTitle>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {traineeEvals.map(ev => {
                    const noteText = safeText(ev?.comments || ev?.notes);
                    const label    = evalType(ev) || t('evaluation');
                    const overall  = ev?.grade || ev?.formData?.globalRating || ev?.scores?.overall || '';
                    return (
                      <div
                        key={ev?._id || `${evalTraineeId(ev)}-${ev?.createdAt || 'row'}`}
                        style={{
                          border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px',
                          display:'flex', alignItems:'center', gap:12,
                          background: ev?.isFinalized ? 'var(--success-bg)' : 'var(--surface)'
                        }}
                      >
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                            <span style={{
                              fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:20,
                              background:'var(--info-bg)', color:'var(--info-fg)'
                            }}>{label}</span>
                            {overall && (
                              <span style={{
                                fontSize:11, padding:'2px 8px', borderRadius:20,
                                background:'var(--warning-bg)', color:'var(--warning-fg)', fontWeight:600
                              }}>{overall}</span>
                            )}
                            {ev?.totalScore != null && (
                              <span style={{
                                fontSize:11, padding:'2px 8px', borderRadius:20,
                                background:'var(--info-bg)', color:'var(--link)', fontWeight:700
                              }}>avg {Math.round(ev.totalScore * 10) / 10}</span>
                            )}
                            {ev?.isFinalized && (
                              <span className="status-ic status-ic-green" title={t('sentToGrades')}>
                                <IconCheck size={15} />
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                            {fmtDate(ev?.date || ev?.createdAt)}
                            {noteText ? ` · ${noteText.replace(/\n/g, ' · ').slice(0, 60)}${noteText.length > 60 ? '…' : ''}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => printEvaluation(ev, { traineeName: trainee?.name, assessorName })}
                          title={t('printTitle')}
                          style={{
                            padding:'6px 12px', borderRadius:8,
                            background:'var(--surface)', color:'var(--text)',
                            border:'1.5px solid var(--border)', fontSize:12, fontWeight:600,
                            cursor:'pointer', flexShrink:0
                          }}
                        >
                          🖨 {t('print')}
                        </button>
                        {!isReadOnly && !ev?.isFinalized && (
                          <button
                            onClick={() => handleFinalize(ev?._id)}
                            disabled={finalizing === ev?._id || !ev?._id}
                            style={{
                              padding:'6px 14px', borderRadius:8,
                              background:'var(--brand-secondary)', color:'#fff',
                              border:'none', fontSize:12, fontWeight:600,
                              cursor:'pointer', flexShrink:0,
                              opacity: finalizing === ev?._id ? 0.7 : 1
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
              <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
                <div style={{ fontSize:14, fontWeight:500 }}>{t('noEvalsYet')}</div>
              </div>
            )}

            {error && (
              <div style={{
                background:'var(--danger-bg)', borderRadius:8, padding:'9px 13px',
                fontSize:13, color:'var(--danger-fg)', marginTop:14
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

export default function SupervisorEvaluations() {
  const { user: me }   = useAuth();
  const { lang, dir }  = usePrefs();
  const basePath       = useBasePath();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const [evals,      setEvals     ] = useState([]);
  const [trainees,   setTrainees  ] = useState([]);
  const [loading,    setLoading   ] = useState(true);
  const [search,     setSearch    ] = useState('');
  const [selected,   setSelected  ] = useState(null);
  const [toasts,     setToasts    ] = useState([]);

  const isReadOnly = me?.role === 'dio';

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/supervisor/evaluations'),
      api.get('/api/supervisor/trainees'),
    ]).then(([evalRes, traineeRes]) => {
      setEvals(safeArr(evalRes.data?.data || evalRes.data));
      setTrainees(safeArr(traineeRes.data?.data || traineeRes.data));
    }).catch(() => showToast(t('loadFailed'), 'error'))
      .finally(() => setLoading(false));
  }, [me]);

  const seen = new Set();
  const traineeList = [];
  for (const dist of safeArr(trainees)) {
    const t   = dist.traineeId || dist.student || {};
    const tid = t._id?.toString();
    if (!tid || seen.has(tid)) continue;
    seen.add(tid);
    traineeList.push({ dist, trainee: t });
  }

  const filtered = traineeList.filter(({ trainee }) => {
    const q = search.toLowerCase();
    return !q
      || trainee.name?.toLowerCase().includes(q)
      || (trainee.studentId || '').toLowerCase().includes(q);
  });

  function evalCountFor(tid) {
    return safeArr(evals).filter(ev => evalTraineeId(ev) === tid).length;
  }

  function monthlyTypesFor(tid) {
    const set = new Set(
      safeArr(evals)
        .filter(ev => evalTraineeId(ev) === tid && isThisMonth(ev?.date || ev?.createdAt))
        .map(evalType)
    );
    return set.size;
  }

  function handleSubmitted(newEval) {
    if (!newEval || typeof newEval !== 'object') return;
    setEvals(prev => [newEval, ...safeArr(prev)]);
    showToast(t('submitSuccess'));
  }

  function handleFinalized(evalId, finalized = {}) {
    setEvals(prev => safeArr(prev).map(ev => (
      ev?._id === evalId
        ? {
            ...ev, ...finalized, _id: ev._id, isFinalized: true,
            sentToTraineeAt: finalized.sentToTraineeAt || ev.sentToTraineeAt || new Date().toISOString(),
            status: finalized.status || ev.status || 'completed',
          }
        : ev
    )));
    showToast(t('sentToGradesToast'));
  }

  const evalList       = safeArr(evals);
  const totalEvals     = evalList.length;
  const finalizedCount = evalList.filter(ev => ev?.isFinalized).length;
  const thisMonthTotal = evalList.filter(ev => isThisMonth(ev?.date || ev?.createdAt)).length;

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={46} h={46} r={10} />
              <Sk w={110} h={14} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom:16 }}><Sk h={40} r={8} /></div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[...Array(6)].map((_,i) => (
            <div key={i} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={44} h={44} r="50%" />
              <div style={{ flex:1 }}>
                <Sk w={160} h={14} style={{ marginBottom:8 }} />
                <Sk w={100} h={12} />
              </div>
              <Sk w={80} h={32} r={8} />
              <Sk w={60} h={32} r={8} />
            </div>
          ))}
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>

        {/* Stat Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
          {[
            { label:t('statTotal'),     count:totalEvals,     color:'var(--info-fg)',    bg:'var(--info-bg)' },
            { label:t('statThisMonth'), count:thisMonthTotal, color:'var(--warning-fg)', bg:'var(--warning-bg)' },
            { label:t('statFinalized'), count:finalizedCount, color:'var(--success-fg)', bg:'var(--success-bg)' },
          ].map(c => (
            <div key={c.label} style={{
              background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
              padding:'16px 20px', display:'flex', alignItems:'center', gap:14
            }}>
              <div style={{
                width:46, height:46, borderRadius:10, background:c.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:22, fontWeight:700, color:c.color, flexShrink:0
              }}>
                {c.count}
              </div>
              <div style={{ fontSize:13, color:'var(--text-2)', fontWeight:500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Official reference forms — Advanced/residency track only */}
        {basePath === '' && (
          <div style={{
            background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
            padding:'14px 18px', marginBottom:20
          }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-2)', marginBottom:10 }}>Official Forms</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
              {OFFICIAL_FORMS.map(f => (
                <div key={f.file} style={{
                  display:'flex', alignItems:'center', gap:10,
                  border:'1px solid var(--border)', borderRadius:10, padding:'10px 12px',
                  flex:'1 1 260px', minWidth:0
                }}>
                  <div style={{ fontSize:22, flexShrink:0 }}>📄</div>
                  <div style={{ flex:1, minWidth:0, fontSize:13, fontWeight:600, color:'var(--text)' }}>{f.title}</div>
                  <a href={officeViewUrl(f.file)} target="_blank" rel="noopener noreferrer"
                     style={{ fontSize:12, fontWeight:700, color:'#185FA5', textDecoration:'none', flexShrink:0 }}>View</a>
                  <a href={`/evaluation-forms/${f.file}`} download
                     style={{ fontSize:12, fontWeight:700, color:'var(--text-2)', textDecoration:'none', flexShrink:0 }}>Download</a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ marginBottom:16 }}>
          <input
            className="admin-search"
            style={{ width:'100%', height:40, maxWidth:'100%' }}
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:56, color:'var(--text-muted)' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:16, fontWeight:600, color:'var(--text-2)', marginBottom:6 }}>
              {traineeList.length === 0 ? t('emptyNoTrainees') : t('emptyNoMatch')}
            </div>
            <div style={{ fontSize:13 }}>{t('emptyHint')}</div>
          </div>
        )}

        {/* Trainee list */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(({ dist, trainee }) => {
            const tid        = trainee._id?.toString();
            const count      = evalCountFor(tid);
            const monthTypes = monthlyTypesFor(tid);
            const complete   = monthTypes >= MONTHLY_CAP;

            const isView = isReadOnly || complete; // read-only or fully complete → view-only

            return (
              <div
                key={tid}
                style={{
                  background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12,
                  padding:'16px 20px', display:'flex', alignItems:'center', gap:14,
                  boxShadow:'0 1px 3px rgba(0,0,0,.05)'
                }}
              >
                <Avatar user={trainee} size={44} />

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'var(--text)', marginBottom:2 }}>
                    {trainee.name || '—'}
                  </div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                    {trainee.studentId ? `${t('idLabel')}: ${trainee.studentId} · ` : ''}
                    {count} {t('evaluationsTotal')} · {monthTypes}/{MONTHLY_CAP} {t('formsThisMonth')}
                  </div>
                </div>

                {complete && !isReadOnly && (
                  <span style={{
                    fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                    background:'var(--success-bg)', color:'var(--success-fg)'
                  }}>{t('allFormsDone')}</span>
                )}

                {isView ? (
                  <button
                    onClick={() => setSelected({ dist, trainee })}
                    title={t('view')}
                    aria-label={t('view')}
                    style={{
                      width:36, height:36, borderRadius:8, background:'var(--surface)',
                      color:'var(--text-2)', border:'1.5px solid var(--border)',
                      display:'inline-flex', alignItems:'center', justifyContent:'center',
                      cursor:'pointer', flexShrink:0
                    }}
                  >
                    <IconEye size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => setSelected({ dist, trainee })}
                    style={{
                      padding:'8px 18px', borderRadius:8, background:'var(--accent)',
                      color:'#fff', border:'none', fontWeight:500, fontSize:12,
                      cursor:'pointer', flexShrink:0,
                      boxShadow:'0 2px 6px rgba(255,107,53,.3)'
                    }}
                  >
                    {t('evaluationsBtn')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {selected && (
          <EvalModal
            item={selected}
            evals={evals}
            assessorName={me?.name}
            onClose={() => setSelected(null)}
            onSubmitted={handleSubmitted}
            onFinalized={handleFinalized}
            isReadOnly={isReadOnly}
            t={t}
          />
        )}

        <Toast toasts={toasts} />

        <style>{`
          @keyframes modalIn {
            from { opacity:0; transform:translateY(-14px) scale(.98); }
            to   { opacity:1; transform:translateY(0) scale(1); }
          }
        `}</style>

      </main>
    </>
  );
}
