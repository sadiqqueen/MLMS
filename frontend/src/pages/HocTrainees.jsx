// frontend/src/pages/HocTrainees.jsx
//
// Head of Council — read-only trainees table (RULINGS §43: zero write UI, no add
// button, no row-action icons). Every active trainee in the council's specialties
// (main + precise) or enrolled on one of the council's programs.
//   GET /api/hoc/trainees → [{ ...trainee, trainingYear,
//       specialtyId:{name,type}, programId:{name}, hospitalId:{name}, countryId }]
// Columns: Trainee · ID · Specialty · Program · Center · Year · Email.
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
    search: 'ابحث بالاسم أو المعرّف…', allSpecialties: 'كل الاختصاصات', allCenters: 'كل المراكز',
    count: '{n} متدرب', trainee: 'المتدرب', id: 'المعرّف', specialty: 'الاختصاص',
    program: 'البرنامج', center: 'المركز', year: 'السنة', email: 'البريد',
    main: 'اختصاص', precise: 'اختصاص فرعي', yearN: 'السنة {n}',
    noneTitle: 'لا يوجد متدربون', noneSub: 'لا يوجد متدربون ضمن نطاق مجلسك بعد.',
    noMatch: 'لا يوجد متدربون مطابقون.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by name or ID…', allSpecialties: 'All specialties', allCenters: 'All centers',
    count: '{n} trainees', trainee: 'Trainee', id: 'ID', specialty: 'Specialty',
    program: 'Program', center: 'Center', year: 'Year', email: 'Email',
    main: 'Specialty', precise: 'Sub-specialty', yearN: 'Year {n}',
    noneTitle: 'No trainees', noneSub: 'No trainees fall within your council scope yet.',
    noMatch: 'No trainees match your filters.', loadFailed: 'Failed to load',
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

const specialtyOf = (tr) => tr?.specialtyId?.name || '';
const centerOf = (tr) => tr?.hospitalId?.name || tr?.hospital?.name || '';
const idOf = (tr) => tr?.studentId || tr?.idNumber || '';

export default function HocTrainees() {
  const { lang } = usePrefs();
  const t = (k, vars) => {
    let s = STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
    if (vars) Object.entries(vars).forEach(([n, val]) => { s = s.replace(`{${n}}`, val); });
    return s;
  };
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const { toasts, showToast } = useMtToast();
  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [center, setCenter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    let alive = true;
    api.get('/api/hoc/trainees')
      .then(r => { if (alive) setTrainees(r.data?.data ?? r.data ?? []); })
      .catch(() => { if (alive) showToast(t('loadFailed'), 'dng'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const specialtyOptions = useMemo(
    () => [...new Set(trainees.map(specialtyOf).filter(Boolean))].sort(), [trainees]);
  const centerOptions = useMemo(
    () => [...new Set(trainees.map(centerOf).filter(Boolean))].sort(), [trainees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trainees.filter(tr => {
      if (specialty && specialtyOf(tr) !== specialty) return false;
      if (center && centerOf(tr) !== center) return false;
      if (q && !`${tr.name || ''} ${idOf(tr)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [trainees, search, specialty, center]);

  useEffect(() => { setPage(1); }, [search, specialty, center]);
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
          <select className="mt-filter" value={specialty} onChange={e => setSpecialty(e.target.value)} aria-label={t('specialty')}>
            <option value="">{t('allSpecialties')}</option>
            {specialtyOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select className="mt-filter" value={center} onChange={e => setCenter(e.target.value)} aria-label={t('allCenters')}>
            <option value="">{t('allCenters')}</option>
            {centerOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <span className="mt-filterbar-spacer" />
          <span className="mt-count">{t('count', { n: filtered.length.toLocaleString('en-US') })}</span>
        </div>

        {trainees.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><NavIcon name="grad" size={24} /></div>
            <div className="mt-empty-title">{t('noneTitle')}</div>
            <div className="mt-empty-sub">{t('noneSub')}</div>
          </div>
        ) : (
          <>
            <div className="mt-table-wrap">
              <table className="mt-table mt-table--stack">
                <thead>
                  <tr>
                    <th className="mt-th">{t('trainee')}</th>
                    <th className="mt-th">{t('id')}</th>
                    <th className="mt-th">{t('specialty')}</th>
                    <th className="mt-th">{t('program')}</th>
                    <th className="mt-th">{t('center')}</th>
                    <th className="mt-th">{t('year')}</th>
                    <th className="mt-th">{t('email')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.length === 0 && (
                    <tr><td className="mt-td mt-td--muted" colSpan={7} style={{ textAlign: 'center', padding: 26 }}>{t('noMatch')}</td></tr>
                  )}
                  {paged.map(tr => {
                    const type = tr.specialtyId?.type;
                    return (
                      <tr key={tr._id}>
                        <td className="mt-td mt-td--name" data-label={t('trainee')}>{tr.name}</td>
                        <td className="mt-td mt-td--mono" data-label={t('id')}>{idOf(tr) || '—'}</td>
                        <td className="mt-td" data-label={t('specialty')}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {specialtyOf(tr) || '—'}
                            {type && (
                              <span className={`mt-pill ${type === 'main' ? 'mt-pill--role' : 'mt-pill--neutral'}`}>
                                {type === 'main' ? t('main') : t('precise')}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="mt-td" data-label={t('program')}>{tr.programId?.name || '—'}</td>
                        <td className="mt-td" data-label={t('center')}>{centerOf(tr) || '—'}</td>
                        <td className="mt-td" data-label={t('year')}>{tr.trainingYear ? t('yearN', { n: tr.trainingYear }) : '—'}</td>
                        <td className="mt-td mt-td--muted" data-label={t('email')}>{tr.email || '—'}</td>
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
