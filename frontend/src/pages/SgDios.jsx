// frontend/src/pages/SgDios.jsx
//
// Secretary General / Assistant Secretary read-only DIO directory. Each DIO
// (dio_view) card groups its ODIO(s) (dio) and Sub-DIO(s) (sub_dio), linked via
// dioId. Contract: GET /api/sg/dios → { dios, odios, subDios }.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    search: 'ابحث بالاسم أو الرقم التعريفي…', allCountries: 'كل الدول',
    odios: 'ODIOs', subDios: 'Sub-DIOs', none: 'لا يوجد', centersCount: 'مركز',
    noDios: 'لا يوجد DIOs بعد.', noMatch: 'لا توجد نتائج مطابقة.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by name or ID number…', allCountries: 'All countries',
    odios: 'ODIOs', subDios: 'Sub-DIOs', none: 'None', centersCount: 'centers',
    noDios: 'No DIOs yet.', noMatch: 'No matching results.', loadFailed: 'Failed to load',
  },
};

function countryLabel(c) { return c ? `${c.name}${c.code ? ` (${c.code})` : ''}` : '—'; }

export default function SgDios() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [dios, setDios] = useState([]);
  const [odios, setOdios] = useState([]);
  const [subDios, setSubDios] = useState([]);
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
    api.get('/api/sg/dios')
      .then(r => {
        const d = r.data?.data || r.data || {};
        setDios(d.dios || []);
        setOdios(d.odios || []);
        setSubDios(d.subDios || []);
      })
      .catch(() => showToast(t('loadFailed')))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function odiosFor(d) { return odios.filter(o => (o.dioId?._id || o.dioId) === d._id); }
  function subDiosFor(d) { return subDios.filter(s => (s.dioId?._id || s.dioId) === d._id); }

  const countryOptions = [{ value: '', label: t('allCountries') }];
  const seen = new Set();
  dios.forEach(d => {
    const id = d.countryId?._id || d.countryId;
    if (id && !seen.has(id)) { seen.add(id); countryOptions.push({ value: id, label: countryLabel(d.countryId) }); }
  });

  const filtered = dios.filter(d => {
    if (countryFilter && (d.countryId?._id || d.countryId) !== countryFilter) return false;
    const q = search.trim().toLowerCase();
    return !q || (d.name || '').toLowerCase().includes(q) || (d.idNumber || '').toLowerCase().includes(q);
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
              <div className="admin-empty" style={{ gridColumn: '1/-1' }}>{dios.length === 0 ? t('noDios') : t('noMatch')}</div>
            )}
            {filtered.map(d => {
              const myOdios = odiosFor(d);
              const mySubs = subDiosFor(d);
              const centerCount = (d.assignedCenterIds || []).length;
              return (
                <div className="management-card" key={d._id}>
                  <div className="management-card-title">{d.name}</div>
                  <div className="management-card-sub">{d.idNumber ? d.idNumber : (d.email || '—')}</div>
                  <div className="management-card-meta">
                    <span className="badge badge-blue">{countryLabel(d.countryId)}</span>
                    <span className="badge badge-green">{centerCount} {t('centersCount')}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    <div><strong>{t('odios')}:</strong> {myOdios.length ? myOdios.map(o => o.name).join('، ') : t('none')}</div>
                    <div><strong>{t('subDios')}:</strong> {mySubs.length ? mySubs.map(s => s.name).join('، ') : t('none')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
