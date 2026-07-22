// frontend/src/pages/DioViewPds.jsx
//
// DIO / Sub-DIO oversight of the program directors (and their Sub-PDs) across
// the caller's center set — restyled to the mt- design (lists_views "DIO › pds":
// account-card grid, read-only). The edit pencil is never shown (RULINGS §43 —
// DIO writes only through Add-ODIO). Sub-PD cards show their parent PD.
// Contract: GET /api/dio-view/program-directors →
//   { programDirectors: [{ ...pd, specialtyId:{name}, program?:{name}, center?:{name} }],
//     subPds: [{ ...subPd, specialtyId:{name}, pdId:{name}, program?:{name}, center?:{name} }] }
// `program`/`center` are additive (Fable fix-wave). When present, cards show
// Center/Program (design intent) and the filter switches to Program; until the
// backend supplies them, cards fall back to Specialty/City + a Specialty filter.
import { useState, useEffect, useMemo } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import AccountCard from '../components/AccountCard';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconUsers } from '../components/icons';
import api from '../api/axios';
import { specialtyName } from '../utils/specialtyName';
import './dioview.css';

const PAGE_SIZE = 9;

const STRINGS = {
  ar: {
    search: 'ابحث بالاسم أو الرقم…', allSpecialties: 'كل الاختصاصات', allPrograms: 'كل البرامج', count: (n) => `${n} حساب`,
    badgePd: 'مدير برنامج', badgeSub: 'نائب مدير',
    specialty: 'الاختصاص', city: 'المدينة', phone: 'الهاتف', email: 'البريد الإلكتروني', assignedPd: 'المدير المسؤول',
    center: 'المركز', program: 'البرنامج',
    noPds: 'لا يوجد مدراء برامج بعد.', noPdsSub: 'سيظهر مدراء البرامج في مراكزك هنا.',
    noMatch: 'لا توجد نتائج مطابقة.', noMatchSub: 'جرّب تعديل البحث أو التصفية.',
    noCenters: 'لا توجد مراكز مسندة إلى حسابك بعد.', noCentersSub: 'ستظهر بيانات مراكزك هنا بمجرد إسنادها.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by name or ID…', allSpecialties: 'All specialties', allPrograms: 'All programs', count: (n) => `${n} accounts`,
    badgePd: 'PD', badgeSub: 'Sub-PD',
    specialty: 'Specialty', city: 'City', phone: 'Phone', email: 'Email', assignedPd: 'Assigned PD',
    center: 'Center', program: 'Program',
    noPds: 'No program directors yet.', noPdsSub: 'Program directors in your centers appear here.',
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

function refName(x) { return x?.name || '—'; }
function specId(u) { return u.specialtyId?._id || u.specialtyId || ''; }
// Additive Center/Program (Fable fix-wave). Defensive across the natural keys the
// backend batch might use; null until the enrichment lands.
function pdCenter(u) { return u.center?.name || u.hospitalId?.name || u.centerName || null; }
function pdProgram(u) { return u.program?.name || u.programId?.name || u.programName || null; }

export default function DioViewPds() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [pds, setPds] = useState([]);
  const [subPds, setSubPds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noCenters, setNoCenters] = useState(false);
  const [search, setSearch] = useState('');
  const [specialtyF, setSpecialtyF] = useState('');
  const [programF, setProgramF] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/api/dio-view/program-directors')
      .then((r) => {
        const d = r.data?.data || r.data || {};
        setPds(d.programDirectors || []);
        setSubPds(d.subPds || []);
      })
      .catch((err) => { if (err.response?.status === 403) setNoCenters(true); else showToast(t('loadFailed'), 'dng'); })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [search, specialtyF, programF]);

  // Whether the backend populated Center/Program (design intent). When it has,
  // cards show Center/Program and the filter switches to Program.
  const enriched = useMemo(
    () => [...pds, ...subPds].some((u) => pdCenter(u) || pdProgram(u)),
    [pds, subPds],
  );

  // Distinct specialties present drive the (fallback) filter dropdown.
  const specialtyOptions = useMemo(() => {
    const seen = new Set(); const out = [];
    [...pds, ...subPds].forEach((u) => {
      const id = specId(u); const name = specialtyName(u.specialtyId);
      if (id && name && !seen.has(id)) { seen.add(id); out.push({ value: id, label: name }); }
    });
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [pds, subPds]);

  // Distinct program names present drive the enriched filter dropdown.
  const programOptions = useMemo(() => {
    const seen = new Set(); const out = [];
    [...pds, ...subPds].forEach((u) => {
      const name = pdProgram(u);
      if (name && !seen.has(name)) { seen.add(name); out.push({ value: name, label: name }); }
    });
    return out.sort((a, b) => a.label.localeCompare(b.label));
  }, [pds, subPds]);

  const rows = useMemo(() => {
    const all = [
      ...pds.map((u) => ({ u, kind: 'pd' })),
      ...subPds.map((u) => ({ u, kind: 'sub' })),
    ];
    const q = search.trim().toLowerCase();
    return all.filter(({ u }) => {
      if (enriched) {
        if (programF && pdProgram(u) !== programF) return false;
      } else if (specialtyF && specId(u) !== specialtyF) {
        return false;
      }
      if (q && !((u.name || '').toLowerCase().includes(q) || (u.idNumber || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [pds, subPds, search, specialtyF, programF, enriched]);

  const total = rows.length;
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function fieldsFor({ u, kind }) {
    // Enriched (design intent): Center + (Program for PD / Assigned PD for Sub-PD).
    if (enriched) {
      return [
        { label: t('center'), value: pdCenter(u) || '—' },
        kind === 'sub'
          ? { label: t('assignedPd'), value: refName(u.pdId) }
          : { label: t('program'), value: pdProgram(u) || '—' },
        { label: t('phone'), value: u.phone || '—' },
        { label: t('email'), value: u.email || '—' },
      ];
    }
    // Fallback: /program-directors populates only specialtyId.
    return kind === 'sub'
      ? [{ label: t('assignedPd'), value: refName(u.pdId) }, { label: t('specialty'), value: specialtyName(u.specialtyId) || '—' },
         { label: t('phone'), value: u.phone || '—' }, { label: t('email'), value: u.email || '—' }]
      : [{ label: t('specialty'), value: specialtyName(u.specialtyId) || '—' }, { label: t('city'), value: u.city || '—' },
         { label: t('phone'), value: u.phone || '—' }, { label: t('email'), value: u.email || '—' }];
  }

  if (noCenters) {
    return (
      <>
        <Navbar />
        <main className="mt-content" dir={dir}>
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconUsers size={22} /></div>
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
          {enriched ? (
            <select className="mt-filter" value={programF} onChange={(e) => setProgramF(e.target.value)}>
              <option value="">{t('allPrograms')}</option>
              {programOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <select className="mt-filter" value={specialtyF} onChange={(e) => setSpecialtyF(e.target.value)}>
              <option value="">{t('allSpecialties')}</option>
              {specialtyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          <div className="mt-filterbar-spacer" />
          {!loading && <span className="mt-count">{t('count')(total)}</span>}
        </div>

        {loading ? (
          <div className="mt-acct-grid">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton mt-skel" style={{ height: 190 }} />)}
          </div>
        ) : total === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconUsers size={22} /></div>
            <div className="mt-empty-title">{pds.length + subPds.length === 0 ? t('noPds') : t('noMatch')}</div>
            <div className="mt-empty-sub">{pds.length + subPds.length === 0 ? t('noPdsSub') : t('noMatchSub')}</div>
          </div>
        ) : (
          <>
            <div className="mt-acct-grid">
              {paged.map((row, i) => (
                <RevealOnScroll key={row.u._id} delay={(i % PAGE_SIZE) * 0.05}>
                  <AccountCard
                    name={row.u.name} id={row.u.idNumber}
                    role={row.kind === 'sub' ? t('badgeSub') : t('badgePd')}
                    fields={fieldsFor(row)} canEdit={false}
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
