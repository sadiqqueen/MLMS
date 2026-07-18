// frontend/src/pages/DioViewPds.jsx
//
// DIO / Sub-DIO oversight of the program directors of the caller's center set,
// each with its Sub-PDs. Read-only card grid.
// Contract: GET /api/dio-view/program-directors → { programDirectors, subPds }
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    search: 'ابحث بالاسم أو الرقم التعريفي…', subPds: 'النواب', none: 'لا يوجد', specialty: 'الاختصاص',
    noPds: 'لا يوجد مدراء برامج بعد.', noMatch: 'لا توجد نتائج مطابقة.',
    noCenters: 'لا توجد مراكز مسندة إلى حسابك بعد.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by name or ID number…', subPds: 'Sub-PDs', none: 'None', specialty: 'Specialty',
    noPds: 'No program directors yet.', noMatch: 'No matching results.',
    noCenters: 'No centers are assigned to your account yet.', loadFailed: 'Failed to load',
  },
};

export default function DioViewPds() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [pds, setPds] = useState([]);
  const [subPds, setSubPds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noCenters, setNoCenters] = useState(false);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/dio-view/program-directors')
      .then(r => {
        const d = r.data?.data || r.data || {};
        setPds(d.programDirectors || []);
        setSubPds(d.subPds || []);
      })
      .catch(err => { if (err.response?.status === 403) setNoCenters(true); else showToast(t('loadFailed')); })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function subPdsFor(pd) { return subPds.filter(s => (s.pdId?._id || s.pdId) === pd._id); }

  const filtered = pds.filter(pd => {
    const q = search.trim().toLowerCase();
    return !q || (pd.name || '').toLowerCase().includes(q) || (pd.idNumber || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
          <div className="management-card-grid">
            {[...Array(6)].map((_, i) => (<div className="management-card" key={i}><Sk w={140} h={15} /><Sk w={100} h={12} /><Sk w={80} h={22} r={20} /></div>))}
          </div>
        </div>
      </main>
    </>
  );

  if (noCenters) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-empty" style={{ padding: 56, textAlign: 'center' }}>{t('noCenters')}</div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar">
            <input className="admin-search" style={{ flex: 1, minWidth: 200 }} placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="management-card-grid">
            {filtered.length === 0 && (
              <div className="admin-empty" style={{ gridColumn: '1/-1' }}>{pds.length === 0 ? t('noPds') : t('noMatch')}</div>
            )}
            {filtered.map(pd => {
              const mySubs = subPdsFor(pd);
              return (
                <div className="management-card" key={pd._id}>
                  <div className="management-card-title">{pd.name}</div>
                  <div className="management-card-sub">{pd.idNumber ? pd.idNumber : (pd.email || '—')}</div>
                  <div className="management-card-meta">
                    <span className="badge badge-blue">{pd.specialtyId?.name || t('specialty')}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    <strong>{t('subPds')}:</strong> {mySubs.length ? mySubs.map(s => s.name).join('، ') : t('none')}
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
