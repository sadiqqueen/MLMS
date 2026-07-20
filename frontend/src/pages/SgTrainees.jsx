// frontend/src/pages/SgTrainees.jsx
//
// Secretary General / Assistant Secretary read-only trainee list.
// Restyled to the mt- design: navy-header table (read-only), search + pagination
// + a computed training-year pill. Kept as a table rather than the prototype's
// card grid because GET /api/sg/trainees populates only programId (no country /
// specialty names for the design's card key-values). Contract (unchanged):
//   GET /api/sg/trainees[?search=] → trainees with injected trainingYear.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconGrad } from '../components/icons';
import api from '../api/axios';
import './sg.css';

const PAGE_SIZE = 12;

const STRINGS = {
  ar: {
    search: 'ابحث بالاسم أو الرقم التعريفي…', count: n => `${n} متدرب`,
    colName: 'الاسم', colId: 'الرقم التعريفي', colProgram: 'البرنامج', colYear: 'السنة',
    noneTitle: 'لا يوجد متدربون بعد.', noneSub: 'سيظهر المتدربون هنا عند إضافتهم.',
    noMatchTitle: 'لا توجد نتائج مطابقة.', noMatchSub: 'جرّب تعديل البحث.',
    loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by name or ID number…', count: n => `${n} trainees`,
    colName: 'Name', colId: 'ID Number', colProgram: 'Program', colYear: 'Year',
    noneTitle: 'No trainees yet.', noneSub: 'Trainees appear here once added.',
    noMatchTitle: 'No matching results.', noMatchSub: 'Try adjusting your search.',
    loadFailed: 'Failed to load',
  },
};

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export default function SgTrainees() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/api/sg/trainees')
      .then((r) => setTrainees(r.data?.data || r.data || []))
      .catch(() => showToast(t('loadFailed'), 'dng'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [search]);

  const filtered = trainees.filter((tr) => {
    const q = search.trim().toLowerCase();
    return !q
      || (tr.name || '').toLowerCase().includes(q)
      || (tr.idNumber || '').toLowerCase().includes(q)
      || (tr.studentId || '').toLowerCase().includes(q);
  });

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-filterbar">
          <div className="mt-search">
            <SearchIcon />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} />
          </div>
          <div className="mt-filterbar-spacer" />
          {!loading && <span className="mt-count">{t('count')(total)}</span>}
        </div>

        {loading ? (
          <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="sg-skel-rows">
              {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 22, borderRadius: 6 }} />)}
            </div>
          </div>
        ) : total === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconGrad size={22} /></div>
            <div className="mt-empty-title">{trainees.length === 0 ? t('noneTitle') : t('noMatchTitle')}</div>
            <div className="mt-empty-sub">{trainees.length === 0 ? t('noneSub') : t('noMatchSub')}</div>
          </div>
        ) : (
          <>
            <RevealOnScroll className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table mt-table--stack">
                  <thead>
                    <tr>
                      <th className="mt-th">{t('colName')}</th>
                      <th className="mt-th">{t('colId')}</th>
                      <th className="mt-th">{t('colProgram')}</th>
                      <th className="mt-th">{t('colYear')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((tr) => {
                      const yr = tr.trainingYear;
                      return (
                        <tr key={tr._id}>
                          <td className="mt-td mt-td--name" data-label={t('colName')}>{tr.name}</td>
                          <td className="mt-td mt-td--mono" data-label={t('colId')}>{tr.idNumber || tr.studentId || '—'}</td>
                          <td className="mt-td" data-label={t('colProgram')}>{tr.programId?.name || '—'}</td>
                          <td className="mt-td" data-label={t('colYear')}>
                            {yr >= 1 && yr <= 6 ? <span className="mt-pill mt-pill--neutral">Y{yr}</span> : <span className="mt-td--muted">—</span>}
                          </td>
                        </tr>
                      );
                    })}
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
