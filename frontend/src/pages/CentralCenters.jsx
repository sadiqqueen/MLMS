// frontend/src/pages/CentralCenters.jsx
//
// Central Secretary — Training Centers (read-only catalogue). The CS browses the
// centers running its scoped programs together with their DIO / Sub-DIO; it has
// NO center-mutation endpoint (writes are trainee-only, see CentralTrainees), so
// this list carries no add button and no edit pencil (RULINGS §43, proto §7.2).
// Contract: GET /api/central/centers?search=&countryId= , GET /api/central/countries.
//
// TODO(fable): lists_views.md marks CS training-centers/programs/countries as
// "EDIT", but API_CONTRACTS.md exposes NO CS mutation endpoint for these three
// (only trainee CRUD). proto §7.2 also lists CS centers/programs as ro:true.
// Rendered read-only here → confirm CS's write surface is trainees-only.
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
    title: 'المراكز التدريبية', sub: 'السكرتير المركزي',
    search: 'ابحث باسم المركز…', allCountries: 'كل الدول', allCities: 'كل المدن',
    count: n => `${n} مركزاً · مع الـ DIO التابعين`,
    center: 'المركز', id: 'الرقم', country: 'الدولة', city: 'المدينة',
    dio: 'الـ DIO', subDio: 'نائب الـ DIO', status: 'الحالة',
    none: 'لا توجد مراكز في نطاقك.', noMatch: 'لا توجد مراكز مطابقة.',
    loadFailed: 'فشل تحميل المراكز',
    accredited: 'معتمد', expiring: 'قارب الانتهاء', expired: 'منتهٍ', withdrawn: 'مسحوب', na: '—',
  },
  en: {
    title: 'Training Centers', sub: 'Central Secretary',
    search: 'Search by center name…', allCountries: 'All countries', allCities: 'All cities',
    count: n => `${n} center${n === 1 ? '' : 's'} · with their DIOs`,
    center: 'Center', id: 'ID', country: 'Country', city: 'City',
    dio: 'DIO', subDio: 'Sub-DIO', status: 'Status',
    none: 'No centers in your scope yet.', noMatch: 'No centers match your filters.',
    loadFailed: 'Failed to load centers',
    accredited: 'Accredited', expiring: 'Expiring', expired: 'Expired', withdrawn: 'Withdrawn', na: '—',
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

function StatusPill({ status, t }) {
  const map = {
    green:  ['mt-pill--active',  t('accredited')],
    yellow: ['mt-pill--warn',    t('expiring')],
    red:    ['mt-pill--rejected', t('expired')],
    black:  ['mt-pill--rejected', t('withdrawn')],
  };
  const hit = map[status];
  if (!hit) return <span className="mt-td--muted">{t('na')}</span>;
  return <span className={`mt-pill ${hit[0]}`}>{hit[1]}</span>;
}

function ListSkeleton() {
  return (
    <div>
      <div className="mt-filterbar">
        <div className="skeleton" style={{ height: 38, borderRadius: 8, flex: 1, minWidth: 200, maxWidth: 300 }} />
        <div className="skeleton" style={{ height: 38, width: 170, borderRadius: 8 }} />
        <div className="skeleton" style={{ height: 38, width: 150, borderRadius: 8 }} />
      </div>
      <div className="skeleton" style={{ height: 320, borderRadius: 12 }} />
    </div>
  );
}

export default function CentralCenters() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [centers, setCenters] = useState([]);
  const [countryMap, setCountryMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, coRes] = await Promise.allSettled([
      api.get('/api/central/centers'),
      api.get('/api/central/countries'),
    ]);
    if (cRes.status === 'fulfilled') setCenters(cRes.value.data?.data || cRes.value.data || []);
    else showToast(t('loadFailed'), 'dng');
    if (coRes.status === 'fulfilled') {
      const map = {};
      (coRes.value.data?.data || coRes.value.data || []).forEach(c => { map[c._id] = c; });
      setCountryMap(map);
    }
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function countryOf(c) {
    return c.countryId?.name ? c.countryId : (countryMap[idOf(c.countryId)] || null);
  }

  const cities = useMemo(() => {
    const set = new Set();
    centers.forEach(c => { if (c.city) set.add(c.city); });
    return Array.from(set).sort();
  }, [centers]);

  const filtered = useMemo(() => centers.filter(c => {
    if (countryFilter && idOf(c.countryId) !== countryFilter) return false;
    if (cityFilter && c.city !== cityFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !(c.name || '').toLowerCase().includes(q)) return false;
    return true;
  }), [centers, countryFilter, cityFilter, search]);

  useEffect(() => { setPage(1); }, [search, countryFilter, cityFilter]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const countryOptions = Object.values(countryMap).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

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
              <select className="mt-filter" value={countryFilter} onChange={e => setCountryFilter(e.target.value)} aria-label={t('country')}>
                <option value="">{t('allCountries')}</option>
                {countryOptions.map(c => <option key={c._id} value={c._id}>{c.name}{c.code ? ` (${c.code})` : ''}</option>)}
              </select>
              <select className="mt-filter" value={cityFilter} onChange={e => setCityFilter(e.target.value)} aria-label={t('city')}>
                <option value="">{t('allCities')}</option>
                {cities.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
              <span className="mt-filterbar-spacer" />
              <span className="mt-count">{t('count')(filtered.length)}</span>
            </div>

            <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table">
                  <thead>
                    <tr>
                      <th className="mt-th">{t('center')}</th>
                      <th className="mt-th">{t('id')}</th>
                      <th className="mt-th">{t('country')}</th>
                      <th className="mt-th">{t('city')}</th>
                      <th className="mt-th">{t('dio')}</th>
                      <th className="mt-th">{t('subDio')}</th>
                      <th className="mt-th">{t('status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.length === 0 && (
                      <tr>
                        <td className="mt-td" colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-2)' }}>
                          {centers.length === 0 ? t('none') : t('noMatch')}
                        </td>
                      </tr>
                    )}
                    {pageItems.map(c => {
                      const co = countryOf(c);
                      return (
                        <tr key={c._id}>
                          <td className="mt-td mt-td--name">{c.name}</td>
                          <td className="mt-td mt-td--mono">{c.idNumber || idOf(c._id).slice(-6).toUpperCase()}</td>
                          <td className="mt-td">{co ? `${co.name}${co.code ? ` (${co.code})` : ''}` : t('na')}</td>
                          <td className="mt-td mt-td--muted">{c.city || t('na')}</td>
                          <td className="mt-td mt-td--muted">{c.dioId?.name || t('na')}</td>
                          <td className="mt-td mt-td--muted">{c.subDioId?.name || t('na')}</td>
                          <td className="mt-td"><StatusPill status={c.accreditationStatus} t={t} /></td>
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
