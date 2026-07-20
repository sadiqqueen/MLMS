// frontend/src/pages/DioViewTrainees.jsx
//
// DIO / Sub-DIO oversight of the trainees across the caller's center set —
// restyled to the mt- design (lists_views "DIO › trainees": account-card grid,
// read-only, Program + Year filters). No write UI (RULINGS §43).
// Contract (unchanged): GET /api/dio-view/trainees →
//   [{ ...trainee, programId:{name}, hospitalId:{name}, specialtyId:{name},
//      trainingYear }].
// The design's per-trainee "Rotation" key has no source on this payload, so the
// injected training Year stands in its place (see report QUESTIONS).
import { useState, useEffect, useMemo } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import AccountCard from '../components/AccountCard';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconGrad } from '../components/icons';
import api from '../api/axios';
import './dioview.css';

const PAGE_SIZE = 9;

const STRINGS = {
  ar: {
    search: 'ابحث بالاسم أو الرقم…', allPrograms: 'كل البرامج', allYears: 'كل السنوات',
    year: (n) => `السنة ${n}`, count: (n) => `${n} متدرب`, badge: 'متدرب',
    center: 'المركز', program: 'البرنامج', yearLbl: 'السنة', email: 'البريد الإلكتروني',
    noTrainees: 'لا يوجد متدربون بعد.', noTraineesSub: 'سيظهر متدربو مراكزك هنا.',
    noMatch: 'لا توجد نتائج مطابقة.', noMatchSub: 'جرّب تعديل البحث أو التصفية.',
    noCenters: 'لا توجد مراكز مسندة إلى حسابك بعد.', noCentersSub: 'ستظهر بيانات مراكزك هنا بمجرد إسنادها.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by name or ID…', allPrograms: 'All programs', allYears: 'All years',
    year: (n) => `Year ${n}`, count: (n) => `${n} trainees`, badge: 'Trainee',
    center: 'Center', program: 'Program', yearLbl: 'Year', email: 'Email',
    noTrainees: 'No trainees yet.', noTraineesSub: 'Trainees in your centers appear here.',
    noMatch: 'No matching results.', noMatchSub: 'Try adjusting your search or filter.',
    noCenters: 'No centers are assigned to your account yet.', noCentersSub: 'Your center data appears here once assigned.', loadFailed: 'Failed to load',
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

function progId(tr) { return tr.programId?._id || tr.programId || ''; }

export default function DioViewTrainees() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noCenters, setNoCenters] = useState(false);
  const [search, setSearch] = useState('');
  const [programF, setProgramF] = useState('');
  const [yearF, setYearF] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/api/dio-view/trainees')
      .then((r) => setTrainees(r.data?.data || r.data || []))
      .catch((err) => { if (err.response?.status === 403) setNoCenters(true); else showToast(t('loadFailed'), 'dng'); })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [search, programF, yearF]);

  const programOptions = useMemo(() => {
    const seen = new Set(); const out = [];
    trainees.forEach((tr) => {
      const id = progId(tr); const name = tr.programId?.name;
      if (id && name && !seen.has(id)) { seen.add(id); out.push({ value: id, label: name }); }
    });
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [trainees]);

  const yearOptions = useMemo(() => {
    const set = new Set();
    trainees.forEach((tr) => { const y = tr.trainingYear; if (y >= 1 && y <= 6) set.add(y); });
    return [...set].sort((a, b) => a - b);
  }, [trainees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return trainees.filter((tr) => {
      if (programF && progId(tr) !== programF) return false;
      if (yearF && String(tr.trainingYear) !== yearF) return false;
      if (q && !((tr.name || '').toLowerCase().includes(q)
        || (tr.idNumber || '').toLowerCase().includes(q)
        || (tr.studentId || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [trainees, search, programF, yearF]);

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function fieldsFor(tr) {
    const yr = tr.trainingYear;
    return [
      { label: t('center'), value: tr.hospitalId?.name || '—' },
      { label: t('program'), value: tr.programId?.name || '—' },
      { label: t('yearLbl'), value: yr >= 1 && yr <= 6 ? t('year')(yr) : '—' },
      { label: t('email'), value: tr.email || '—' },
    ];
  }

  if (noCenters) {
    return (
      <>
        <Navbar />
        <main className="mt-content" dir={dir}>
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconGrad size={22} /></div>
            <div className="mt-empty-title">{t('noCenters')}</div>
            <div className="mt-empty-sub">{t('noCentersSub')}</div>
          </div>
          <MtToastHost toasts={toasts} />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        <div className="mt-filterbar">
          <div className="mt-search">
            <SearchIcon />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} />
          </div>
          <select className="mt-filter" value={programF} onChange={(e) => setProgramF(e.target.value)}>
            <option value="">{t('allPrograms')}</option>
            {programOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select className="mt-filter" value={yearF} onChange={(e) => setYearF(e.target.value)}>
            <option value="">{t('allYears')}</option>
            {yearOptions.map((y) => <option key={y} value={y}>{t('year')(y)}</option>)}
          </select>
          <div className="mt-filterbar-spacer" />
          {!loading && <span className="mt-count">{t('count')(total)}</span>}
        </div>

        {loading ? (
          <div className="mt-acct-grid">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton mt-skel" style={{ height: 190 }} />)}
          </div>
        ) : total === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconGrad size={22} /></div>
            <div className="mt-empty-title">{trainees.length === 0 ? t('noTrainees') : t('noMatch')}</div>
            <div className="mt-empty-sub">{trainees.length === 0 ? t('noTraineesSub') : t('noMatchSub')}</div>
          </div>
        ) : (
          <>
            <div className="mt-acct-grid">
              {paged.map((tr, i) => (
                <RevealOnScroll key={tr._id} delay={(i % PAGE_SIZE) * 0.05}>
                  <AccountCard
                    name={tr.name} id={tr.idNumber || tr.studentId}
                    role={t('badge')} fields={fieldsFor(tr)} canEdit={false}
                  />
                </RevealOnScroll>
              ))}
            </div>
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
