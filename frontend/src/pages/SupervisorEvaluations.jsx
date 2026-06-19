import { useState, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext';
import Navbar       from '../components/Navbar';
import Toast        from '../components/Toast';
import api          from '../api/axios';
import Sk           from '../components/Skeleton';
import { EVAL_FORMS, FORM_TYPES, getForm, SCORE_SCALE } from '../data/evalForms';

const MONTHLY_CAP = FORM_TYPES.length; // one of each form per trainee per month
const MONTH_LABEL = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const LABEL_STYLE = {
  display:'block', fontSize:12, fontWeight:600, color:'#4B5563',
  marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em'
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
      width:size, height:size, borderRadius:'50%', background:'#E6F1FB',
      color:'#185FA5', fontWeight:700, fontSize:size * 0.38,
      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
    }}>
      {user?.initials || user?.name?.[0] || '?'}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Structured WPBA form (Mini-CEX / CbD / DOPS)
   ───────────────────────────────────────────────────────────── */
function StructuredForm({ form, trainee, assessorName, onCancel, onSubmit, submitting, error }) {
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
      setLocalErr(`Please rate all ${form.domains.length} competency domains.`);
      return;
    }
    if (!overall) {
      setLocalErr(`Please select the ${form.overall.label.toLowerCase()}.`);
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

  const fieldBox = {
    width:'100%', padding:'8px 10px', border:'1.5px solid #E8E9EF', borderRadius:8,
    fontSize:13, color:'#1B1464', background:'#fff', fontFamily:'inherit'
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Auto-filled identity row */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10,
        background:'#F5F6FA', borderRadius:10, padding:'12px 14px', marginBottom:18
      }}>
        {[
          ['Trainee', trainee?.name || '—'],
          ['Assessor', assessorName || '—'],
          ['Date', fmtDate(new Date())],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize:10, fontWeight:700, color:'#8B8FA8', textTransform:'uppercase', letterSpacing:'.05em' }}>{k}</div>
            <div style={{ fontSize:13, fontWeight:600, color:'#1B1464', marginTop:2 }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Header fields */}
      <SectionTitle>Case Details</SectionTitle>
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
                <option value="">Select…</option>
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

      {/* Competency domains */}
      <SectionTitle>Competencies — rate each (N/A · 1–5)</SectionTitle>
      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
        {form.domains.map(d => (
          <div key={d.key} style={{ border:'1px solid #E8E9EF', borderRadius:10, padding:'10px 12px' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#1B1464' }}>{d.label}</div>
            {d.hint && <div style={{ fontSize:11, color:'#8B8FA8', marginTop:2 }}>{d.hint}</div>}
            <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
              {SCORE_SCALE.map(s => {
                const active = String(domains[d.key]) === String(s.value);
                return (
                  <button
                    key={s.value} type="button"
                    title={s.label}
                    onClick={() => rateDomain(d.key, s.value)}
                    style={{
                      minWidth:38, padding:'6px 10px', borderRadius:7, fontSize:12, fontWeight:700,
                      cursor:'pointer', transition:'all .12s',
                      border: active ? `2px solid ${s.color}` : '1.5px solid #E8E9EF',
                      background: active ? s.bg : '#fff',
                      color: active ? s.color : '#6B7280',
                    }}
                  >
                    {s.short}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
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
                    border: active ? '2px solid #0E9F6E' : '1.5px solid #E8E9EF',
                    background: active ? '#eafaf1' : '#fff',
                    color: active ? '#0E6B4A' : '#4B5563',
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
                border: active ? `2px solid ${form.accent}` : '1.5px solid #E8E9EF',
                background: active ? `${form.accent}14` : '#fff',
                color: active ? form.accent : '#4B5563',
              }}
            >
              {o}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      <SectionTitle>Feedback</SectionTitle>
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
          background:'#FEE2E2', borderRadius:8, padding:'9px 13px',
          fontSize:13, color:'#DC2626', marginBottom:14
        }}>
          {localErr || error}
        </div>
      )}

      <div style={{
        display:'flex', gap:10, justifyContent:'flex-end',
        position:'sticky', bottom:0, background:'#fff', paddingTop:12, paddingBottom:2,
        borderTop:'1px solid #F0F1F5'
      }}>
        <button
          type="button" onClick={onCancel}
          style={{
            padding:'9px 20px', borderRadius:8, background:'#F5F6FA',
            color:'#4B5563', border:'none', fontWeight:500, fontSize:13, cursor:'pointer'
          }}
        >
          Back
        </button>
        <button
          type="submit" disabled={submitting}
          style={{
            padding:'9px 22px', borderRadius:8, background:'#FF6B35',
            color:'#fff', border:'none', fontWeight:600, fontSize:13,
            cursor:'pointer', boxShadow:'0 2px 8px rgba(255,107,53,.35)',
            opacity: submitting ? 0.7 : 1
          }}
        >
          {submitting ? 'Submitting…' : `Submit ${form.title}`}
        </button>
      </div>
    </form>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize:12, fontWeight:700, color:'#8B8FA8',
      textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12
    }}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Evaluation modal — monthly checklist + form entry
   ───────────────────────────────────────────────────────────── */
function EvalModal({ item, evals, assessorName, onClose, onSubmitted, onFinalized, isReadOnly }) {
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
      setError(err.response?.data?.message || 'Failed to submit evaluation.');
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
      setError(err.response?.data?.message || 'Failed to finalize evaluation.');
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
        background:'#fff', borderRadius:16, width:'100%', maxWidth:680,
        boxShadow:'0 20px 60px rgba(0,0,0,.2)',
        maxHeight:'92vh', overflowY:'auto',
        animation:'modalIn .22s ease'
      }}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'18px 24px', borderBottom:'1px solid #E8E9EF',
          position:'sticky', top:0, background:'#fff', zIndex:10
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <Avatar user={trainee} size={40} />
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:'#1B1464' }}>{trainee.name || '—'}</div>
              <div style={{ fontSize:12, color:'#8B8FA8' }}>
                {trainee.studentId ? `ID: ${trainee.studentId} · ` : ''}
                {activeForm ? activeForm.fullName : `Monthly evaluations · ${MONTH_LABEL}`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width:30, height:30, borderRadius:'50%', background:'#F5F6FA',
              border:'none', fontSize:18, color:'#8B8FA8', cursor:'pointer',
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
            />
          ) : (
          <>
            {/* Monthly checklist */}
            <div style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              background:'#F5F6FA', borderRadius:10, padding:'10px 14px', marginBottom:16
            }}>
              <div style={{ fontSize:13, color:'#4B5563', fontWeight:500 }}>{MONTH_LABEL} progress</div>
              <div style={{
                fontSize:13, fontWeight:700,
                color: doneTypes.size >= MONTHLY_CAP ? '#059669' : '#D97706'
              }}>
                {doneTypes.size} / {MONTHLY_CAP} forms
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
              {EVAL_FORMS.map(f => {
                const done = doneTypes.has(f.type);
                return (
                  <div
                    key={f.type}
                    style={{
                      border:`1px solid ${done ? '#BBE9D2' : '#E8E9EF'}`,
                      background: done ? '#F0FDF4' : '#fff',
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
                      <div style={{ fontSize:14, fontWeight:700, color:'#1B1464' }}>{f.fullName}</div>
                      <div style={{ fontSize:12, color:'#8B8FA8' }}>{f.domains.length} competency domains</div>
                    </div>
                    {done ? (
                      <span style={{
                        fontSize:11, fontWeight:700, padding:'5px 12px', borderRadius:20,
                        background:'#D1FAE5', color:'#065F46'
                      }}>✓ Done this month</span>
                    ) : isReadOnly ? (
                      <span style={{ fontSize:12, color:'#8B8FA8' }}>Not submitted</span>
                    ) : (
                      <button
                        onClick={() => { setActiveType(f.type); setError(''); }}
                        style={{
                          padding:'8px 18px', borderRadius:8, background:f.accent,
                          color:'#fff', border:'none', fontWeight:600, fontSize:12,
                          cursor:'pointer', flexShrink:0
                        }}
                      >
                        Start
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submitted evaluations */}
            {traineeEvals.length > 0 ? (
              <div>
                <SectionTitle>Submitted Evaluations ({traineeEvals.length})</SectionTitle>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {traineeEvals.map(ev => {
                    const noteText = safeText(ev?.comments || ev?.notes);
                    const label    = evalType(ev) || 'Evaluation';
                    const overall  = ev?.grade || ev?.formData?.globalRating || ev?.scores?.overall || '';
                    return (
                      <div
                        key={ev?._id || `${evalTraineeId(ev)}-${ev?.createdAt || 'row'}`}
                        style={{
                          border:'1px solid #E8E9EF', borderRadius:10, padding:'12px 14px',
                          display:'flex', alignItems:'center', gap:12,
                          background: ev?.isFinalized ? '#F0FDF4' : '#fff'
                        }}
                      >
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                            <span style={{
                              fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:20,
                              background:'#DBEAFE', color:'#1E40AF'
                            }}>{label}</span>
                            {overall && (
                              <span style={{
                                fontSize:11, padding:'2px 8px', borderRadius:20,
                                background:'#FEF3C7', color:'#92400E', fontWeight:600
                              }}>{overall}</span>
                            )}
                            {ev?.totalScore != null && (
                              <span style={{
                                fontSize:11, padding:'2px 8px', borderRadius:20,
                                background:'#E6F1FB', color:'#185FA5', fontWeight:700
                              }}>avg {Math.round(ev.totalScore * 10) / 10}</span>
                            )}
                            {ev?.isFinalized && (
                              <span style={{
                                fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20,
                                background:'#D1FAE5', color:'#065F46'
                              }}>Sent to grades</span>
                            )}
                          </div>
                          <div style={{ fontSize:12, color:'#8B8FA8' }}>
                            {fmtDate(ev?.date || ev?.createdAt)}
                            {noteText ? ` · ${noteText.replace(/\n/g, ' · ').slice(0, 60)}${noteText.length > 60 ? '…' : ''}` : ''}
                          </div>
                        </div>
                        {!isReadOnly && !ev?.isFinalized && (
                          <button
                            onClick={() => handleFinalize(ev?._id)}
                            disabled={finalizing === ev?._id || !ev?._id}
                            style={{
                              padding:'6px 14px', borderRadius:8,
                              background:'#1B1464', color:'#fff',
                              border:'none', fontSize:12, fontWeight:600,
                              cursor:'pointer', flexShrink:0,
                              opacity: finalizing === ev?._id ? 0.7 : 1
                            }}
                          >
                            {finalizing === ev?._id ? 'Sending…' : 'Finalize'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'20px 0', color:'#8B8FA8' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
                <div style={{ fontSize:14, fontWeight:500 }}>No evaluations yet for this trainee</div>
              </div>
            )}

            {error && (
              <div style={{
                background:'#FEE2E2', borderRadius:8, padding:'9px 13px',
                fontSize:13, color:'#DC2626', marginTop:14
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
    }).catch(() => showToast('Failed to load data', 'error'))
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
    showToast('Evaluation submitted successfully');
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
    showToast("Evaluation sent to trainee's grades page");
  }

  const evalList       = safeArr(evals);
  const totalEvals     = evalList.length;
  const finalizedCount = evalList.filter(ev => ev?.isFinalized).length;
  const thisMonthTotal = evalList.filter(ev => isThisMonth(ev?.date || ev?.createdAt)).length;

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={46} h={46} r={10} />
              <Sk w={110} h={14} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom:16 }}><Sk h={40} r={8} /></div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[...Array(6)].map((_,i) => (
            <div key={i} style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
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
      <main className="admin-main">

        {/* Stat Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 }}>
          {[
            { label:'Total Evaluations', count:totalEvals,     color:'#185FA5', bg:'#E6F1FB' },
            { label:'This Month',        count:thisMonthTotal, color:'#D97706', bg:'#FEF3C7' },
            { label:'Finalized',         count:finalizedCount, color:'#059669', bg:'#D1FAE5' },
          ].map(c => (
            <div key={c.label} style={{
              background:'#fff', border:'1px solid #E8E9EF', borderRadius:12,
              padding:'16px 20px', display:'flex', alignItems:'center', gap:14
            }}>
              <div style={{
                width:46, height:46, borderRadius:10, background:c.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:22, fontWeight:700, color:c.color, flexShrink:0
              }}>
                {c.count}
              </div>
              <div style={{ fontSize:13, color:'#4B5563', fontWeight:500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom:16 }}>
          <input
            className="admin-search"
            style={{ width:'100%', height:40, maxWidth:'100%' }}
            placeholder="Search by trainee name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:56, color:'#8B8FA8' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
            <div style={{ fontSize:16, fontWeight:600, color:'#4B5563', marginBottom:6 }}>
              {traineeList.length === 0 ? 'No trainees assigned yet' : 'No trainees match your search'}
            </div>
            <div style={{ fontSize:13 }}>Trainees are assigned to you by the secretary.</div>
          </div>
        )}

        {/* Trainee list */}
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(({ dist, trainee }) => {
            const tid        = trainee._id?.toString();
            const count      = evalCountFor(tid);
            const monthTypes = monthlyTypesFor(tid);
            const complete   = monthTypes >= MONTHLY_CAP;

            return (
              <div
                key={tid}
                style={{
                  background:'#fff', border:'1px solid #E8E9EF', borderRadius:12,
                  padding:'16px 20px', display:'flex', alignItems:'center', gap:14,
                  boxShadow:'0 1px 3px rgba(0,0,0,.05)'
                }}
              >
                <Avatar user={trainee} size={44} />

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'#1B1464', marginBottom:2 }}>
                    {trainee.name || '—'}
                  </div>
                  <div style={{ fontSize:12, color:'#8B8FA8' }}>
                    {trainee.studentId ? `ID: ${trainee.studentId} · ` : ''}
                    {count} evaluation{count !== 1 ? 's' : ''} total · {monthTypes}/{MONTHLY_CAP} forms this month
                  </div>
                </div>

                {complete && !isReadOnly && (
                  <span style={{
                    fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                    background:'#D1FAE5', color:'#065F46'
                  }}>All forms done</span>
                )}

                <button
                  onClick={() => setSelected({ dist, trainee })}
                  style={{
                    padding:'8px 18px', borderRadius:8, background:'#FF6B35',
                    color:'#fff', border:'none', fontWeight:500, fontSize:12,
                    cursor:'pointer', flexShrink:0,
                    boxShadow:'0 2px 6px rgba(255,107,53,.3)'
                  }}
                >
                  {isReadOnly ? 'View' : (complete ? 'View' : 'Evaluate')}
                </button>
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
