// frontend/src/pages/SgReports.jsx
//
// Secretary General / Assistant Secretary reports inbox — the PDF/PPTX analysis
// reports uploaded by Data Analyzers. Read-only list + per-row blob download.
// Contract: GET /api/sg/analysis-reports → { data: [{ _id, range, name,
//   uploadedBy:{name}, createdAt, sizeBytes }] }
//   GET /api/sg/analysis-reports/:id/download → file blob (original filename).
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    range: 'النطاق', name: 'الاسم', uploadedBy: 'بواسطة', date: 'التاريخ',
    size: 'الحجم', action: 'الإجراء', download: 'تنزيل', downloading: 'جارٍ التنزيل…',
    weekly: 'أسبوعي', monthly: 'شهري', yearly: 'سنوي',
    none: 'لا توجد تقارير بعد.', loadFailed: 'فشل التحميل', downloadFailed: 'فشل التنزيل',
  },
  en: {
    range: 'Range', name: 'Name', uploadedBy: 'Uploaded by', date: 'Date',
    size: 'Size', action: 'Action', download: 'Download', downloading: 'Downloading…',
    weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
    none: 'No reports yet.', loadFailed: 'Failed to load', downloadFailed: 'Download failed',
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

export default function SgReports() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState('');
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/sg/analysis-reports', { cache: false })
      .then(r => setReports(r.data?.data || r.data || []))
      .catch(() => showToast(t('loadFailed'), 'error'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function download(row) {
    setDownloadingId(row._id);
    try {
      const res = await api.get(`/api/sg/analysis-reports/${row._id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = row.name || 'report';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { showToast(t('downloadFailed'), 'error'); }
    finally { setDownloadingId(''); }
  }

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('range')}</th><th>{t('name')}</th><th>{t('uploadedBy')}</th>
                  <th>{t('date')}</th><th>{t('size')}</th><th>{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {loading && [...Array(5)].map((_, i) => (
                  <tr key={i}><td><Sk w={70} h={22} r={20} /></td><td><Sk w={160} h={13} /></td><td><Sk w={110} h={13} /></td><td><Sk w={90} h={13} /></td><td><Sk w={60} h={13} /></td><td><Sk w={100} h={30} r={8} /></td></tr>
                ))}
                {!loading && reports.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t('none')}</td></tr>
                )}
                {!loading && reports.map(r => (
                  <tr key={r._id}>
                    <td><span className="badge badge-blue">{t(r.range) || r.range}</span></td>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.uploadedBy?.name || '—'}</td>
                    <td>{fmtDate(r.createdAt)}</td>
                    <td>{fmtSize(r.sizeBytes)}</td>
                    <td>
                      <button className="btn-outline" disabled={downloadingId === r._id} onClick={() => download(r)}>
                        {downloadingId === r._id ? t('downloading') : `⬇ ${t('download')}`}
                      </button>
                    </td>
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
