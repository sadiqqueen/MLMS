import { useState, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext';
import Navbar       from '../components/Navbar';
import Toast        from '../components/Toast';
import api          from '../api/axios';
import Sk           from '../components/Skeleton';

const API_BASE    = '';
const MONTHLY_CAP = 5;
const MONTH_LABEL = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const EVAL_TYPES = ['Mini-CEX', 'DOPS', 'CbD', 'MSF', 'Other'];

const EVAL_PDF_TYPES = [
  { field: 'evaluationPdf1', label: 'Eval Form 1' },
  { field: 'evaluationPdf2', label: 'Eval Form 2' },
  { field: 'evaluationPdf3', label: 'Eval Form 3' },
  { field: 'evaluationPdf4', label: 'Eval Form 4' },
  { field: 'evaluationPdf5', label: 'Eval Form 5' },
];

const RATINGS = [
  { key: 'na',    label: 'N/A',            color: '#b2bec3', bg: '#f0f2f3' },
  { key: 'below', label: 'Below Standard', color: '#FF4757', bg: '#fef0f0' },
  { key: 'meets', label: 'Meets Standard', color: '#f39c12', bg: '#fff8e1' },
  { key: 'above', label: 'Above Standard', color: '#00B894', bg: '#e8fdf3' },
];

const EMPTY_FORM = { evalType: '', rating: '', notes: '' };

const LABEL_STYLE = {
  display:'block', fontSize:12, fontWeight:600, color:'#4B5563',
  marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em'
};

function isThisMonth(dateStr) {
  const d = new Date(dateStr), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Avatar({ user, size = 32 }) {
  if (user?.photoUrl)
    return (
      <img
        src={`${API_BASE}${user.photoUrl}`} alt=""
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

function EvalModal({ item, evals, specialty, onClose, onSubmitted, onFinalized, isReadOnly }) {
  const { trainee, dist } = item;
  const traineeEvals      = evals.filter(ev => {
    const tid = (ev.traineeId?._id || ev.student?._id || ev.traineeId || ev.student)?.toString();
    return tid === trainee._id?.toString();
  });
  const thisMonthCount = traineeEvals.filter(ev => isThisMonth(ev.date || ev.createdAt)).length;
  const atCap          = thisMonthCount >= MONTHLY_CAP;

  const availablePdfs = specialty
    ? EVAL_PDF_TYPES.filter(t => !!specialty[t.field])
    : [];

  const [form,       setForm      ] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(null);
  const [error,      setError     ] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function submitEval(e) {
    e.preventDefault();
    if (!form.evalType || !form.rating) {
      setError('Please select evaluation type and rating.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await api.post('/api/supervisor/evaluations', {
        traineeId:      trainee._id,
        student:        trainee._id,
        distributionId: dist._id,
        rotation:       dist._id,
        type:           form.evalType,
        scores:         { overall: form.rating },
        notes:          form.notes,
        date:           new Date().toISOString(),
      });
      const newEval = res.data?.data || res.data;
      onSubmitted(newEval);
      setForm(EMPTY_FORM);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit evaluation.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFinalize(evalId) {
    setFinalizing(evalId);
    try {
      await api.patch(`/api/supervisor/evaluations/${evalId}/finalize`);
      onFinalized(evalId);
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
        background:'#fff', borderRadius:16, width:'100%', maxWidth:620,
        boxShadow:'0 20px 60px rgba(0,0,0,.2)',
        maxHeight:'90vh', overflowY:'auto',
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
                {trainee.studentId ? `IMA: ${trainee.studentId}` : ''} · Evaluations
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

          {/* Evaluation template downloads */}
          {availablePdfs.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{
                fontSize:12, fontWeight:700, color:'#8B8FA8',
                textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10
              }}>
                Evaluation Templates
              </div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {availablePdfs.map(t => (
                  <a
                    key={t.field}
                    href={specialty[t.field]}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding:'6px 12px', borderRadius:7, fontSize:12, fontWeight:600,
                      background:'#E6F1FB', color:'#185FA5', textDecoration:'none',
                      display:'flex', alignItems:'center', gap:4,
                      border:'1px solid #BFDBFE'
                    }}
                  >
                    ↓ {t.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Monthly progress */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            background:'#F5F6FA', borderRadius:10, padding:'10px 14px', marginBottom:20
          }}>
            <div style={{ fontSize:13, color:'#4B5563', fontWeight:500 }}>
              {MONTH_LABEL} evaluations
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{
                fontSize:13, fontWeight:700,
                color: atCap ? '#DC2626' : '#059669'
              }}>
                {thisMonthCount} / {MONTHLY_CAP}
              </div>
              {atCap && (
                <span style={{
                  fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20,
                  background:'#FEE2E2', color:'#991B1B'
                }}>Cap reached</span>
              )}
            </div>
          </div>

          {/* Existing evaluations */}
          {traineeEvals.length > 0 && (
            <div style={{ marginBottom:24 }}>
              <div style={{
                fontSize:12, fontWeight:700, color:'#8B8FA8',
                textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10
              }}>
                Submitted Evaluations ({traineeEvals.length})
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {traineeEvals.map(ev => {
                  const ratingKey = ev.scores?.overall || '';
                  const ratingObj = RATINGS.find(r => r.key === ratingKey);
                  return (
                    <div
                      key={ev._id}
                      style={{
                        border:'1px solid #E8E9EF', borderRadius:10, padding:'12px 14px',
                        display:'flex', alignItems:'center', gap:12,
                        background: ev.isFinalized ? '#F0FDF4' : '#fff'
                      }}
                    >
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                          <span style={{
                            fontSize:12, fontWeight:600, padding:'2px 8px', borderRadius:20,
                            background:'#DBEAFE', color:'#1E40AF'
                          }}>
                            {ev.type || ev.evalType || 'Evaluation'}
                          </span>
                          {ratingObj && (
                            <span style={{
                              fontSize:11, padding:'2px 8px', borderRadius:20,
                              background:ratingObj.bg, color:ratingObj.color, fontWeight:600
                            }}>
                              {ratingObj.label}
                            </span>
                          )}
                          {ev.isFinalized && (
                            <span style={{
                              fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20,
                              background:'#D1FAE5', color:'#065F46'
                            }}>Sent to grades</span>
                          )}
                        </div>
                        <div style={{ fontSize:12, color:'#8B8FA8' }}>
                          {fmtDate(ev.date || ev.createdAt)}
                          {ev.notes ? ` · ${ev.notes.slice(0, 60)}${ev.notes.length > 60 ? '…' : ''}` : ''}
                        </div>
                      </div>
                      {!isReadOnly && !ev.isFinalized && (
                        <button
                          onClick={() => handleFinalize(ev._id)}
                          disabled={finalizing === ev._id}
                          style={{
                            padding:'6px 14px', borderRadius:8,
                            background:'#1B1464', color:'#fff',
                            border:'none', fontSize:12, fontWeight:600,
                            cursor:'pointer', flexShrink:0,
                            opacity: finalizing === ev._id ? 0.7 : 1
                          }}
                        >
                          {finalizing === ev._id ? 'Sending…' : 'Finalize'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {traineeEvals.length === 0 && (
            <div style={{
              textAlign:'center', padding:'24px 0', color:'#8B8FA8',
              marginBottom:20
            }}>
              <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
              <div style={{ fontSize:14, fontWeight:500 }}>No evaluations yet for this trainee</div>
            </div>
          )}

          {/* Add evaluation form */}
          {!isReadOnly && !atCap && (
            <form onSubmit={submitEval}>
              <div style={{
                borderTop:'1px solid #E8E9EF', paddingTop:20,
                fontSize:12, fontWeight:700, color:'#8B8FA8',
                textTransform:'uppercase', letterSpacing:'.05em', marginBottom:14
              }}>
                New Evaluation
              </div>

              <div style={{ marginBottom:16 }}>
                <label style={LABEL_STYLE}>Evaluation Type</label>
                <select
                  value={form.evalType}
                  onChange={e => setForm(p => ({ ...p, evalType: e.target.value }))}
                  style={{
                    width:'100%', padding:'9px 12px',
                    border:'1.5px solid #E8E9EF', borderRadius:8,
                    fontSize:13, color:'#1B1464', background:'#fff',
                    fontFamily:'inherit'
                  }}
                >
                  <option value="">Select type…</option>
                  {EVAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{ marginBottom:16 }}>
                <label style={LABEL_STYLE}>Rating</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {RATINGS.map(r => {
                    const active = form.rating === r.key;
                    return (
                      <button
                        key={r.key} type="button"
                        onClick={() => setForm(p => ({ ...p, rating: active ? '' : r.key }))}
                        style={{
                          padding:'8px 14px', borderRadius:8, fontSize:12, fontWeight:600,
                          border: active ? `2px solid ${r.color}` : '1.5px solid #E8E9EF',
                          background: active ? r.bg : '#fff',
                          color: active ? r.color : '#4B5563',
                          cursor:'pointer', transition:'all .15s'
                        }}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom:16 }}>
                <label style={LABEL_STYLE}>Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Observations, feedback for the trainee…"
                  style={{
                    width:'100%', minHeight:80, padding:'9px 12px',
                    border:'1.5px solid #E8E9EF', borderRadius:8,
                    fontSize:13, color:'#1B1464', resize:'vertical', fontFamily:'inherit'
                  }}
                />
              </div>

              {error && (
                <div style={{
                  background:'#FEE2E2', borderRadius:8, padding:'9px 13px',
                  fontSize:13, color:'#DC2626', marginBottom:14
                }}>
                  {error}
                </div>
              )}

              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button
                  type="button" onClick={onClose}
                  style={{
                    padding:'9px 20px', borderRadius:8, background:'#F5F6FA',
                    color:'#4B5563', border:'none', fontWeight:500, fontSize:13, cursor:'pointer'
                  }}
                >
                  Cancel
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
                  {submitting ? 'Submitting…' : 'Submit Evaluation'}
                </button>
              </div>
            </form>
          )}

          {!isReadOnly && atCap && (
            <div style={{
              background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:10,
              padding:'14px 16px', display:'flex', alignItems:'center', gap:10
            }}>
              <div style={{ fontSize:20 }}>⚠️</div>
              <div style={{ fontSize:13, color:'#92400E', fontWeight:500 }}>
                Monthly evaluation cap ({MONTHLY_CAP}) reached for {MONTH_LABEL}.
                New evaluations can be added next month.
              </div>
            </div>
          )}

          {isReadOnly && (
            <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:10 }}>
              <button
                onClick={onClose}
                style={{
                  padding:'9px 20px', borderRadius:8, background:'#FF6B35',
                  color:'#fff', border:'none', fontWeight:500, fontSize:13, cursor:'pointer'
                }}
              >Close</button>
            </div>
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
  const [specialty,  setSpecialty ] = useState(null);
  const [loading,    setLoading   ] = useState(true);
  const [search,     setSearch    ] = useState('');
  const [selected,   setSelected  ] = useState(null);
  const [toasts,     setToasts    ] = useState([]);

  const isReadOnly = me?.role === 'dio' || me?.role === 'professor';

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }

  useEffect(() => {
    const mySpecialtyId = me?.specialtyId?._id || me?.specialtyId;

    Promise.all([
      api.get('/api/supervisor/evaluations'),
      api.get('/api/supervisor/trainees'),
      mySpecialtyId ? api.get('/api/specialties') : Promise.resolve(null),
    ]).then(([evalRes, traineeRes, specRes]) => {
      setEvals(evalRes.data?.data || evalRes.data || []);
      setTrainees(traineeRes.data?.data || traineeRes.data || []);
      if (specRes && mySpecialtyId) {
        const all = specRes.data?.data || specRes.data || [];
        const found = all.find(s =>
          (s._id?.toString() === mySpecialtyId?.toString())
        );
        setSpecialty(found || null);
      }
    }).catch(() => showToast('Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, [me]);

  const seen = new Set();
  const traineeList = [];
  for (const dist of (Array.isArray(trainees) ? trainees : [])) {
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
    return evals.filter(ev => {
      const eid = (ev.traineeId?._id || ev.student?._id || ev.traineeId || ev.student)?.toString();
      return eid === tid;
    }).length;
  }

  function monthlyCountFor(tid) {
    return evals.filter(ev => {
      const eid = (ev.traineeId?._id || ev.student?._id || ev.traineeId || ev.student)?.toString();
      return eid === tid && isThisMonth(ev.date || ev.createdAt);
    }).length;
  }

  function handleSubmitted(newEval) {
    setEvals(prev => [newEval, ...prev]);
    showToast('Evaluation submitted successfully');
  }

  function handleFinalized(evalId) {
    setEvals(prev => prev.map(ev => ev._id === evalId ? { ...ev, isFinalized: true } : ev));
    showToast("Evaluation sent to trainee's grades page");
  }

  const totalEvals     = evals.length;
  const finalizedCount = evals.filter(ev => ev.isFinalized).length;
  const thisMonthTotal = evals.filter(ev => isThisMonth(ev.date || ev.createdAt)).length;

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
            const monthCount = monthlyCountFor(tid);
            const atCap      = monthCount >= MONTHLY_CAP;

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
                    {trainee.studentId ? `IMA: ${trainee.studentId} · ` : ''}
                    {count} evaluation{count !== 1 ? 's' : ''} total · {monthCount}/{MONTHLY_CAP} this month
                  </div>
                </div>

                {atCap && !isReadOnly && (
                  <span style={{
                    fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                    background:'#FEF3C7', color:'#92400E'
                  }}>Cap reached</span>
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
                  {isReadOnly ? 'View' : (atCap ? 'View' : 'Evaluate')}
                </button>
              </div>
            );
          })}
        </div>

        {selected && (
          <EvalModal
            item={selected}
            evals={evals}
            specialty={specialty}
            onClose={() => setSelected(null)}
            onSubmitted={handleSubmitted}
            onFinalized={handleFinalized}
            isReadOnly={isReadOnly}
          />
        )}

        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}

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
