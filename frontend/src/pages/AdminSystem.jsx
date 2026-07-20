// W2-Developer — System overview (RULINGS §B14: "System = current AdminSystem
// content, restyled"). mt- restyle of the country → centers/users overview; all
// behaviour kept (expandable cards + "Unassigned" bucket + i18n).
// Contract: GET /api/admin/system →
//   { data: { countries:[{ _id, country, code, centers:[{_id,name,city}], userCount }],
//             unassigned:{ centers:[…], userCount } } }
import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import RevealOnScroll from '../components/RevealOnScroll';
import { IconBuilding } from '../components/icons';
import api from '../api/axios';
import './developer.css';

const STRINGS = {
  ar: {
    intro: 'كل دولة مع مراكزها التدريبية وعدد مستخدميها.',
    centers: 'المراكز', users: 'المستخدمون',
    unassigned: 'غير مُسند', noCenters: 'لا توجد مراكز', noData: 'لا توجد بيانات.',
    loadFailed: 'فشل تحميل بيانات النظام',
  },
  en: {
    intro: 'Every country with its training centers and user count.',
    centers: 'Centers', users: 'Users',
    unassigned: 'Unassigned', noCenters: 'No centers', noData: 'No data.',
    loadFailed: 'Failed to load system data',
  },
};

export default function AdminSystem() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.en[k] ?? k;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/api/admin/system', { cache: false })
      .then((r) => setData(r.data?.data || r.data || null))
      .catch(() => setErr(t('loadFailed')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <>
        <Navbar title="System" subtitle="Developer" />
        <main className="mt-content">
          <div className="dev-sys-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton mt-skel" style={{ height: 96, animationDelay: `${(i * 0.08).toFixed(2)}s` }} />
            ))}
          </div>
        </main>
      </>
    );
  }

  const countries = data?.countries || [];
  const unassigned = data?.unassigned || { centers: [], userCount: 0 };
  const showUnassigned = (unassigned.centers?.length || 0) > 0 || (unassigned.userCount || 0) > 0;

  const renderCard = (id, name, code, centers, userCount, i) => {
    const isOpen = expanded === id;
    return (
      <RevealOnScroll key={id} delay={i * 0.05}
        className="mt-card dev-sys-card" role="button" tabIndex={0}
        onClick={() => setExpanded(isOpen ? null : id)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(isOpen ? null : id); } }}
      >
        <div className="dev-sys-head">
          <div style={{ minWidth: 0 }}>
            <div className="dev-sys-name">{name}</div>
            {code ? <div className="dev-sys-code">{code}</div> : null}
          </div>
          <div className="dev-sys-badges">
            <span className="mt-pill mt-pill--capacity">{centers.length} {t('centers')}</span>
            <span className="mt-pill mt-pill--active">{userCount} {t('users')}</span>
          </div>
        </div>
        {isOpen && (
          <div className="dev-sys-expand" onClick={(e) => e.stopPropagation()}>
            {centers.length === 0 ? (
              <div className="mt-td--muted" style={{ fontSize: 13 }}>{t('noCenters')}</div>
            ) : (
              centers.map((c) => (
                <div key={c._id} className="dev-sys-center-row">
                  <b>{c.name}</b><span className="mt-td--muted">{c.city || '—'}</span>
                </div>
              ))
            )}
            <div className="mt-td--muted" style={{ fontSize: 12, marginBlockStart: 8 }}>
              {t('users')}: <b style={{ color: 'var(--text)' }}>{userCount}</b>
            </div>
          </div>
        )}
      </RevealOnScroll>
    );
  };

  return (
    <>
      <Navbar title="System" subtitle="Developer" />
      <main className="mt-content">
        <div className="dev-intro">{t('intro')}</div>
        {err && (
          <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)' }}>{err}</div>
        )}
        {countries.length === 0 && !showUnassigned ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconBuilding size={22} /></div>
            <div className="mt-empty-title">{t('noData')}</div>
          </div>
        ) : (
          <div className="dev-sys-grid">
            {countries.map((co, i) => renderCard(co._id, co.country, co.code, co.centers || [], co.userCount || 0, i))}
            {showUnassigned && renderCard('__unassigned__', t('unassigned'), '', unassigned.centers || [], unassigned.userCount || 0, countries.length)}
          </div>
        )}
      </main>
    </>
  );
}
