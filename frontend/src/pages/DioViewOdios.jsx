// frontend/src/pages/DioViewOdios.jsx  (NEW — design DIO › ODIOs)
//
// The DIO's own operational DIOs (ODIOs). This is the DIO's ONLY write surface
// (RULINGS §43 · §F28): "+ Add ODIO" creates a role-`dio` account under this
// DIO. Country, City and Training centers are INHERITED from the DIO's account
// (server copies them from req.user; centers resolve dynamically through the
// parent) — shown read-only & locked in the modal. Creates apply directly
// (201) → green "saved" toast, no approval note (RULINGS §E22).
//
// Only `dio` (formerly dio_view) may list/create here (contract: GET/POST
// /api/dio-view/odios are dio-only). `sub_dio`/`developer` reach the route
// (App.jsx) but the API returns 403 → a friendly read-only notice.
// Contract:
//   GET  /api/dio-view/odios  → [{ ...odio(role:dio), countryId:{name}, city, email }]
//   POST /api/dio-view/odios  { name*, email*, password*(≥6) } → 201 { data }
//   GET  /api/dio-view/centers (parent's centers) → inherited training-centers display
//   GET  /api/dio-view/me      → { countryId:{name}, city } (authoritative inherited
//                                 country/city; additive — 404 falls back to centers)
import { useState, useEffect, useMemo } from 'react';
import { usePrefs } from '../context/PrefsContext';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import AccountCard from '../components/AccountCard';
import MtModal from '../components/MtModal';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconLock, IconBriefcase } from '../components/icons';
import api from '../api/axios';
import './dioview.css';

const STRINGS = {
  ar: {
    addOdio: 'إضافة ODIO', count: (n) => `${n} ODIO`, badge: 'ODIO',
    country: 'الدولة', city: 'المدينة', centers: 'مراكز التدريب', email: 'البريد الإلكتروني',
    nCenters: (n) => `${n} مركز`,
    empty: 'لا يوجد ODIO تحت حسابك بعد.', emptySub: 'أنشئ أول ODIO تشغيلي لمؤسستك.',
    forbidden: 'إدارة ODIO متاحة لحساب DIO فقط.',
    forbiddenSub: 'يتولى حساب DIO إنشاء المديرين التشغيليين وإدارتهم من هنا.',
    loadFailed: 'فشل التحميل',
    // modal
    newOdio: 'ODIO جديد', newOdioSub: 'مدير تشغيلي تحت مؤسستك',
    name: 'الاسم', password: 'كلمة المرور', pwHint: '(6 أحرف على الأقل)',
    inherited: 'موروث من حسابك', cancel: 'إلغاء', create: 'إنشاء ODIO', saving: 'جارٍ الحفظ…',
    required: 'الحقول المطلوبة ناقصة', saveFailed: 'فشل الحفظ', created: 'تم إنشاء ODIO',
  },
  en: {
    addOdio: 'Add ODIO', count: (n) => `${n} ODIOs`, badge: 'ODIO',
    country: 'Country', city: 'City', centers: 'Training centers', email: 'Email',
    nCenters: (n) => `${n} centers`,
    empty: 'No ODIOs under your account yet.', emptySub: 'Create the first operational DIO for your institution.',
    forbidden: 'ODIO management is available to the DIO account.',
    forbiddenSub: 'The DIO account creates and manages operational DIOs from here.',
    loadFailed: 'Failed to load',
    // modal
    newOdio: 'New ODIO', newOdioSub: 'Operational DIO under your institution',
    name: 'Name', password: 'Password', pwHint: '(min 6 chars)',
    inherited: 'Inherited from your account', cancel: 'Cancel', create: 'Create ODIO', saving: 'Saving…',
    required: 'Required fields are missing', saveFailed: 'Save failed', created: 'ODIO created',
  },
};

function AddOdioModal({ lang, inherited, onClose, onSaved }) {
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.en[k] ?? k;
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErr((e) => ({ ...e, [k]: false })); setApiErr(''); };

  async function save() {
    const e = {};
    if (!f.name.trim()) e.name = true;
    if (!f.email.trim()) e.email = true;
    if (!f.password || f.password.length < 6) e.password = true;
    if (Object.keys(e).length) { setErr(e); setApiErr(t('required')); return; }
    setSaving(true); setApiErr('');
    try {
      const res = await api.post('/api/dio-view/odios', {
        name: f.name.trim(), email: f.email.trim(), password: f.password,
      });
      onSaved(res.data?.data || res.data);
    } catch (ex) { setApiErr(ex.response?.data?.message || t('saveFailed')); } finally { setSaving(false); }
  }

  const errStyle = (k) => (err[k] ? { borderColor: 'var(--danger)' } : undefined);
  const Help = () => (
    <div className="dioview-help"><IconLock size={11} /> {t('inherited')}</div>
  );

  return (
    <MtModal open tone="user" title={t('newOdio')} sub={t('newOdioSub')} onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="mt-btn" onClick={save} disabled={saving}>{saving ? t('saving') : t('create')}</button>
      </>}>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">{t('name')}<span className="mt-label-req">*</span></label>
          <input className="mt-input" value={f.name} placeholder="Dr. Full Name"
            onChange={(e) => set('name', e.target.value)} style={errStyle('name')} />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">{t('email')}<span className="mt-label-req">*</span></label>
          <input className="mt-input" type="email" value={f.email} placeholder="name@mtms.med"
            onChange={(e) => set('email', e.target.value)} style={errStyle('email')} />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">{t('password')}<span className="mt-label-req">*</span>{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>{t('pwHint')}</span></label>
          <input className="mt-input" type="password" autoComplete="new-password" value={f.password}
            onChange={(e) => set('password', e.target.value)} style={errStyle('password')} />
        </div>

        {/* Inherited (read-only, locked) — server copies these from the DIO. */}
        <div className="mt-field">
          <label className="mt-label mt-lock"><IconLock size={12} /> {t('country')}</label>
          <input className="mt-input" value={inherited.country || '—'} readOnly tabIndex={-1} />
          <Help />
        </div>
        <div className="mt-field">
          <label className="mt-label mt-lock"><IconLock size={12} /> {t('city')}</label>
          <input className="mt-input" value={inherited.city || '—'} readOnly tabIndex={-1} />
          <Help />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label mt-lock"><IconLock size={12} /> {t('centers')}</label>
          <div className="dioview-ro-box">{inherited.centersLabel || '—'}</div>
          <Help />
        </div>
      </div>
      {apiErr && <div className="dioview-err">{apiErr}</div>}
    </MtModal>
  );
}

export default function DioViewOdios() {
  const { lang } = usePrefs();
  const { user } = useAuth();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const isDio = user?.role === 'dio';   // only the DIO can list/create ODIOs
  const [odios, setOdios] = useState([]);
  const [centers, setCenters] = useState([]);
  const [me, setMe] = useState(null);        // GET /dio-view/me → authoritative country/city
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [adding, setAdding] = useState(false);

  async function load() {
    setLoading(true);
    const [o, c, m] = await Promise.allSettled([
      api.get('/api/dio-view/odios', { cache: false }),
      api.get('/api/dio-view/centers'),
      api.get('/api/dio-view/me', { cache: false }), // inherited country/city; additive (404 → derive from centers)
    ]);
    if (o.status === 'fulfilled') {
      setOdios(o.value.data?.data || o.value.data || []);
      setForbidden(false);
    } else if (o.reason?.response?.status === 403) {
      setForbidden(true);
    } else {
      showToast(t('loadFailed'), 'dng');
    }
    if (c.status === 'fulfilled') setCenters(c.value.data?.data || c.value.data || []);
    if (m.status === 'fulfilled') setMe(m.value.data?.data || m.value.data || null);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The values the server copies onto every new ODIO. Prefer the authoritative
  // GET /dio-view/me (exactly what the server writes); fall back to values
  // derived from the DIO's assigned centers when /me isn't available (the auth
  // context carries no country/city). Training centers resolve through the
  // parent, so their display always comes from the centers list.
  const inherited = useMemo(() => {
    const centerNames = centers.map((c) => c.name).filter(Boolean);
    const cities = [...new Set(centers.map((c) => c.city).filter(Boolean))];
    return {
      country: me?.countryId?.name || centers[0]?.countryId?.name || odios[0]?.countryId?.name || '',
      city: me?.city || (cities.length === 1 ? cities[0] : (cities[0] || odios[0]?.city || '')),
      centerNames,
      centersLabel: centerNames.join(', '),
    };
  }, [centers, odios, me]);

  function fieldsFor(o) {
    const label = inherited.centerNames.length ? inherited.centersLabel : t('nCenters')(0);
    return [
      { label: t('country'), value: o.countryId?.name || inherited.country || '—' },
      { label: t('city'), value: o.city || inherited.city || '—' },
      { label: t('centers'), value: label },
      { label: t('email'), value: o.email || '—' },
    ];
  }

  // sub_dio / developer land here but the API is dio-only → read-only notice.
  if (forbidden) {
    return (
      <>
        <Navbar />
        <main className="mt-content" dir={dir}>
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconBriefcase size={22} /></div>
            <div className="mt-empty-title">{t('forbidden')}</div>
            <div className="mt-empty-sub">{t('forbiddenSub')}</div>
          </div>
          <MtToastHost toasts={toasts} />
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        <div className="mt-filterbar">
          <div className="mt-filterbar-spacer" />
          {isDio && (
            <button type="button" className="mt-btn" onClick={() => setAdding(true)}>+ {t('addOdio')}</button>
          )}
          {!loading && <span className="mt-count">{t('count')(odios.length)}</span>}
        </div>

        {loading ? (
          <div className="mt-acct-grid">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton mt-skel" style={{ height: 190 }} />)}
          </div>
        ) : odios.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconBriefcase size={22} /></div>
            <div className="mt-empty-title">{t('empty')}</div>
            {isDio && <div className="mt-empty-sub">{t('emptySub')}</div>}
          </div>
        ) : (
          <div className="mt-acct-grid">
            {odios.map((o, i) => (
              <RevealOnScroll key={o._id} delay={i * 0.06}>
                <AccountCard name={o.name} id={o.idNumber} role={t('badge')} fields={fieldsFor(o)} canEdit={false} />
              </RevealOnScroll>
            ))}
          </div>
        )}

        {adding && (
          <AddOdioModal
            lang={lang} inherited={inherited}
            onClose={() => setAdding(false)}
            onSaved={() => { setAdding(false); showToast(t('created'), 'ok'); load(); }}
          />
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
