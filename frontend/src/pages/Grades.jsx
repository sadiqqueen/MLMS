import { useState, useEffect } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import api    from '../api/axios';
import Navbar from '../components/Navbar';
import Sk     from '../components/Skeleton';
import { getForm, scoreMeta } from '../data/evalForms';
import { printEvaluation } from '../utils/printEvaluation';
import { IconCheck, IconClock } from '../components/icons';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function fmt(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function safeArr(value) {
  return Array.isArray(value) ? value : [];
}

function gradeToGpa(grade) {
  const map = { 'A':4.0,'A-':3.7,'B+':3.3,'B':3.0,'B-':2.7,'C+':2.3,'C':2.0,'C-':1.7,'D':1.0,'F':0 };
  return map[grade] ?? null;
}

function calcAvg(reps) {
  const g = reps.filter(r => r.grade);
  if (!g.length) return null;
  return g.reduce((s, r) => s + (gradeToGpa(r.grade) ?? 0), 0) / g.length;
}

function hasScore(report) {
  return report?.score !== undefined && report?.score !== null;
}

function gradeLabel(report) {
  const parts = [];
  if (report?.grade) parts.push(report.grade);
  if (hasScore(report)) parts.push(`${report.score}/100`);
  if (!parts.length && report?.globalRating) parts.push(report.globalRating);
  return parts.join(' / ') || '-';
}

const RATING_LABEL = { na:'N/A', below:'Below Standard', meets:'Meets Standard', above:'Above Standard' };
const RATING_COLOR = { na:'#b2bec3', below:'#FF4757', meets:'#f39c12', above:'#00B894' };

// One supervisor evaluation (Mini-CEX / CbD / DOPS) — expandable to show the
// per-competency scores and structured feedback captured by the supervisor.
function EvalCard({ ev, traineeName }) {
  const [open, setOpen] = useState(false);

  const supName  = ev.supervisorId?.name || ev.doctor?.name || 'Supervisor';
  const type     = ev.evaluationType || ev.type || '';
  const form     = getForm(type);
  const fd       = ev.formData || {};
  const overall  = ev.grade || fd.globalRating || RATING_LABEL[ev.scores?.overall] || '';
  const accent   = form?.accent || '#185FA5';

  const domainRows = form
    ? form.domains
        .map(d => ({ label: d.label, value: fd.domains?.[d.key] }))
        .filter(r => r.value !== undefined && r.value !== null && r.value !== '')
    : [];

  const feedbackRows = form
    ? form.feedback.map(f => ({ label: f.label, text: fd.feedback?.[f.key] })).filter(r => r.text)
    : [];

  const hasDetail = domainRows.length > 0 || feedbackRows.length > 0 || fd.supervisionLevel;

  return (
    <div style={{
      border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px',
      background: ev.isFinalized ? 'var(--success-bg)' : 'var(--surface-2)',
      borderLeft:`4px solid ${accent}`
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {type && (
              <span style={{ fontSize:11, background:`${accent}22`, color:accent, borderRadius:5, padding:'2px 8px', fontWeight:800, textTransform:'uppercase' }}>
                {form?.title || type}
              </span>
            )}
            <span
              className={ev.isFinalized ? 'status-ic status-ic-green' : 'status-ic status-ic-amber'}
              style={{ width:24, height:24 }}
              title={ev.isFinalized ? 'Graded' : 'Pending'}
            >
              {ev.isFinalized ? <IconCheck size={14} /> : <IconClock size={14} />}
            </span>
            {overall && <span style={{ fontSize:13, fontWeight:600, color:accent }}>{overall}</span>}
          </div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:4 }}>
            By {supName} · {fmt(ev.sentToTraineeAt || ev.createdAt)}
          </div>
          {ev.hospital?.name && (
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>🏥 {ev.hospital.name}</div>
          )}
        </div>
        {ev.totalScore !== undefined && ev.totalScore !== null && (
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--text)', lineHeight:1 }}>
              {Math.round(ev.totalScore * 10) / 10}
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>avg / 10</div>
          </div>
        )}
      </div>

      {hasDetail && open && (
        <div style={{ marginTop:12, borderTop:'1px solid var(--border-soft)', paddingTop:12 }}>
          {fd.supervisionLevel && (
            <div style={{ fontSize:12.5, color:'var(--text-2)', marginBottom:10 }}>
              <strong>Supervision level:</strong> {fd.supervisionLevel}
            </div>
          )}
          {domainRows.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:feedbackRows.length ? 12 : 0 }}>
              {domainRows.map(r => {
                const m = scoreMeta(r.value);
                return (
                  <div key={r.label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{
                      width:26, height:22, flexShrink:0, borderRadius:6, fontSize:11, fontWeight:800,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      background:m?.bg || 'var(--surface-3)', color:m?.color || 'var(--text-muted)'
                    }}>
                      {m?.short || r.value}
                    </span>
                    <span style={{ fontSize:12.5, color:'var(--text-2)' }}>{r.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          {feedbackRows.map(r => (
            <div key={r.label} style={{ marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.04em' }}>{r.label}</div>
              <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.5 }}>{r.text}</div>
            </div>
          ))}
        </div>
      )}

      {!hasDetail && (ev.comments || ev.notes) && (
        <div style={{ fontSize:13, color:'var(--text-2)', marginTop:8, padding:'8px 10px', background:'var(--surface-3)', borderRadius:7, lineHeight:1.6, whiteSpace:'pre-line' }}>
          {ev.comments || ev.notes}
        </div>
      )}

      <div style={{ marginTop:10, display:'flex', alignItems:'center', gap:16 }}>
        {hasDetail && (
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              padding:0, background:'none', border:'none',
              color:accent, fontSize:12, fontWeight:600, cursor:'pointer'
            }}
          >
            {open ? 'Hide details ▲' : 'View full assessment ▼'}
          </button>
        )}
        <button
          onClick={() => printEvaluation(ev, { traineeName })}
          title="Print evaluation form"
          style={{
            padding:0, background:'none', border:'none',
            color:'var(--text-2)', fontSize:12, fontWeight:600, cursor:'pointer'
          }}
        >
          🖨 Print
        </button>
      </div>
    </div>
  );
}

export default function Grades() {
  const { user }      = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [finalGrades, setFinalGrades] = useState([]);
  const [reports,     setReports    ] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [collapsed,   setCollapsed  ] = useState({});
  const [evalSearch,  setEvalSearch ] = useState('');
  const [evalType,    setEvalType   ] = useState('all');

  useEffect(() => {
    if (!user) return;

    const v2 = api.get('/api/trainee/grades')
      .then(r => {
        const data = r.data?.data || {};
        setEvaluations(safeArr(data.evaluations));
        setFinalGrades(safeArr(data.finalReports));
      })
      .catch(() => {});

    const v1 = api.get(`/api/reports/student/${user._id}`)
      .then(res => setReports(safeArr(res.data?.data || res.data)))
      .catch(() => {});

    Promise.all([v2, v1]).finally(() => setLoading(false));
  }, [user]);

  if (loading) return (
    <>
      <Navbar />
      <main className="main">
        <div className="stats">
          {[0,1,2].map(i => (
            <div className="stat-card" key={i}>
              <Sk w={90} h={12} />
              <Sk w={120} h={28} style={{ marginTop:8 }} />
            </div>
          ))}
        </div>
        <div className="card">
          <Sk w={180} h={16} style={{ marginBottom:14 }} />
          <Sk h={220} r={8} />
        </div>
      </main>
    </>
  );

  const reportList = safeArr(reports);
  const evalList   = safeArr(evaluations);
  const finalList  = safeArr(finalGrades);

  // Supervisor-evaluations search + type filter
  const evalTypeOf = ev => ev.evaluationType || ev.type || 'Other';
  const evalTypes  = [...new Set(evalList.map(evalTypeOf))];
  const evalQuery  = evalSearch.trim().toLowerCase();
  const filteredEvals = evalList.filter(ev => {
    if (evalType !== 'all' && evalTypeOf(ev) !== evalType) return false;
    if (!evalQuery) return true;
    const hay = `${ev.supervisorId?.name || ev.doctor?.name || ''} ${evalTypeOf(ev)} ${ev.comments || ev.notes || ''} ${ev.hospital?.name || ''}`.toLowerCase();
    return hay.includes(evalQuery);
  });
  const graded     = reportList.filter(r => r.status === 'graded' && r.grade);
  const overallAvg = calcAvg(graded);
  const gpaDisplay = overallAvg !== null ? overallAvg.toFixed(1) : '—';

  const byHospital = {};
  reportList.forEach(r => {
    const key = r.hospital?.name ?? 'Unknown';
    if (!byHospital[key]) byHospital[key] = [];
    byHospital[key].push(r);
  });

  let best = null, bestAvg = -1;
  for (const [name, reps] of Object.entries(byHospital)) {
    const avg = calcAvg(reps);
    if (avg !== null && avg > bestAvg) { bestAvg = avg; best = name; }
  }

  const sorted = [...graded].sort((a,b) => new Date(a.date) - new Date(b.date));
  const chartData = {
    labels: sorted.map(r => fmt(r.date)),
    datasets: [{
      label:'GPA Points',
      data: sorted.map(r => gradeToGpa(r.grade)),
      borderColor:'#185FA5',
      backgroundColor:'rgba(24,95,165,0.08)',
      tension:0.35,
      pointBackgroundColor:'#185FA5',
      pointRadius:5,
      fill:true
    }]
  };
  const chartOptions = {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ display:false } },
    scales:{
      y:{ min:0, max:4.0, ticks:{ stepSize:0.5 }, grid:{ color:'#f0f0f0' } },
      x:{ grid:{ display:false } }
    }
  };

  return (
    <>
      <Navbar />
      <main className="main">

        {/* ── STAT CARDS ── */}
        <div className="stats">
          <div className="stat-card">
            <div className="stat-label">Overall GPA</div>
            <div className="gpa-score" style={{ marginTop:6 }}>
              <span className="gpa-num">{gpaDisplay}</span>
              <span className="gpa-max">/ 4.0</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Evaluations received</div>
            <div className="gpa-score" style={{ marginTop:6 }}>
              <span className="gpa-num gpa-num-sm">{evalList.length}</span>
              <span className="gpa-max">total</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Final reports graded</div>
            <div className="gpa-score" style={{ marginTop:6 }}>
              <span className="gpa-num gpa-num-sm">{finalList.length}</span>
              <span className="gpa-max">total</span>
            </div>
          </div>
        </div>

        {/* ── SUPERVISOR EVALUATIONS ── */}
        {evalList.length > 0 && (
          <div className="card">
            <div className="card-title" style={{ marginBottom:14 }}>
              Supervisor Evaluations
              <span className="badge badge-blue" style={{ marginInlineStart:8 }}>{evalList.length}</span>
            </div>

            <div className="report-search-bar">
              <input
                type="text"
                className="report-search-input"
                placeholder="Search evaluations (supervisor, type, comment)…"
                value={evalSearch}
                onChange={e => setEvalSearch(e.target.value)}
              />
              <select className="report-sort-select" value={evalType} onChange={e => setEvalType(e.target.value)}>
                <option value="all">All types</option>
                {evalTypes.map(t => <option key={t} value={t}>{getForm(t)?.title || t}</option>)}
              </select>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filteredEvals.length === 0
                ? <div className="empty-row">No evaluations match your search.</div>
                : filteredEvals.map(ev => <EvalCard key={ev._id} ev={ev} traineeName={user?.name} />)}
            </div>
          </div>
        )}

        {/* ── FINAL REPORT GRADES (from Program Director) ── */}
        {finalList.length > 0 && (
          <div className="card">
            <div className="card-title" style={{ marginBottom:14 }}>
              Final Report Grades
              <span className="badge" style={{ marginLeft:8, background:'#FEE2E2', color:'#991B1B' }}>Program Director</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {finalList.map(r => (
                <div key={r._id} style={{
                  border:'1px solid #E8E9EF', borderRadius:10, padding:'14px 16px',
                  background:'#FFF9F0', borderLeft:'4px solid #FF6B35'
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1B1464' }}>Final Report</div>
                      <div style={{ fontSize:12, color:'#8B8FA8', marginTop:3 }}>
                        Graded by {r.gradedBy?.name || 'Program Director'} · {fmt(r.gradedAt)}
                      </div>
                      {r.hospital?.name && <div style={{ fontSize:12, color:'#8B8FA8' }}>🏥 {r.hospital.name}</div>}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                      {r.grade && (
                        <div style={{ width:44, height:44, borderRadius:'50%', background:'#1B1464', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 }}>
                          {r.grade}
                        </div>
                      )}
                      {hasScore(r) && (
                        <span style={{ fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:20, background:'#E6F1FB', color:'#185FA5' }}>
                          {r.score}/100
                        </span>
                      )}
                      {!r.grade && !hasScore(r) && (
                        <span style={{ fontSize:12, fontWeight:700, padding:'4px 10px', borderRadius:20, background:'#F5F6FA', color:'#8B8FA8' }}>
                          {gradeLabel(r)}
                        </span>
                      )}
                      {r.globalRating && (
                        <span style={{
                          fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:20,
                          background:r.globalRating==='competent' ? '#D1FAE5' : '#FEE2E2',
                          color:     r.globalRating==='competent' ? '#065F46' : '#991B1B'
                        }}>
                          {r.globalRating==='competent' ? 'Competent' : 'Not-Competent'}
                        </span>
                      )}
                    </div>
                  </div>
                  {r.assessorComments && (
                    <div style={{ fontSize:13, color:'#4B5563', marginTop:8, padding:'8px 10px', background:'#F5F6FA', borderRadius:7, lineHeight:1.6 }}>
                      {r.assessorComments}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GPA CHART ── */}
        {graded.length > 1 && (
          <div className="card">
            <div className="card-title">Grade progress over time</div>
            <div style={{ height:220 }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        )}

        {/* ── HOSPITAL REPORT BREAKDOWN ── */}
        {Object.entries(byHospital).map(([name, reps]) => {
          const avg    = calcAvg(reps);
          const isOpen = !collapsed[name];
          return (
            <div className="card" key={name}>
              <button className="hospital-header" onClick={() => setCollapsed(c => ({ ...c, [name]:!c[name] }))}>
                <div>
                  <span className="hospital-name">{name}</span>
                  {avg !== null && <span className="badge badge-blue" style={{ marginLeft:10 }}>Avg GPA: {avg.toFixed(1)}</span>}
                </div>
                <span className="collapse-icon">{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <table className="grade-table">
                  <thead>
                    <tr><th>Report</th><th>Type</th><th>Date</th><th>Status</th><th>Grade</th><th>Graded by</th></tr>
                  </thead>
                  <tbody>
                    {reps.map(r => (
                      <tr key={r._id}>
                        <td>{r.title}</td>
                        <td><span className="badge badge-blue">{r.type}</span></td>
                        <td>{fmt(r.date)}</td>
                        <td><span className={r.status==='graded' ? 'status-ic status-ic-green' : 'status-ic status-ic-amber'} title={r.status==='graded' ? 'Graded' : 'Pending'} style={{ margin:'0 auto' }}>{r.status==='graded' ? <IconCheck size={15} /> : <IconClock size={15} />}</span></td>
                        <td><div className={`grade-circle${r.grade ? '' : ' grade-empty'}`} style={{ margin:'0 auto' }}>{gradeLabel(r)}</div></td>
                        <td>{r.gradedBy?.name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {reportList.length === 0 && evalList.length === 0 && finalList.length === 0 && (
          <div style={{ textAlign:'center', padding:56, color:'#8B8FA8' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📊</div>
            <div style={{ fontSize:16, fontWeight:600, color:'#4B5563', marginBottom:6 }}>No grades yet</div>
            <div style={{ fontSize:13 }}>Grades will appear here once your supervisor assesses your reports and evaluations.</div>
          </div>
        )}

      </main>
    </>
  );
}
