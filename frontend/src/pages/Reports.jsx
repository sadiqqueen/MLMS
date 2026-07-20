import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api    from '../api/axios';
import Navbar from '../components/Navbar';
import Sk     from '../components/Skeleton';
import ReportModal from '../components/ReportModal';
import { IconCheck, IconClock, IconXCircle, IconUserCheck, IconPlus, NavIcon } from '../components/icons';
import './trainee.css';

const API_BASE = '';

function fmt(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function safeArr(value) {
  return Array.isArray(value) ? value : [];
}

const FILTERS = ['All', 'Weekly', 'Monthly', 'Final', 'Graded', 'Pending'];

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

// One clickable report row (opens the detail modal).
function ReportRow({ r, fallbackTitle, onOpen, meta }) {
  return (
    <div className="tr-row tr-clickable" style={{ alignItems: 'center' }} onClick={() => onOpen(r)}>
      <div className="tr-row-main">
        <div className="tr-row-title">{r.title || fallbackTitle}</div>
        <div className="tr-row-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{meta}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <ReportStatus status={r.status} grade={r.grade} />
        {r.grade && !['Competent', 'Not-Competent'].includes(r.grade) && <div className="grade-circle">{r.grade}</div>}
        <NavIcon name="eye" size={16} style={{ color: 'var(--text-2)' }} />
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
      <main className="mt-content">
        <div className="mt-card" style={{ marginBlockEnd: 18 }}>
          <Sk w={200} h={16} style={{ marginBottom:16 }} />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
            {[0,1,2].map(i => <Sk key={i} h={80} r={10} />)}
          </div>
        </div>
        {[0,1].map(i => (
          <div className="mt-card" key={i} style={{ marginBlockEnd: 18 }}>
            <Sk w={180} h={16} style={{ marginBottom:14 }} />
            {[0,1].map(j => <Sk key={j} h={58} r={10} style={{ marginBottom: 10 }} />)}
          </div>
        ))}
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="mt-content">

        {/* ── UPLOAD A REPORT — shown when assigned to a specialty ── */}
        {distribution && (
          <div className="mt-card" style={{ marginBlockEnd: 18 }}>
            <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 16 }}>
              <div className="mt-card-title">Upload a report</div>
              {specialty?.name && <span className="mt-pill mt-pill--role">{specialty.name}</span>}
            </div>

            <div className="mt-field-grid" style={{ alignItems: 'end' }}>
              <div className="mt-field">
                <label className="mt-label">Report type</label>
                <select className="mt-select" value={uploadType} onChange={e => setUploadType(e.target.value)}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="final">Final</option>
                </select>
              </div>
              <div className="mt-field">
                <label className="mt-label">Report name</label>
                <input className="mt-input" type="text" placeholder="e.g. Week 4 Report"
                  value={uploadName} onChange={e => setUploadName(e.target.value)} />
              </div>
              <div className="mt-field mt-field-full">
                <label className="mt-label">Report file (PDF · max 10MB)</label>
                <label className="mt-dropzone">
                  <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display:'none' }}
                    onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                  <div className="mt-dropzone-ic"><NavIcon name="doc" size={22} /></div>
                  <div className="mt-dropzone-title">{uploadFile ? uploadFile.name : 'Click to choose a PDF file'}</div>
                  <div className="mt-dropzone-sub">{uploadFile ? 'Click to change' : 'PDF only · under 10MB'}</div>
                </label>
              </div>
            </div>

            <button className="mt-btn" style={{ marginBlockStart: 16 }} onClick={handleUpload} disabled={uploading || !uploadFile}>
              <NavIcon name="doc" size={15} /> {uploading ? 'Uploading…' : 'Upload report'}
            </button>

            {error    && <div style={{ marginBlockStart: 12, fontSize: 13, color: 'var(--danger)' }}>{error}</div>}
            {uploadMsg && <div style={{ marginBlockStart: 12, fontSize: 13, color: 'var(--success)' }}>✓ {uploadMsg}</div>}
          </div>
        )}

        {/* No active distribution — show legacy submit form */}
        {!distribution && !loading && (
          <>
            <div className="mt-empty" style={{ marginBlockEnd: 18 }}>
              <span className="mt-empty-icon"><NavIcon name="doc" size={24} /></span>
              <div className="mt-empty-title">Not assigned to a specialty yet</div>
              <div className="mt-empty-sub">Once your secretary assigns you to a specialty, your report templates will appear here.</div>
              <button className="mt-btn" onClick={() => { setShowForm(v => !v); setFormError(''); }}>
                {showForm ? 'Cancel' : <><IconPlus size={15} /> Submit report</>}
              </button>
            </div>

            {showForm && (
              <div className="mt-card" style={{ marginBlockEnd: 18 }}>
                <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 14 }}>
                  <div className="mt-card-title">Submit a new report</div>
                </div>
                <form onSubmit={handleLegacySubmit} className="mt-field-grid">
                  <div className="mt-field">
                    <label className="mt-label">Report title</label>
                    <input className="mt-input" type="text" placeholder="e.g. Week 4 Report" value={form.title}
                      onChange={e => setForm(f => ({ ...f, title:e.target.value }))} required />
                  </div>
                  <div className="mt-field">
                    <label className="mt-label">Report type</label>
                    <select className="mt-select" value={form.type} onChange={e => setForm(f => ({ ...f, type:e.target.value }))}>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="final">Final</option>
                    </select>
                  </div>
                  <div className="mt-field">
                    <label className="mt-label">Date</label>
                    <input className="mt-input" type="date" value={form.date}
                      onChange={e => setForm(f => ({ ...f, date:e.target.value }))} required />
                  </div>
                  <div className="mt-field">
                    <label className="mt-label">Attachment (PDF / image, optional)</label>
                    <input className="mt-input" style={{ height: 'auto', padding: 8 }} type="file" accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => setForm(f => ({ ...f, file:e.target.files[0] }))} />
                  </div>
                  <div className="mt-field-full">
                    {formError && <div style={{ fontSize: 13, color: 'var(--danger)', marginBlockEnd: 10 }}>{formError}</div>}
                    <button className="mt-btn" type="submit" disabled={submitting}>
                      {submitting ? 'Submitting…' : 'Submit report'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}

        {/* ── SUBMITTED REPORTS ── */}
        <div className="mt-filterbar">
          <div className="mt-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input type="text" placeholder="Search reports by name…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="mt-filter" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>

        <div className="tr-tabs">
          {FILTERS.map(f => (
            <button key={f} className={`tr-tab${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>

        {distribution ? (
          // grouped by type when V2
          [
            { label:'Weekly Reports',  items:weekly,  type:'weekly'  },
            { label:'Monthly Reports', items:monthly, type:'monthly' },
            { label:'Final Reports',   items:final,   type:'final'   },
          ].filter(({ type }) => {
            if (filter === 'All')     return true;
            if (filter === 'Weekly')  return type === 'weekly';
            if (filter === 'Monthly') return type === 'monthly';
            if (filter === 'Final')   return type === 'final';
            return true;
          }).map(({ label, items, type }) => {
            const visibleItems = filter === 'Graded'  ? items.filter(r => r.status === 'graded')
                               : filter === 'Pending' ? items.filter(r => r.status === 'pending')
                               : items;
            return (
              <div className="mt-card" key={type} style={{ marginBlockEnd: 18 }}>
                <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 14 }}>
                  <div className="mt-card-title">{label}</div>
                  <span className="mt-count">{visibleItems.length}</span>
                </div>
                {visibleItems.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-2)', padding: '10px 2px' }}>No {type} reports submitted yet</div>
                ) : (
                  <div className="tr-rows">
                    {visibleItems.map(r => (
                      <ReportRow key={r._id} r={r} onOpen={setSelected}
                        fallbackTitle={`${type.charAt(0).toUpperCase()+type.slice(1)} Report`}
                        meta={fmt(r.date)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          // flat list when V1
          <div className="mt-card">
            {filtered.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-2)', padding: '10px 2px' }}>
                {reportList.length === 0 ? 'No reports yet. Submit your first report above.' : 'No reports match this filter.'}
              </div>
            ) : (
              <div className="tr-rows">
                {filtered.map(r => (
                  <ReportRow key={r._id} r={r} onOpen={setSelected} fallbackTitle={r.title}
                    meta={<>
                      <span className="mt-pill mt-pill--role">{r.type}</span>
                      <span>{fmt(r.date)}</span>
                      {r.hospital?.name && <span>{r.hospital.name}</span>}
                    </>} />
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {selected && <ReportModal report={selected} student={user} onClose={() => setSelected(null)} />}
    </>
  );
}
