// frontend/src/pages/DioViewCenters.jsx
//
// DIO / Sub-DIO center oversight — the caller's assigned centers, each expandable
// to list its programs (with accreditation badges). Read-only.
// Contract: GET /api/dio-view/centers →
//   [{ ...center, accreditationStatus, programs: [{ ...program, accreditationStatus }] }]
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import AccreditationBadge from '../components/AccreditationBadge';
import Sk from '../components/Skeleton';
import { IconCaret } from '../components/icons';
import api from '../api/axios';

const STRINGS = {
  ar: {
    search: 'ابحث باسم المركز…', programs: 'البرامج',
    colName: 'اسم البرنامج', colSpecialty: 'الاختصاص', colPd: 'مدير البرنامج', colType: 'نوع الاعتماد',
    partly: 'جزئي', fully: 'كامل', noPrograms: 'لا توجد برامج في هذا المركز.',
    noCenters: 'لا توجد مراكز مسندة إلى حسابك بعد.', noMatch: 'لا توجد مراكز مطابقة.', loadFailed: 'فشل التحميل',
  },
  en: {
    search: 'Search by center name…', programs: 'Programs',
    colName: 'Program', colSpecialty: 'Specialty', colPd: 'Program Director', colType: 'Accreditation',
    partly: 'Partly', fully: 'Fully', noPrograms: 'No programs in this center.',
    noCenters: 'No centers are assigned to your account yet.', noMatch: 'No centers match your search.', loadFailed: 'Failed to load',
  },
};

function refName(x) { return x?.name || '—'; }

export default function DioViewCenters() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noCenters, setNoCenters] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({});
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'error') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/dio-view/centers')
      .then(r => setCenters(r.data?.data || r.data || []))
      .catch(err => { if (err.response?.status === 403) setNoCenters(true); else showToast(t('loadFailed')); })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id) { setExpanded(e => ({ ...e, [id]: !e[id] })); }

  const filtered = centers.filter(c => {
    const q = search.trim().toLowerCase();
    return !q || (c.name || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card"><div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div></div>
        {[...Array(4)].map((_, i) => (
          <div className="admin-card" key={i} style={{ marginTop: 12, padding: 18 }}><Sk w={200} h={16} /><div style={{ height: 8 }} /><Sk w={120} h={12} /></div>
        ))}
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
        <div className="admin-card" style={{ marginBottom: 12 }}>
          <div className="admin-toolbar">
            <input className="admin-search" style={{ flex: 1, minWidth: 200 }} placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="admin-empty">{centers.length === 0 ? t('noCenters') : t('noMatch')}</div>
        )}

        {filtered.map(c => {
          const isOpen = !!expanded[c._id];
          const programs = c.programs || [];
          return (
            <div className="admin-card" key={c._id} style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => toggle(c._id)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: dir === 'rtl' ? 'right' : 'left' }}
              >
                <span style={{ display: 'inline-flex', transform: isOpen ? 'rotate(180deg)' : 'none', color: 'var(--text-muted)', flexShrink: 0 }}>
                  <IconCaret size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand-secondary)' }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {c.countryId?.name ? `${c.countryId.name}${c.countryId.code ? ` (${c.countryId.code})` : ''}` : '—'}{c.city ? ` · ${c.city}` : ''}
                  </div>
                </div>
                <AccreditationBadge status={c.accreditationStatus} />
                <span className="badge badge-blue" style={{ flexShrink: 0 }}>{t('programs')}: {programs.length}</span>
              </button>

              {isOpen && (
                <div className="admin-table-wrap" style={{ borderTop: '1px solid var(--border)' }}>
                  <table className="admin-table">
                    <thead>
                      <tr><th>{t('colName')}</th><th>{t('colSpecialty')}</th><th>{t('colPd')}</th><th>{t('colType')}</th></tr>
                    </thead>
                    <tbody>
                      {programs.length === 0 && (
                        <tr><td colSpan={4} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>{t('noPrograms')}</td></tr>
                      )}
                      {programs.map(p => (
                        <tr key={p._id}>
                          <td><strong>{p.name}</strong></td>
                          <td>{refName(p.specialtyId)}</td>
                          <td>{refName(p.programDirectorId)}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span className="badge badge-blue">{p.accreditationType === 'fully' ? t('fully') : t('partly')}</span>
                              <AccreditationBadge status={p.accreditationStatus} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
