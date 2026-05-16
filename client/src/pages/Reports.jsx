import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
}

function fmtShort(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

const FILTERS = ['All', 'Weekly', 'Monthly', 'Final', 'Graded', 'Pending'];

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

// ── REPORT DETAIL MODAL ────────────────────────────────────────────────────
function ReportModal({ report, student, onClose }) {
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  if (!report) return null;

  const criteria    = report.assessmentCriteria || {};
  const isGraded    = report.status === 'graded';
  const hasFullAssess = isGraded && report.globalRating;
  const rota        = report.rotation;
  const rotaStr     = rota ? `${fmtShort(rota.startDate)} – ${fmtShort(rota.endDate)}` : '—';

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal report-print-modal">

        {/* ══ PRINT HEADER (hidden on screen) ══════════════════════════════ */}
        <div className="print-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="print-logo"><img src="public/logo.png" alt="MedLearn LMS" className="print-logo-img" /></div>
              <div className="print-subtitle">Clinical Training Assessment Report</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11, color: '#666' }}>
              <div>Printed: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
              <div style={{ marginTop: 2 }}>Status: <strong>{isGraded ? 'Assessed' : 'Pending'}</strong></div>
            </div>
          </div>
        </div>

        {/* ══ SCREEN HEADER (hidden when printing) ═════════════════════════ */}
        <div className="modal-header no-print">
          <div>
            <div className="modal-title">{report.title}</div>
            <div className="modal-meta">
              <span className={`badge ${report.type === 'final' ? 'badge-red' : report.type === 'monthly' ? 'badge-amber' : 'badge-blue'}`}>{report.type}</span>
              <span style={{ fontSize: 12, color: '#888' }}>{fmtShort(report.date)}</span>
              {report.hospital?.name && <span style={{ fontSize: 12, color: '#666' }}>{report.hospital.name}</span>}
              <span className={isGraded ? 'badge badge-green' : 'badge badge-amber'}>
                {isGraded ? 'Assessed' : 'Pending review'}
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-divider no-print" />

        {/* ══ SECTION 1 — REPORT DETAILS ═══════════════════════════════════ */}
        <div className="modal-section">
          <div className="modal-section-title">Report Details</div>
          <div className="assess-grid">
            <div className="assess-info-item">
              <span className="modal-label">Report Title</span>
              <span className="modal-value">{report.title}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Report Type</span>
              <span className="modal-value" style={{ textTransform: 'capitalize' }}>{report.type}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Date Submitted</span>
              <span className="modal-value">{fmt(report.date)}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Hospital</span>
              <span className="modal-value">{report.hospital?.name || '—'}</span>
            </div>
            {report.fileUrl && (
              <div className="assess-info-item">
                <span className="modal-label">Attached File</span>
                <a className="modal-link no-print" href={`http://https://mlms-production.up.railway.app${report.fileUrl}`} target="_blank" rel="noreferrer">
                  View attachment ↗
                </a>
                <span className="print-only modal-value">{report.fileUrl}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-divider" />

        {/* ══ SECTION 2 — TRAINEE INFORMATION ══════════════════════════════ */}
        <div className="modal-section">
          <div className="modal-section-title">Trainee Information</div>
          <div className="assess-grid">
            <div className="assess-info-item">
              <span className="modal-label">Trainee's Name</span>
              <span className="modal-value">{student?.name || '—'}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">IMA Number</span>
              <span className="modal-value">{student?.studentId || '—'}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Rotation Period</span>
              <span className="modal-value">{rotaStr}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Rotation Status</span>
              <span className="modal-value" style={{ textTransform: 'capitalize' }}>{rota?.status || '—'}</span>
            </div>
          </div>
        </div>

        <div className="modal-divider" />

        {/* ══ SECTION 3 — ASSESSMENT RESULT ════════════════════════════════ */}
        {isGraded ? (
          <>
            <div className="modal-section">
              <div className="modal-section-title">Assessment Result</div>

              {/* Grade + Rating side by side */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 12 }}>
                {report.grade && !['Competent','Not-Competent'].includes(report.grade) && (
                  <div style={{ textAlign: 'center' }}>
                    <div className="grade-circle-lg" style={{ margin: '0 auto 4px' }}>{report.grade}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Letter Grade</div>
                  </div>
                )}
                {report.globalRating && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      padding: '10px 22px', borderRadius: 10, fontWeight: 700, fontSize: 15,
                      background: report.globalRating === 'competent' ? '#e8fdf3' : '#fef0f0',
                      color:      report.globalRating === 'competent' ? '#00B894' : '#FF4757',
                      border:    `2px solid ${report.globalRating === 'competent' ? '#00B894' : '#FF4757'}`,
                    }}>
                      {report.globalRating === 'competent' ? 'Competent' : 'Not-Competent'}
                    </div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Global Rating</div>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div className="modal-row">
                    <span className="modal-label">Assessed by</span>
                    <span className="modal-value">{report.gradedBy?.name ?? '—'}</span>
                  </div>
                  <div className="modal-row" style={{ marginTop: 6 }}>
                    <span className="modal-label">Assessed on</span>
                    <span className="modal-value">{fmt(report.gradedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-divider" />

            {/* ══ SECTION 4 — ASR CRITERIA ════════════════════════════════ */}
            {hasFullAssess && (
              <>
                <div className="modal-section">
                  <div className="modal-section-title">ASR — Assessment Criteria</div>
                  <div className="report-asr-grid">
                    <div className="report-asr-header">
                      <div className="report-asr-name">Criteria</div>
                      {RATINGS.map(r => (
                        <div key={r.key} className="report-asr-col" style={{ color: r.color }}>{r.label}</div>
                      ))}
                    </div>
                    {ASR_CRITERIA.map((name, idx) => {
                      const selected = criteria[name];
                      return (
                        <div key={name} className={`report-asr-row${idx % 2 === 1 ? ' alt' : ''}`}>
                          <div className="report-asr-name">{name}</div>
                          {RATINGS.map(r => (
                            <div key={r.key} className="report-asr-col">
                              <div className="report-asr-bubble"
                                style={selected === r.key ? { background: r.color, borderColor: r.color } : {}} />
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="modal-divider" />
              </>
            )}

            {/* ══ SECTION 5 — COMMENTS ════════════════════════════════════ */}
            {report.assessorComments && (
              <>
                <div className="modal-section">
                  <div className="modal-section-title">Assessor's Comments</div>
                  <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7, background: '#f9fbff', borderRadius: 8, padding: '10px 14px', border: '1px solid #e6f1fb' }}>
                    {report.assessorComments}
                  </div>
                </div>
                <div className="modal-divider" />
              </>
            )}

            {/* ══ SECTION 6 — SIGNATURES ══════════════════════════════════ */}
            <div className="modal-section">
              <div className="modal-section-title">Signatures</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 4 }}>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>ASSESSOR'S SIGNATURE</div>
                  <div style={{ fontSize: 15, fontStyle: 'italic', color: '#185FA5', borderBottom: '2px solid #222', paddingBottom: 8, minHeight: 32 }}>
                    {report.assessorSignature || ''}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{report.gradedBy?.name || ''}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>TRAINEE'S SIGNATURE</div>
                  <div style={{ fontSize: 15, fontStyle: 'italic', color: '#185FA5', borderBottom: '2px solid #222', paddingBottom: 8, minHeight: 32 }}>
                    {report.traineeSignature || ''}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{student?.name || ''}</div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="modal-section">
            <div className="modal-pending-msg">
              This report has not been assessed yet. You will receive a notification once your doctor reviews it.
            </div>
          </div>
        )}

        {/* ══ ACTIONS (hidden when printing) ═══════════════════════════════ */}
        <div className="modal-actions no-print">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-primary" onClick={() => window.print()}>🖨 Print as PDF</button>
        </div>

      </div>
    </div>
  );
}

// ── MAIN REPORTS PAGE ──────────────────────────────────────────────────────
export default function Reports() {
  const { user } = useAuth();
  const [reports,    setReports  ] = useState([]);
  const [rotation,   setRotation ] = useState(null);
  const [filter,     setFilter   ] = useState('All');
  const [loading,    setLoading  ] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm,   setShowForm  ] = useState(false);
  const [formError,  setFormError ] = useState('');
  const [selected,   setSelected  ] = useState(null);  // the report shown in the modal

  const [form, setForm] = useState({ title: '', type: 'weekly', date: '', file: null });

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get(`/api/reports/student/${user._id}`),
      api.get(`/api/rotations/current/${user._id}`)
    ]).then(([rep, rot]) => {
      setReports(rep.data);
      setRotation(rot.data);
    }).finally(() => setLoading(false));
  }, [user]);

  const filtered = reports.filter(r => {
    if (filter === 'All')     return true;
    if (filter === 'Weekly')  return r.type === 'weekly';
    if (filter === 'Monthly') return r.type === 'monthly';
    if (filter === 'Final')   return r.type === 'final';
    if (filter === 'Graded')  return r.status === 'graded';
    if (filter === 'Pending') return r.status === 'pending';
    return true;
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.title || !form.date) return setFormError('Title and date are required.');
    if (!rotation) return setFormError('You need an active rotation to submit a report.');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title',    form.title);
      fd.append('type',     form.type);
      fd.append('date',     form.date);
      fd.append('rotation', rotation._id);
      fd.append('hospital', rotation.hospital._id);
      if (form.file) fd.append('file', form.file);

      const res = await api.post('/api/reports', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setReports(prev => [res.data, ...prev]);
      setForm({ title: '', type: 'weekly', date: '', file: null });
      setShowForm(false);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <><Navbar /><div className="main"><div className="loading">Loading…</div></div></>;

  return (
    <>
      <Navbar />
      <main className="main">

        <div className="page-header">
<button className="btn-primary" onClick={() => { setShowForm(v => !v); setFormError(''); }}>
            {showForm ? 'Cancel' : '+ Submit report'}
          </button>
        </div>

        {/* SUBMIT FORM */}
        {showForm && (
          <div className="card">
            <div className="card-title">Submit a new report</div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="field">
                  <label>Report title</label>
                  <input
                    type="text"
                    placeholder="e.g. Week 4 Report"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>Report type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="final">Final</option>
                  </select>
                </div>
                <div className="field">
                  <label>Date</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label>Attachment (PDF / image, optional)</label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setForm(f => ({ ...f, file: e.target.files[0] }))}
                  />
                </div>
              </div>
              {formError && <p className="error-msg">{formError}</p>}
              <button className="btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit report'}
              </button>
            </form>
          </div>
        )}

        {/* FILTER TABS */}
        <div className="filter-tabs">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`filter-tab${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* REPORT LIST */}
        <div className="card">
          {filtered.length === 0 && (
            <div className="empty-row">
              {reports.length === 0
                ? 'No reports yet. Submit your first report above.'
                : 'No reports match this filter.'}
            </div>
          )}

          {filtered.map(r => (
            // Clicking any row opens the detail modal
            <div
              className="report-row report-row-lg report-row-clickable"
              key={r._id}
              onClick={() => setSelected(r)}
              title="Click to view details"
            >
              <div className="report-info">
                <div className="report-name">{r.title}</div>
                <div className="report-meta">
                  <span className="badge badge-blue">{r.type}</span>
                  <span className="report-date">{fmtShort(r.date)}</span>
                  {r.hospital?.name && (
                    <span className="report-hospital">{r.hospital.name}</span>
                  )}
                </div>
              </div>
              <div className="report-right">
                {r.locked && <span className="lock-icon" title="Locked">🔒</span>}
                <span className={r.status === 'graded' ? 'badge badge-green' : 'badge badge-amber'}>
                  {r.status === 'graded' ? 'Graded' : 'Pending'}
                </span>
                <div className={`grade-circle${r.grade ? '' : ' grade-empty'}`}>
                  {r.grade ?? '—'}
                </div>
                <span className="row-arrow">›</span>
              </div>
            </div>
          ))}
        </div>

      </main>

      {/* DETAIL MODAL */}
      {selected && (
        <ReportModal report={selected} student={user} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
