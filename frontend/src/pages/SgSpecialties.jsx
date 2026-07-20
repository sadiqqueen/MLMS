// frontend/src/pages/SgSpecialties.jsx
//
// Secretary General / Assistant Secretary read-only specialty list.
// Restyled to the mt- design and surfaces the council→main/precise hierarchy to
// the extent the existing endpoint exposes it: the scalar `type` (main/precise),
// `code` and `nameEn` fields ARE returned by GET /api/sg/specialties, so they are
// shown here. The council NAME is NOT (the route does not populate councilId) —
// see report QUESTIONS for the backend populate + per-specialty counts needed to
// fill the design's Parent / Programs / Trainees / HOC columns.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconBook } from '../components/icons';
import api from '../api/axios';
import './sg.css';

const PAGE_SIZE = 12;

const STRINGS = {
  ar: {
    search: 'ابحث عن اختصاص…', count: n => `${n} اختصاص`,
    allTypes: 'كل الأنواع', main: 'رئيسي', precise: 'دقيق',
    colNum: '#', colName: 'الاختصاص', colType: 'النوع', colCode: 'الرمز',
    noneTitle: 'لا توجد اختصاصات بعد.', noneSub: 'ستظهر الاختصاصات هنا عند إضافتها.',
    noMatchTitle: 'لا توجد نتائج مطابقة.', noMatchSub: 'جرّب تعديل البحث أو عامل التصفية.',
    loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search specialties…', count: n => `${n} specialties`,
    allTypes: 'All types', main: 'Main', precise: 'Precise',
    colNum: '#', colName: 'Specialty', colType: 'Type', colCode: 'Code',
    noneTitle: 'No specialties yet.', noneSub: 'Specialties appear here once added.',
    noMatchTitle: 'No matching results.', noMatchSub: 'Try adjusting your search or filter.',
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

export default function SgSpecialties() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/api/sg/specialties')
      .then((r) => setSpecialties(r.data?.data || r.data || []))
      .catch(() => showToast(t('loadFailed'), 'dng'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [search, typeFilter]);

  // Only offer the Type filter when the data actually carries a `type`.
  const hasTypes = specialties.some((s) => s.type === 'main' || s.type === 'precise');

  const filtered = specialties.filter((s) => {
    if (typeFilter && s.type !== typeFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || (s.name || '').toLowerCase().includes(q) || (s.nameEn || '').toLowerCase().includes(q);
  });

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function typePill(type) {
    if (type === 'main') return <span className="mt-pill mt-pill--warn">{t('main')}</span>;
    if (type === 'precise') return <span className="mt-pill mt-pill--active">{t('precise')}</span>;
    return <span className="mt-td--muted">—</span>;
  }

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-filterbar">
          <div className="mt-search">
            <SearchIcon />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} />
          </div>
          {hasTypes && (
            <select className="mt-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">{t('allTypes')}</option>
              <option value="main">{t('main')}</option>
              <option value="precise">{t('precise')}</option>
            </select>
          )}
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
            <div className="mt-empty-icon"><IconBook size={22} /></div>
            <div className="mt-empty-title">{specialties.length === 0 ? t('noneTitle') : t('noMatchTitle')}</div>
            <div className="mt-empty-sub">{specialties.length === 0 ? t('noneSub') : t('noMatchSub')}</div>
          </div>
        ) : (
          <>
            <RevealOnScroll className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table mt-table--stack">
                  <thead>
                    <tr>
                      <th className="mt-th">{t('colNum')}</th>
                      <th className="mt-th">{t('colName')}</th>
                      <th className="mt-th">{t('colType')}</th>
                      <th className="mt-th">{t('colCode')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((s, i) => (
                      <tr key={s._id}>
                        <td className="mt-td mt-td--muted" data-label={t('colNum')}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="mt-td mt-td--name" data-label={t('colName')}>
                          {s.name}
                          {s.nameEn && <div className="sg-subname">{s.nameEn}</div>}
                        </td>
                        <td className="mt-td" data-label={t('colType')}>{typePill(s.type)}</td>
                        <td className="mt-td mt-td--mono" data-label={t('colCode')}>{s.code || '—'}</td>
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
