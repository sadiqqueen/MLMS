// frontend/src/pages/SgReports.jsx
//
// Secretary General / Assistant Secretary reports inbox — the PDF/PPTX analysis
// reports uploaded by Data Analyzers. Restyled to the mt- design: navy-header
// table + per-row blob download. Contract (unchanged):
//   GET /api/sg/analysis-reports → [{ _id, range, name, uploadedBy:{name},
//     createdAt, sizeBytes }]
//   GET /api/sg/analysis-reports/:id/download → file blob (original filename).
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconFileText } from '../components/icons';
import api from '../api/axios';
import './sg.css';

const PAGE_SIZE = 12;

const STRINGS = {
  ar: {
    count: n => `${n} تقرير`, allRanges: 'كل النطاقات',
    range: 'النطاق', name: 'الاسم', uploadedBy: 'بواسطة', date: 'التاريخ',
    size: 'الحجم', action: '', download: 'تنزيل', downloading: 'جارٍ التنزيل…',
    weekly: 'أسبوعي', monthly: 'شهري', yearly: 'سنوي',
    noneTitle: 'لا توجد تقارير بعد.', noneSub: 'ستظهر تقارير التحليل هنا عند رفعها.',
    noMatchTitle: 'لا توجد تقارير مطابقة.', noMatchSub: 'جرّب تغيير عامل التصفية.',
    loadFailed: 'فشل التحميل', downloadFailed: 'فشل التنزيل',
  },
  en: {
    count: n => `${n} reports`, allRanges: 'All ranges',
    range: 'Range', name: 'Name', uploadedBy: 'Uploaded by', date: 'Date',
    size: 'Size', action: '', download: 'Download', downloading: 'Downloading…',
    weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
    noneTitle: 'No reports yet.', noneSub: 'Analysis reports appear here once uploaded.',
    noMatchTitle: 'No reports match.', noMatchSub: 'Try changing the filter.',
    loadFailed: 'Failed to load', downloadFailed: 'Download failed',
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
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState('');
  const [rangeFilter, setRangeFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/api/sg/analysis-reports', { cache: false })
      .then((r) => setReports(r.data?.data || r.data || []))
      .catch(() => showToast(t('loadFailed'), 'dng'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [rangeFilter]);

  async function download(row) {
    setDownloadingId(row._id);
    try {
      const res = await api.get(`/api/sg/analysis-reports/${row._id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = row.name || 'report';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { showToast(t('downloadFailed'), 'dng'); }
    finally { setDownloadingId(''); }
  }

  // Range options limited to what's actually present in the data.
  const rangesPresent = [...new Set(reports.map((r) => r.range).filter(Boolean))];
  const filtered = rangeFilter ? reports.filter((r) => r.range === rangeFilter) : reports;
  const total = filtered.length;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-filterbar">
          {rangesPresent.length > 1 && (
            <select className="mt-filter" value={rangeFilter} onChange={(e) => setRangeFilter(e.target.value)}>
              <option value="">{t('allRanges')}</option>
              {rangesPresent.map((rg) => <option key={rg} value={rg}>{t(rg) || rg}</option>)}
            </select>
          )}
          <div className="mt-filterbar-spacer" />
          {!loading && total > 0 && <span className="mt-count">{t('count')(total)}</span>}
        </div>

        {loading ? (
          <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="sg-skel-rows">
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 22, borderRadius: 6 }} />)}
            </div>
          </div>
        ) : total === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconFileText size={22} /></div>
            <div className="mt-empty-title">{reports.length === 0 ? t('noneTitle') : t('noMatchTitle')}</div>
            <div className="mt-empty-sub">{reports.length === 0 ? t('noneSub') : t('noMatchSub')}</div>
          </div>
        ) : (
          <>
            <RevealOnScroll className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table mt-table--stack">
                  <thead>
                    <tr>
                      <th className="mt-th">{t('range')}</th>
                      <th className="mt-th">{t('name')}</th>
                      <th className="mt-th">{t('uploadedBy')}</th>
                      <th className="mt-th">{t('date')}</th>
                      <th className="mt-th">{t('size')}</th>
                      <th className="mt-th">{t('action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((r) => (
                      <tr key={r._id}>
                        <td className="mt-td" data-label={t('range')}><span className="mt-pill mt-pill--neutral">{t(r.range) || r.range}</span></td>
                        <td className="mt-td mt-td--name" data-label={t('name')}>{r.name}</td>
                        <td className="mt-td" data-label={t('uploadedBy')}>{r.uploadedBy?.name || '—'}</td>
                        <td className="mt-td mt-td--mono" data-label={t('date')}>{fmtDate(r.createdAt)}</td>
                        <td className="mt-td mt-td--mono" data-label={t('size')}>{fmtSize(r.sizeBytes)}</td>
                        <td className="mt-td mt-td--actions" data-label={t('download')}>
                          <button type="button" className="mt-btn--small-outline" disabled={downloadingId === r._id} onClick={() => download(r)}>
                            {downloadingId === r._id ? t('downloading') : `⬇ ${t('download')}`}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </RevealOnScroll>
            {total > PAGE_SIZE && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={total}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)} />
            )}
          </>
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
