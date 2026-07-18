// frontend/src/pages/SgCenters.jsx
//
// Secretary General / Assistant Secretary read-only training-center list. Card
// grid with an accreditation badge and country, filterable by name + country.
// Contract: GET /api/sg/centers → centers with computed accreditationStatus.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import AccreditationBadge from '../components/AccreditationBadge';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    search: 'ابحث باسم المركز…', allCountries: 'كل الدول',
    noCenters: 'لا توجد مراكز بعد.', noMatch: 'لا توجد مراكز مطابقة.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by center name…', allCountries: 'All countries',
    noCenters: 'No centers yet.', noMatch: 'No centers match your search.', loadFailed: 'Failed to load',
  },
};

function countryLabel(c) { return c ? `${c.name}${c.code ? ` (${c.code})` : ''}` : '—'; }

export default function SgCenters() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/sg/centers')
      .then(r => setCenters(r.data?.data || r.data || []))
      .catch(() => showToast(t('loadFailed')))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Distinct countries present in the data drive the filter dropdown.
  const countryOptions = [{ value: '', label: t('allCountries') }];
  const seen = new Set();
  centers.forEach(c => {
    const id = c.countryId?._id || c.countryId;
    if (id && !seen.has(id)) { seen.add(id); countryOptions.push({ value: id, label: countryLabel(c.countryId) }); }
  });

  const filtered = centers.filter(c => {
    if (countryFilter && (c.countryId?._id || c.countryId) !== countryFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || (c.name || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /><Sk w={170} h={36} r={8} /></div>
          <div className="management-card-grid">
            {[...Array(6)].map((_, i) => (<div className="management-card" key={i}><Sk w={140} h={15} /><Sk w={100} h={12} /><Sk w={80} h={22} r={20} /></div>))}
          </div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
            <input className="admin-search" style={{ flex: 1, minWidth: 200 }} placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ minWidth: 180 }}>
              <SearchableSelect value={countryFilter} onChange={setCountryFilter} options={countryOptions} placeholder={t('allCountries')} />
            </div>
          </div>

          <div className="management-card-grid">
            {filtered.length === 0 && (
              <div className="admin-empty" style={{ gridColumn: '1/-1' }}>{centers.length === 0 ? t('noCenters') : t('noMatch')}</div>
            )}
            {filtered.map(c => (
              <div className="management-card" key={c._id}>
                <div className="management-card-title">{c.name}</div>
                <div className="management-card-sub">{countryLabel(c.countryId)}{c.city ? ` · ${c.city}` : ''}</div>
                <div className="management-card-meta">
                  <AccreditationBadge status={c.accreditationStatus} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
