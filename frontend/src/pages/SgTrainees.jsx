// frontend/src/pages/SgTrainees.jsx
//
// Secretary General / Assistant Secretary read-only trainee list with search and
// a computed training-year badge (Y1–Y6).
// Contract: GET /api/sg/trainees[?search=] → trainees with injected trainingYear
//   and populated programId.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    search: 'ابحث بالاسم أو الرقم التعريفي…',
    name: 'الاسم', idNumber: 'الرقم التعريفي', program: 'البرنامج', year: 'السنة',
    none: 'لا يوجد متدربون بعد.', noMatch: 'لا توجد نتائج مطابقة.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by name or ID number…',
    name: 'Name', idNumber: 'ID Number', program: 'Program', year: 'Year',
    none: 'No trainees yet.', noMatch: 'No matching results.', loadFailed: 'Failed to load',
  },
};

export default function SgTrainees() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [trainees, setTrainees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/sg/trainees')
      .then(r => setTrainees(r.data?.data || r.data || []))
      .catch(() => showToast(t('loadFailed')))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = trainees.filter(tr => {
    const q = search.trim().toLowerCase();
    return !q
      || (tr.name || '').toLowerCase().includes(q)
      || (tr.idNumber || '').toLowerCase().includes(q)
      || (tr.studentId || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(8)].map((_, i) => (<tr key={i}><td><Sk w={130} h={13} /></td><td><Sk w={80} h={13} /></td><td><Sk w={120} h={13} /></td><td><Sk w={40} h={22} r={20} /></td></tr>))}
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
              <thead>
                <tr><th>{t('name')}</th><th>{t('idNumber')}</th><th>{t('program')}</th><th>{t('year')}</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{trainees.length === 0 ? t('none') : t('noMatch')}</td></tr>
                )}
                {filtered.map(tr => {
                  const yr = tr.trainingYear;
                  return (
                    <tr key={tr._id}>
                      <td><strong>{tr.name}</strong></td>
                      <td>{tr.idNumber || tr.studentId || '—'}</td>
                      <td>{tr.programId?.name || '—'}</td>
                      <td>{yr >= 1 && yr <= 6 ? <span className="badge badge-blue">Y{yr}</span> : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
