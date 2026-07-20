// frontend/src/pages/SgCenters.jsx
//
// Secretary General / Assistant Secretary read-only training-center list.
// Restyled to the mt- design: filter bar + navy-header table (no edit actions —
// read-only per RULINGS §43), client-side search/country filter + pagination.
// Contract (unchanged): GET /api/sg/centers → centers with populated countryId
//   and computed accreditationStatus.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import AccreditationBadge from '../components/AccreditationBadge';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconBuilding } from '../components/icons';
import api from '../api/axios';
import './sg.css';

const PAGE_SIZE = 12;

const STRINGS = {
  ar: {
    search: 'ابحث باسم المركز…', allCountries: 'كل الدول', count: n => `${n} مركز`,
    colCenter: 'المركز', colId: 'المعرف', colCountry: 'الدولة', colCity: 'المدينة', colAccred: 'الاعتماد',
    noneTitle: 'لا توجد مراكز بعد.', noneSub: 'ستظهر مراكز التدريب هنا عند إضافتها.',
    noMatchTitle: 'لا توجد مراكز مطابقة.', noMatchSub: 'جرّب تعديل البحث أو عامل التصفية.',
    loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by center name…', allCountries: 'All countries', count: n => `${n} centers`,
    colCenter: 'Center', colId: 'ID', colCountry: 'Country', colCity: 'City', colAccred: 'Accreditation',
    noneTitle: 'No centers yet.', noneSub: 'Training centers appear here once added.',
    noMatchTitle: 'No centers match.', noMatchSub: 'Try adjusting your search or filter.',
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

function countryLabel(c) { return c ? `${c.name}${c.code ? ` (${c.code})` : ''}` : '—'; }

export default function SgCenters() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/api/sg/centers')
      .then((r) => setCenters(r.data?.data || r.data || []))
      .catch(() => showToast(t('loadFailed'), 'dng'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [search, countryFilter]);

  // Distinct countries present in the data drive the filter dropdown.
  const countryOptions = [];
  const seen = new Set();
  centers.forEach((c) => {
    const id = c.countryId?._id || c.countryId;
    if (id && !seen.has(id)) { seen.add(id); countryOptions.push({ value: id, label: countryLabel(c.countryId) }); }
  });

  const filtered = centers.filter((c) => {
    if (countryFilter && (c.countryId?._id || c.countryId) !== countryFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || (c.name || '').toLowerCase().includes(q);
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
          <select className="mt-filter" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
            <option value="">{t('allCountries')}</option>
            {countryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
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
            <div className="mt-empty-icon"><IconBuilding size={22} /></div>
            <div className="mt-empty-title">{centers.length === 0 ? t('noneTitle') : t('noMatchTitle')}</div>
            <div className="mt-empty-sub">{centers.length === 0 ? t('noneSub') : t('noMatchSub')}</div>
          </div>
        ) : (
          <>
            <RevealOnScroll className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table mt-table--stack">
                  <thead>
                    <tr>
                      <th className="mt-th">{t('colCenter')}</th>
                      <th className="mt-th">{t('colId')}</th>
                      <th className="mt-th">{t('colCountry')}</th>
                      <th className="mt-th">{t('colCity')}</th>
                      <th className="mt-th">{t('colAccred')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((c) => (
                      <tr key={c._id}>
                        <td className="mt-td mt-td--name" data-label={t('colCenter')}>{c.name}</td>
                        <td className="mt-td mt-td--mono" data-label={t('colId')}>{c.idNumber || '—'}</td>
                        <td className="mt-td" data-label={t('colCountry')}>{countryLabel(c.countryId)}</td>
                        <td className="mt-td" data-label={t('colCity')}>{c.city || '—'}</td>
                        <td className="mt-td" data-label={t('colAccred')}><AccreditationBadge status={c.accreditationStatus} /></td>
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
