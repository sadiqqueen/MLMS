import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import api from '../api/axios';
import Sk from '../components/Skeleton';

const API_BASE = '';
const REPORT_TYPES = ['weekly', 'monthly', 'final'];
const GRADE_OPTIONS = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'Competent', 'Not-Competent'];
const EVAL_TYPES = ['Monthly', 'Rotation', 'Remediation', 'Professionalism', 'Other'];
const RATING_OPTIONS = [
  ['na', 'N/A'],
  ['below', 'Below Standard'],
  ['meets', 'Meets Standard'],
  ['above', 'Above Standard'],
];

function safeArr(value) {
  return Array.isArray(value) ? value : [];
}

function fmtDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isGraded(report) {
  return report?.status === 'graded' || !!report?.grade || report?.score !== null && report?.score !== undefined || !!report?.gradedBy;
}

function nameOf(value) {
  return value?.name || '-';
}

function roleLabel(role) {
  const labels = {
    dio: 'DIO',
    super_admin: 'Super Admin',
    supervisor: 'Supervisor',
    program_director: 'Program Director',
    president: 'President',
    trainee: 'Trainee',
  };
  return labels[role] || role || '-';
}

function StatCard({ label, value, tone = 'blue' }) {
  const colors = {
    blue: ['#DBEAFE', '#1E40AF'],
    amber: ['#FEF3C7', '#92400E'],
    green: ['#D1FAE5', '#065F46'],
    red: ['#FEE2E2', '#991B1B'],
  }[tone] || ['#EEF2FF', '#3730A3'];

  return (
    <div style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:'16px 18px', display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:44, height:44, borderRadius:10, background:colors[0], color:colors[1], display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:18 }}>
        {value}
      </div>
      <div style={{ fontSize:13, color:'#4B5563', fontWeight:600 }}>{label}</div>
    </div>
  );
}

function InfoCard({ title, rows }) {
  return (
    <section style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:18 }}>
      <div style={{ fontSize:14, fontWeight:800, color:'#1B1464', marginBottom:12 }}>{title}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:'12px 18px' }}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize:11, color:'#8B8FA8', fontWeight:700, textTransform:'uppercase', letterSpacing:'.04em', marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:13, color:'#1B1464', fontWeight:600 }}>{value || '-'}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EvaluationModal({ trainee, currentRotation, hospital, specialty, onClose, onSaved }) {
  const [form, setForm] = useState({
    evaluationType: 'Monthly',
    overall: 'meets',
    knowledge: '',
    clinicalSkills: '',
    professionalism: '',
    comments: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  function setField(key, value) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function numericOrBlank(value) {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  async function save() {
    setError('');
    const numericScores = {
      knowledge: numericOrBlank(form.knowledge),
      clinicalSkills: numericOrBlank(form.clinicalSkills),
      professionalism: numericOrBlank(form.professionalism),
    };
    if (Object.values(numericScores).some(Number.isNaN)) {
      setError('Numeric criteria must be valid numbers.');
      return;
    }
    if (Object.values(numericScores).some(v => v !== null && (v < 0 || v > 100))) {
      setError('Numeric criteria must be between 0 and 100.');
      return;
    }

    const scoreValues = Object.values(numericScores).filter(v => v !== null);
    const scores = { overall: form.overall };
    Object.entries(numericScores).forEach(([key, value]) => {
      if (value !== null) scores[key] = value;
    });

    setSaving(true);
    try {
      await api.post(`/api/dio/trainees/${trainee._id}/evaluations`, {
        traineeId: trainee._id,
        student: trainee._id,
        distributionId: currentRotation?._id || null,
        hospitalId: hospital?._id || currentRotation?.hospitalId?._id || currentRotation?.hospitalId || null,
        specialty: specialty?.name || trainee.specialty || '',
        evaluationType: form.evaluationType,
        type: form.evaluationType,
        scores,
        totalScore: scoreValues.length ? scoreValues.reduce((sum, n) => sum + n, 0) / scoreValues.length : undefined,
        comments: form.comments,
        notes: form.comments,
        isFinalized: true,
        status: 'completed',
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create evaluation.');
      setSaving(false);
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:2500, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:560, boxShadow:'0 20px 60px rgba(0,0,0,.2)', overflow:'hidden' }}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid #E8E9EF', display:'flex', justifyContent:'space-between', gap:12 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#1B1464' }}>Add Evaluation</div>
            <div style={{ fontSize:12, color:'#8B8FA8', marginTop:3 }}>{trainee?.name || 'Trainee'}</div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', border:'none', background:'#F5F6FA', color:'#8B8FA8', cursor:'pointer', fontSize:18 }}>x</button>
        </div>

        <div style={{ padding:22, display:'flex', flexDirection:'column', gap:16 }}>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#4B5563', marginBottom:7 }}>Evaluation Type</label>
            <select className="admin-search" style={{ width:'100%', boxSizing:'border-box', height:42 }} value={form.evaluationType} onChange={e => setField('evaluationType', e.target.value)}>
              {EVAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#4B5563', marginBottom:7 }}>Overall Rating</label>
            <select className="admin-search" style={{ width:'100%', boxSizing:'border-box', height:42 }} value={form.overall} onChange={e => setField('overall', e.target.value)}>
              {RATING_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12 }}>
            {[
              ['knowledge', 'Knowledge'],
              ['clinicalSkills', 'Clinical Skills'],
              ['professionalism', 'Professionalism'],
            ].map(([key, label]) => (
              <div key={key}>
                <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#4B5563', marginBottom:7 }}>{label} (0-100)</label>
                <input className="admin-search" style={{ width:'100%', boxSizing:'border-box', height:42 }} type="number" min="0" max="100" value={form[key]} onChange={e => setField(key, e.target.value)} />
              </div>
            ))}
          </div>

          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#4B5563', marginBottom:7 }}>Comments / Feedback</label>
            <textarea className="admin-search" style={{ width:'100%', minHeight:100, boxSizing:'border-box', padding:'10px 12px', resize:'vertical', fontFamily:'inherit' }} value={form.comments} onChange={e => setField('comments', e.target.value)} />
          </div>

          {error && <div style={{ background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'10px 12px', fontSize:13 }}>{error}</div>}

          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button className="btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn-purple" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Evaluation'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GradeModal({ report, onClose, onSaved }) {
  const overriding = isGraded(report);
  const [grade, setGrade] = useState(report?.grade || '');
  const [score, setScore] = useState(report?.score ?? '');
  const [feedback, setFeedback] = useState(report?.assessorComments || report?.reviewNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function save() {
    setError('');
    const numericScore = score === '' ? null : Number(score);
    if (!grade && numericScore === null) {
      setError('Please provide a grade or score.');
      return;
    }
    if (numericScore !== null && (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100)) {
      setError('Score must be between 0 and 100.');
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch(`/api/dio/reports/${report._id}/grade`, {
        grade,
        score: numericScore,
        feedback,
        status: 'graded',
      });
      onSaved(res.data?.data || res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save grade.');
      setSaving(false);
    }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:2500, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:520, boxShadow:'0 20px 60px rgba(0,0,0,.2)', overflow:'hidden' }}>
        <div style={{ padding:'18px 22px', borderBottom:'1px solid #E8E9EF', display:'flex', justifyContent:'space-between', gap:12 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#1B1464' }}>{overriding ? 'Override Grade' : 'Grade Report'}</div>
            <div style={{ fontSize:12, color:'#8B8FA8', marginTop:3 }}>{report?.title || 'Report'} - {report?.type}</div>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:'50%', border:'none', background:'#F5F6FA', color:'#8B8FA8', cursor:'pointer', fontSize:18 }}>x</button>
        </div>

        <div style={{ padding:22, display:'flex', flexDirection:'column', gap:16 }}>
          {overriding && (
            <div style={{ background:'#FEF3C7', border:'1px solid #FCD34D', color:'#92400E', borderRadius:10, padding:'11px 13px', fontSize:13, lineHeight:1.5 }}>
              You are overriding an existing grade. Previous grade: <strong>{report.grade || '-'}</strong>{report.score !== null && report.score !== undefined ? `, score ${report.score}` : ''}.
            </div>
          )}

          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#4B5563', marginBottom:7 }}>Grade</label>
            <select className="admin-search" style={{ width:'100%', boxSizing:'border-box', height:42 }} value={grade} onChange={e => setGrade(e.target.value)}>
              <option value="">Select grade...</option>
              {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#4B5563', marginBottom:7 }}>Score (0-100)</label>
            <input className="admin-search" style={{ width:'100%', boxSizing:'border-box', height:42 }} type="number" min="0" max="100" value={score} onChange={e => setScore(e.target.value)} />
          </div>

          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#4B5563', marginBottom:7 }}>Feedback / Comment</label>
            <textarea className="admin-search" style={{ width:'100%', minHeight:90, boxSizing:'border-box', padding:'10px 12px', resize:'vertical', fontFamily:'inherit' }} value={feedback} onChange={e => setFeedback(e.target.value)} />
          </div>

          {error && <div style={{ background:'#FEE2E2', color:'#DC2626', borderRadius:8, padding:'10px 12px', fontSize:13 }}>{error}</div>}

          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button className="btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn-purple" onClick={save} disabled={saving}>{saving ? 'Saving...' : overriding ? 'Override Grade' : 'Save Grade'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportRow({ report, onGrade }) {
  const graded = isGraded(report);
  return (
    <tr>
      <td>
        <div style={{ fontWeight:700, color:'#1B1464' }}>{report.title || '-'}</div>
        <div style={{ fontSize:11, color:'#8B8FA8' }}>{report.type} report</div>
      </td>
      <td>{fmtDate(report.date || report.createdAt)}</td>
      <td>{nameOf(report.hospital)}</td>
      <td>
        <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:graded ? '#D1FAE5' : '#FEF3C7', color:graded ? '#065F46' : '#92400E' }}>
          {graded ? 'Graded' : 'Ungraded'}
        </span>
      </td>
      <td>{report.grade || '-'}</td>
      <td>{report.score ?? '-'}</td>
      <td>{report.gradedBy?.name || '-'}</td>
      <td>{report.gradedByRole || report.gradedBy?.role || '-'}</td>
      <td>
        {report.fileUrl ? <a href={`${API_BASE}${report.fileUrl}`} target="_blank" rel="noreferrer" style={{ color:'#185FA5', fontWeight:700, fontSize:12 }}>Open</a> : <span style={{ color:'#B8BBC8' }}>-</span>}
      </td>
      <td>
        <button className={graded ? 'btn-action edit' : 'btn-purple'} style={{ fontSize:12, padding:graded ? undefined : '6px 12px' }} onClick={() => onGrade(report)}>
          {graded ? 'Override' : 'Grade'}
        </button>
      </td>
    </tr>
  );
}

function ReportsTable({ title, reports, onGrade }) {
  return (
    <section className="admin-card">
      <div className="admin-card-header">
        <div className="admin-card-title">{title}</div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Report</th><th>Submitted</th><th>Hospital</th><th>Status</th><th>Grade</th><th>Score</th><th>Graded By</th><th>Role</th><th>File</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr><td colSpan={10} className="admin-empty">No reports in this section</td></tr>
            ) : reports.map(r => <ReportRow key={r._id} report={r} onGrade={onGrade} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EvaluationsTable({ evaluations, onAdd }) {
  const rows = safeArr(evaluations);
  return (
    <section className="admin-card">
      <div className="admin-card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
        <div className="admin-card-title">Evaluations</div>
        <button className="btn-purple" onClick={onAdd}>+ Add Evaluation</button>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th><th>Evaluator</th><th>Role</th><th>Type</th><th>Status</th><th>Score</th><th>Grade</th><th>Comments</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="admin-empty">No evaluations found</td></tr>
            ) : rows.map((evaluation, index) => {
              const evaluator = evaluation?.evaluatorId || evaluation?.createdBy || evaluation?.supervisorId || evaluation?.doctor || {};
              const evaluatorRole = evaluation?.evaluatorRole || evaluation?.createdByRole || evaluator?.role || (evaluation?.supervisorId ? 'supervisor' : '');
              const finalized = evaluation?.isFinalized || evaluation?.status === 'completed';
              return (
                <tr key={evaluation?._id || index}>
                  <td>{fmtDate(evaluation?.sentToTraineeAt || evaluation?.createdAt)}</td>
                  <td>{evaluator?.name || '-'}</td>
                  <td>{roleLabel(evaluatorRole)}</td>
                  <td>{evaluation?.evaluationType || evaluation?.type || '-'}</td>
                  <td>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:finalized ? '#D1FAE5' : '#FEF3C7', color:finalized ? '#065F46' : '#92400E' }}>
                      {finalized ? 'Finalized' : 'Pending'}
                    </span>
                  </td>
                  <td>{evaluation?.totalScore ?? '-'}</td>
                  <td>{evaluation?.grade || evaluation?.scores?.overall || '-'}</td>
                  <td style={{ maxWidth:260 }}>{evaluation?.comments || evaluation?.notes || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CertificatesTable({ certificates }) {
  const rows = safeArr(certificates);
  const navigate = useNavigate();
  return (
    <section className="admin-card">
      <div className="admin-card-header">
        <div className="admin-card-title">Certificates</div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Type</th><th>Issue Date</th><th>Hospital</th><th>Status</th><th>Issued By</th><th>Notes</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="admin-empty">No certificates found</td></tr>
            ) : rows.map((certificate, index) => {
              const revoked = !!certificate?.revokedAt;
              return (
                <tr key={certificate?._id || index} style={{ opacity: revoked ? 0.65 : 1 }}>
                  <td>{certificate?.type || 'Completion'}</td>
                  <td>{fmtDate(certificate?.issueDate || certificate?.issuedAt || certificate?.createdAt)}</td>
                  <td>{certificate?.hospital?.name || '-'}</td>
                  <td>
                    <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:revoked ? '#FEE2E2' : '#D1FAE5', color:revoked ? '#991B1B' : '#065F46' }}>
                      {revoked ? `Revoked ${fmtDate(certificate.revokedAt)}` : 'Valid'}
                    </span>
                  </td>
                  <td>{certificate?.issuedBy?.name || '-'}</td>
                  <td style={{ maxWidth:200 }}>{certificate?.notes || '-'}</td>
                  <td>
                    {!revoked && certificate?._id && (
                      <button
                        className="btn-action edit"
                        style={{ fontSize:11, background:'#FEF3C7', color:'#92400E' }}
                        onClick={() => navigate(`/dio/certificates/${certificate._id}/print`)}
                      >
                        🖨 Print
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Rotation Timeline section ────────────────────────────────────────────
const ROT_STATUS_STYLE = {
  upcoming:  { bg:'#EFF6FF', color:'#1D4ED8', label:'Upcoming' },
  current:   { bg:'#D1FAE5', color:'#065F46', label:'Current'  },
  completed: { bg:'#E8E9EF', color:'#374151', label:'Completed'},
  cancelled: { bg:'#FEE2E2', color:'#991B1B', label:'Cancelled'},
};

function RotationTimeline({ rotations, traineeId, navigate }) {
  if (!rotations || rotations.length === 0) return (
    <section className="admin-card" style={{ marginBottom:16 }}>
      <div className="admin-card-header">
        <div className="admin-card-title">Rotation Timeline</div>
        <button className="btn-action edit" title="Add rotation"
          onClick={() => navigate('/dio/rotations')}>+ Add Rotation</button>
      </div>
      <div className="admin-empty">No rotations found for this trainee.</div>
    </section>
  );

  const buckets = [
    { key:'current',   label:'Current Rotation',    icon:'🔵', items: rotations.filter(r => r.status === 'current') },
    { key:'upcoming',  label:'Upcoming Rotations',   icon:'🔜', items: rotations.filter(r => r.status === 'upcoming') },
    { key:'completed', label:'Completed Rotations',  icon:'✅', items: rotations.filter(r => r.status === 'completed') },
    { key:'cancelled', label:'Cancelled Rotations',  icon:'🚫', items: rotations.filter(r => r.status === 'cancelled') },
  ].filter(b => b.items.length > 0);

  return (
    <section className="admin-card" style={{ marginBottom:16 }}>
      <div className="admin-card-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div className="admin-card-title">Rotation Timeline</div>
        <button className="btn-action edit" style={{ fontSize:12, width:'auto', padding:'0 12px', height:36 }}
          title="Add rotation for this trainee"
          onClick={() => navigate('/dio/rotations')}>
          + Add Rotation
        </button>
      </div>

      <div style={{ padding:'0 0 4px' }}>
        {buckets.map(bucket => (
          <div key={bucket.key} style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.05em', padding:'0 18px', marginBottom:8 }}>
              {bucket.icon} {bucket.label} ({bucket.items.length})
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'0 18px' }}>
              {bucket.items.map(r => {
                const hospital   = r.hospitalId  || r.hospital   || {};
                const supervisor = r.supervisorId || r.doctor    || {};
                const specialty  = r.specialtyId?.name || r.specialty || null;
                const st         = ROT_STATUS_STYLE[r.status] || { bg:'#F3F4F6', color:'#374151', label: r.status };
                const canCancel  = r.status === 'upcoming';
                const canEdit    = r.status === 'upcoming' || r.status === 'current';
                return (
                  <div key={r._id} style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, border:'1px solid #F0F0F0', borderRadius:10, padding:'12px 14px', background:'#FAFAFA', flexWrap:'wrap' }}>
                    <div style={{ flex:1, minWidth:200 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
                        <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:st.bg, color:st.color }}>
                          {st.label}
                        </span>
                        {specialty && (
                          <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#EEEDFE', color:'#3C3489' }}>
                            {specialty}
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight:700, fontSize:14, color:'#1B1464', marginBottom:3 }}>
                        {hospital?.name || '—'}
                      </div>
                      <div style={{ fontSize:12, color:'#6B7280' }}>
                        {supervisor?.name ? `Supervisor: ${supervisor.name}` : 'No supervisor assigned'}
                      </div>
                      <div style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>
                        {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                      </div>
                    </div>
                    {(canEdit || canCancel) && (
                      <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                        {canEdit && (
                          <button className="btn-action edit"
                            title="Edit rotation" aria-label="Edit rotation"
                            onClick={() => navigate('/dio/rotations')}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function DioTraineeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [rotations, setRotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gradeModal, setGradeModal] = useState(null);
  const [evaluationModal, setEvaluationModal] = useState(false);
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const toastId = Date.now();
    setToasts(p => [...p, { id: toastId, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== toastId)), 3500);
  }

  function load(options = {}) {
    const showPageLoading = options.showPageLoading !== false;
    if (showPageLoading) setLoading(true);
    setError('');
    return Promise.all([
      api.get(`/api/dio/trainees/${id}/details`),
      api.get(`/api/rotations/student/${id}`),
    ]).then(([detailsRes, rotationsRes]) => {
      setData(detailsRes.data?.data || detailsRes.data);
      const rots = Array.isArray(rotationsRes.data) ? rotationsRes.data : [];
      // Sort: current first, then upcoming, then completed, then cancelled
      const order = { current:0, upcoming:1, completed:2, cancelled:3 };
      setRotations([...rots].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)));
    }).catch(err => setError(err.response?.data?.message || 'Failed to load trainee details'))
    .finally(() => {
      if (showPageLoading) setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, [id]);

  function handleSaved(updated) {
    setData(prev => {
      const reports = safeArr(prev?.reports).map(r => r._id === updated._id ? updated : r);
      const ungradedReports = reports.filter(r => !isGraded(r));
      return {
        ...prev,
        reports,
        reportsByType: {
          weekly: reports.filter(r => r.type === 'weekly'),
          monthly: reports.filter(r => r.type === 'monthly'),
          final: reports.filter(r => r.type === 'final'),
        },
        ungradedReports,
        pendingUngradedCount: ungradedReports.length,
      };
    });
    showToast('Report grade saved');
  }

  async function handleEvaluationSaved() {
    await load({ showPageLoading: false });
    showToast('Evaluation added successfully');
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <Sk h={44} r={10} style={{ marginBottom:18 }} />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12 }}>
          {[0, 1, 2].map(i => <Sk key={i} h={90} r={12} />)}
        </div>
      </main>
    </>
  );

  if (error) return (
    <>
      <Navbar />
      <main className="admin-main">
        <button className="btn-outline" onClick={() => navigate('/dio/trainees')} style={{ marginBottom:16 }}>Back</button>
        <div style={{ background:'#FEE2E2', color:'#DC2626', borderRadius:12, padding:18 }}>{error}</div>
      </main>
    </>
  );

  const trainee = data?.trainee || {};
  const reports = safeArr(data?.reports);
  const byType = data?.reportsByType || {};
  const ungraded = safeArr(data?.ungradedReports);
  const evaluations = safeArr(data?.evaluations);
  const certificates = safeArr(data?.certificates);
  const currentRotation = data?.currentRotation;

  return (
    <>
      <Navbar />
      <main className="admin-main">
        {/* Header row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12, flexWrap:'wrap', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button className="btn-outline" onClick={() => navigate('/dio/trainees')}>← Back</button>
            <div>
              <div style={{ fontSize:22, fontWeight:900, color:'#1B1464' }}>{trainee.name || 'Trainee'}</div>
              <div style={{ fontSize:13, color:'#8B8FA8' }}>{trainee.studentId || '-'} · {trainee.email || '-'}</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <span style={{ background:ungraded.length ? '#FEE2E2' : '#D1FAE5', color:ungraded.length ? '#991B1B' : '#065F46', borderRadius:20, padding:'6px 12px', fontSize:12, fontWeight:800 }}>
              {ungraded.length} ungraded report{ungraded.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Quick-action buttons */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18, padding:'14px 16px', background:'#F8FAFD', borderRadius:12, border:'1px solid #E8E9EF' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.05em', alignSelf:'center', marginRight:4 }}>
            Quick Actions:
          </div>
          <button className="btn-action edit"
            onClick={() => navigate('/dio/trainees', { state: { editId: trainee._id } })}>
            ✏ Edit Trainee
          </button>
          <button className="btn-action edit"
            style={{ background:'#EFF6FF', color:'#1D4ED8' }}
            onClick={() => navigate('/dio/distributions?new=1')}>
            ＋ Create Distribution
          </button>
          <button className="btn-action edit"
            style={{ background:'#F0FDF4', color:'#065F46' }}
            onClick={() => navigate('/dio/rotations?new=1')}>
            ＋ Create Rotation
          </button>
          {certificates.length > 0 && !certificates[0]?.revokedAt && (
            <button className="btn-action edit"
              style={{ background:'#FEF3C7', color:'#92400E' }}
              onClick={() => navigate(`/dio/certificates/${certificates[0]._id}/print`)}>
              🖨 Print Latest Certificate
            </button>
          )}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(210px, 1fr))', gap:12, marginBottom:16 }}>
          <StatCard label="All Reports" value={reports.length} />
          <StatCard label="Ungraded Reports" value={ungraded.length} tone={ungraded.length ? 'red' : 'green'} />
          <StatCard label="Evaluations" value={data?.evaluationsSummary?.total || 0} tone="amber" />
          <StatCard label="Valid Certificates" value={data?.certificatesSummary?.valid || 0} tone="green" />
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14, marginBottom:16 }}>
          <InfoCard title="Basic Information" rows={[
            ['Name', trainee.name],
            ['Student ID', trainee.studentId],
            ['Email', trainee.email],
            ['Phone', trainee.phone],
            ['Year', trainee.year ? `Year ${trainee.year}` : '-'],
            ['City', trainee.city],
          ]} />
          <InfoCard title="Training Assignment" rows={[
            ['Hospital', nameOf(data?.hospital)],
            ['Specialty', data?.specialty?.name || trainee.specialty],
            ['Supervisor', nameOf(data?.supervisor)],
            ['Program Director', nameOf(data?.programDirector)],
            ['Rotations', `${rotations.filter(r=>r.status==='current').length} current, ${rotations.filter(r=>r.status==='upcoming').length} upcoming`],
          ]} />
        </div>

        {/* ─── Rotation Timeline ─────────────────────────────────────── */}
        <RotationTimeline rotations={rotations} traineeId={trainee._id} navigate={navigate} />

        <section style={{ background:'#fff', border:'1px solid #E8E9EF', borderRadius:12, padding:18, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:'#1B1464' }}>Ungraded Reports</div>
              <div style={{ fontSize:12, color:'#8B8FA8' }}>DIO can grade weekly, monthly, and final reports from here.</div>
            </div>
            <span style={{ fontSize:12, fontWeight:800, background:'#FEF3C7', color:'#92400E', padding:'4px 10px', borderRadius:20 }}>{ungraded.length} pending</span>
          </div>
          {ungraded.length === 0 ? (
            <div className="admin-empty">No ungraded reports. Everything is caught up.</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {ungraded.map(report => (
                <div key={report._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, border:'1px solid #F3F4F6', borderRadius:10, padding:'10px 12px', flexWrap:'wrap' }}>
                  <div>
                    <div style={{ fontWeight:800, color:'#1B1464' }}>{report.title}</div>
                    <div style={{ fontSize:12, color:'#8B8FA8' }}>{report.type} - submitted {fmtDate(report.date || report.createdAt)}</div>
                  </div>
                  <button className="btn-purple" onClick={() => setGradeModal(report)}>Grade</button>
                </div>
              ))}
            </div>
          )}
        </section>

        <EvaluationsTable evaluations={evaluations} onAdd={() => setEvaluationModal(true)} />
        <CertificatesTable certificates={certificates} />

        {REPORT_TYPES.map(type => (
          <ReportsTable
            key={type}
            title={`${type.charAt(0).toUpperCase()}${type.slice(1)} Reports`}
            reports={safeArr(byType[type])}
            onGrade={setGradeModal}
          />
        ))}

        {gradeModal && (
          <GradeModal
            report={gradeModal}
            onClose={() => setGradeModal(null)}
            onSaved={handleSaved}
          />
        )}
        {evaluationModal && (
          <EvaluationModal
            trainee={trainee}
            currentRotation={currentRotation}
            hospital={data?.hospital}
            specialty={data?.specialty}
            onClose={() => setEvaluationModal(false)}
            onSaved={handleEvaluationSaved}
          />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
