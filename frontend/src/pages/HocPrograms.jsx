// frontend/src/pages/HocPrograms.jsx
//
// Head of Council — read-only programs table (RULINGS §43: zero write UI, no add
// button, no row-action icons). The council's programs (main + precise scope).
//   GET /api/hoc/programs → [{ ...program, accreditationNumber, yearlyCapacity,
//       capacityUsed, specialtyId:{name,type,code},
//       trainingCenterId:{name,countryId:{name}}, programDirectorId:{name} }]
// Columns: Program · ID · Specialty · Center · PD · Capacity · Trainees.
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
    search: 'ابحث باسم البرنامج…', allSpecialties: 'كل الاختصاصات', allCountries: 'كل الدول',
    count: '{n} برنامج', program: 'البرنامج', id: 'المعرّف', specialty: 'الاختصاص',
    center: 'المركز', pd: 'مدير البرنامج', capacity: 'السعة', trainees: 'المتدربون',
    main: 'رئيسي', precise: 'دقيق', full: 'مكتمل',
    noneTitle: 'لا توجد برامج', noneSub: 'لا توجد برامج ضمن نطاق مجلسك بعد.',
    noMatch: 'لا توجد برامج مطابقة.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by program name…', allSpecialties: 'All specialties', allCountries: 'All countries',
    count: '{n} programs', program: 'Program', id: 'ID', specialty: 'Specialty',
    center: 'Center', pd: 'PD', capacity: 'Capacity', trainees: 'Trainees',
    main: 'Main', precise: 'Precise', full: 'Full',
    noneTitle: 'No programs', noneSub: 'No programs fall within your council scope yet.',
    noMatch: 'No programs match your filters.', loadFailed: 'Failed to load',
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

const specialtyOf = p => p?.specialtyId?.name || '';
const countryOf = p => p?.trainingCenterId?.countryId?.name || '';

export default function HocPrograms() {
  const { lang } = usePrefs();
  const t = (k, vars) => {
    let s = STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
    if (vars) Object.entries(vars).forEach(([n, val]) => { s = s.replace(`{${n}}`, val); });
    return s;
  };
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const { toasts, showToast } = useMtToast();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [country, setCountry] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    api.get('/api/hoc/programs')
      .then(r => { if (alive) setPrograms(r.data?.data ?? r.data ?? []); })
      .catch(() => { if (alive) showToast(t('loadFailed'), 'dng'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const specialtyOptions = useMemo(
    () => [...new Set(programs.map(specialtyOf).filter(Boolean))].sort(), [programs]);
  const countryOptions = useMemo(
    () => [...new Set(programs.map(countryOf).filter(Boolean))].sort(), [programs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return programs.filter(p => {
      if (specialty && specialtyOf(p) !== specialty) return false;
      if (country && countryOf(p) !== country) return false;
      if (q && !`${p.name || ''} ${p.accreditationNumber || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [programs, search, specialty, country]);

  useEffect(() => { setPage(1); }, [search, specialty, country]);
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

  const renderCapacity = p => {
    const cap = Number(p.yearlyCapacity) || 0;
    const used = Number(p.capacityUsed) || 0;
    const full = cap > 0 && used >= cap;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{used} / {cap || '—'}</span>
        {full && <span className="mt-pill mt-pill--rejected">{t('full')}</span>}
      </span>
    );
  };

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        <div className="mt-filterbar">
          <span className="mt-search">
            <SearchIcon />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search')} aria-label={t('search')} />
          </span>
          <select className="mt-filter" value={specialty} onChange={e => setSpecialty(e.target.value)} aria-label={t('specialty')}>
            <option value="">{t('allSpecialties')}</option>
            {specialtyOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select className="mt-filter" value={country} onChange={e => setCountry(e.target.value)} aria-label={t('allCountries')}>
            <option value="">{t('allCountries')}</option>
            {countryOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <span className="mt-filterbar-spacer" />
          <span className="mt-count">{t('count', { n: filtered.length.toLocaleString('en-US') })}</span>
        </div>

        {programs.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><NavIcon name="layers" size={24} /></div>
            <div className="mt-empty-title">{t('noneTitle')}</div>
            <div className="mt-empty-sub">{t('noneSub')}</div>
          </div>
        ) : (
          <>
            <div className="mt-table-wrap">
              <table className="mt-table mt-table--stack">
                <thead>
                  <tr>
                    <th className="mt-th">{t('program')}</th>
                    <th className="mt-th">{t('id')}</th>
                    <th className="mt-th">{t('specialty')}</th>
                    <th className="mt-th">{t('center')}</th>
                    <th className="mt-th">{t('pd')}</th>
                    <th className="mt-th">{t('capacity')}</th>
                    <th className="mt-th">{t('trainees')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 && (
                    <tr><td className="mt-td mt-td--muted" colSpan={7} style={{ textAlign: 'center', padding: 26 }}>{t('noMatch')}</td></tr>
                  )}
                  {paged.map(p => {
                    const type = p.specialtyId?.type;
                    return (
                      <tr key={p._id}>
                        <td className="mt-td mt-td--name" data-label={t('program')}>{p.name}</td>
                        <td className="mt-td mt-td--mono" data-label={t('id')}>{p.accreditationNumber || '—'}</td>
                        <td className="mt-td" data-label={t('specialty')}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {specialtyOf(p) || '—'}
                            {type && (
                              <span className={`mt-pill ${type === 'main' ? 'mt-pill--role' : 'mt-pill--neutral'}`}>
                                {type === 'main' ? t('main') : t('precise')}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="mt-td" data-label={t('center')}>{p.trainingCenterId?.name || '—'}</td>
                        <td className="mt-td mt-td--muted" data-label={t('pd')}>{p.programDirectorId?.name || '—'}</td>
                        <td className="mt-td" data-label={t('capacity')}>{renderCapacity(p)}</td>
                        <td className="mt-td" data-label={t('trainees')}>{(Number(p.capacityUsed) || 0).toLocaleString('en-US')}</td>
                      </tr>
                    );
                  })}
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
