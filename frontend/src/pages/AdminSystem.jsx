// frontend/src/pages/AdminSystem.jsx
//
// Developer (super_admin) system overview. Country cards — each shows the number
// of training centers and users; clicking a card expands it in-place to list the
// country's centers and its user count. An "Unassigned" card collects centers /
// users with no countryId.
// Contract: GET /api/admin/system →
//   { success, data: { countries: [{ _id, country, code, centers:[{_id,name,city}],
//                       userCount }], unassigned: { centers:[…], userCount } } }
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    title: 'نظرة عامة على النظام',
    centers: 'المراكز', users: 'المستخدمون', city: 'المدينة',
    unassigned: 'غير مُسند', noCenters: 'لا توجد مراكز', noData: 'لا توجد بيانات.',
    loadFailed: 'فشل تحميل بيانات النظام',
  },
  en: {
    title: 'System Overview',
    centers: 'Centers', users: 'Users', city: 'City',
    unassigned: 'Unassigned', noCenters: 'No centers', noData: 'No data.',
    loadFailed: 'Failed to load system data',
  },
};

export default function AdminSystem() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/api/admin/system', { cache: false })
      .then(r => setData(r.data?.data || r.data || null))
      .catch(() => setErr(t('loadFailed')))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="management-card-grid">
          {[...Array(6)].map((_, i) => (
            <div className="management-card" key={i}>
              <Sk w="60%" h={18} style={{ marginBottom: 8 }} />
              <Sk w="35%" h={12} style={{ marginBottom: 12 }} />
              <Sk w="80%" h={22} r={20} />
            </div>
          ))}
        </div>
      </main>
    </>
  );

  const countries = data?.countries || [];
  const unassigned = data?.unassigned || { centers: [], userCount: 0 };
  const showUnassigned = (unassigned.centers?.length || 0) > 0 || (unassigned.userCount || 0) > 0;

  // Render one expandable card (a country, or the unassigned bucket).
  const renderCard = (id, name, code, centers, userCount) => {
    const isOpen = expanded === id;
    return (
      <div
        className="management-card"
        key={id}
        onClick={() => setExpanded(isOpen ? null : id)}
        style={{ cursor: 'pointer' }}
      >
        <div>
          <div className="management-card-title">{name}</div>
          {code ? <div className="management-card-sub">{code}</div> : null}
        </div>
        <div className="management-card-meta" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge badge-blue">{centers.length} {t('centers')}</span>
          <span className="badge badge-green">{userCount} {t('users')}</span>
        </div>
        {isOpen && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }} onClick={e => e.stopPropagation()}>
            {centers.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{t('noCenters')}</div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {centers.map(c => (
                  <li key={c._id} style={{ fontSize: 13, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{c.city || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
              {t('users')}: <strong style={{ color: 'var(--text-2)' }}>{userCount}</strong>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        {err && (
          <div style={{ marginBottom: 16, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{err}</div>
        )}
        {countries.length === 0 && !showUnassigned ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>{t('noData')}</div>
        ) : (
          <div className="management-card-grid">
            {countries.map(co => renderCard(co._id, co.country, co.code, co.centers || [], co.userCount || 0))}
            {showUnassigned && renderCard('__unassigned__', t('unassigned'), '', unassigned.centers || [], unassigned.userCount || 0)}
          </div>
        )}
      </main>
    </>
  );
}
