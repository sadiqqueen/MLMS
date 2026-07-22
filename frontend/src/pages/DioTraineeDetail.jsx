import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useBasePath from '../hooks/useBasePath';
import Navbar from '../components/Navbar';
import { useMtToast, MtToastHost } from '../components/MtToast';
import MtModal from '../components/MtModal';
import StatCard from '../components/StatCard';
import api from '../api/axios';
import Sk from '../components/Skeleton';
import { IconPencil, IconPlus, IconPrinter, IconBack } from '../components/icons';
import { roleLabel } from '../config/roles';
import { specialtyName } from '../utils/specialtyName';
import './dio.css';

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

function InfoCard({ title, rows }) {
  return (
    <section className="mt-card">
      <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 12 }}>
        <div className="mt-card-title">{title}</div>
        <div className="mt-divider" />
      </div>
      <div className="dio-kv-grid">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div className="mt-acct-k">{label}</div>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{value || '-'}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <section className="mt-card dio-section">
      <div className="mt-card-head">
        <div className="mt-card-title">{title}</div>
        <div className="mt-divider" />
        {action}
      </div>
      {children}
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
    <MtModal open title="Add Evaluation" sub={trainee?.name || 'Trainee'} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="mt-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Evaluation'}</button>
        </>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="mt-field">
          <label className="mt-label">Evaluation Type</label>
          <select className="mt-select" value={form.evaluationType} onChange={e => setField('evaluationType', e.target.value)}>
            {EVAL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="mt-field">
          <label className="mt-label">Overall Rating</label>
          <select className="mt-select" value={form.overall} onChange={e => setField('overall', e.target.value)}>
            {RATING_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="mt-field-grid">
          {[
            ['knowledge', 'Knowledge'],
            ['clinicalSkills', 'Clinical Skills'],
            ['professionalism', 'Professionalism'],
          ].map(([key, label]) => (
            <div className="mt-field" key={key}>
              <label className="mt-label">{label} (0-100)</label>
              <input className="mt-input" type="number" min="0" max="100" value={form[key]} onChange={e => setField(key, e.target.value)} />
            </div>
          ))}
        </div>
        <div className="mt-field">
          <label className="mt-label">Comments / Feedback</label>
          <textarea className="mt-textarea" value={form.comments} onChange={e => setField('comments', e.target.value)} />
        </div>
        {error && <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger)', margin: 0 }}>{error}</div>}
      </div>
    </MtModal>
  );
}

function GradeModal({ report, onClose, onSaved }) {
  const overriding = isGraded(report);
  const [grade, setGrade] = useState(report?.grade || '');
  const [score, setScore] = useState(report?.score ?? '');
  const [feedback, setFeedback] = useState(report?.assessorComments || report?.reviewNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
    <MtModal open title={overriding ? 'Override Grade' : 'Grade Report'} sub={`${report?.title || 'Report'} · ${report?.type}`} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="mt-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : overriding ? 'Override Grade' : 'Save Grade'}</button>
        </>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {overriding && (
          <div className="mt-banner" style={{ background: 'var(--warning-bg)', borderInlineStartColor: 'var(--accent)', color: 'var(--warning-fg)', margin: 0 }}>
            You are overriding an existing grade. Previous grade: <strong>{report.grade || '-'}</strong>{report.score !== null && report.score !== undefined ? `, score ${report.score}` : ''}.
          </div>
        )}
        <div className="mt-field">
          <label className="mt-label">Grade</label>
          <select className="mt-select" value={grade} onChange={e => setGrade(e.target.value)}>
            <option value="">Select grade…</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="mt-field">
          <label className="mt-label">Score (0-100)</label>
          <input className="mt-input" type="number" min="0" max="100" value={score} onChange={e => setScore(e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">Feedback / Comment</label>
          <textarea className="mt-textarea" value={feedback} onChange={e => setFeedback(e.target.value)} />
        </div>
        {error && <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger)', margin: 0 }}>{error}</div>}
      </div>
    </MtModal>
  );
}

function FileLink({ url }) {
  return url
    ? <a href={`${API_BASE}${url}`} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-primary)', fontWeight: 600, fontSize: 12 }}>Open</a>
    : <span className="mt-td--muted">-</span>;
}

function ReportRow({ report, onGrade }) {
  const graded = isGraded(report);
  return (
    <tr>
      <td className="mt-td mt-td--name">
        <div>{report.title || '-'}</div>
        <div className="mt-acct-id">{report.type} report</div>
      </td>
      <td className="mt-td mt-td--mono">{fmtDate(report.date || report.createdAt)}</td>
      <td className="mt-td mt-td--muted">{nameOf(report.hospital)}</td>
      <td className="mt-td"><span className={`mt-pill ${graded ? 'mt-pill--active' : 'mt-pill--warn'}`}>{graded ? 'Graded' : 'Ungraded'}</span></td>
      <td className="mt-td">{report.grade || '-'}</td>
      <td className="mt-td">{report.score ?? '-'}</td>
      <td className="mt-td mt-td--muted">{report.gradedBy?.name || '-'}</td>
      <td className="mt-td mt-td--muted">{report.gradedByRole || report.gradedBy?.role || '-'}</td>
      <td className="mt-td"><FileLink url={report.fileUrl} /></td>
      <td className="mt-td">
        <button className={graded ? 'mt-btn--small-outline' : 'mt-btn mt-btn--small'} onClick={() => onGrade(report)}>
          {graded ? 'Override' : 'Grade'}
        </button>
      </td>
    </tr>
  );
}

function ReportsTable({ title, reports, onGrade }) {
  return (
    <SectionCard title={title}>
      <div className="mt-table-wrap">
        <table className="mt-table">
          <thead>
            <tr>
              {['Report', 'Submitted', 'Hospital', 'Status', 'Grade', 'Score', 'Graded By', 'Role', 'File', 'Action'].map(h => <th key={h} className="mt-th">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr><td colSpan={10} className="mt-td mt-td--muted" style={{ textAlign: 'center', padding: 28 }}>No reports in this section</td></tr>
            ) : reports.map(r => <ReportRow key={r._id} report={r} onGrade={onGrade} />)}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function EvaluationsTable({ evaluations, onAdd }) {
  const rows = safeArr(evaluations);
  return (
    <SectionCard title="Evaluations" action={<button className="mt-btn mt-btn--small" onClick={onAdd}><IconPlus size={14} /> Add Evaluation</button>}>
      <div className="mt-table-wrap">
        <table className="mt-table">
          <thead>
            <tr>{['Date', 'Evaluator', 'Role', 'Type', 'Status', 'Score', 'Grade', 'Comments'].map(h => <th key={h} className="mt-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="mt-td mt-td--muted" style={{ textAlign: 'center', padding: 28 }}>No evaluations found</td></tr>
            ) : rows.map((evaluation, index) => {
              const evaluator = evaluation?.evaluatorId || evaluation?.createdBy || evaluation?.supervisorId || evaluation?.doctor || {};
              const evaluatorRole = evaluation?.evaluatorRole || evaluation?.createdByRole || evaluator?.role || (evaluation?.supervisorId ? 'supervisor' : '');
              const finalized = evaluation?.isFinalized || evaluation?.status === 'completed';
              return (
                <tr key={evaluation?._id || index}>
                  <td className="mt-td mt-td--mono">{fmtDate(evaluation?.sentToTraineeAt || evaluation?.createdAt)}</td>
                  <td className="mt-td">{evaluator?.name || '-'}</td>
                  <td className="mt-td mt-td--muted">{roleLabel(evaluatorRole)}</td>
                  <td className="mt-td">{evaluation?.evaluationType || evaluation?.type || '-'}</td>
                  <td className="mt-td"><span className={`mt-pill ${finalized ? 'mt-pill--active' : 'mt-pill--warn'}`}>{finalized ? 'Finalized' : 'Pending'}</span></td>
                  <td className="mt-td">{evaluation?.totalScore ?? '-'}</td>
                  <td className="mt-td">{evaluation?.grade || evaluation?.scores?.overall || '-'}</td>
                  <td className="mt-td mt-td--muted" style={{ maxWidth: 260 }}>{evaluation?.comments || evaluation?.notes || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function CertificatesTable({ certificates }) {
  const rows = safeArr(certificates);
  const navigate = useNavigate();
  const bp = useBasePath();
  return (
    <SectionCard title="Certificates">
      <div className="mt-table-wrap">
        <table className="mt-table">
          <thead>
            <tr>{['Type', 'Issue Date', 'Hospital', 'Status', 'Issued By', 'Notes', 'Action'].map(h => <th key={h} className="mt-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="mt-td mt-td--muted" style={{ textAlign: 'center', padding: 28 }}>No certificates found</td></tr>
            ) : rows.map((certificate, index) => {
              const revoked = !!certificate?.revokedAt;
              return (
                <tr key={certificate?._id || index} style={{ opacity: revoked ? 0.65 : 1 }}>
                  <td className="mt-td">{certificate?.type || 'Completion'}</td>
                  <td className="mt-td mt-td--mono">{fmtDate(certificate?.issueDate || certificate?.issuedAt || certificate?.createdAt)}</td>
                  <td className="mt-td mt-td--muted">{certificate?.hospital?.name || '-'}</td>
                  <td className="mt-td">
                    <span className={`mt-pill ${revoked ? 'mt-pill--rejected' : 'mt-pill--active'}`}>
                      {revoked ? `Revoked ${fmtDate(certificate.revokedAt)}` : 'Valid'}
                    </span>
                  </td>
                  <td className="mt-td mt-td--muted">{certificate?.issuedBy?.name || '-'}</td>
                  <td className="mt-td mt-td--muted" style={{ maxWidth: 200 }}>{certificate?.notes || '-'}</td>
                  <td className="mt-td">
                    {!revoked && certificate?._id && (
                      <button className="mt-btn--small-outline" title="Print Certificate" aria-label="Print Certificate"
                        onClick={() => navigate(bp + `/dio/certificates/${certificate._id}/print`)}>
                        <IconPrinter size={13} /> Print
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// Trainee-uploaded courses & certificates (self-reported portfolio items).
function CoursesTable({ courses }) {
  const rows = safeArr(courses);
  return (
    <SectionCard title="Courses & Certificates (uploaded by trainee)">
      <div className="mt-table-wrap">
        <table className="mt-table">
          <thead>
            <tr>{['Title', 'Type', 'Issuer', 'Date', 'File'].map(h => <th key={h} className="mt-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="mt-td mt-td--muted" style={{ textAlign: 'center', padding: 28 }}>No uploaded courses or certificates</td></tr>
            ) : rows.map((c, index) => (
              <tr key={c?._id || index}>
                <td className="mt-td mt-td--name">{c?.title || '-'}</td>
                <td className="mt-td">{c?.kind === 'course' ? 'Course' : 'Certificate'}</td>
                <td className="mt-td mt-td--muted">{c?.issuer || '-'}</td>
                <td className="mt-td mt-td--mono">{fmtDate(c?.completedDate || c?.createdAt)}</td>
                <td className="mt-td"><FileLink url={c?.fileUrl} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// Public publications (approved researches the trainee marked Public).
function PublicationsTable({ publications }) {
  const rows = safeArr(publications);
  return (
    <SectionCard title="Publications (public)">
      <div className="mt-table-wrap">
        <table className="mt-table">
          <thead>
            <tr>{['Title', 'Authors', 'Journal / Venue', 'Date', 'File'].map(h => <th key={h} className="mt-th">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="mt-td mt-td--muted" style={{ textAlign: 'center', padding: 28 }}>No public publications</td></tr>
            ) : rows.map((p, index) => (
              <tr key={p?._id || index}>
                <td className="mt-td mt-td--name">{p?.title || '-'}</td>
                <td className="mt-td mt-td--muted">{p?.authors || '-'}</td>
                <td className="mt-td mt-td--muted">{p?.journal || '-'}</td>
                <td className="mt-td mt-td--mono">{fmtDate(p?.reviewedAt || p?.createdAt)}</td>
                <td className="mt-td"><FileLink url={p?.fileUrl} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ── Rotation Timeline section ────────────────────────────────────────────
const ROT_STATUS = {
  upcoming:  { pill: 'mt-pill--warn',    label: 'Upcoming' },
  current:   { pill: 'mt-pill--active',  label: 'Current' },
  completed: { pill: 'mt-pill--neutral', label: 'Completed' },
  cancelled: { pill: 'mt-pill--rejected',label: 'Cancelled' },
};

function RotationTimeline({ rotations, navigate }) {
  const bp = useBasePath();
  const addBtn = (
    <button className="mt-btn--small-outline" title="Add rotation for this trainee"
      onClick={() => navigate(bp + '/dio/assignments?tab=rotations&new=1')}>
      <IconPlus size={14} /> Add Rotation
    </button>
  );

  if (!rotations || rotations.length === 0) return (
    <SectionCard title="Rotation Timeline" action={addBtn}>
      <div className="mt-empty"><div className="mt-empty-sub">No rotations found for this trainee.</div></div>
    </SectionCard>
  );

  const buckets = [
    { key: 'current',   label: 'Current Rotation',   items: rotations.filter(r => r.status === 'current') },
    { key: 'upcoming',  label: 'Upcoming Rotations', items: rotations.filter(r => r.status === 'upcoming') },
    { key: 'completed', label: 'Completed Rotations',items: rotations.filter(r => r.status === 'completed') },
    { key: 'cancelled', label: 'Cancelled Rotations',items: rotations.filter(r => r.status === 'cancelled') },
  ].filter(b => b.items.length > 0);

  return (
    <SectionCard title="Rotation Timeline" action={addBtn}>
      {buckets.map(bucket => (
        <div key={bucket.key} style={{ marginBlockEnd: 16 }}>
          <div className="mt-acct-k" style={{ marginBlockEnd: 8 }}>{bucket.label} ({bucket.items.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bucket.items.map(r => {
              const hospital   = r.hospitalId  || r.hospital   || {};
              const supervisor = r.supervisorId || r.doctor    || {};
              const specialty  = specialtyName(r.specialtyId) || r.specialty || null;
              const st         = ROT_STATUS[r.status] || { pill: 'mt-pill--neutral', label: r.status };
              const canEdit    = r.status === 'upcoming' || r.status === 'current';
              return (
                <div key={r._id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface-2)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div className="dio-chip-row" style={{ marginBlockEnd: 5 }}>
                      <span className={`mt-pill ${st.pill}`}>{st.label}</span>
                      {specialty && <span className="mt-pill mt-pill--neutral">{specialty}</span>}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBlockEnd: 3 }}>{hospital?.name || '—'}</div>
                    <div className="mt-card-sub">{supervisor?.name ? `Supervisor: ${supervisor.name}` : 'No supervisor assigned'}</div>
                    <div className="mt-card-sub" style={{ marginBlockStart: 2 }}>{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</div>
                  </div>
                  {canEdit && (
                    <button className="mt-icon-action" title="Edit rotation" aria-label="Edit rotation"
                      onClick={() => navigate(bp + '/dio/assignments?tab=rotations')}>
                      <IconPencil size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </SectionCard>
  );
}

export default function DioTraineeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const bp = useBasePath();
  const [data, setData] = useState(null);
  const [rotations, setRotations] = useState([]);
  const [courses, setCourses] = useState([]);
  const [publications, setPublications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gradeModal, setGradeModal] = useState(null);
  const [evaluationModal, setEvaluationModal] = useState(false);
  const { toasts, showToast } = useMtToast();

  function load(options = {}) {
    const showPageLoading = options.showPageLoading !== false;
    if (showPageLoading) setLoading(true);
    setError('');
    return Promise.all([
      api.get(`/api/dio/trainees/${id}/details`),
      api.get(`/api/rotations/student/${id}`),
      api.get(`/api/trainee-courses/trainee/${id}`).catch(() => ({ data: { data: [] } })),
      api.get(`/api/research/trainee/${id}`).catch(() => ({ data: { data: [] } })),
    ]).then(([detailsRes, rotationsRes, coursesRes, pubsRes]) => {
      setData(detailsRes.data?.data || detailsRes.data);
      const rots = Array.isArray(rotationsRes.data) ? rotationsRes.data : [];
      // Sort: current first, then upcoming, then completed, then cancelled
      const order = { current: 0, upcoming: 1, completed: 2, cancelled: 3 };
      setRotations([...rots].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)));
      setCourses(safeArr(coursesRes.data?.data || coursesRes.data));
      setPublications(safeArr(pubsRes.data?.data || pubsRes.data));
    }).catch(err => setError(err.response?.data?.message || 'Failed to load trainee details'))
    .finally(() => {
      if (showPageLoading) setLoading(false);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    showToast('Report grade saved', 'ok');
  }

  async function handleEvaluationSaved() {
    await load({ showPageLoading: false });
    showToast('Evaluation added successfully', 'ok');
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content">
        <Sk h={44} r={10} style={{ marginBottom: 18 }} />
        <div className="mt-stat-grid">
          {[0, 1, 2, 3].map(i => <Sk key={i} h={104} r={12} />)}
        </div>
      </main>
    </>
  );

  if (error) return (
    <>
      <Navbar />
      <main className="mt-content">
        <button className="mt-btn--outline" onClick={() => navigate(bp + '/dio/users')} style={{ marginBlockEnd: 16 }}><IconBack size={15} /> Back</button>
        <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger)' }}>{error}</div>
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
      <main className="mt-content">
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBlockEnd: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="mt-btn--outline" onClick={() => navigate(bp + '/dio/users')}><IconBack size={15} /> Back</button>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{trainee.name || 'Trainee'}</div>
              <div className="mt-card-sub">{trainee.studentId || '-'} · {trainee.email || '-'}</div>
            </div>
          </div>
          <span className={`mt-pill ${ungraded.length ? 'mt-pill--rejected' : 'mt-pill--active'}`}>
            {ungraded.length} ungraded report{ungraded.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Quick-action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockEnd: 18, padding: '14px 16px', background: 'var(--surface-2)', borderRadius: 12, border: '1px solid var(--border)', alignItems: 'center' }}>
          <div className="mt-acct-k" style={{ marginInlineEnd: 4 }}>Quick Actions:</div>
          <button className="mt-btn--small-outline" onClick={() => navigate(bp + `/dio/users?edit=${trainee._id}`)}><IconPencil size={14} /> Edit Trainee</button>
          <button className="mt-btn--small-outline" onClick={() => navigate(bp + '/dio/assignments?tab=distributions&new=1')}><IconPlus size={14} /> Create Distribution</button>
          <button className="mt-btn--small-outline" onClick={() => navigate(bp + '/dio/assignments?tab=rotations&new=1')}><IconPlus size={14} /> Create Rotation</button>
          {certificates.length > 0 && !certificates[0]?.revokedAt && (
            <button className="mt-btn--small-outline" title="Print latest certificate" aria-label="Print latest certificate"
              onClick={() => navigate(bp + `/dio/certificates/${certificates[0]._id}/print`)}>
              <IconPrinter size={14} /> Print Latest Certificate
            </button>
          )}
        </div>

        <div className="mt-stat-grid" style={{ marginBlockEnd: 16 }}>
          <StatCard label="All Reports" value={reports.length} icon="doc" />
          <StatCard label="Ungraded Reports" value={ungraded.length} icon="doc" tone={ungraded.length ? 'dng' : 'ok'} />
          <StatCard label="Evaluations" value={data?.evaluationsSummary?.total || 0} icon="check" tone="warn" />
          <StatCard label="Valid Certificates" value={data?.certificatesSummary?.valid || 0} icon="award" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBlockEnd: 16 }}>
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
        <RotationTimeline rotations={rotations} navigate={navigate} />

        <SectionCard title="Ungraded Reports"
          action={<span className="mt-pill mt-pill--warn">{ungraded.length} pending</span>}>
          <div className="mt-card-sub" style={{ marginBlockEnd: 12 }}>DIO can grade weekly, monthly, and final reports from here.</div>
          {ungraded.length === 0 ? (
            <div className="mt-empty"><div className="mt-empty-sub">No ungraded reports. Everything is caught up.</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ungraded.map(report => (
                <div key={report._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text)' }}>{report.title}</div>
                    <div className="mt-card-sub">{report.type} · submitted {fmtDate(report.date || report.createdAt)}</div>
                  </div>
                  <button className="mt-btn mt-btn--small" onClick={() => setGradeModal(report)}>Grade</button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <EvaluationsTable evaluations={evaluations} onAdd={() => setEvaluationModal(true)} />
        <CertificatesTable certificates={certificates} />
        <CoursesTable courses={courses} />
        <PublicationsTable publications={publications} />

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
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
