import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api    from '../api/axios';
import Navbar from '../components/Navbar';
import Sk     from '../components/Skeleton';

const API_BASE = '';

function fmt(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function fmtShort(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function safeArr(value) {
  return Array.isArray(value) ? value : [];
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
  { key:'na',    label:'N/A',            color:'#b2bec3' },
  { key:'below', label:'Below Standard', color:'#FF4757' },
  { key:'meets', label:'Meets Standard', color:'#f39c12' },
  { key:'above', label:'Above Standard', color:'#00B894' },
];

// ── REPORT DETAIL MODAL ────────────────────────────────────────────────────
function ReportModal({ report, student, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  if (!report) return null;

  const criteria    = report.assessmentCriteria || {};
  const isGraded    = report.status === 'graded';
  const hasFullAssess = isGraded && report.globalRating;
  const rota        = report.rotation;
  const rotaStr     = rota ? `${fmtShort(rota.startDate)} – ${fmtShort(rota.endDate)}` : '—';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal report-print-modal">

        <div className="print-header">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div className="print-logo"><img src="/logo.png" alt="MTMS" className="print-logo-img" /></div>
              <div className="print-subtitle">Clinical Training Assessment Report</div>
            </div>
            <div style={{ textAlign:'right', fontSize:11, color:'#666' }}>
              <div>Printed: {new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</div>
              <div style={{ marginTop:2 }}>Status: <strong>{isGraded ? 'Assessed' : 'Pending'}</strong></div>
            </div>
          </div>
        </div>

        <div className="modal-header no-print">
          <div>
            <div className="modal-title">{report.title}</div>
            <div className="modal-meta">
              <span className={`badge ${report.type === 'final' ? 'badge-red' : report.type === 'monthly' ? 'badge-amber' : 'badge-blue'}`}>{report.type}</span>
              <span style={{ fontSize:12, color:'#888' }}>{fmtShort(report.date)}</span>
              {report.hospital?.name && <span style={{ fontSize:12, color:'#666' }}>{report.hospital.name}</span>}
              <span className={isGraded ? 'badge badge-green' : 'badge badge-amber'}>
                {isGraded ? 'Assessed' : 'Pending review'}
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-divider no-print" />

        <div className="modal-section">
          <div className="modal-section-title">Report Details</div>
          <div className="assess-grid">
            <div className="assess-info-item">
              <span className="modal-label">Report Title</span>
              <span className="modal-value">{report.title}</span>
            </div>
            <div className="assess-info-item">
              <span className="modal-label">Report Type</span>
              <span className="modal-value" style={{ textTransform:'capitalize' }}>{report.type}</span>
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
                <a className="modal-link no-print" href={report.fileUrl} target="_blank" rel="noreferrer">View attachment ↗</a>
                <span className="print-only modal-value">{report.fileUrl}</span>
              </div>
            )}
          </div>
        </div>

        <div className="modal-divider" />

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
              <span className="modal-value" style={{ textTransform:'capitalize' }}>{rota?.status || '—'}</span>
            </div>
          </div>
        </div>

        <div className="modal-divider" />

        {isGraded ? (
          <>
            <div className="modal-section">
              <div className="modal-section-title">Assessment Result</div>
              <div style={{ display:'flex', gap:16, alignItems:'flex-start', flexWrap:'wrap', marginBottom:12 }}>
                {report.grade && !['Competent','Not-Competent'].includes(report.grade) && (
                  <div style={{ textAlign:'center' }}>
                    <div className="grade-circle-lg" style={{ margin:'0 auto 4px' }}>{report.grade}</div>
                    <div style={{ fontSize:11, color:'#888' }}>Letter Grade</div>
                  </div>
                )}
                {report.globalRating && (
                  <div style={{ textAlign:'center' }}>
                    <div style={{
                      padding:'10px 22px', borderRadius:10, fontWeight:700, fontSize:15,
                      background:report.globalRating === 'competent' ? '#e8fdf3' : '#fef0f0',
                      color:     report.globalRating === 'competent' ? '#00B894' : '#FF4757',
                      border:   `2px solid ${report.globalRating === 'competent' ? '#00B894' : '#FF4757'}`,
                    }}>
                      {report.globalRating === 'competent' ? 'Competent' : 'Not-Competent'}
                    </div>
                    <div style={{ fontSize:11, color:'#888', marginTop:4 }}>Global Rating</div>
                  </div>
                )}
                <div style={{ flex:1, minWidth:160 }}>
                  <div className="modal-row">
                    <span className="modal-label">Assessed by</span>
                    <span className="modal-value">{report.gradedBy?.name ?? '—'}</span>
                  </div>
                  <div className="modal-row" style={{ marginTop:6 }}>
                    <span className="modal-label">Assessed on</span>
                    <span className="modal-value">{fmt(report.gradedAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-divider" />

            {hasFullAssess && (
              <>
                <div className="modal-section">
                  <div className="modal-section-title">ASR — Assessment Criteria</div>
                  <div className="report-asr-grid">
                    <div className="report-asr-header">
                      <div className="report-asr-name">Criteria</div>
                      {RATINGS.map(r => (
                        <div key={r.key} className="report-asr-col" style={{ color:r.color }}>{r.label}</div>
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
                                style={selected === r.key ? { background:r.color, borderColor:r.color } : {}} />
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

            {report.assessorComments && (
              <>
                <div className="modal-section">
                  <div className="modal-section-title">Assessor's Comments</div>
                  <div style={{ fontSize:13, color:'#333', lineHeight:1.7, background:'#f9fbff', borderRadius:8, padding:'10px 14px', border:'1px solid #e6f1fb' }}>
                    {report.assessorComments}
                  </div>
                </div>
                <div className="modal-divider" />
              </>
            )}

            <div className="modal-section">
              <div className="modal-section-title">Signatures</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32, marginTop:4 }}>
                <div>
                  <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>ASSESSOR'S SIGNATURE</div>
                  <div style={{ fontSize:15, fontStyle:'italic', color:'#185FA5', borderBottom:'2px solid #222', paddingBottom:8, minHeight:32 }}>
                    {report.assessorSignature || ''}
                  </div>
                  <div style={{ fontSize:11, color:'#888', marginTop:4 }}>{report.gradedBy?.name || ''}</div>
                </div>
                <div>
                  <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>TRAINEE'S SIGNATURE</div>
                  <div style={{ fontSize:15, fontStyle:'italic', color:'#185FA5', borderBottom:'2px solid #222', paddingBottom:8, minHeight:32 }}>
                    {report.traineeSignature || ''}
                  </div>
                  <div style={{ fontSize:11, color:'#888', marginTop:4 }}>{student?.name || ''}</div>
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
  const { user }       = useAuth();
  const fileRef        = useRef();
  const [distribution, setDistribution] = useState(null);
  const [reports,      setReports     ] = useState([]);
  const [filter,       setFilter      ] = useState('All');
  const [loading,      setLoading     ] = useState(true);
  const [uploading,    setUploading   ] = useState(false);
  const [uploadType,   setUploadType  ] = useState('');
  const [uploadMsg,    setUploadMsg   ] = useState('');
  const [error,        setError       ] = useState('');
  const [selected,     setSelected    ] = useState(null);

  // legacy submit form state
  const [showForm,   setShowForm  ] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError ] = useState('');
  const [form,       setForm      ] = useState({ title:'', type:'weekly', date:'', file:null });

  useEffect(() => {
    if (!user) return;
    api.get('/api/trainee/reports')
      .then(r => {
        const data = r.data?.data || r.data;
        if (data?.distribution || data?.reports) {
          setDistribution(data.distribution || null);
          setReports(safeArr(data.reports));
        } else {
          return api.get(`/api/reports/student/${user._id}`)
            .then(r2 => setReports(safeArr(r2.data?.data || r2.data)));
        }
      })
      .catch(() =>
        api.get(`/api/reports/student/${user._id}`)
          .then(r => setReports(safeArr(r.data?.data || r.data)))
          .catch(console.error)
      )
      .finally(() => setLoading(false));
  }, [user]);

  const specialty = distribution?.specialtyId;
  const hasPdfs   = specialty && (specialty.weeklyReportPdf || specialty.monthlyReportPdf || specialty.finalReportPdf);

  async function handleUpload(type) {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (!file.type.includes('pdf')) { setError('Only PDF files allowed'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('File must be under 10MB'); return; }

    setUploading(true);
    setUploadType(type);
    setError('');
    setUploadMsg('');

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', type);
      fd.append('date', new Date().toISOString().slice(0,10));
      fd.append('title', `${type.charAt(0).toUpperCase() + type.slice(1)} Report — ${specialty?.name || ''}`);
      if (distribution?._id) fd.append('rotation', distribution._id);
      if (distribution?.hospitalId?._id) fd.append('hospital', distribution.hospitalId._id);

      const res = await api.post('/api/reports', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      const newReport = res.data?.data || res.data;
      if (newReport && typeof newReport === 'object') setReports(prev => [newReport, ...safeArr(prev)]);
      setUploadMsg(`${type.charAt(0).toUpperCase() + type.slice(1)} report submitted successfully!`);
      fileRef.current.value = '';
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadType('');
    }
  }

  function triggerUpload(type) {
    setUploadType(type);
    fileRef.current?.click();
  }

  async function handleLegacySubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.title || !form.date) return setFormError('Title and date are required.');
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('type',  form.type);
      fd.append('date',  form.date);
      if (form.file) fd.append('file', form.file);
      const res = await api.post('/api/reports', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      const newReport = res.data?.data || res.data;
      if (newReport && typeof newReport === 'object') setReports(prev => [newReport, ...safeArr(prev)]);
      setForm({ title:'', type:'weekly', date:'', file:null });
      setShowForm(false);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  }

  const reportList = safeArr(reports);
  const filtered = reportList.filter(r => {
    if (filter === 'All')     return true;
    if (filter === 'Weekly')  return r.type === 'weekly';
    if (filter === 'Monthly') return r.type === 'monthly';
    if (filter === 'Final')   return r.type === 'final';
    if (filter === 'Graded')  return r.status === 'graded';
    if (filter === 'Pending') return r.status === 'pending';
    return true;
  });

  const weekly  = reportList.filter(r => r.type === 'weekly');
  const monthly = reportList.filter(r => r.type === 'monthly');
  const final   = reportList.filter(r => r.type === 'final');

  if (loading) return (
    <>
      <Navbar />
      <main className="main">
        <div className="card">
          <Sk w={200} h={16} style={{ marginBottom:16 }} />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
            {[0,1,2].map(i => <Sk key={i} h={100} r={10} />)}
          </div>
        </div>
        {[0,1,2].map(i => (
          <div className="card" key={i}>
            <Sk w={180} h={16} style={{ marginBottom:14 }} />
            {[0,1].map(j => (
              <div key={j} className="report-row">
                <div className="report-info"><Sk w={150} h={13} /><Sk w={80} h={11} style={{ marginTop:4 }} /></div>
                <div className="report-right"><Sk w={60} h={20} r={20} /></div>
              </div>
            ))}
          </div>
        ))}
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="main">

        {/* ── PDF TEMPLATES — auto-loaded when assigned to specialty ── */}
        {distribution && (
          <div className="card">
            <div className="card-title" style={{ marginBottom:14 }}>
              📄 Report Templates
              {specialty?.name && <span className="badge badge-blue" style={{ marginLeft:8 }}>{specialty.name}</span>}
            </div>

            {!hasPdfs && (
              <div style={{ fontSize:13, color:'#8B8FA8', padding:'12px 0' }}>
                PDF templates for your specialty have not been uploaded yet. Contact your secretary.
              </div>
            )}

            {hasPdfs && (
              <>
                <div style={{ fontSize:13, color:'#4B5563', marginBottom:14, lineHeight:1.6 }}>
                  Download the template for your specialty, fill it in, then upload the completed PDF using the button below.
                  Your rotation: <strong>{fmt(distribution.startDate)} – {fmt(distribution.endDate)}</strong>
                  {distribution.durationWeeks ? ` · ${distribution.durationWeeks} weeks` : ''}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:8 }}>
                  {[
                    { type:'weekly',  label:'Weekly Report',  pdf:specialty?.weeklyReportPdf,  color:'#2563EB', bg:'#DBEAFE' },
                    { type:'monthly', label:'Monthly Report', pdf:specialty?.monthlyReportPdf, color:'#D97706', bg:'#FEF3C7' },
                    { type:'final',   label:'Final Report',   pdf:specialty?.finalReportPdf,   color:'#DC2626', bg:'#FEE2E2' },
                  ].map(({ type, label, pdf, color, bg }) => (
                    <div key={type} style={{ border:'1px solid #E8E9EF', borderRadius:10, padding:'16px 14px', background:'#fff', display:'flex', flexDirection:'column', gap:10 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1B1464' }}>{label}</div>

                      {pdf ? (
                        <a
                          href={`${API_BASE}${pdf}`}
                          download
                          style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:7, background:bg, color, fontWeight:600, fontSize:12, textDecoration:'none' }}
                        >
                          ⬇ Download Template
                        </a>
                      ) : (
                        <span style={{ fontSize:12, color:'#D1D5DB' }}>Template not uploaded yet</span>
                      )}

                      <button
                        style={{
                          display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
                          borderRadius:7, background:'#FF6B35', color:'#fff',
                          border:'none', fontWeight:600, fontSize:12, cursor:'pointer',
                          opacity: uploading && uploadType === type ? 0.7 : 1
                        }}
                        onClick={() => triggerUpload(type)}
                        disabled={uploading}
                      >
                        {uploading && uploadType === type ? '⏳ Uploading…' : '⬆ Upload Completed'}
                      </button>
                    </div>
                  ))}
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display:'none' }}
                  onChange={() => handleUpload(uploadType)}
                />

                {error    && <div style={{ fontSize:13, color:'#DC2626', marginTop:8, padding:'8px 12px', background:'#FEE2E2', borderRadius:7 }}>{error}</div>}
                {uploadMsg && <div style={{ fontSize:13, color:'#065F46', marginTop:8, padding:'8px 12px', background:'#D1FAE5', borderRadius:7 }}>✓ {uploadMsg}</div>}
              </>
            )}
          </div>
        )}

        {/* No active distribution — show legacy submit form */}
        {!distribution && !loading && (
          <>
            <div className="card" style={{ textAlign:'center', padding:40, color:'#8B8FA8' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:16, fontWeight:600, color:'#4B5563', marginBottom:6 }}>Not assigned to a specialty yet</div>
              <div style={{ fontSize:13 }}>Once your secretary assigns you to a specialty, your report templates will appear here.</div>
            </div>

            <div className="page-header">
              <button className="btn-primary" onClick={() => { setShowForm(v => !v); setFormError(''); }}>
                {showForm ? 'Cancel' : '+ Submit report'}
              </button>
            </div>

            {showForm && (
              <div className="card">
                <div className="card-title">Submit a new report</div>
                <form onSubmit={handleLegacySubmit}>
                  <div className="form-row">
                    <div className="field">
                      <label>Report title</label>
                      <input type="text" placeholder="e.g. Week 4 Report" value={form.title} onChange={e => setForm(f => ({ ...f, title:e.target.value }))} required />
                    </div>
                    <div className="field">
                      <label>Report type</label>
                      <select value={form.type} onChange={e => setForm(f => ({ ...f, type:e.target.value }))}>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="final">Final</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Date</label>
                      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date:e.target.value }))} required />
                    </div>
                    <div className="field">
                      <label>Attachment (PDF / image, optional)</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setForm(f => ({ ...f, file:e.target.files[0] }))} />
                    </div>
                  </div>
                  {formError && <p className="error-msg">{formError}</p>}
                  <button className="btn-primary" type="submit" disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Submit report'}
                  </button>
                </form>
              </div>
            )}
          </>
        )}

        {/* ── SUBMITTED REPORTS ── */}
        <div className="filter-tabs">
          {FILTERS.map(f => (
            <button key={f} className={`filter-tab${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>

        {distribution ? (
          // grouped by type when V2
          [
            { label:'Weekly Reports',  items:weekly,  badge:'badge-blue',  type:'weekly'  },
            { label:'Monthly Reports', items:monthly, badge:'badge-amber', type:'monthly' },
            { label:'Final Reports',   items:final,   badge:'badge-red',   type:'final'   },
          ].filter(({ type }) => {
            if (filter === 'All')     return true;
            if (filter === 'Weekly')  return type === 'weekly';
            if (filter === 'Monthly') return type === 'monthly';
            if (filter === 'Final')   return type === 'final';
            return true;
          }).map(({ label, items, badge, type }) => {
            const visibleItems = filter === 'Graded'  ? items.filter(r => r.status === 'graded')
                               : filter === 'Pending' ? items.filter(r => r.status === 'pending')
                               : items;
            return (
              <div className="card" key={type}>
                <div className="card-title">
                  {label} <span className={`badge ${badge}`}>{visibleItems.length}</span>
                </div>
                {visibleItems.length === 0 && <div className="empty-row">No {type} reports submitted yet</div>}
                {visibleItems.map(r => (
                  <div className="report-row report-row-lg report-row-clickable" key={r._id} onClick={() => setSelected(r)}>
                    <div className="report-info">
                      <div className="report-name">{r.title || `${type.charAt(0).toUpperCase()+type.slice(1)} Report`}</div>
                      <div className="report-date">{fmt(r.date)}</div>
                    </div>
                    <div className="report-right">
                      <span className={r.status==='graded' || r.status==='approved' ? 'badge badge-green' : 'badge badge-amber'}>
                        {r.status==='graded' || r.status==='approved' ? 'Assessed' : r.status || 'Pending'}
                      </span>
                      {r.grade && <div className={`grade-circle${r.grade ? '' : ' grade-empty'}`}>{r.grade}</div>}
                      {r.fileUrl && <a href={`${API_BASE}${r.fileUrl}`} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#185FA5', fontWeight:500 }}>View ↗</a>}
                      <span className="row-arrow">›</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        ) : (
          // flat list when V1
          <div className="card">
            {filtered.length === 0 && (
              <div className="empty-row">
                {reportList.length === 0 ? 'No reports yet. Submit your first report above.' : 'No reports match this filter.'}
              </div>
            )}
            {filtered.map(r => (
              <div className="report-row report-row-lg report-row-clickable" key={r._id} onClick={() => setSelected(r)}>
                <div className="report-info">
                  <div className="report-name">{r.title}</div>
                  <div className="report-meta">
                    <span className="badge badge-blue">{r.type}</span>
                    <span className="report-date">{fmtShort(r.date)}</span>
                    {r.hospital?.name && <span className="report-hospital">{r.hospital.name}</span>}
                  </div>
                </div>
                <div className="report-right">
                  {r.locked && <span className="lock-icon" title="Locked">🔒</span>}
                  <span className={r.status === 'graded' ? 'badge badge-green' : 'badge badge-amber'}>
                    {r.status === 'graded' ? 'Graded' : 'Pending'}
                  </span>
                  <div className={`grade-circle${r.grade ? '' : ' grade-empty'}`}>{r.grade ?? '—'}</div>
                  <span className="row-arrow">›</span>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {selected && <ReportModal report={selected} student={user} onClose={() => setSelected(null)} />}
    </>
  );
}
