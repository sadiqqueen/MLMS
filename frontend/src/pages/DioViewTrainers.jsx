// frontend/src/pages/DioViewTrainers.jsx
//
// DIO / Sub-DIO oversight of the trainers (supervisors) in the caller's center
// set. Read-only table with search.
// Contract: GET /api/dio-view/trainers[?search=] → trainers with populated
//   programId/hospitalId/specialtyId.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    search: 'ابحث بالاسم أو الرقم التعريفي…',
    name: 'الاسم', idNumber: 'الرقم التعريفي', program: 'البرنامج', center: 'المركز', specialty: 'الاختصاص', phone: 'الهاتف',
    none: 'لا يوجد مدربون بعد.', noMatch: 'لا توجد نتائج مطابقة.',
    noCenters: 'لا توجد مراكز مسندة إلى حسابك بعد.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by name or ID number…',
    name: 'Name', idNumber: 'ID Number', program: 'Program', center: 'Center', specialty: 'Specialty', phone: 'Phone',
    none: 'No trainers yet.', noMatch: 'No matching results.',
    noCenters: 'No centers are assigned to your account yet.', loadFailed: 'Failed to load',
  },
};

export default function DioViewTrainers() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [trainers, setTrainers] = useState([]);
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
    api.get('/api/dio-view/trainers')
      .then(r => setTrainers(r.data?.data || r.data || []))
      .catch(err => { if (err.response?.status === 403) setNoCenters(true); else showToast(t('loadFailed')); })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = trainers.filter(tr => {
    const q = search.trim().toLowerCase();
    return !q
      || (tr.name || '').toLowerCase().includes(q)
      || (tr.idNumber || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(8)].map((_, i) => (<tr key={i}><td><Sk w={130} h={13} /></td><td><Sk w={80} h={13} /></td><td><Sk w={120} h={13} /></td><td><Sk w={110} h={13} /></td><td><Sk w={90} h={13} /></td></tr>))}
            </tbody></table>
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
            <span style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>{filtered.length}</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>{t('name')}</th><th>{t('idNumber')}</th><th>{t('program')}</th><th>{t('center')}</th><th>{t('specialty')}</th><th>{t('phone')}</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{trainers.length === 0 ? t('none') : t('noMatch')}</td></tr>
                )}
                {filtered.map(tr => (
                  <tr key={tr._id}>
                    <td><strong>{tr.name}</strong></td>
                    <td>{tr.idNumber || '—'}</td>
                    <td>{tr.programId?.name || '—'}</td>
                    <td>{tr.hospitalId?.name || '—'}</td>
                    <td>{tr.specialtyId?.name || tr.specialty || '—'}</td>
                    <td>{tr.phone || '—'}</td>
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
