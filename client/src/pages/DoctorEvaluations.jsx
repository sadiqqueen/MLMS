import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import api from '../api/axios';

const API_BASE    = 'http://https://mlms-production.up.railway.app';
const MONTHLY_CAP = 5;
const MONTH_LABEL = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const EVAL_TYPES = ['x', 'y', 'z', 'h', 't'];

const RATINGS = [
  { key: 'na',    label: 'N/A',            color: '#b2bec3', bg: '#f0f2f3' },
  { key: 'below', label: 'Below Standard', color: '#FF4757', bg: '#fef0f0' },
  { key: 'meets', label: 'Meets Standard', color: '#f39c12', bg: '#fff8e1' },
  { key: 'above', label: 'Above Standard', color: '#00B894', bg: '#e8fdf3' },
];

const RATING_LABEL = Object.fromEntries(RATINGS.map(r => [r.key, r.label]));
const RATING_COLOR = Object.fromEntries(RATINGS.map(r => [r.key, r.color]));

const EMPTY_FORM = { evalType: '', rating: '', notes: '' };

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
    return <img src={`${API_BASE}${user.photoUrl}`} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: '#e6f1fb',
      color: '#185FA5', fontWeight: 700, fontSize: size * 0.38,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {user?.initials || user?.name?.[0] || '?'}
    </div>
  );
}

export default function DoctorEvaluations() {
  const { user: me } = useAuth();
  const [rotations,  setRotations ] = useState([]);
  const [evals,      setEvals     ] = useState([]);
  const [loading,    setLoading   ] = useState(true);
  const [search,     setSearch    ] = useState('');

  const [selected,   setSelected  ] = useState(null);
  const [form,       setForm      ] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError     ] = useState('');

  useEffect(() => {
    if (!me?._id) return;
    Promise.all([
      api.get(`/api/rotations/doctor/${me._id}`),
      api.get(`/api/evaluations/by-doctor/${me._id}`),
    ]).then(([rotRes, evalRes]) => {
      setRotations(rotRes.data);
      setEvals(evalRes.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [me]);

  const evalsByStudent = {};
  for (const ev of evals) {
    const sid = typeof ev.student === 'object' ? ev.student?._id : ev.student;
    if (!sid) continue;
    (evalsByStudent[sid] = evalsByStudent[sid] || []).push(ev);
  }

  const seen = new Set();
  const students = [];
  for (const rot of rotations) {
    const sid = rot.student?._id;
    if (!sid || seen.has(sid)) continue;
    seen.add(sid);
    students.push({ rotation: rot, student: rot.student });
  }

  const filtered = students.filter(({ student }) => {
    const q = search.toLowerCase();
    return !q || student?.name?.toLowerCase().includes(q) || (student?.studentId || '').toLowerCase().includes(q);
  });

  function monthlyCount(sid) {
    return (evalsByStudent[sid] || []).filter(ev => isThisMonth(ev.date)).length;
  }

  function openModal(item) { setSelected(item); setForm(EMPTY_FORM); setError(''); }
  function closeModal()    { setSelected(null);  setForm(EMPTY_FORM); setError(''); }

  async function submitEval(e) {
    e.preventDefault();
    if (!form.evalType || !form.rating) return;
    setError('');
    setSubmitting(true);
    try {
      const rot = selected.rotation;
      const res = await api.post('/api/evaluations', {
        student:        selected.student._id,
        doctor:         me._id,
        hospital:       rot.hospital?._id || undefined,
        specialty:      rot.doctor?.specialty || '',
        evaluationType: form.evalType,
        grade:          form.rating,
        notes:          form.notes.trim(),
        status:         'completed',
        date:           new Date().toISOString(),
      });
      setEvals(prev => [res.data, ...prev]);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit evaluation');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedEvals  = selected
    ? [...(evalsByStudent[selected.student._id] || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
    : [];
  const thisMonthCount = selected ? monthlyCount(selected.student._id) : 0;
  const canAdd         = thisMonthCount < MONTHLY_CAP;
  const totalThisMonth = evals.filter(ev => isThisMonth(ev.date)).length;

  const LABEL_STYLE = { display: 'block', fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' };

  if (loading) return <><Navbar /><main className="admin-main"><div className="loading">Loading…</div></main></>;

  return (
    <>
      <Navbar />
      <main className="admin-main">

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 8 }}>
          {[
            { label: 'Students Under Supervision', value: students.length,    color: '#185FA5', bg: '#e6f1fb' },
            { label: `Evaluations in ${MONTH_LABEL}`,  value: totalThisMonth, color: '#00B894', bg: '#e8fdf3' },
            { label: 'Total Evaluations',          value: evals.length,       color: '#f39c12', bg: '#fff8e1' },
          ].map(c => (
            <div key={c.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: c.color, flexShrink: 0 }}>
                {c.value}
              </div>
              <div style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="admin-card">
          <div className="admin-toolbar">
            <input className="admin-search" placeholder="Search by student name or ID…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th><th>Student</th><th>Hospital</th><th>Rotation</th>
                  <th>{MONTH_LABEL} Progress</th><th>All Time</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} className="admin-empty">No students found</td></tr>}
                {filtered.map(({ rotation: rot, student }, i) => {
                  const mCount = monthlyCount(student._id);
                  const total  = (evalsByStudent[student._id] || []).length;
                  const full   = mCount >= MONTHLY_CAP;
                  return (
                    <tr key={student._id}>
                      <td style={{ color: '#aaa' }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar user={student} size={32} />
                          <div>
                            <strong>{student.name}</strong>
                            {student.studentId && <div style={{ fontSize: 11, color: '#888' }}>ID: {student.studentId}</div>}
                          </div>
                        </div>
                      </td>
                      <td>{rot.hospital?.name || '—'}</td>
                      <td>
                        <span className={rot.status === 'current' ? 'badge-active' : rot.status === 'completed' ? 'badge-completed' : 'badge-pending'}>
                          {rot.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {Array.from({ length: MONTHLY_CAP }).map((_, idx) => (
                              <div key={idx} style={{ width: 13, height: 13, borderRadius: 3, background: idx < mCount ? '#fe9a16' : '#e5e7eb' }} />
                            ))}
                          </div>
                          <span style={{ fontSize: 12, color: full ? '#e74c3c' : '#888', fontWeight: full ? 700 : 400 }}>
                            {mCount}/{MONTHLY_CAP}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: '#185FA5' }}>{total}</td>
                      <td>
                        <button className="btn-primary" style={{ marginLeft: 0, fontSize: 12, height: 30, padding: '0 12px' }} onClick={() => openModal({ rotation: rot, student })}>
                          {full ? 'View' : 'Evaluate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── MODAL ── */}
        {selected && (
          <div className="admin-modal-overlay" onClick={closeModal}>
            <div className="admin-modal admin-modal-lg" onClick={e => e.stopPropagation()}>

              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <Avatar user={selected.student} size={48} />
                  <div>
                    <div className="admin-modal-title">{selected.student.name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>
                      {selected.rotation.hospital?.name || 'No hospital'} &nbsp;·&nbsp;
                      <span style={{ color: thisMonthCount >= MONTHLY_CAP ? '#e74c3c' : '#fe9a16', fontWeight: 600 }}>
                        {thisMonthCount}/{MONTHLY_CAP} this month
                      </span>
                    </div>
                  </div>
                </div>
                <button className="admin-modal-close" onClick={closeModal}>✕</button>
              </div>

              <div className="admin-modal-body">

                {/* History */}
                <div className="modal-section-title" style={{ marginBottom: 10 }}>Evaluation History</div>
                {selectedEvals.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#aaa', marginBottom: 20 }}>No evaluations yet</div>
                ) : (
                  <div style={{ marginBottom: 20, maxHeight: 240, overflowY: 'auto' }}>
                    {selectedEvals.map(ev => {
                      const ratingColor = RATING_COLOR[ev.grade] || '#185FA5';
                      return (
                        <div key={ev._id} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          padding: '10px 14px', marginBottom: 8, borderRadius: 10,
                          background: isThisMonth(ev.date) ? '#fffbf2' : '#f8f9fa',
                          border: `1px solid ${isThisMonth(ev.date) ? '#fde8bc' : '#f0f2f5'}`,
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              {ev.evaluationType && (
                                <span style={{ fontSize: 11, background: '#e6f1fb', color: '#185FA5', borderRadius: 4, padding: '1px 7px', fontWeight: 700, textTransform: 'uppercase' }}>
                                  {ev.evaluationType}
                                </span>
                              )}
                              <span style={{ fontWeight: 700, fontSize: 13, color: ratingColor }}>
                                {RATING_LABEL[ev.grade] || ev.grade}
                              </span>
                              {isThisMonth(ev.date) && (
                                <span style={{ fontSize: 10, background: '#fe9a16', color: '#fff', borderRadius: 4, padding: '1px 7px', fontWeight: 600 }}>
                                  This month
                                </span>
                              )}
                            </div>
                            {ev.notes && <div style={{ fontSize: 12, color: '#666' }}>{ev.notes}</div>}
                          </div>
                          <div style={{ fontSize: 11, color: '#aaa', flexShrink: 0, paddingTop: 2 }}>{fmtDate(ev.date)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Form */}
                <div className="modal-section-title" style={{ marginBottom: 12 }}>
                  {canAdd
                    ? `Add Evaluation (${thisMonthCount + 1} of ${MONTHLY_CAP} this month)`
                    : `Limit reached — ${MONTHLY_CAP}/${MONTHLY_CAP} for ${MONTH_LABEL}`}
                </div>

                {canAdd ? (
                  <form onSubmit={submitEval}>

                    {/* Step 1: evaluation type dropdown */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={LABEL_STYLE}>Evaluation Type *</label>
                      <select
                        className="admin-search"
                        style={{ width: '100%' }}
                        value={form.evalType}
                        onChange={e => setForm(f => ({ ...f, evalType: e.target.value, rating: '' }))}
                        required
                      >
                        <option value="">— Select evaluation type —</option>
                        {EVAL_TYPES.map(t => (
                          <option key={t} value={t}>{t.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    {/* Step 2: rating grid — appears after type is selected */}
                    {form.evalType && (
                      <div style={{ marginBottom: 16 }}>
                        <label style={LABEL_STYLE}>Rating for "{form.evalType.toUpperCase()}" *</label>

                        {/* Column headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 6 }}>
                          {RATINGS.map(r => (
                            <div key={r.key} style={{ fontSize: 11, fontWeight: 600, color: r.color, textAlign: 'center' }}>
                              {r.label}
                            </div>
                          ))}
                        </div>

                        {/* Bubble row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                          {RATINGS.map(r => {
                            const active = form.rating === r.key;
                            return (
                              <button
                                key={r.key}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, rating: active ? '' : r.key }))}
                                style={{
                                  height: 44, borderRadius: 10,
                                  border: active ? `2px solid ${r.color}` : '1.5px solid #d1d5db',
                                  background: active ? r.color : 'white',
                                  color: active ? 'white' : '#666',
                                  fontSize: 12, fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.12s',
                                }}
                              >
                                {active ? '✓' : '○'}
                              </button>
                            );
                          })}
                        </div>

                        {form.rating && (
                          <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                            Selected: <strong style={{ color: RATING_COLOR[form.rating] }}>{RATING_LABEL[form.rating]}</strong>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={LABEL_STYLE}>Notes</label>
                      <input
                        className="admin-search"
                        style={{ width: '100%' }}
                        placeholder="Optional comments…"
                        value={form.notes}
                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      />
                    </div>

                    {error && <div style={{ color: '#e74c3c', fontSize: 13, marginBottom: 10 }}>{error}</div>}

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn-purple" style={{ marginLeft: 0 }} disabled={submitting || !form.evalType || !form.rating}>
                        {submitting ? 'Saving…' : 'Submit Evaluation'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div style={{ padding: '14px 16px', background: '#fff0f0', borderRadius: 10, fontSize: 13, color: '#c0392b', border: '1px solid #ffd0d0' }}>
                    This student has reached the maximum of {MONTHLY_CAP} evaluations for {MONTH_LABEL}.
                    New evaluations can be added starting next month.
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
