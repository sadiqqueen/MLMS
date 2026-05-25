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
  { key: 'na',    label: 'N/A',            color: '#b2bec3' },
  { key: 'below', label: 'Below Standard', color: '#FF4757' },
  { key: 'meets', label: 'Meets Standard', color: '#f39c12' },
  { key: 'above', label: 'Above Standard', color: '#00B894' },
];

const LETTER_GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function GradeModal({ report, programDirector, onClose, onSaved }) {
  const isGraded = report.status === 'graded';

  const [criteria,     setCriteria    ] = useState(report.assessmentCriteria || {});
  const [globalRating, setGlobalRating] = useState(report.globalRating       || '');
  const [letterGrade,  setLetterGrade ] = useState(
    report.grade && !['Competent','Not-Competent','graded'].includes(report.grade)
      ? report.grade : ''
  );
  const [comments, setComments] = useState(report.assessorComments || report.reviewNote || '');
  const [saving,   setSaving  ] = useState(false);
  const [error,    setError   ] = useState('');

  function toggleCriteria(name, key) {
    if (isGraded) return;
    setCriteria(p => ({ ...p, [name]: p[name] === key ? '' : key }));
  }

  async function handleGrade() {
    if (!globalRating) {
      setError('Please select a global rating (Competent or Not-Competent).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/api/program-director/reports/${report._id}/grade`, {
        grade:              letterGrade || (globalRating === 'competent' ? 'Competent' : 'Not-Competent'),
        globalRating,
        assessmentCriteria: criteria,
        assessorComments:   comments,
        reviewNote:         comments,
      });
      onSaved(res.data?.data || res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit grade.');
      setSaving(false);
    }
  }

  const rota    = report.rotation;
  const rotaStr = rota ? `${fmtDate(rota.startDate)} – ${fmtDate(rota.endDate)}` : '—';

  return (
    <div
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,.5)',
        zIndex:2000, display:'flex', alignItems:'center',
        justifyContent:'center', padding:20, overflowY:'auto'
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background:'#fff', borderRadius:16, width:'100%', maxWidth:700,
        boxShadow:'0 20px 60px rgba(0,0,0,.2)',
        maxHeight:'90vh', overflowY:'auto'
      }}>
        {/* Header */}
        <div style={{
          display:'flex', alignItems:'flex-start', justifyContent:'space-between',
          padding:'20px 24px', borderBottom:'1px solid #E8E9EF',
          position:'sticky', top:0, background:'#fff', zIndex:10
        }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'#1B1464' }}>
              {isGraded ? 'Final Report — Graded' : 'Grade Final Report'}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:4, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{
                fontSize:11, padding:'2px 9px', borderRadius:20,
                fontWeight:600, background:'#FEE2E2', color:'#991B1B'
              }}>Final Report</span>
              <span style={{ fontSize:12, color:'#8B8FA8' }}>{report.title}</span>
              {isGraded && (
                <span style={{
                  fontSize:11, padding:'2px 9px', borderRadius:20,
                  fontWeight:600, background:'#D1FAE5', color:'#065F46'
                }}>Graded</span>
              )}
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

          {/* PD grading notice */}
          {!isGraded && (
            <div style={{
              background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10,
              padding:'12px 16px', marginBottom:20, display:'flex', gap:10, alignItems:'flex-start'
            }}>
              <div style={{ fontSize:18 }}>📋</div>
              <div style={{ fontSize:13, color:'#1E40AF', lineHeight:1.6 }}>
                <strong>Program Director grading.</strong> You are grading this final report.
                Weekly and monthly reports are assessed by the supervising physician.
              </div>
            </div>
          )}

          {/* Trainee info */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#8B8FA8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
              Trainee Information
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 20px' }}>
              {[
                ['Name',           report.student?.name      || '—'],
                ['Student ID',     report.student?.studentId || '—'],
                ['Date Submitted', fmtDate(report.date)],
                ['Hospital',       report.hospital?.name     || '—'],
                ['Rotation',       rotaStr],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize:11, color:'#8B8FA8', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:13, color:'#1B1464', fontWeight:500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Assessor info */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#8B8FA8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:10 }}>
              Program Director (Assessor)
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 20px' }}>
              {[
                ['Name',    programDirector?.name    || report.gradedBy?.name || '—'],
                ['Email',   programDirector?.email   || '—'],
                ['Hospital',report.hospital?.name    || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize:11, color:'#8B8FA8', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:13, color:'#1B1464', fontWeight:500 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* File link */}
          {report.fileUrl && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#8B8FA8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
                Report File
              </div>
              <a
                href={`${API_BASE}${report.fileUrl}`}
                target="_blank" rel="noreferrer"
                style={{
                  display:'inline-flex', alignItems:'center', gap:7,
                  padding:'8px 16px', borderRadius:8, background:'#EFF6FF',
                  color:'#2563EB', fontWeight:500, fontSize:13, textDecoration:'none',
                  border:'1px solid #BFDBFE'
                }}
              >
                📄 View Final Report PDF ↗
              </a>
            </div>
          )}

          {/* ASR Criteria */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#8B8FA8', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:12 }}>
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
                  gap:6, padding:'8px 0',
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
                          transition:'all .12s',
                          opacity: isGraded && !sel ? 0.5 : 1
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
            <div style={{ fontSize:12, fontWeight:700, color:'#4B5563', marginBottom:10 }}>
              Global Rating *
            </div>
            <div style={{ display:'flex', gap:12 }}>
              {['competent','not-competent'].map(val => {
                const active = globalRating === val;
                const color  = val === 'competent' ? '#00B894' : '#FF4757';
                return (
                  <button
                    key={val} type="button"
                    disabled={isGraded}
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

          {/* Letter Grade (optional) */}
          {!isGraded && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'#4B5563', marginBottom:8 }}>
                Letter Grade (optional)
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {LETTER_GRADES.map(g => {
                  const active = letterGrade === g;
                  return (
                    <button
                      key={g} type="button"
                      onClick={() => setLetterGrade(active ? '' : g)}
                      style={{
                        width:40, height:40, borderRadius:'50%',
                        border: active ? '2px solid #185FA5' : '1.5px solid #D1D5DB',
                        background: active ? '#185FA5' : 'white',
                        color: active ? 'white' : '#444',
                        fontSize:12, fontWeight:700, cursor:'pointer', transition:'all .12s'
                      }}
                    >{g}</button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comments */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#4B5563', marginBottom:6 }}>
              {isGraded ? 'Assessment Notes' : 'Comments / Feedback (shown to trainee)'}
            </div>
            <textarea
              disabled={isGraded}
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Enter feedback for the trainee…"
              style={{
                width:'100%', minHeight:90, padding:'10px 12px',
                border:'1.5px solid #E8E9EF', borderRadius:8, fontSize:13,
                color:'#1B1464', resize:'vertical', fontFamily:'inherit',
                background: isGraded ? '#F5F6FA' : '#fff'
              }}
            />
          </div>

          {/* Graded confirmation banner */}
          {isGraded && (
            <div style={{
              background:'#D1FAE5', border:'1px solid #059669',
              borderRadius:10, padding:'14px 16px', marginBottom:16,
              display:'flex', alignItems:'center', gap:10
            }}>
              <div style={{ fontSize:20 }}>✓</div>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#065F46' }}>
                  Final report graded
                </div>
                <div style={{ fontSize:12, color:'#047857', marginTop:2 }}>
                  Grade: {report.grade} · Global: {report.globalRating} ·
                  By {report.gradedBy?.name || '—'} on {fmtDate(report.gradedAt)}
                </div>
              </div>
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

          {/* Action buttons */}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            {!isGraded ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding:'9px 20px', borderRadius:8, background:'#fff',
                    color:'#4B5563', border:'1.5px solid #E8E9EF',
                    fontWeight:500, fontSize:13, cursor:'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGrade}
                  disabled={saving}
                  style={{
                    padding:'9px 24px', borderRadius:8, background:'#FF6B35',
                    color:'#fff', border:'none', fontWeight:600, fontSize:13,
                    cursor:'pointer', boxShadow:'0 2px 8px rgba(255,107,53,.35)',
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  {saving ? 'Submitting…' : 'Submit Grade'}
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                style={{
                  padding:'9px 20px', borderRadius:8, background:'#FF6B35',
                  color:'#fff', border:'none', fontWeight:500, fontSize:13, cursor:'pointer'
                }}
              >Close</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProgramDirectorReports() {
  const { user: me }    = useAuth();
  const [reports,    setReports   ] = useState([]);
  const [loading,    setLoading   ] = useState(true);
  const [search,     setSearch    ] = useState('');
  const [filter,     setFilter    ] = useState('all');
  const [gradeModal, setGradeModal] = useState(null);
  const [toasts,     setToasts    ] = useState([]);

  function showToast(msg, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }

  useEffect(() => {
    api.get('/api/program-director/reports')
      .then(r => {
        const list = r.data?.data || r.data || [];
        setReports(Array.isArray(list) ? list : []);
      })
      .catch(() => showToast('Failed to load reports', 'error'))
      .finally(() => setLoading(false));
  }, []);

  function handleSaved(updated) {
    setReports(prev => prev.map(r => r._id === updated._id ? updated : r));
    showToast('Final report graded — trainee notified');
  }

  const pendingCount = reports.filter(r => r.status !== 'graded').length;
  const gradedCount  = reports.filter(r => r.status === 'graded').length;

  const displayed = reports.filter(r => {
    const matchFilter =
      filter === 'all'     ? true :
      filter === 'pending' ? r.status !== 'graded' :
      r.status === 'graded';
    const q = search.toLowerCase();
    const matchSearch = !q
      || r.student?.name?.toLowerCase().includes(q)
      || r.title?.toLowerCase().includes(q)
      || (r.hospital?.name || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:'16px 20px', display:'flex', alignItems:'center', gap:14 }}>
              <Sk w={46} h={46} r={10} /><Sk w={110} h={14} />
            </div>
          ))}
        </div>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(6)].map((_,i) => (
                  <tr key={i}>
                    <td><Sk w={20} h={13} /></td>
                    <td><div style={{ display:'flex', alignItems:'center', gap:8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                    <td><Sk w={160} h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
                    <td><Sk w={70}  h={22} r={20} /></td>
                    <td><Sk w={80}  h={28} r={8} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        {/* Stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
          {[
            { label:'Total Final Reports', count: reports.length,  color:'#2563EB', bg:'#DBEAFE' },
            { label:'Pending Grading',     count: pendingCount,     color:'#D97706', bg:'#FEF3C7' },
            { label:'Graded',              count: gradedCount,      color:'#059669', bg:'#D1FAE5' },
          ].map(c => (
            <div key={c.label} style={{
              background:'#fff', border:'1px solid #E8E9EF', borderRadius:12,
              padding:'16px 20px', display:'flex', alignItems:'center', gap:14
            }}>
              <div style={{
                width:46, height:46, borderRadius:10, background:c.bg,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:20, fontWeight:700, color:c.color, flexShrink:0
              }}>{c.count}</div>
              <div style={{ fontSize:13, color:'#4B5563', fontWeight:500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="admin-card">
          <div className="admin-toolbar" style={{ flexWrap:'wrap', gap:10 }}>
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
                ['graded',  `Graded (${gradedCount})`],
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

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trainee</th>
                  <th>Report Title</th>
                  <th>Date</th>
                  <th>File</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign:'center', padding:40, color:'#8B8FA8' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>📄</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'#4B5563', marginBottom:4 }}>
                        No final reports found
                      </div>
                      <div style={{ fontSize:13 }}>
                        {reports.length === 0
                          ? 'No final reports have been submitted in this hospital yet.'
                          : 'Try a different filter or search term.'}
                      </div>
                    </td>
                  </tr>
                )}
                {displayed.map((r, i) => (
                  <tr key={r._id} style={{ background: r.status !== 'graded' ? '#FFFEF5' : '#fff' }}>
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

                    <td style={{ maxWidth:200 }}>
                      <div style={{ fontWeight:500, color:'#1B1464', fontSize:13 }}>{r.title}</div>
                      <div style={{ fontSize:11, color:'#8B8FA8' }}>{r.hospital?.name || ''}</div>
                    </td>

                    <td style={{ whiteSpace:'nowrap', fontSize:13, color:'#4B5563' }}>
                      {fmtDate(r.date)}
                    </td>

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
                      {r.status === 'graded' ? (
                        <span style={{
                          fontSize:11, fontWeight:600, padding:'3px 9px',
                          borderRadius:20, background:'#D1FAE5', color:'#065F46'
                        }}>
                          Graded {r.grade ? `· ${r.grade}` : ''}
                        </span>
                      ) : (
                        <span style={{
                          fontSize:11, fontWeight:600, padding:'3px 9px',
                          borderRadius:20, background:'#FEF3C7', color:'#92400E'
                        }}>Pending</span>
                      )}
                    </td>

                    <td>
                      {r.status !== 'graded' ? (
                        <button
                          className="btn-primary"
                          style={{ fontSize:12, padding:'6px 14px' }}
                          onClick={() => setGradeModal(r)}
                        >
                          Grade
                        </button>
                      ) : (
                        <button
                          className="btn-action edit"
                          onClick={() => setGradeModal(r)}
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

        {gradeModal && (
          <GradeModal
            report={gradeModal}
            programDirector={me}
            onClose={() => setGradeModal(null)}
            onSaved={handleSaved}
          />
        )}

        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
      </main>
    </>
  );
}
