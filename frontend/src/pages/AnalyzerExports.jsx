// frontend/src/pages/AnalyzerExports.jsx
//
// Data Analyzer's Exports & Reports workspace — restyled to the mt- shell
// (W1-Analyzer), functionality unchanged (dashboards.md §8, lists_views §8):
//   1. Snapshots — generated CSV bundles, each row downloadable (blob).
//   2. Run now — trigger a weekly/monthly/yearly snapshot on demand.
//   3. Analysis reports — upload a PDF/PPTX report to the SG/AS inbox + own list.
// Contracts (unchanged):
//   GET  /api/analyzer/snapshots                → { data: [DataSnapshot] }
//   GET  /api/analyzer/snapshots/:id/download   → CSV blob
//   POST /api/analyzer/snapshots/run { range }  → 202 { data: [DataSnapshot] }
//   POST /api/analyzer/analysis-reports (FormData: file, range) → 201
//   GET  /api/analyzer/analysis-reports         → { data: [AnalysisReport] }
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { Pill } from './AnalyzerListKit';
import api from '../api/axios';
import './Analyzer.css';

const RANGES = ['weekly', 'monthly', 'yearly'];

const STRINGS = {
  ar: {
    title: 'التصدير والتقارير',
    snapshots: 'اللقطات', runNow: 'تشغيل الآن', reports: 'تقارير التحليل',
    range: 'النطاق', date: 'التاريخ', datasets: 'مجموعات البيانات', size: 'الحجم',
    action: 'الإجراء', download: 'تنزيل', downloading: 'جارٍ التنزيل…',
    weekly: 'أسبوعي', monthly: 'شهري', yearly: 'سنوي',
    noSnapshots: 'لا توجد لقطات بعد.', noReports: 'لم تقم برفع أي تقارير بعد.',
    file: 'الملف (PDF / PPT / PPTX)', name: 'الاسم',
    upload: 'رفع', uploading: 'جارٍ الرفع…', selectRange: '— اختر النطاق —',
    running: 'جارٍ التشغيل…', snapshotDone: 'تم إنشاء اللقطة', runFailed: 'فشل تشغيل اللقطة',
    uploaded: 'تم رفع التقرير', uploadFailed: 'فشل رفع التقرير',
    downloadFailed: 'فشل التنزيل', loadFailed: 'فشل التحميل',
    pickFile: 'اختر ملفاً', pickRange: 'اختر النطاق', noFile: 'لم يتم اختيار ملف',
  },
  en: {
    title: 'Exports & Reports',
    snapshots: 'Snapshots', runNow: 'Run now', reports: 'Analysis Reports',
    range: 'Range', date: 'Date', datasets: 'Datasets', size: 'Size',
    action: 'Action', download: 'Download', downloading: 'Downloading…',
    weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
    noSnapshots: 'No snapshots yet.', noReports: 'You have not uploaded any reports yet.',
    file: 'File (PDF / PPT / PPTX)', name: 'Name',
    upload: 'Upload', uploading: 'Uploading…', selectRange: '— Select range —',
    running: 'Running…', snapshotDone: 'Snapshot created', runFailed: 'Snapshot run failed',
    uploaded: 'Report uploaded', uploadFailed: 'Report upload failed',
    downloadFailed: 'Download failed', loadFailed: 'Failed to load',
    pickFile: 'Choose a file', pickRange: 'Choose a range', noFile: 'No file chosen',
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
function basename(p) { return String(p || '').split('/').pop() || 'download.csv'; }

export default function AnalyzerExports() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();
  const notify = (msg, type) => showToast(msg, type === 'error' ? 'dng' : 'ok');

  const [snapshots, setSnapshots] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState('');
  const [downloadingId, setDownloadingId] = useState('');
  const [uploadRange, setUploadRange] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [sRes, rRes] = await Promise.all([
        api.get('/api/analyzer/snapshots', { cache: false }),
        api.get('/api/analyzer/analysis-reports', { cache: false }),
      ]);
      setSnapshots(sRes.data?.data || sRes.data || []);
      setReports(rRes.data?.data || rRes.data || []);
    } catch { notify(t('loadFailed'), 'error'); }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function runSnapshot(range) {
    setRunning(range);
    try {
      await api.post('/api/analyzer/snapshots/run', { range });
      notify(t('snapshotDone'));
      await load();
    } catch (e) {
      notify(e.response?.data?.message || t('runFailed'), 'error');
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
    } catch { notify(t('downloadFailed'), 'error'); }
    finally { setDownloadingId(''); }
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!RANGES.includes(uploadRange)) { notify(t('pickRange'), 'error'); return; }
    if (!uploadFile) { notify(t('pickFile'), 'error'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('range', uploadRange);
      await api.post('/api/analyzer/analysis-reports', fd);
      notify(t('uploaded'));
      setUploadRange(''); setUploadFile(null);
      e.target.reset();
      await load();
    } catch (err) {
      notify(err.response?.data?.message || t('uploadFailed'), 'error');
    } finally { setUploading(false); }
  }

  return (
    <>
      <Navbar title={t('title')} subtitle="Data Analyzer" />
      <main className="mt-content">

        {/* ── SNAPSHOTS ── */}
        <RevealOnScroll className="mt-card" style={{ marginBlockEnd: 16 }}>
          <div className="mt-card-head mt-card-head--tight">
            <div className="mt-card-title">{t('snapshots')}</div>
            <div className="mt-divider" />
          </div>

          <div className="mt-filterbar" style={{ marginBlockStart: 14, marginBlockEnd: 12 }}>
            <span className="mt-count">{t('runNow')}:</span>
            {RANGES.map((r) => (
              <button key={r} type="button" className="mt-btn--outline" disabled={!!running} onClick={() => runSnapshot(r)}>
                {running === r ? t('running') : t(r)}
              </button>
            ))}
          </div>

          <div className="mt-table-wrap">
            <table className="mt-table">
              <thead>
                <tr>
                  <th className="mt-th">{t('range')}</th><th className="mt-th">{t('date')}</th>
                  <th className="mt-th">{t('datasets')}</th><th className="mt-th">{t('size')}</th>
                  <th className="mt-th">{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && [...Array(3)].map((_, i) => (
                  <tr key={i}><td className="mt-td" colSpan={5}><div className="skeleton mt-skel" style={{ height: 20 }} /></td></tr>
                ))}
                {!loading && snapshots.length === 0 && (
                  <tr><td className="mt-td" colSpan={5} style={{ textAlign: 'center', padding: '44px 16px', color: 'var(--text-2)' }}>{t('noSnapshots')}</td></tr>
                )}
                {!loading && snapshots.map((s) => (
                  <tr key={s._id}>
                    <td className="mt-td"><Pill tone="neutral">{t(s.range) || s.range}</Pill></td>
                    <td className="mt-td mt-td--mono">{fmtDate(s.generatedAt || s.createdAt)}</td>
                    <td className="mt-td">{Array.isArray(s.datasets) ? s.datasets.length : 0}</td>
                    <td className="mt-td mt-td--muted">{fmtSize(s.sizeBytes)}</td>
                    <td className="mt-td">
                      <button type="button" className="mt-btn--small-outline" disabled={downloadingId === s._id} onClick={() => downloadSnapshot(s)}>
                        {downloadingId === s._id ? t('downloading') : `⬇ ${t('download')}`}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>

        {/* ── ANALYSIS REPORTS ── */}
        <RevealOnScroll className="mt-card">
          <div className="mt-card-head mt-card-head--tight">
            <div className="mt-card-title">{t('reports')}</div>
            <div className="mt-divider" />
          </div>

          <form onSubmit={submitReport} className="mt-filterbar" style={{ marginBlockStart: 14, marginBlockEnd: 12, alignItems: 'flex-end' }}>
            <div className="mt-field" style={{ minWidth: 180 }}>
              <label className="mt-label">{t('range')} <span className="mt-label-req">*</span></label>
              <select className="mt-select" value={uploadRange} onChange={(e) => setUploadRange(e.target.value)}>
                <option value="">{t('selectRange')}</option>
                {RANGES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
              </select>
            </div>
            <div className="mt-field" style={{ minWidth: 240, flex: 1 }}>
              <label className="mt-label">{t('file')} <span className="mt-label-req">*</span></label>
              <input className="mt-input" style={{ paddingBlock: 7 }} type="file" accept=".pdf,.ppt,.pptx"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
            </div>
            <button type="submit" className="mt-btn" disabled={uploading}>
              {uploading ? t('uploading') : `⬆ ${t('upload')}`}
            </button>
          </form>

          <div className="mt-table-wrap">
            <table className="mt-table">
              <thead>
                <tr>
                  <th className="mt-th">{t('range')}</th><th className="mt-th">{t('name')}</th>
                  <th className="mt-th">{t('date')}</th><th className="mt-th">{t('size')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && [...Array(2)].map((_, i) => (
                  <tr key={i}><td className="mt-td" colSpan={4}><div className="skeleton mt-skel" style={{ height: 20 }} /></td></tr>
                ))}
                {!loading && reports.length === 0 && (
                  <tr><td className="mt-td" colSpan={4} style={{ textAlign: 'center', padding: '44px 16px', color: 'var(--text-2)' }}>{t('noReports')}</td></tr>
                )}
                {!loading && reports.map((r) => (
                  <tr key={r._id}>
                    <td className="mt-td"><Pill tone="ok">{t(r.range) || r.range}</Pill></td>
                    <td className="mt-td mt-td--name">{r.name}</td>
                    <td className="mt-td mt-td--mono">{fmtDate(r.createdAt)}</td>
                    <td className="mt-td mt-td--muted">{fmtSize(r.sizeBytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RevealOnScroll>

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
