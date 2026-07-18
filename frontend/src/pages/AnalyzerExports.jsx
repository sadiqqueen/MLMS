// frontend/src/pages/AnalyzerExports.jsx
//
// Data Analyzer's Exports & Reports workspace:
//   1. Snapshots — the generated CSV bundles, each row downloadable (blob).
//   2. Run now — trigger a weekly/monthly/yearly snapshot on demand.
//   3. Analysis reports — upload a PDF/PPTX report to the SG/AS inbox + own list.
// Contracts:
//   GET  /api/analyzer/snapshots                → { data: [DataSnapshot] }
//   GET  /api/analyzer/snapshots/:id/download   → CSV blob
//   POST /api/analyzer/snapshots/run { range }  → 202 { data: [DataSnapshot] }
//   POST /api/analyzer/analysis-reports (FormData: file, range) → 201
//   GET  /api/analyzer/analysis-reports         → { data: [AnalysisReport] }
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const RANGES = ['weekly', 'monthly', 'yearly'];

const STRINGS = {
  ar: {
    snapshots: 'اللقطات', runNow: 'تشغيل الآن', reports: 'تقارير التحليل',
    range: 'النطاق', date: 'التاريخ', datasets: 'مجموعات البيانات', size: 'الحجم',
    action: 'الإجراء', download: 'تنزيل', downloading: 'جارٍ التنزيل…',
    weekly: 'أسبوعي', monthly: 'شهري', yearly: 'سنوي',
    noSnapshots: 'لا توجد لقطات بعد.', noReports: 'لم تقم برفع أي تقارير بعد.',
    uploadReport: 'رفع تقرير', file: 'الملف (PDF / PPT / PPTX)', name: 'الاسم',
    upload: 'رفع', uploading: 'جارٍ الرفع…', selectRange: '— اختر النطاق —',
    running: 'جارٍ التشغيل…', snapshotDone: 'تم إنشاء اللقطة', runFailed: 'فشل تشغيل اللقطة',
    uploaded: 'تم رفع التقرير', uploadFailed: 'فشل رفع التقرير',
    downloadFailed: 'فشل التنزيل', loadFailed: 'فشل التحميل',
    pickFile: 'اختر ملفاً', pickRange: 'اختر النطاق',
  },
  en: {
    snapshots: 'Snapshots', runNow: 'Run now', reports: 'Analysis Reports',
    range: 'Range', date: 'Date', datasets: 'Datasets', size: 'Size',
    action: 'Action', download: 'Download', downloading: 'Downloading…',
    weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
    noSnapshots: 'No snapshots yet.', noReports: 'You have not uploaded any reports yet.',
    uploadReport: 'Upload Report', file: 'File (PDF / PPT / PPTX)', name: 'Name',
    upload: 'Upload', uploading: 'Uploading…', selectRange: '— Select range —',
    running: 'Running…', snapshotDone: 'Snapshot created', runFailed: 'Snapshot run failed',
    uploaded: 'Report uploaded', uploadFailed: 'Report upload failed',
    downloadFailed: 'Download failed', loadFailed: 'Failed to load',
    pickFile: 'Choose a file', pickRange: 'Choose a range',
  },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function basename(p) {
  return String(p || '').split('/').pop() || 'download.csv';
}

export default function AnalyzerExports() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [snapshots, setSnapshots] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');       // range currently running
  const [downloadingId, setDownloadingId] = useState('');
  const [uploadRange, setUploadRange] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    try {
      const [sRes, rRes] = await Promise.all([
        api.get('/api/analyzer/snapshots', { cache: false }),
        api.get('/api/analyzer/analysis-reports', { cache: false }),
      ]);
      setSnapshots(sRes.data?.data || sRes.data || []);
      setReports(rRes.data?.data || rRes.data || []);
    } catch { showToast(t('loadFailed'), 'error'); }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function runSnapshot(range) {
    setRunning(range);
    try {
      await api.post('/api/analyzer/snapshots/run', { range });
      showToast(t('snapshotDone'));
      await load();
    } catch (e) {
      showToast(e.response?.data?.message || t('runFailed'), 'error');
    } finally { setRunning(''); }
  }

  async function downloadSnapshot(row) {
    setDownloadingId(row._id);
    try {
      const res = await api.get(`/api/analyzer/snapshots/${row._id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = basename(row.fileName);
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { showToast(t('downloadFailed'), 'error'); }
    finally { setDownloadingId(''); }
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!RANGES.includes(uploadRange)) { showToast(t('pickRange'), 'error'); return; }
    if (!uploadFile) { showToast(t('pickFile'), 'error'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('range', uploadRange);
      await api.post('/api/analyzer/analysis-reports', fd);
      showToast(t('uploaded'));
      setUploadRange(''); setUploadFile(null);
      e.target.reset();
      await load();
    } catch (err) {
      showToast(err.response?.data?.message || t('uploadFailed'), 'error');
    } finally { setUploading(false); }
  }

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>

        {/* ── SNAPSHOTS ── */}
        <div className="admin-card" style={{ marginBottom: 16 }}>
          <div className="admin-card-header" style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--brand-secondary)' }}>{t('snapshots')}</div>

          {/* Run-now buttons */}
          <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8, padding: '0 16px 12px' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>{t('runNow')}:</span>
            {RANGES.map(r => (
              <button key={r} className="btn-outline" disabled={!!running} onClick={() => runSnapshot(r)}>
                {running === r ? t('running') : t(r)}
              </button>
            ))}
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('range')}</th><th>{t('date')}</th><th>{t('datasets')}</th>
                  <th>{t('size')}</th><th>{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && [...Array(4)].map((_, i) => (
                  <tr key={i}><td><Sk w={70} h={22} r={20} /></td><td><Sk w={90} h={13} /></td><td><Sk w={40} h={13} /></td><td><Sk w={60} h={13} /></td><td><Sk w={100} h={30} r={8} /></td></tr>
                ))}
                {!loading && snapshots.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>{t('noSnapshots')}</td></tr>
                )}
                {!loading && snapshots.map(s => (
                  <tr key={s._id}>
                    <td><span className="badge badge-blue">{t(s.range) || s.range}</span></td>
                    <td>{fmtDate(s.generatedAt || s.createdAt)}</td>
                    <td>{Array.isArray(s.datasets) ? s.datasets.length : 0}</td>
                    <td>{fmtSize(s.sizeBytes)}</td>
                    <td>
                      <button className="btn-outline" disabled={downloadingId === s._id} onClick={() => downloadSnapshot(s)}>
                        {downloadingId === s._id ? t('downloading') : `⬇ ${t('download')}`}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── ANALYSIS REPORTS ── */}
        <div className="admin-card">
          <div className="admin-card-header" style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--brand-secondary)' }}>{t('reports')}</div>

          {/* Upload form */}
          <form onSubmit={submitReport} className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8, padding: '0 16px 12px', alignItems: 'flex-end' }}>
            <div className="admin-field" style={{ minWidth: 160 }}>
              <label>{t('range')} *</label>
              <select value={uploadRange} onChange={e => setUploadRange(e.target.value)}>
                <option value="">{t('selectRange')}</option>
                {RANGES.map(r => <option key={r} value={r}>{t(r)}</option>)}
              </select>
            </div>
            <div className="admin-field" style={{ minWidth: 220, flex: 1 }}>
              <label>{t('file')} *</label>
              <input type="file" accept=".pdf,.ppt,.pptx" onChange={e => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            <button type="submit" className="btn-primary" disabled={uploading}>
              {uploading ? t('uploading') : `⬆ ${t('upload')}`}
            </button>
          </form>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('range')}</th><th>{t('name')}</th><th>{t('date')}</th><th>{t('size')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && [...Array(3)].map((_, i) => (
                  <tr key={i}><td><Sk w={70} h={22} r={20} /></td><td><Sk w={160} h={13} /></td><td><Sk w={90} h={13} /></td><td><Sk w={60} h={13} /></td></tr>
                ))}
                {!loading && reports.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>{t('noReports')}</td></tr>
                )}
                {!loading && reports.map(r => (
                  <tr key={r._id}>
                    <td><span className="badge badge-green">{t(r.range) || r.range}</span></td>
                    <td><strong>{r.name}</strong></td>
                    <td>{fmtDate(r.createdAt)}</td>
                    <td>{fmtSize(r.sizeBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
