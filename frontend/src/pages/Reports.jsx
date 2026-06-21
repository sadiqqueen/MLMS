import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api    from '../api/axios';
import Navbar from '../components/Navbar';
import Sk     from '../components/Skeleton';
import { IconCheck, IconClock, IconXCircle, IconUserCheck } from '../components/icons';

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

// Report status as an icon badge: pending=clock, assessed=check,
// competent=user-check, not-competent=x. Hover shows the label.
function ReportStatus({ status, grade }) {
  const graded = status === 'graded' || status === 'approved';
  if (!graded)
    return <span className="status-ic status-ic-amber" title="Pending review"><IconClock size={15} /></span>;
  if (grade === 'Not-Competent')
    return <span className="status-ic status-ic-red" title="Not Competent"><IconXCircle size={15} /></span>;
  if (grade === 'Competent')
    return <span className="status-ic status-ic-green" title="Competent"><IconUserCheck size={15} /></span>;
  return <span className="status-ic status-ic-green" title="Assessed"><IconCheck size={15} /></span>;
}

// ── MAIN REPORTS PAGE ──────────────────────────────────────────────────────
export default function Reports() {
  const { user }       = useAuth();
  const fileRef        = useRef();
  const [distribution, setDistribution] = useState(null);
  const [reports,      setReports     ] = useState([]);
  const [filter,       setFilter      ] = useState('All');
  const [search,       setSearch      ] = useState('');
  const [sort,         setSort        ] = useState('newest');
  const [loading,      setLoading     ] = useState(true);
  const [uploading,    setUploading   ] = useState(false);
  const [uploadType,   setUploadType  ] = useState('weekly');
  const [uploadName,   setUploadName  ] = useState('');
  const [uploadFile,   setUploadFile  ] = useState(null);
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

  async function handleUpload() {
    const file = uploadFile || fileRef.current?.files?.[0];
    if (!file) { setError('Please choose a PDF file to upload.'); return; }
    if (!file.type.includes('pdf')) { setError('Only PDF files allowed'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('File must be under 10MB'); return; }

    setUploading(true);
    setError('');
    setUploadMsg('');

    try {
      const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', uploadType);
      fd.append('date', new Date().toISOString().slice(0,10));
      fd.append('title', uploadName.trim() || `${cap(uploadType)} Report — ${specialty?.name || ''}`);
      if (distribution?._id) fd.append('rotation', distribution._id);
      if (distribution?.hospitalId?._id) fd.append('hospital', distribution.hospitalId._id);

      const res = await api.post('/api/reports', fd, { headers:{ 'Content-Type':'multipart/form-data' } });
      const newReport = res.data?.data || res.data;
      if (newReport && typeof newReport === 'object') setReports(prev => [newReport, ...safeArr(prev)]);
      setUploadMsg(`${cap(uploadType)} report submitted successfully!`);
      setUploadName('');
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
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
  const q = search.trim().toLowerCase();
  const matchesSearch = r =>
    !q || (r.title || '').toLowerCase().includes(q) || (r.hospital?.name || '').toLowerCase().includes(q);
  const applySort = arr => {
    const a = [...arr];
    if (sort === 'name') a.sort((x, y) => (x.title || '').localeCompare(y.title || ''));
    else {
      a.sort((x, y) => new Date(y.date || y.createdAt || 0) - new Date(x.date || x.createdAt || 0));
      if (sort === 'oldest') a.reverse();
    }
    return a;
  };
  const shape = arr => applySort(arr.filter(matchesSearch));

  const filtered = shape(reportList.filter(r => {
    if (filter === 'All')     return true;
    if (filter === 'Weekly')  return r.type === 'weekly';
    if (filter === 'Monthly') return r.type === 'monthly';
    if (filter === 'Final')   return r.type === 'final';
    if (filter === 'Graded')  return r.status === 'graded';
    if (filter === 'Pending') return r.status === 'pending';
    return true;
  }));

  const weekly  = shape(reportList.filter(r => r.type === 'weekly'));
  const monthly = shape(reportList.filter(r => r.type === 'monthly'));
  const final   = shape(reportList.filter(r => r.type === 'final'));

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

        {/* ── UPLOAD A REPORT — shown when assigned to a specialty ── */}
        {distribution && (
          <div className="card">
            <div className="card-title" style={{ marginBottom:16 }}>
              ⬆ Upload a Report
              {specialty?.name && <span className="badge badge-blue" style={{ marginInlineStart:8 }}>{specialty.name}</span>}
            </div>

            <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
              <div className="field" style={{ flex:'1 1 150px', marginBottom:0 }}>
                <label>Report type</label>
                <select value={uploadType} onChange={e => setUploadType(e.target.value)}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="final">Final</option>
                </select>
              </div>
              <div className="field" style={{ flex:'2 1 240px', marginBottom:0 }}>
                <label>Report name</label>
                <input
                  type="text"
                  placeholder="e.g. Week 4 Report"
                  value={uploadName}
                  onChange={e => setUploadName(e.target.value)}
                />
              </div>
            </div>

            <div className="field" style={{ marginTop:14, marginBottom:0 }}>
              <label>Report file (PDF · max 10MB)</label>
              <label className="file-drop">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  style={{ display:'none' }}
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                />
                <span className="file-drop-icon">📎</span>
                <span className="file-drop-text">
                  {uploadFile ? uploadFile.name : 'Click to choose a PDF file'}
                </span>
                {uploadFile && <span className="file-drop-change">Change</span>}
              </label>
            </div>

            <button
              className="btn-primary"
              style={{ marginTop:16 }}
              onClick={handleUpload}
              disabled={uploading || !uploadFile}
            >
              {uploading ? 'Uploading…' : '⬆ Upload report'}
            </button>

            {error    && <div className="upload-msg upload-err">{error}</div>}
            {uploadMsg && <div className="upload-msg upload-ok">✓ {uploadMsg}</div>}
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
        <div className="report-search-bar">
          <input
            type="text"
            className="report-search-input"
            placeholder="Search reports by name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="report-sort-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>

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
                      <ReportStatus status={r.status} grade={r.grade} />
                      {r.grade && !['Competent','Not-Competent'].includes(r.grade) && <div className="grade-circle">{r.grade}</div>}
                      {r.fileUrl && <a href={`${API_BASE}${r.fileUrl}`} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--link)', fontWeight:500 }}>View ↗</a>}
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
                  <ReportStatus status={r.status} grade={r.grade} />
                  {r.grade && !['Competent','Not-Competent'].includes(r.grade) && <div className="grade-circle">{r.grade}</div>}
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
