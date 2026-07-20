// frontend/src/pages/CentralPrograms.jsx
//
// Central Secretary — Programs (read-only catalogue). Lists the CS's scoped
// programs with their PD / Sub-PD, capacity and duration. No mutation endpoint
// exists for the CS on programs (writes are trainee-only), so there is no add
// button or edit pencil here (RULINGS §43, proto §7.2).
// Contract: GET /api/central/programs?search=&specialtyId=&countryId= ,
//           GET /api/central/centers , GET /api/central/countries.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Pagination from '../components/Pagination';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import './central.css';

const PAGE_SIZE = 8;

const STRINGS = {
  ar: {
    title: 'البرامج', sub: 'السكرتير المركزي',
    search: 'ابحث باسم البرنامج…', allCountries: 'كل الدول', allCenters: 'كل المراكز',
    count: n => `${n} برنامجاً · مع مدرائها`,
    program: 'البرنامج', id: 'الرقم', center: 'المركز', pd: 'مدير البرنامج',
    subPd: 'النائب', capacity: 'السعة', duration: 'المدة', years: 'سنوات',
    none: 'لا توجد برامج في نطاقك.', noMatch: 'لا توجد برامج مطابقة.',
    loadFailed: 'فشل تحميل البرامج', na: '—',
  },
  en: {
    title: 'Programs', sub: 'Central Secretary',
    search: 'Search by program name…', allCountries: 'All countries', allCenters: 'All centers',
    count: n => `${n} program${n === 1 ? '' : 's'} · with their PDs`,
    program: 'Program', id: 'ID', center: 'Center', pd: 'PD',
    subPd: 'Sub-PD', capacity: 'Capacity', duration: 'Duration', years: 'yrs',
    none: 'No programs in your scope yet.', noMatch: 'No programs match your filters.',
    loadFailed: 'Failed to load programs', na: '—',
  },
};

function idOf(v) { return v?._id || v || ''; }

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ListSkeleton() {
  return (
    <div>
      <div className="mt-filterbar">
        <div className="skeleton" style={{ height: 38, borderRadius: 8, flex: 1, minWidth: 200, maxWidth: 300 }} />
        <div className="skeleton" style={{ height: 38, width: 170, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 38, width: 170, borderRadius: 8 }} />
      </div>
      <div className="skeleton" style={{ height: 320, borderRadius: 12 }} />
    </div>
  );
}

export default function CentralPrograms() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [programs, setPrograms] = useState([]);
  const [centerMap, setCenterMap] = useState({}); // id -> { name, countryId }
  const [countryMap, setCountryMap] = useState({}); // id -> { name, code }
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [centerFilter, setCenterFilter] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes, cRes, coRes] = await Promise.allSettled([
      api.get('/api/central/programs'),
      api.get('/api/central/centers'),
      api.get('/api/central/countries'),
    ]);
    if (pRes.status === 'fulfilled') setPrograms(pRes.value.data?.data || pRes.value.data || []);
    else showToast(t('loadFailed'), 'dng');
    const cmap = {};
    if (cRes.status === 'fulfilled') {
      (cRes.value.data?.data || cRes.value.data || []).forEach(c => { cmap[c._id] = c; });
    }
    setCenterMap(cmap);
    const comap = {};
    if (coRes.status === 'fulfilled') {
      (coRes.value.data?.data || coRes.value.data || []).forEach(c => { comap[c._id] = c; });
    }
    setCountryMap(comap);
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Resolve a program's center + country through the payload (may be populated)
  // or the centers map (raw id), so the columns and filters work either way.
  function centerOf(p) {
    if (p.trainingCenterId?.name) return p.trainingCenterId;
    return centerMap[idOf(p.trainingCenterId)] || null;
  }
  function countryIdOf(p) {
    const ctr = centerOf(p);
    return idOf(ctr?.countryId);
  }

  const centerOptions = useMemo(
    () => Object.values(centerMap).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [centerMap],
  );
  const countryOptions = useMemo(() => {
    const seen = new Map();
    Object.values(centerMap).forEach(c => {
      const co = c.countryId;
      const cid = idOf(co);
      if (cid && !seen.has(cid)) {
        seen.set(cid, co?.name ? co : { _id: cid, name: countryMap[cid]?.name || cid });
      }
    });
    return Array.from(seen.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [centerMap, countryMap]);

  const filtered = useMemo(() => programs.filter(p => {
    if (centerFilter && idOf(p.trainingCenterId) !== centerFilter) return false;
    if (countryFilter && countryIdOf(p) !== countryFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !(p.name || '').toLowerCase().includes(q)) return false;
    return true;
  }), [programs, centerFilter, countryFilter, search, centerMap]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [search, countryFilter, centerFilter]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function durationOf(p) {
    if (p.durationYears) return `${p.durationYears} ${t('years')}`;
    if (p.accreditationType) return p.accreditationType;
    return t('na');
  }

  return (
    <>
      <Navbar title={t('title')} subtitle={t('sub')} />
      <main className="mt-content" dir={dir}>
        {loading ? <ListSkeleton /> : (
          <>
            <div className="mt-filterbar">
              <label className="mt-search">
                <SearchIcon />
                <input placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} aria-label={t('search')} />
              </label>
              <select className="mt-filter" value={countryFilter} onChange={e => setCountryFilter(e.target.value)} aria-label={t('allCountries')}>
                <option value="">{t('allCountries')}</option>
                {countryOptions.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <select className="mt-filter" value={centerFilter} onChange={e => setCenterFilter(e.target.value)} aria-label={t('center')}>
                <option value="">{t('allCenters')}</option>
                {centerOptions.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <span className="mt-filterbar-spacer" />
              <span className="mt-count">{t('count')(filtered.length)}</span>
            </div>

            <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table">
                  <thead>
                    <tr>
                      <th className="mt-th">{t('program')}</th>
                      <th className="mt-th">{t('id')}</th>
                      <th className="mt-th">{t('center')}</th>
                      <th className="mt-th">{t('pd')}</th>
                      <th className="mt-th">{t('subPd')}</th>
                      <th className="mt-th">{t('capacity')}</th>
                      <th className="mt-th">{t('duration')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 && (
                      <tr>
                        <td className="mt-td" colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-2)' }}>
                          {programs.length === 0 ? t('none') : t('noMatch')}
                        </td>
                      </tr>
                    )}
                    {pageItems.map(p => {
                      const ctr = centerOf(p);
                      return (
                        <tr key={p._id}>
                          <td className="mt-td mt-td--name">{p.name}</td>
                          <td className="mt-td mt-td--mono">{idOf(p._id).slice(-6).toUpperCase()}</td>
                          <td className="mt-td mt-td--muted">{ctr?.name || t('na')}</td>
                          <td className="mt-td mt-td--muted">{p.programDirectorId?.name || t('na')}</td>
                          <td className="mt-td mt-td--muted">{p.subProgramDirectorId?.name || t('na')}</td>
                          <td className="mt-td" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {(p.capacityUsed ?? 0)} / {(p.yearlyCapacity ?? 0)}
                          </td>
                          <td className="mt-td mt-td--muted">{durationOf(p)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {filtered.length > PAGE_SIZE && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => p + 1)} />
            )}
          </>
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
