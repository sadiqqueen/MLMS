// frontend/src/pages/HocCenters.jsx
//
// Head of Council — read-only training-centers table (RULINGS §43: zero write UI,
// no add button, no row-action icons). Centers running the council's programs.
//   GET /api/hoc/centers  → [{ ...center, idNumber, city, countryId:{name},
//                             dioId, programs:[…] }]
//   GET /api/hoc/programs  → used only to derive the per-center current-trainee
//                            count (Σ capacityUsed), which the centers payload
//                            does not carry.
// Columns: Center · ID · Country · City · DIO · Programs · Trainees.
import { useState, useEffect, useMemo } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Pagination from '../components/Pagination';
import MtToastHost, { useMtToast } from '../components/MtToast';
import { NavIcon } from '../components/icons';
import api from '../api/axios';

const PAGE_SIZE = 8;

const STRINGS = {
  ar: {
    search: 'ابحث باسم المركز…', allCountries: 'كل الدول', allCities: 'كل المدن',
    count: '{n} مركز', center: 'المركز', id: 'المعرّف', country: 'الدولة', city: 'المدينة',
    dio: 'DIO', programs: 'البرامج', trainees: 'المتدربون',
    noneTitle: 'لا توجد مراكز', noneSub: 'لا توجد مراكز تدريب ضمن نطاق مجلسك بعد.',
    noMatch: 'لا توجد مراكز مطابقة.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by center name…', allCountries: 'All countries', allCities: 'All cities',
    count: '{n} centers', center: 'Center', id: 'ID', country: 'Country', city: 'City',
    dio: 'DIO', programs: 'Programs', trainees: 'Trainees',
    noneTitle: 'No centers', noneSub: 'No training centers fall within your council scope yet.',
    noMatch: 'No centers match your filters.', loadFailed: 'Failed to load',
  },
};

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

const countryOf = c => c?.countryId?.name || '';

export default function HocCenters() {
  const { lang } = usePrefs();
  const t = (k, vars) => {
    let s = STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
    if (vars) Object.entries(vars).forEach(([n, val]) => { s = s.replace(`{${n}}`, val); });
    return s;
  };
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const { toasts, showToast } = useMtToast();
  const [centers, setCenters] = useState([]);
  const [traineesByCenter, setTraineesByCenter] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    const pick = (r, d) => (r.status === 'fulfilled' ? (r.value.data?.data ?? r.value.data ?? d) : d);
    Promise.allSettled([
      api.get('/api/hoc/centers'),
      api.get('/api/hoc/programs'),
    ]).then(([c, p]) => {
      if (!alive) return;
      const centerRows = pick(c, []);
      const programRows = pick(p, []);
      setCenters(centerRows);
      const map = {};
      programRows.forEach(pr => {
        const id = pr.trainingCenterId?._id || pr.trainingCenterId;
        if (!id) return;
        map[id] = (map[id] || 0) + (Number(pr.capacityUsed) || 0);
      });
      setTraineesByCenter(map);
      if (c.status === 'rejected') showToast(t('loadFailed'), 'dng');
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Distinct filter options from the loaded data.
  const countryOptions = useMemo(() => {
    const s = [...new Set(centers.map(countryOf).filter(Boolean))].sort();
    return s;
  }, [centers]);
  const cityOptions = useMemo(() => {
    const s = [...new Set(centers.map(c => c.city).filter(Boolean))].sort();
    return s;
  }, [centers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return centers.filter(c => {
      if (country && countryOf(c) !== country) return false;
      if (city && c.city !== city) return false;
      if (q) {
        const hay = `${c.name || ''} ${c.idNumber || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [centers, search, country, city]);

  // Keep the page in range whenever the filtered set shrinks.
  useEffect(() => { setPage(1); }, [search, country, city]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="mt-content" dir={dir}>
          <div className="skeleton mt-skel mt-skel-table" style={{ height: 360 }} />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        <div className="mt-filterbar">
          <span className="mt-search">
            <SearchIcon />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} aria-label={t('search')} />
          </span>
          <select className="mt-filter" value={country} onChange={e => setCountry(e.target.value)} aria-label={t('country')}>
            <option value="">{t('allCountries')}</option>
            {countryOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select className="mt-filter" value={city} onChange={e => setCity(e.target.value)} aria-label={t('city')}>
            <option value="">{t('allCities')}</option>
            {cityOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <span className="mt-filterbar-spacer" />
          <span className="mt-count">{t('count', { n: filtered.length.toLocaleString('en-US') })}</span>
        </div>

        {centers.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><NavIcon name="building" size={24} /></div>
            <div className="mt-empty-title">{t('noneTitle')}</div>
            <div className="mt-empty-sub">{t('noneSub')}</div>
          </div>
        ) : (
          <>
            <div className="mt-table-wrap">
              <table className="mt-table mt-table--stack">
                <thead>
                  <tr>
                    <th className="mt-th">{t('center')}</th>
                    <th className="mt-th">{t('id')}</th>
                    <th className="mt-th">{t('country')}</th>
                    <th className="mt-th">{t('city')}</th>
                    <th className="mt-th">{t('dio')}</th>
                    <th className="mt-th">{t('programs')}</th>
                    <th className="mt-th">{t('trainees')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 && (
                    <tr><td className="mt-td mt-td--muted" colSpan={7} style={{ textAlign: 'center', padding: 26 }}>{t('noMatch')}</td></tr>
                  )}
                  {paged.map(c => (
                    <tr key={c._id}>
                      <td className="mt-td mt-td--name" data-label={t('center')}>{c.name}</td>
                      <td className="mt-td mt-td--mono" data-label={t('id')}>{c.idNumber || '—'}</td>
                      <td className="mt-td" data-label={t('country')}>{countryOf(c) || '—'}</td>
                      <td className="mt-td" data-label={t('city')}>{c.city || '—'}</td>
                      <td className="mt-td mt-td--muted" data-label={t('dio')}>{c.dioId?.name || '—'}</td>
                      <td className="mt-td" data-label={t('programs')}>{(c.programs?.length ?? 0).toLocaleString('en-US')}</td>
                      <td className="mt-td" data-label={t('trainees')}>{(traineesByCenter[c._id] ?? 0).toLocaleString('en-US')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPrev={() => setPage(p => Math.max(1, p - 1))}
              onNext={() => setPage(p => Math.min(pageCount, p + 1))}
            />
          </>
        )}
      </main>
      <MtToastHost toasts={toasts} />
    </>
  );
}
