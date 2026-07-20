import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api    from '../api/axios';
import Navbar from '../components/Navbar';
import Sk     from '../components/Skeleton';
import StatCard from '../components/StatCard';
import LineChart from '../components/charts/LineChart';
import RevealOnScroll from '../components/RevealOnScroll';
import { getForm, scoreMeta } from '../data/evalForms';
import { printEvaluation } from '../utils/printEvaluation';
import { IconCheck, IconClock, IconEye, NavIcon } from '../components/icons';
import ReportModal from '../components/ReportModal';
import './trainee.css';

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
  const g = reps.filter(r => gradeToGpa(r.grade) !== null);
  if (!g.length) return null;
  return g.reduce((s, r) => s + gradeToGpa(r.grade), 0) / g.length;
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

// One evaluation (Mini-CEX / CbD / DOPS) — expandable to show the per-competency
// scores and structured feedback captured by the evaluator.
function EvalCard({ ev, traineeName }) {
  const [open, setOpen] = useState(false);

  const supName  = ev.supervisorId?.name || ev.doctor?.name || 'Evaluator';
  const type     = ev.evaluationType || ev.type || '';
  const form     = getForm(type);
  const fd       = ev.formData || {};
  const overall  = ev.grade || fd.globalRating || RATING_LABEL[ev.scores?.overall] || '';
  const accent   = form?.accent || 'var(--brand-primary)';

  const domainRows = form?.domains
    ? form.domains
        .map(d => ({ label: d.label, value: fd.domains?.[d.key] }))
        .filter(r => r.value !== undefined && r.value !== null && r.value !== '')
    : [];

  const feedbackRows = form?.feedback
    ? form.feedback.map(f => ({ label: f.label, text: fd.feedback?.[f.key] })).filter(r => r.text)
    : [];

  const hasDetail = domainRows.length > 0 || feedbackRows.length > 0 || fd.supervisionLevel;

  return (
    <div style={{
      border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px',
      background: ev.isFinalized ? 'var(--success-bg)' : 'var(--surface-2)',
      borderInlineStart:`4px solid ${accent}`
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            {type && (
              <span className="mt-pill mt-pill--capacity">{form?.title || type}</span>
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
          <div style={{ fontSize:12, color:'var(--text-2)', marginBlockStart:4 }}>
            By {supName} · {fmt(ev.sentToTraineeAt || ev.createdAt)}
          </div>
          {ev.hospital?.name && (
            <div style={{ fontSize:12, color:'var(--text-2)' }}>{ev.hospital.name}</div>
          )}
        </div>
        {ev.totalScore !== undefined && ev.totalScore !== null && (
          <div style={{ textAlign:'end' }}>
            <div style={{ fontSize:22, fontWeight:700, color:'var(--text)', lineHeight:1 }}>
              {Math.round(ev.totalScore * 10) / 10}
            </div>
            <div style={{ fontSize:11, color:'var(--text-2)' }}>avg / 10</div>
          </div>
        )}
      </div>

      {hasDetail && open && (
        <div style={{ marginBlockStart:12, borderTop:'1px solid var(--border-soft)', paddingBlockStart:12 }}>
          {fd.supervisionLevel && (
            <div style={{ fontSize:12.5, color:'var(--text-2)', marginBlockEnd:10 }}>
              <strong>Supervision level:</strong> {fd.supervisionLevel}
            </div>
          )}
          {domainRows.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBlockEnd:feedbackRows.length ? 12 : 0 }}>
              {domainRows.map(r => {
                const m = scoreMeta(r.value);
                return (
                  <div key={r.label} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{
                      width:26, height:22, flexShrink:0, borderRadius:6, fontSize:11, fontWeight:800,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      background:m?.bg || 'var(--surface-3)', color:m?.color || 'var(--text-2)'
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
            <div key={r.label} style={{ marginBlockEnd:8 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'.04em' }}>{r.label}</div>
              <div style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.5 }}>{r.text}</div>
            </div>
          ))}
        </div>
      )}

      {!hasDetail && (ev.comments || ev.notes) && (
        <div style={{ fontSize:13, color:'var(--text-2)', marginBlockStart:8, padding:'8px 10px', background:'var(--surface-3)', borderRadius:7, lineHeight:1.6, whiteSpace:'pre-line' }}>
          {ev.comments || ev.notes}
        </div>
      )}

      <div style={{ marginBlockStart:10, display:'flex', alignItems:'center', gap:16 }}>
        {hasDetail && (
          <button onClick={() => setOpen(o => !o)}
            style={{ padding:0, background:'none', border:'none', color:accent, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            {open ? 'Hide details ▲' : 'View full assessment ▼'}
          </button>
        )}
        <button onClick={() => printEvaluation(ev, { traineeName })} title="Print evaluation form"
          style={{ padding:0, background:'none', border:'none', color:'var(--text-2)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
          Print
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
  const [viewReport,  setViewReport ] = useState(null);

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
      <main className="mt-content">
        <div className="mt-stat-grid">
          {[0,1,2].map(i => <Sk key={i} h={100} r={12} />)}
        </div>
        <div className="mt-card" style={{ marginBlockStart: 16 }}>
          <Sk w={180} h={16} style={{ marginBottom:14 }} />
          <Sk h={220} r={8} />
        </div>
      </main>
    </>
  );

  const reportList = safeArr(reports);
  const evalList   = safeArr(evaluations);
  const finalList  = safeArr(finalGrades);

  // Evaluations search + type filter
  const evalTypeOf = ev => ev.evaluationType || ev.type || 'Other';
  const evalTypes  = [...new Set(evalList.map(evalTypeOf))];
  const evalQuery  = evalSearch.trim().toLowerCase();
  const filteredEvals = evalList.filter(ev => {
    if (evalType !== 'all' && evalTypeOf(ev) !== evalType) return false;
    if (!evalQuery) return true;
    const hay = `${ev.supervisorId?.name || ev.doctor?.name || ''} ${evalTypeOf(ev)} ${ev.comments || ev.notes || ''} ${ev.hospital?.name || ''}`.toLowerCase();
    return hay.includes(evalQuery);
  });
  const graded     = reportList.filter(r => (r.status === 'graded' || r.status === 'approved') && r.grade);
  const overallAvg = calcAvg(graded);
  const gpaDisplay = overallAvg !== null ? overallAvg.toFixed(1) : '—';

  const byHospital = {};
  reportList.forEach(r => {
    const key = r.hospital?.name ?? 'Unknown';
    if (!byHospital[key]) byHospital[key] = [];
    byHospital[key].push(r);
  });

  const sorted = [...graded].sort((a,b) => new Date(a.date) - new Date(b.date));
  const gpaValues = sorted.map(r => gradeToGpa(r.grade));
  const gpaLabels = sorted.map(r => fmt(r.date));

  return (
    <>
      <Navbar />
      <main className="mt-content">

        {/* ── STAT CARDS ── */}
        <div className="mt-stat-grid">
          <RevealOnScroll delay={0}>
            <div className="mt-stat">
              <div className="mt-stat-ic"><NavIcon name="award" size={19} /></div>
              <div className="mt-stat-value">{gpaDisplay}
                <span style={{ fontSize:13, fontWeight:500, color:'var(--text-2)', marginInlineStart:6 }}>/ 4.0</span>
              </div>
              <div className="mt-stat-label">Overall GPA</div>
            </div>
          </RevealOnScroll>
          <RevealOnScroll delay={0.055}>
            <StatCard label="Evaluations received" value={evalList.length} icon="doc" />
          </RevealOnScroll>
          <RevealOnScroll delay={0.11}>
            <StatCard label="Final reports graded" value={finalList.length} icon="check" />
          </RevealOnScroll>
        </div>

        {/* ── EVALUATIONS ── */}
        {evalList.length > 0 && (
          <div className="mt-card" style={{ marginBlockStart: 16 }}>
            <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 14 }}>
              <div className="mt-card-title">Evaluations</div>
              <span className="mt-count">{evalList.length}</span>
            </div>

            <div className="mt-filterbar">
              <div className="mt-search">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input type="text" placeholder="Search evaluations (evaluator, type, comment)…"
                  value={evalSearch} onChange={e => setEvalSearch(e.target.value)} />
              </div>
              <select className="mt-filter" value={evalType} onChange={e => setEvalType(e.target.value)}>
                <option value="all">All types</option>
                {evalTypes.map(ty => <option key={ty} value={ty}>{getForm(ty)?.title || ty}</option>)}
              </select>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filteredEvals.length === 0
                ? <div style={{ fontSize: 13, color: 'var(--text-2)', padding: '10px 2px' }}>No evaluations match your search.</div>
                : filteredEvals.map(ev => <EvalCard key={ev._id} ev={ev} traineeName={user?.name} />)}
            </div>
          </div>
        )}

        {/* ── FINAL REPORT GRADES (from Program Director) ── */}
        {finalList.length > 0 && (
          <div className="mt-card" style={{ marginBlockStart: 16 }}>
            <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 14 }}>
              <div className="mt-card-title">Final report grades</div>
              <span className="mt-pill mt-pill--role">Program Director</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {finalList.map(r => (
                <div key={r._id} style={{
                  border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px',
                  background:'var(--surface-2)', borderInlineStart:'4px solid var(--accent)'
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Final Report</div>
                      <div style={{ fontSize:12, color:'var(--text-2)', marginBlockStart:3 }}>
                        Graded by {r.gradedBy?.name || 'Program Director'} · {fmt(r.gradedAt)}
                      </div>
                      {r.hospital?.name && <div style={{ fontSize:12, color:'var(--text-2)' }}>{r.hospital.name}</div>}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                      {r.grade && (
                        <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--brand-primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700 }}>
                          {r.grade}
                        </div>
                      )}
                      {hasScore(r) && (
                        <span className="mt-pill mt-pill--capacity">{r.score}/100</span>
                      )}
                      {!r.grade && !hasScore(r) && (
                        <span className="mt-pill mt-pill--neutral">{gradeLabel(r)}</span>
                      )}
                      {r.globalRating && (
                        <span className={`mt-pill ${r.globalRating==='competent' ? 'mt-pill--active' : 'mt-pill--rejected'}`}>
                          {r.globalRating==='competent' ? 'Competent' : 'Not-Competent'}
                        </span>
                      )}
                    </div>
                  </div>
                  {r.assessorComments && (
                    <div style={{ fontSize:13, color:'var(--text-2)', marginBlockStart:8, padding:'8px 10px', background:'var(--surface)', borderRadius:7, lineHeight:1.6 }}>
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
          <RevealOnScroll chart className="mt-card mt-card--chart" style={{ marginBlockStart: 16 }}>
            <div className="mt-card-head">
              <div style={{ minWidth: 0 }}>
                <div className="mt-card-title">Grade progress over time</div>
                <div className="mt-card-sub">GPA equivalent per assessment</div>
              </div>
              <div className="mt-divider" />
            </div>
            <LineChart values={gpaValues} labels={gpaLabels} />
          </RevealOnScroll>
        )}

        {/* ── HOSPITAL REPORT BREAKDOWN ── */}
        {Object.entries(byHospital).map(([name, reps]) => {
          const avg    = calcAvg(reps);
          const isOpen = !collapsed[name];
          return (
            <div className="mt-card" key={name} style={{ marginBlockStart: 16 }}>
              <button onClick={() => setCollapsed(c => ({ ...c, [name]:!c[name] }))}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', background:'none', border:'none', padding:0, cursor:'pointer' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span className="mt-card-title">{name}</span>
                  {avg !== null && <span className="mt-pill mt-pill--capacity">Avg GPA: {avg.toFixed(1)}</span>}
                </div>
                <span style={{ color:'var(--text-2)' }}>{isOpen ? '▲' : '▼'}</span>
              </button>
              {isOpen && (
                <div className="mt-table-wrap" style={{ marginBlockStart: 14 }}>
                  <table className="mt-table">
                    <thead>
                      <tr>
                        <th className="mt-th">Report</th><th className="mt-th">Type</th><th className="mt-th">Date</th>
                        <th className="mt-th">Status</th><th className="mt-th">Grade</th><th className="mt-th">Graded by</th><th className="mt-th"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reps.map(r => {
                        const isGraded = r.status==='graded' || r.status==='approved';
                        return (
                        <tr key={r._id}>
                          <td className="mt-td mt-td--name">{r.title}</td>
                          <td className="mt-td"><span className="mt-pill mt-pill--role">{r.type}</span></td>
                          <td className="mt-td mt-td--mono">{fmt(r.date)}</td>
                          <td className="mt-td"><span className={isGraded ? 'status-ic status-ic-green' : 'status-ic status-ic-amber'} title={isGraded ? 'Graded' : 'Pending'}>{isGraded ? <IconCheck size={15} /> : <IconClock size={15} />}</span></td>
                          <td className="mt-td"><div className={`grade-circle${r.grade ? '' : ' grade-empty'}`}>{gradeLabel(r)}</div></td>
                          <td className="mt-td mt-td--muted">{r.gradedBy?.name ?? '—'}</td>
                          <td className="mt-td mt-td--actions">
                            <button type="button" className="mt-icon-action" title="View report" aria-label="View report" onClick={() => setViewReport(r)}>
                              <IconEye size={16} />
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {reportList.length === 0 && evalList.length === 0 && finalList.length === 0 && (
          <div className="mt-empty" style={{ marginBlockStart: 16 }}>
            <span className="mt-empty-icon"><NavIcon name="award" size={24} /></span>
            <div className="mt-empty-title">No grades yet</div>
            <div className="mt-empty-sub">Grades will appear here once your evaluator assesses your reports and evaluations.</div>
          </div>
        )}

      </main>

      {viewReport && (
        <ReportModal report={viewReport} student={user} onClose={() => setViewReport(null)} />
      )}
    </>
  );
}
