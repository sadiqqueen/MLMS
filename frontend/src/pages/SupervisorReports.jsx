import { useState, useEffect } from 'react';
import { useAuth }  from '../context/AuthContext';
import Navbar       from '../components/Navbar';
import Toast        from '../components/Toast';
import api          from '../api/axios';
import Sk           from '../components/Skeleton';

const API_BASE = '';

const ASR_CRITERIA = [
  'History Taking',
  'Physical Examination',
  'Clinical Reasoning',
  'Diagnosis & Management',
  'Communication with Patient',
  'Communication with Team',
  'Professionalism & Ethics',
  'Time Management',
];

const RATINGS = [
  { key: 'na',    label: 'N/A',            color: '#b2bec3', bg: '#f0f2f3' },
  { key: 'below', label: 'Below Standard', color: '#FF4757', bg: '#fef0f0' },
  { key: 'meets', label: 'Meets Standard', color: '#f39c12', bg: '#fff8e1' },
  { key: 'above', label: 'Above Standard', color: '#00B894', bg: '#e8fdf3' },
];

const LETTER_GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function GradeBubbles({ selected, onChange, disabled }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
      {LETTER_GRADES.map(g => {
        const active = selected === g;
        return (
          <button
            key={g} type="button"
            onClick={() => !disabled && onChange(active ? '' : g)}
            disabled={disabled}
            style={{
              width:40, height:40, borderRadius:'50%',
              border: active ? '2px solid #185FA5' : '1.5px solid #d1d5db',
              background: active ? '#185FA5' : 'white',
              color: active ? 'white' : '#444',
              fontSize:12, fontWeight:700,
              cursor: disabled ? 'default' : 'pointer',
              transition:'all 0.12s', flexShrink:0,
              opacity: disabled && !active ? 0.5 : 1,
            }}
          >{g}</button>
        );
      })}
    </div>
  );
}

function AssessmentModal({ report, supervisor, onClose, onSaved }) {
  const isGraded = report.status === 'graded' || report.status === 'approved';

  const [criteria,     setCriteria    ] = useState(report.assessmentCriteria || {});
  const [globalRating, setGlobalRating] = useState(report.globalRating       || '');
  const [letterGrade,  setLetterGrade ] = useState(
    report.grade && !['Competent','Not-Competent','approved','rejected'].includes(report.grade)
      ? report.grade : ''
  );
  const [comments,   setComments  ] = useState(report.assessorComments || '');
  const [reviewNote, setReviewNote] = useState(report.reviewNote       || '');
  const [saving,     setSaving    ] = useState(false);
  const [error,      setError     ] = useState('');

  function toggleCriteria(name, key) {
    if (isGraded) return;
    setCriteria(p => ({ ...p, [name]: p[name] === key ? '' : key }));
  }

  async function handleSubmit(status) {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/api/supervisor/reports/${report._id}`, {
        status,
        reviewNote: reviewNote || comments,
        globalRating: globalRating || undefined,
        assessmentCriteria: criteria,
        assessorComments: comments,
        grade: letterGrade || undefined,
      });
      onSaved(res.data?.data || res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit assessment.');
      setSaving(false);
    }
  }

  const rota    = report.rotation;
  const rotaStr = rota ? `${fmtDate(rota.startDate)} – ${fmtDate(rota.endDate)}` : '—';

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
        boxShadow:'0 20px 60px rgba(0,0,0,.2)', maxHeight:'90vh', overflowY:'auto'
      }}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          padding:'20px 24px', borderBottom:'1px solid #E8E9EF',
          position:'sticky', top:0, background:'#fff', zIndex:10
        }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'#1B1464' }}>
              {isGraded ? 'Assessment Details' : 'Assess Report'}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
              <span style={{
                fontSize:11, padding:'2px 9px', borderRadius:20, fontWeight:600,
                background: report.type==='monthly' ? '#FEF3C7' : '#DBEAFE',
                color:      report.type==='monthly' ? '#92400E' : '#1E40AF'
              }}>{report.type}</span>
              <span style={{ fontSize:12, color:'#8B8FA8' }}>{report.title}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width:30, height:30, borderRadius:'50%', background:'#F5F6FA',
              border:'none', fontSize:18, color:'#8B8FA8', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0
            }}
          >✕</button>
        </div>

        <div style={{ padding:'20px 24px' }}>

          {/* Trainee Info */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#8B8FA8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
              Trainee Information
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 20px' }}>
              {[
                ['Name',            report.student?.name || '—'],
                ['IMA / Student ID',report.student?.studentId || '—'],
                ['Date Submitted',  fmtDate(report.date)],
                ['Hospital',        report.hospital?.name || '—'],
                ['Rotation Period', rotaStr],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize:11, color:'#8B8FA8', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:13, color:'#1B1464', fontWeight:500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Assessor Info */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#8B8FA8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
              Assessor Information
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 20px' }}>
              {[
                ['Name',     supervisor?.name    || '—'],
                ['Email',    supervisor?.email   || '—'],
                ['Phone',    supervisor?.phone   || '—'],
                ['Hospital', report.hospital?.name || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize:11, color:'#8B8FA8', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:13, color:'#1B1464', fontWeight:500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ASR Criteria */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#8B8FA8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
              ASR Assessment Criteria
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr', gap:6, marginBottom:6 }}>
              <div />
              {RATINGS.map(r => (
                <div key={r.key} style={{ fontSize:10, fontWeight:600, color:r.color, textAlign:'center' }}>
                  {r.label}
                </div>
              ))}
            </div>
            {ASR_CRITERIA.map((name, idx) => (
              <div
                key={name}
                style={{
                  display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr',
                  gap:6, marginBottom:4, padding:'8px 0',
                  borderTop: idx === 0 ? 'none' : '1px solid #F5F6FA'
                }}
              >
                <div style={{ fontSize:13, color:'#1B1464', alignSelf:'center' }}>{name}</div>
                {RATINGS.map(r => {
                  const sel = criteria[name] === r.key;
                  return (
                    <div key={r.key} style={{ display:'flex', justifyContent:'center' }}>
                      <button
                        type="button"
                        disabled={isGraded}
                        onClick={() => toggleCriteria(name, r.key)}
                        style={{
                          width:28, height:28, borderRadius:'50%',
                          border: sel ? `2px solid ${r.color}` : '1.5px solid #D1D5DB',
                          background: sel ? r.color : '#fff',
                          cursor: isGraded ? 'default' : 'pointer',
                          transition:'all 0.12s',
                          opacity: isGraded && !sel ? 0.5 : 1,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Global Rating */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#8B8FA8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
              Global Rating
            </div>
            <div style={{ display:'flex', gap:12 }}>
              {['competent','not-competent'].map(val => {
                const active = globalRating === val;
                const color  = val === 'competent' ? '#00B894' : '#FF4757';
                return (
                  <button
                    key={val} type="button" disabled={isGraded}
                    onClick={() => !isGraded && setGlobalRating(active ? '' : val)}
                    style={{
                      flex:1, padding:'12px 0', borderRadius:10,
                      border: active ? `2px solid ${color}` : '1.5px solid #E8E9EF',
                      background: active ? (val==='competent' ? '#E8FDF3' : '#FEF0F0') : '#fff',
                      color: active ? color : '#4B5563',
                      fontWeight:700, fontSize:14,
                      cursor: isGraded ? 'default' : 'pointer',
                      transition:'all .15s'
                    }}
                  >
                    {val === 'competent' ? '✓ Competent' : '✗ Not-Competent'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Letter Grade */}
          {!isGraded && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#4B5563', marginBottom:8 }}>
                Letter Grade (optional)
              </div>
              <GradeBubbles
                selected={letterGrade}
                onChange={setLetterGrade}
                disabled={isGraded}
              />
            </div>
          )}

          {/* Comments */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#4B5563', marginBottom:6 }}>
              {isGraded ? 'Assessment Notes' : 'Comments / Notes'}
            </div>
            <textarea
              disabled={isGraded}
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Enter any comments or observations…"
              style={{
                width:'100%', minHeight:90, padding:'10px 12px',
                border:'1.5px solid #E8E9EF', borderRadius:8, fontSize:13,
                color:'#1B1464', resize:'vertical', fontFamily:'inherit',
                background: isGraded ? '#F5F6FA' : '#fff'
              }}
            />
          </div>

          {/* Review Note */}
          {!isGraded && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#4B5563', marginBottom:6 }}>
                Review Note (shown to trainee)
              </div>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                placeholder="Optional note for the trainee…"
                style={{
                  width:'100%', minHeight:70, padding:'10px 12px',
                  border:'1.5px solid #E8E9EF', borderRadius:8, fontSize:13,
                  color:'#1B1464', resize:'vertical', fontFamily:'inherit'
                }}
              />
            </div>
          )}

          {error && (
            <div style={{
              background:'#FEE2E2', borderRadius:8, padding:'10px 14px',
              fontSize:13, color:'#DC2626', marginBottom:16
            }}>
              {error}
            </div>
          )}

          {isGraded && (
            <div style={{
              background:'#E8FDF3', border:'1px solid #00B894',
              borderRadius:10, padding:'14px 16px', marginBottom:16,
              display:'flex', alignItems:'center', gap:10
            }}>
              <div style={{ fontSize:20 }}>✓</div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#065F46' }}>
                  Assessment submitted
                </div>
                <div style={{ fontSize:12, color:'#047857', marginTop:2 }}>
                  Status: {report.status} · By {report.gradedBy?.name || report.reviewedBy?.name || '—'}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          {!isGraded && (
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
              <button
                type="button"
                onClick={() => handleSubmit('rejected')}
                disabled={saving}
                style={{
                  padding:'9px 20px', borderRadius:8, background:'#DC2626',
                  color:'#fff', border:'none', fontWeight:500, fontSize:13,
                  cursor:'pointer', opacity: saving ? 0.7 : 1
                }}
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => handleSubmit('graded')}
                disabled={saving}
                style={{
                  padding:'9px 20px', borderRadius:8, background:'#FF6B35',
                  color:'#fff', border:'none', fontWeight:500, fontSize:13,
                  cursor:'pointer', boxShadow:'0 2px 8px rgba(255,107,53,.35)',
                  opacity: saving ? 0.7 : 1
                }}
              >
                {saving ? 'Saving…' : 'Approve & Assess'}
              </button>
            </div>
          )}

          {isGraded && (
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
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

export default function SupervisorReports() {
  const { user: me }     = useAuth();
  const [reports,     setReports    ] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [search,      setSearch     ] = useState('');
  const [filter,      setFilter     ] = useState('all');
  const [assessModal, setAssessModal] = useState(null);
  const [toasts,      setToasts     ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/supervisor/reports')
      .then(r => {
        const list = r.data?.data || r.data || [];
        // Block final reports — supervisor only handles weekly/monthly
        const filtered = (Array.isArray(list) ? list : []).filter(rep => rep.type !== 'final');
        setReports(filtered);
      })
      .catch(() => showToast('Failed to load reports', 'error'))
      .finally(() => setLoading(false));
  }, []);

  function handleAssessmentSaved(updated) {
    setReports(prev => prev.map(r => r._id === updated._id ? updated : r));
    showToast('Assessment submitted successfully');
  }

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const gradedCount  = reports.filter(r => r.status === 'graded' || r.status === 'approved').length;

  const displayed = reports.filter(r => {
    const matchFilter =
      filter === 'all'     ? true :
      filter === 'pending' ? r.status === 'pending' :
      ['graded','approved'].includes(r.status);
    const q = search.toLowerCase();
    const matchSearch = !q
      || r.student?.name?.toLowerCase().includes(q)
      || r.title?.toLowerCase().includes(q)
      || r.type?.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
          {[0,1].map(i => (
            <div key={i} style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={46} h={46} r={10} />
              <Sk w={120} h={14} />
            </div>
          ))}
        </div>
        <div style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #E8E9EF' }}>
            <Sk h={36} r={8} />
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <tbody>
              {[...Array(8)].map((_,i) => (
                <tr key={i} style={{ borderBottom:'1px solid #F5F6FA' }}>
                  <td style={{ padding:'13px 16px' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={120} h={13} /></div></td>
                  <td style={{ padding:'13px 16px' }}><Sk w={140} h={13} /></td>
                  <td style={{ padding:'13px 16px' }}><Sk w={60} h={22} r={20} /></td>
                  <td style={{ padding:'13px 16px' }}><Sk w={80} h={13} /></td>
                  <td style={{ padding:'13px 16px' }}><Sk w={80} h={22} r={20} /></td>
                  <td style={{ padding:'13px 16px' }}><Sk w={80} h={32} r={8} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        {/* Stat Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
          {[
            { label:'Pending Review', count:pendingCount, color:'#D97706', bg:'#FEF3C7' },
            { label:'Assessed',       count:gradedCount,  color:'#059669', bg:'#D1FAE5' },
          ].map(c => (
            <div key={c.label} style={{
              background:'#fff', border:'1px solid #E8E9EF', borderRadius:12,
              padding:'16px 20px', display:'flex', alignItems:'center', gap:14
            }}>
              <div style={{
                width:46, height:46, borderRadius:10, background:c.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:22, fontWeight:700, color:c.color, flexShrink:0
              }}>{c.count}</div>
              <div style={{ fontSize:13, color:'#4B5563', fontWeight:500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Table Card */}
        <div style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, overflow:'hidden' }}>

          {/* Toolbar */}
          <div style={{
            padding:'14px 20px', borderBottom:'1px solid #E8E9EF',
            display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'
          }}>
            <input
              className="admin-search"
              style={{ flex:1, minWidth:200, height:36 }}
              placeholder="Search by trainee name or report title…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ display:'flex', gap:6 }}>
              {[
                ['pending', `Pending (${pendingCount})`],
                ['graded',  `Assessed (${gradedCount})`],
                ['all',     `All (${reports.length})`],
              ].map(([val, label]) => (
                <button
                  key={val}
                  className={`filter-tab${filter === val ? ' active' : ''}`}
                  onClick={() => setFilter(val)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trainee</th>
                  <th>Report Title</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign:'center', padding:32, color:'#8B8FA8' }}>
                      No reports found
                    </td>
                  </tr>
                )}
                {displayed.map((r, i) => (
                  <tr key={r._id} style={{ background: r.status==='pending' ? '#FFFEF5' : '#fff' }}>
                    <td style={{ color:'#8B8FA8' }}>{i + 1}</td>

                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {r.student?.photoUrl
                          ? <img src={`${API_BASE}${r.student.photoUrl}`} alt="" className="cell-photo" />
                          : <div className="cell-initials">{r.student?.initials || r.student?.name?.[0] || '?'}</div>
                        }
                        <div>
                          <strong>{r.student?.name || '—'}</strong>
                          {r.student?.studentId && (
                            <div style={{ fontSize:11, color:'#8B8FA8' }}>IMA: {r.student.studentId}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ maxWidth:180 }}>
                      <div style={{ fontWeight:500, color:'#1B1464', fontSize:13 }}>{r.title}</div>
                    </td>

                    <td>
                      <span className={r.type==='monthly' ? 'badge badge-amber' : 'badge badge-blue'}>
                        {r.type}
                      </span>
                    </td>

                    <td style={{ whiteSpace:'nowrap' }}>{fmtDate(r.date)}</td>

                    <td>
                      {r.fileUrl
                        ? <a href={`${API_BASE}${r.fileUrl}`} target="_blank" rel="noreferrer"
                             style={{ color:'#185FA5', fontSize:13, fontWeight:500 }}>
                            View ↗
                          </a>
                        : <span style={{ color:'#D1D5DB', fontSize:12 }}>None</span>
                      }
                    </td>

                    <td>
                      {(r.status==='graded' || r.status==='approved') ? (
                        <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'#D1FAE5', color:'#065F46' }}>Assessed</span>
                      ) : r.status === 'rejected' ? (
                        <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'#FEE2E2', color:'#991B1B' }}>Rejected</span>
                      ) : (
                        <span style={{ fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20, background:'#FEF3C7', color:'#92400E' }}>Pending</span>
                      )}
                    </td>

                    <td>
                      {r.status === 'pending' ? (
                        <button
                          className="btn-primary"
                          style={{ fontSize:12, padding:'6px 14px' }}
                          onClick={() => setAssessModal(r)}
                        >
                          Assess
                        </button>
                      ) : (
                        <button
                          className="btn-action edit"
                          onClick={() => setAssessModal(r)}
                        >
                          View
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {assessModal && (
          <AssessmentModal
            report={assessModal}
            supervisor={me}
            onClose={() => setAssessModal(null)}
            onSaved={handleAssessmentSaved}
          />
        )}

        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
      </main>
    </>
  );
}
