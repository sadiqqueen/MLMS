// frontend/src/pages/SgDios.jsx
//
// Secretary General / Assistant Secretary read-only DIO directory.
// Restyled to the mt- design: AccountCard people-grid (avatar, mono ID, role
// pill, key/value rows). Read-only — no edit pencil (RULINGS §43). Each DIO's
// ODIO(s) and Sub-DIO(s) are preserved as extra key/value rows so no oversight
// info is lost. Contract (unchanged): GET /api/sg/dios → { dios, odios, subDios }.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import AccountCard from '../components/AccountCard';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconBriefcase } from '../components/icons';
import api from '../api/axios';
import './sg.css';

const PAGE_SIZE = 9;

const STRINGS = {
  ar: {
    search: 'ابحث بالاسم أو الرقم التعريفي…', allCountries: 'كل الدول', count: n => `${n} مدير تدريب`,
    roleDio: 'DIO', country: 'الدولة', city: 'المدينة', phone: 'الهاتف', email: 'البريد',
    odios: 'ODIOs', subDios: 'النواب',
    noneTitle: 'لا يوجد DIOs بعد.', noneSub: 'سيظهر مدراء التدريب هنا عند إضافتهم.',
    noMatchTitle: 'لا توجد نتائج مطابقة.', noMatchSub: 'جرّب تعديل البحث أو عامل التصفية.',
    loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by name or ID number…', allCountries: 'All countries', count: n => `${n} DIOs`,
    roleDio: 'DIO', country: 'Country', city: 'City', phone: 'Phone', email: 'Email',
    odios: 'ODIOs', subDios: 'Sub-DIOs',
    noneTitle: 'No DIOs yet.', noneSub: 'DIOs appear here once added.',
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

function countryLabel(c) { return c ? `${c.name}${c.code ? ` (${c.code})` : ''}` : '—'; }

export default function SgDios() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [dios, setDios] = useState([]);
  const [odios, setOdios] = useState([]);
  const [subDios, setSubDios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get('/api/sg/dios')
      .then((r) => {
        const d = r.data?.data || r.data || {};
        setDios(d.dios || []);
        setOdios(d.odios || []);
        setSubDios(d.subDios || []);
      })
      .catch(() => showToast(t('loadFailed'), 'dng'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1); }, [search, countryFilter]);

  const odiosFor = (d) => odios.filter((o) => (o.dioId?._id || o.dioId) === d._id);
  const subDiosFor = (d) => subDios.filter((s) => (s.dioId?._id || s.dioId) === d._id);

  const countryOptions = [];
  const seen = new Set();
  dios.forEach((d) => {
    const id = d.countryId?._id || d.countryId;
    if (id && !seen.has(id)) { seen.add(id); countryOptions.push({ value: id, label: countryLabel(d.countryId) }); }
  });

  const filtered = dios.filter((d) => {
    if (countryFilter && (d.countryId?._id || d.countryId) !== countryFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || (d.name || '').toLowerCase().includes(q) || (d.idNumber || '').toLowerCase().includes(q);
  });

  const total = filtered.length;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function fieldsFor(d) {
    const fields = [
      { label: t('country'), value: countryLabel(d.countryId) },
      { label: t('city'), value: d.city || '—' },
      { label: t('phone'), value: d.phone || '—' },
      { label: t('email'), value: d.email || '—' },
    ];
    const myO = odiosFor(d);
    const myS = subDiosFor(d);
    if (myO.length) fields.push({ label: t('odios'), value: myO.map((o) => o.name).join('، ') });
    if (myS.length) fields.push({ label: t('subDios'), value: myS.map((s) => s.name).join('، ') });
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
          <select className="mt-filter" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
            <option value="">{t('allCountries')}</option>
            {countryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
            <div className="mt-empty-icon"><IconBriefcase size={22} /></div>
            <div className="mt-empty-title">{dios.length === 0 ? t('noneTitle') : t('noMatchTitle')}</div>
            <div className="mt-empty-sub">{dios.length === 0 ? t('noneSub') : t('noMatchSub')}</div>
          </div>
        ) : (
          <>
            <div className="mt-acct-grid">
              {paged.map((d, i) => (
                <RevealOnScroll key={d._id} delay={(i % PAGE_SIZE) * 0.06}>
                  <AccountCard name={d.name} id={d.idNumber} role={t('roleDio')} fields={fieldsFor(d)} />
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
