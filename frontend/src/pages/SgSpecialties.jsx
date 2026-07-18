// frontend/src/pages/SgSpecialties.jsx
//
// Secretary General / Assistant Secretary read-only specialty list.
// Contract: GET /api/sg/specialties → advanced specialties.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    search: 'ابحث عن اختصاص…', colNum: '#', colName: 'الاختصاص',
    none: 'لا توجد اختصاصات بعد.', noMatch: 'لا توجد نتائج مطابقة.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search specialties…', colNum: '#', colName: 'Specialty',
    none: 'No specialties yet.', noMatch: 'No matching results.', loadFailed: 'Failed to load',
  },
};

export default function SgSpecialties() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/sg/specialties')
      .then(r => setSpecialties(r.data?.data || r.data || []))
      .catch(() => showToast(t('loadFailed')))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = specialties.filter(s => {
    const q = search.trim().toLowerCase();
    return !q || (s.name || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(8)].map((_, i) => (<tr key={i}><td><Sk w={20} h={13} /></td><td><Sk w={180} h={13} /></td></tr>))}
            </tbody></table>
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
          <div className="admin-toolbar">
            <input className="admin-search" style={{ flex: 1, minWidth: 200 }} placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{filtered.length}</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>{t('colNum')}</th><th>{t('colName')}</th></tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={2} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{specialties.length === 0 ? t('none') : t('noMatch')}</td></tr>
                )}
                {filtered.map((s, i) => (
                  <tr key={s._id}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td><strong>{s.name}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
