import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api from '../api/axios';

const API_BASE = 'http://https://mlms-production.up.railway.app';

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

// Each rating column: key used in state, display label, color when selected
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

// ── Circular bubble button selector (used for letter grades) ──────────────
function GradeBubbles({ selected, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {LETTER_GRADES.map(g => {
        const active = selected === g;
        return (
          <button
            key={g}
            type="button"
            onClick={() => !disabled && onChange(active ? '' : g)}
            disabled={disabled}
            style={{
              width: 40, height: 40,
              borderRadius: '50%',
              border: active ? '2px solid #185FA5' : '1.5px solid #d1d5db',
              background: active ? '#185FA5' : 'white',
              color: active ? 'white' : '#444',
              fontSize: 12, fontWeight: 700,
              cursor: disabled ? 'default' : 'pointer',
              transition: 'all 0.12s',
              flexShrink: 0,
              opacity: disabled && !active ? 0.5 : 1,
            }}
          >{g}</button>
        );
      })}
    </div>
  );
}

// ── Assessment Modal ───────────────────────────────────────────────────────
function AssessmentModal({ report, doctor, onClose, onSaved }) {
  const isGraded = report.status === 'graded';

  const [criteria,     setCriteria    ] = useState(report.assessmentCriteria || {});
  const [globalRating, setGlobalRating] = useState(report.globalRating       || '');
  const [letterGrade,  setLetterGrade ] = useState(report.grade && !['Competent','Not-Competent'].includes(report.grade) ? report.grade : '');
  const [comments,     setComments    ] = useState(report.assessorComments   || '');
  const [assessorSig,  setAssessorSig ] = useState(report.assessorSignature  || '');
  const [traineeSig,   setTraineeSig  ] = useState(report.traineeSignature   || '');
  const [saving,       setSaving      ] = useState(false);
  const [error,        setError       ] = useState('');

  const rota     = report.rotation;
  const rotaStr  = rota ? `${fmtDate(rota.startDate)} – ${fmtDate(rota.endDate)} · ${rota.status}` : '—';

  function toggleCriteria(name, key) {
    if (isGraded) return;
    setCriteria(p => ({ ...p, [name]: p[name] === key ? '' : key }));
  }

  async function handleSubmit() {
    if (!globalRating) return setError('Please select a global rating (Competent or Not-Competent).');
    setSaving(true);
    setError('');
    try {
      const res = await api.put(`/api/reports/${report._id}/grade`, {
        grade:              letterGrade || undefined,
        globalRating,
        assessmentCriteria: criteria,
        assessorComments:   comments,
        assessorSignature:  assessorSig,
        traineeSignature:   traineeSig,
      });
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit assessment.');
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal assessment-modal">

        {/* Print header */}
        <div className="print-header">
          <div className="print-logo"><img src="public/logo.png" alt="MedLearn LMS" className="print-logo-img" /></div>
          <div className="print-subtitle">Official Assessment Record</div>
        </div>

        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">Assessment Form</div>
            <div className="modal-meta">
              <span className={`badge ${report.type === 'final' ? 'badge-red' : report.type === 'monthly' ? 'badge-amber' : 'badge-blue'}`}>{report.type}</span>
              <span style={{ fontSize: 12, color: '#888' }}>{report.title}</span>
            </div>
          </div>
          <button className="modal-close no-print" onClick={onClose}>✕</button>
        </div>

        <div className="modal-divider" />

        {/* 1 — Trainee Information */}
        <div className="modal-section">
          <div className="modal-section-title">1 · Trainee Information</div>
          <div className="assess-grid">
            <div className="assess-info-item">
              <span className="modal-label">Trainee's Name</span>
              <span className="modal-value">{report.student?.name || '—'}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">IMA Number</span>
              <span className="modal-value">{report.student?.studentId || '—'}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Date of Assessment</span>
              <span className="modal-value">{fmtDate(report.date)}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Trainee's ROTA</span>
              <span className="modal-value">{rotaStr}</span>
            </div>
          </div>
        </div>

        <div className="modal-divider" />

        {/* 2 — Assessor Information */}
        <div className="modal-section">
          <div className="modal-section-title">2 · Assessor Information</div>
          <div className="assess-grid">
            <div className="assess-info-item">
              <span className="modal-label">Assessor's Name</span>
              <span className="modal-value">{doctor?.name || '—'}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Email Address</span>
              <span className="modal-value">{doctor?.email || '—'}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Phone Number</span>
              <span className="modal-value">{doctor?.phone || '—'}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Hospital</span>
              <span className="modal-value">{report.hospital?.name || '—'}</span>
            </div>
          </div>
        </div>

        <div className="modal-divider" />

        {/* 3 — ASR Bubble Sheet */}
        <div className="modal-section">
          <div className="modal-section-title">3 · ASR — Assessment Criteria</div>

          {/* Column headers */}
          <div className="asr-header-row">
            <div className="asr-criteria-label" />
            {RATINGS.map(r => (
              <div key={r.key} className="asr-col-header" style={{ color: r.color }}>
                {r.label}
              </div>
            ))}
          </div>

          {/* Criteria rows */}
          {ASR_CRITERIA.map((name, idx) => (
            <div key={name} className={`asr-row${idx % 2 === 1 ? ' asr-row-alt' : ''}`}>
              <div className="asr-criteria-label">{name}</div>
              {RATINGS.map(r => {
                const active = criteria[name] === r.key;
                return (
                  <div key={r.key} className="asr-bubble-cell">
                    <button
                      type="button"
                      onClick={() => toggleCriteria(name, r.key)}
                      disabled={isGraded}
                      className={`asr-bubble${active ? ' active' : ''}`}
                      style={active ? { background: r.color, borderColor: r.color, color: 'white' } : {}}
                      title={r.label}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="modal-divider" />

        {/* 4 — Global Rating */}
        <div className="modal-section">
          <div className="modal-section-title">4 · Global Rating</div>
          <div className="assess-global-row">
            {[
              { val: 'not-competent', label: 'Not-Competent' },
              { val: 'competent',     label: 'Competent'     },
            ].map(opt => (
              <label
                key={opt.val}
                className={`assess-global-opt${globalRating === opt.val ? ' selected' : ''}${opt.val === 'competent' ? ' competent' : ' not-competent'}`}
              >
                <input
                  type="radio"
                  name="globalRating"
                  value={opt.val}
                  checked={globalRating === opt.val}
                  onChange={() => !isGraded && setGlobalRating(opt.val)}
                  disabled={isGraded}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="modal-divider" />

        {/* 5 — Letter Grade Bubble Sheet */}
        <div className="modal-section">
          <div className="modal-section-title">5 · Letter Grade</div>
          <GradeBubbles
            selected={letterGrade}
            onChange={setLetterGrade}
            disabled={isGraded}
          />
          {letterGrade && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              Selected: <strong style={{ color: '#185FA5' }}>{letterGrade}</strong>
            </div>
          )}
        </div>

        <div className="modal-divider" />

        {/* 6 — Comments */}
        <div className="modal-section">
          <div className="modal-section-title">6 · Comments of Assessor</div>
          <textarea
            className="assess-comments"
            value={comments}
            onChange={e => !isGraded && setComments(e.target.value)}
            placeholder="Enter assessment comments…"
            rows={4}
            readOnly={isGraded}
          />
        </div>

        <div className="modal-divider" />

        {/* 7 — Signatures */}
        <div className="modal-section">
          <div className="assess-sig-row">
            <div className="assess-sig-field">
              <label className="modal-label">Assessor's Signature</label>
              <input
                type="text"
                className="assess-sig-input"
                value={assessorSig}
                onChange={e => !isGraded && setAssessorSig(e.target.value)}
                placeholder="Type name to sign"
                readOnly={isGraded}
              />
              <div className="assess-sig-line" />
            </div>
            <div className="assess-sig-field">
              <label className="modal-label">Trainee's Signature</label>
              <input
                type="text"
                className="assess-sig-input"
                value={traineeSig}
                onChange={e => !isGraded && setTraineeSig(e.target.value)}
                placeholder="Trainee's signature"
                readOnly={isGraded}
              />
              <div className="assess-sig-line" />
            </div>
          </div>
        </div>

        {error && <p style={{ color: '#e74c3c', fontSize: 13, padding: '0 22px 8px', margin: 0 }}>{error}</p>}

        {/* Actions */}
        <div className="modal-actions no-print">
          <button className="btn-secondary" onClick={onClose}>Close</button>
          <button className="btn-secondary" onClick={() => window.print()}>🖨 Print</button>
          {!isGraded && (
            <button className="btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Assessment'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function DoctorReports() {
  const { user: me } = useAuth();
  const [reports,     setReports    ] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [filter,      setFilter     ] = useState('pending');
  const [search,      setSearch     ] = useState('');
  const [assessModal, setAssessModal] = useState(null);
  const [toasts,      setToasts     ] = useState([]);

  function showToast(msg, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    if (!me?._id) { setLoading(false); return; }
    api.get(`/api/reports/doctor/${me._id}`)
      .then(r => setReports(r.data))
      .catch(() => showToast('Failed to load reports', 'error'))
      .finally(() => setLoading(false));
  }, [me]);

  function handleAssessmentSaved(updated) {
    setReports(prev => prev.map(r => r._id === updated._id ? { ...r, ...updated } : r));
    showToast('Assessment submitted successfully');
  }

  const filtered = reports
    .filter(r => {
      if (filter === 'pending') return r.status === 'pending';
      if (filter === 'graded')  return r.status === 'graded';
      return true;
    })
    .filter(r => {
      const q = search.toLowerCase();
      return !q || r.student?.name?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q);
    });

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const gradedCount  = reports.filter(r => r.status === 'graded').length;

  if (loading) return <><Navbar /><main className="admin-main"><div className="loading">Loading…</div></main></>;

  return (
    <>
      <Navbar />
      <main className="admin-main">


        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 8 }}>
          {[
            { label: 'Pending Review', count: pendingCount, color: '#f39c12', bg: '#fff8e1' },
            { label: 'Assessed',       count: gradedCount,  color: '#00B894', bg: '#e8fdf3' },
          ].map(c => (
            <div key={c.label} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: c.color, flexShrink: 0 }}>
                {c.count}
              </div>
              <div style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        <div className="admin-card">

          <div className="admin-toolbar">
            <input
              className="admin-search"
              placeholder="Search by student name or report title…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, padding: '0 20px 14px', flexWrap: 'wrap' }}>
            {[
              ['pending', `Pending (${pendingCount})`],
              ['graded',  `Assessed (${gradedCount})`],
              ['all',     `All (${reports.length})`],
            ].map(([val, label]) => (
              <button key={val} className={`filter-tab${filter === val ? ' active' : ''}`} onClick={() => setFilter(val)}>
                {label}
              </button>
            ))}
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Report Title</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>File</th>
                  <th>Grade</th>
                  <th>Rating</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="admin-empty">No reports found</td></tr>
                )}
                {filtered.map((r, i) => (
                  <tr key={r._id} style={r.status === 'pending' ? { background: '#fffef5' } : {}}>
                    <td style={{ color: '#aaa' }}>{i + 1}</td>

                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.student?.photoUrl
                          ? <img src={`${API_BASE}${r.student.photoUrl}`} alt="" className="cell-photo" />
                          : <div className="cell-initials">{r.student?.initials || r.student?.name?.[0] || '?'}</div>
                        }
                        <div>
                          <strong>{r.student?.name || '—'}</strong>
                          {r.student?.studentId && (
                            <div style={{ fontSize: 11, color: '#888' }}>IMA: {r.student.studentId}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td style={{ maxWidth: 180 }}>
                      <div style={{ fontWeight: 500, color: '#111', fontSize: 13 }}>{r.title}</div>
                    </td>

                    <td>
                      <span className={r.type === 'final' ? 'badge badge-red' : r.type === 'monthly' ? 'badge badge-amber' : 'badge badge-blue'}>{r.type}</span>
                    </td>

                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.date)}</td>

                    <td>
                      {r.fileUrl
                        ? <a href={`${API_BASE}${r.fileUrl}`} target="_blank" rel="noreferrer" style={{ color: '#185FA5', fontSize: 13, fontWeight: 500 }}>View ↗</a>
                        : <span style={{ color: '#ccc', fontSize: 12 }}>None</span>
                      }
                    </td>

                    {/* Letter grade column */}
                    <td>
                      {r.status === 'graded' && r.grade && !['Competent','Not-Competent'].includes(r.grade) ? (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#185FA5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
                          {r.grade}
                        </div>
                      ) : (
                        <span style={{ color: '#ccc', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Global rating column */}
                    <td>
                      {r.status === 'graded' ? (
                        <span className={`assess-rating-badge ${r.globalRating === 'competent' ? 'competent' : 'not-competent'}`}>
                          {r.globalRating === 'competent' ? 'Competent' : 'Not-Competent'}
                        </span>
                      ) : (
                        <span style={{ color: '#ccc', fontSize: 12 }}>—</span>
                      )}
                    </td>

                    <td style={{ minWidth: 110 }}>
                      {r.status === 'graded' ? (
                        <div>
                          <button className="btn-action edit" onClick={() => setAssessModal(r)}>View</button>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>By {r.gradedBy?.name || '—'}</div>
                          <div style={{ fontSize: 11, color: '#aaa' }}>{fmtDate(r.gradedAt)}</div>
                        </div>
                      ) : (
                        <button className="btn-primary" onClick={() => setAssessModal(r)}>Assess</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </main>

      {assessModal && (
        <AssessmentModal
          report={assessModal}
          doctor={me}
          onClose={() => setAssessModal(null)}
          onSaved={handleAssessmentSaved}
        />
      )}

      <Toast toasts={toasts} />
    </>
  );
}
