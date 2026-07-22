// frontend/src/pages/SgPds.jsx
//
// Secretary General / Assistant Secretary read-only Program Director directory.
// Restyled to the mt- design: AccountCard people-grid, read-only (no edit pencil,
// RULINGS §43). Each PD's Sub-PD(s) are preserved as an extra key/value row.
// The design's Country / Program key-values are unavailable from this endpoint
// (it populates specialtyId only, no countryId, and a PD's program derives from
// program attachment), so Specialty is shown instead. Contract (unchanged):
//   GET /api/sg/pds → { pds, subPds }.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import AccountCard from '../components/AccountCard';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconUsers } from '../components/icons';
import api from '../api/axios';
import { specialtyName } from '../utils/specialtyName';
import './sg.css';

const PAGE_SIZE = 9;

const STRINGS = {
  ar: {
    search: 'ابحث بالاسم أو الرقم التعريفي…', allSpecialties: 'كل الاختصاصات', count: n => `${n} مدير برنامج`,
    rolePd: 'PD', specialty: 'الاختصاص', city: 'المدينة', phone: 'الهاتف', email: 'البريد', subPds: 'النواب',
    noneTitle: 'لا يوجد مدراء برامج بعد.', noneSub: 'سيظهر مدراء البرامج هنا عند إضافتهم.',
    noMatchTitle: 'لا توجد نتائج مطابقة.', noMatchSub: 'جرّب تعديل البحث أو عامل التصفية.',
    loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by name or ID number…', allSpecialties: 'All specialties', count: n => `${n} PDs`,
    rolePd: 'PD', specialty: 'Specialty', city: 'City', phone: 'Phone', email: 'Email', subPds: 'Sub-PDs',
    noneTitle: 'No program directors yet.', noneSub: 'Program directors appear here once added.',
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

export default function SgPds() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [pds, setPds] = useState([]);
  const [subPds, setSubPds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/api/sg/pds')
      .then((r) => {
        const d = r.data?.data || r.data || {};
        setPds(d.pds || []);
        setSubPds(d.subPds || []);
      })
      .catch(() => showToast(t('loadFailed'), 'dng'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [search, specialtyFilter]);

  const subPdsFor = (pd) => subPds.filter((s) => (s.pdId?._id || s.pdId) === pd._id);

  const specialtyOptions = [];
  const seen = new Set();
  pds.forEach((pd) => {
    const id = pd.specialtyId?._id || pd.specialtyId;
    if (id && !seen.has(id) && specialtyName(pd.specialtyId)) { seen.add(id); specialtyOptions.push({ value: id, label: specialtyName(pd.specialtyId) }); }
  });

  const filtered = pds.filter((pd) => {
    if (specialtyFilter && (pd.specialtyId?._id || pd.specialtyId) !== specialtyFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || (pd.name || '').toLowerCase().includes(q) || (pd.idNumber || '').toLowerCase().includes(q);
  });

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function fieldsFor(pd) {
    const fields = [
      { label: t('specialty'), value: specialtyName(pd.specialtyId) || '—' },
      { label: t('city'), value: pd.city || '—' },
      { label: t('phone'), value: pd.phone || '—' },
      { label: t('email'), value: pd.email || '—' },
    ];
    const mySubs = subPdsFor(pd);
    if (mySubs.length) fields.push({ label: t('subPds'), value: mySubs.map((s) => s.name).join('، ') });
    return fields;
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
          <select className="mt-filter" value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)}>
            <option value="">{t('allSpecialties')}</option>
            {specialtyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="mt-filterbar-spacer" />
          {!loading && <span className="mt-count">{t('count')(total)}</span>}
        </div>

        {loading ? (
          <div className="mt-acct-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 168, borderRadius: 12 }} />
            ))}
          </div>
        ) : total === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconUsers size={22} /></div>
            <div className="mt-empty-title">{pds.length === 0 ? t('noneTitle') : t('noMatchTitle')}</div>
            <div className="mt-empty-sub">{pds.length === 0 ? t('noneSub') : t('noMatchSub')}</div>
          </div>
        ) : (
          <>
            <div className="mt-acct-grid">
              {paged.map((pd, i) => (
                <RevealOnScroll key={pd._id} delay={(i % PAGE_SIZE) * 0.06}>
                  <AccountCard name={pd.name} id={pd.idNumber} role={t('rolePd')} fields={fieldsFor(pd)} />
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
