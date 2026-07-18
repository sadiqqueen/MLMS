// frontend/src/pages/SgPrograms.jsx
//
// Secretary General / Assistant Secretary read-only program list with center,
// specialty, PD and accreditation badges.
// Contract: GET /api/sg/programs → programs with populated trainingCenterId /
//   specialtyId / programDirectorId and computed accreditationStatus.
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import AccreditationBadge from '../components/AccreditationBadge';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    search: 'ابحث باسم البرنامج…',
    colName: 'البرنامج', colCenter: 'المركز', colSpecialty: 'الاختصاص', colPd: 'مدير البرنامج',
    colType: 'نوع الاعتماد', colStatus: 'الحالة', partly: 'جزئي', fully: 'كامل',
    none: 'لا توجد برامج بعد.', noMatch: 'لا توجد نتائج مطابقة.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by program name…',
    colName: 'Program', colCenter: 'Center', colSpecialty: 'Specialty', colPd: 'Program Director',
    colType: 'Accreditation', colStatus: 'Status', partly: 'Partly', fully: 'Fully',
    none: 'No programs yet.', noMatch: 'No matching results.', loadFailed: 'Failed to load',
  },
};

function refName(x) { return x?.name || '—'; }

export default function SgPrograms() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/sg/programs')
      .then(r => setPrograms(r.data?.data || r.data || []))
      .catch(() => showToast(t('loadFailed')))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = programs.filter(p => {
    const q = search.trim().toLowerCase();
    return !q
      || (p.name || '').toLowerCase().includes(q)
      || refName(p.trainingCenterId).toLowerCase().includes(q)
      || refName(p.specialtyId).toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(8)].map((_, i) => (<tr key={i}><td><Sk w={140} h={13} /></td><td><Sk w={120} h={13} /></td><td><Sk w={100} h={13} /></td><td><Sk w={110} h={13} /></td><td><Sk w={70} h={22} r={20} /></td><td><Sk w={70} h={22} r={20} /></td></tr>))}
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
                <tr><th>{t('colName')}</th><th>{t('colCenter')}</th><th>{t('colSpecialty')}</th><th>{t('colPd')}</th><th>{t('colType')}</th><th>{t('colStatus')}</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{programs.length === 0 ? t('none') : t('noMatch')}</td></tr>
                )}
                {filtered.map(p => (
                  <tr key={p._id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{refName(p.trainingCenterId)}</td>
                    <td>{refName(p.specialtyId)}</td>
                    <td>{refName(p.programDirectorId)}</td>
                    <td><span className="badge badge-blue">{p.accreditationType === 'fully' ? t('fully') : t('partly')}</span></td>
                    <td><AccreditationBadge status={p.accreditationStatus} /></td>
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
