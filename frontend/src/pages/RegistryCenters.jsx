// frontend/src/pages/RegistryCenters.jsx
//
// Data-entry clerk's Training Centers registry (global, unscoped). A card grid
// of centers with a search + country filter toolbar, an Add/Edit modal, and a
// click-through to the center detail page (programs live there).
// Contract: GET/POST/PATCH /api/registry/centers, GET /api/countries.
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import AccreditationBadge from '../components/AccreditationBadge';
import Sk from '../components/Skeleton';
import { IconPencil } from '../components/icons';
import api from '../api/axios';

const STRINGS = {
  ar: {
    title: 'المراكز التدريبية',
    search: 'ابحث باسم المركز…',
    allCountries: 'كل الدول',
    addCenter: 'إضافة مركز',
    editCenter: 'تعديل المركز',
    newCenter: 'مركز جديد',
    name: 'اسم المركز',
    country: 'الدولة',
    city: 'المدينة',
    address: 'العنوان',
    email: 'البريد الإلكتروني',
    phone: 'الهاتف',
    accNo: 'رقم الاعتماد',
    accGrant: 'تاريخ منح الاعتماد',
    accExpiry: 'تاريخ انتهاء الاعتماد',
    withdrawn: 'الاعتماد مسحوب',
    programs: 'البرامج',
    noCenters: 'لا توجد مراكز بعد.',
    noMatch: 'لا توجد مراكز مطابقة.',
    edit: 'تعديل',
    cancel: 'إلغاء',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    created: 'تم إنشاء المركز',
    updated: 'تم تحديث المركز',
    loadFailed: 'فشل تحميل المراكز',
    nameReq: 'اسم المركز مطلوب',
    countryReq: 'الدولة مطلوبة',
  },
  en: {
    title: 'Training Centers',
    search: 'Search by center name…',
    allCountries: 'All countries',
    addCenter: 'Add Center',
    editCenter: 'Edit Center',
    newCenter: 'New Center',
    name: 'Center Name',
    country: 'Country',
    city: 'City',
    address: 'Address',
    email: 'Email',
    phone: 'Phone',
    accNo: 'Accreditation No.',
    accGrant: 'Accreditation Grant Date',
    accExpiry: 'Accreditation Expiry',
    withdrawn: 'Accreditation withdrawn',
    programs: 'Programs',
    noCenters: 'No centers yet.',
    noMatch: 'No centers match your filters.',
    edit: 'Edit',
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    created: 'Center created',
    updated: 'Center updated',
    loadFailed: 'Failed to load centers',
    nameReq: 'Center name is required',
    countryReq: 'Country is required',
  },
};

function toDateInput(v) { return v ? new Date(v).toISOString().slice(0, 10) : ''; }

function CenterModal({ center, countries, t, dir, onClose, onSaved }) {
  const isEdit = !!center;
  const [form, setForm] = useState(() => ({
    name:                   center?.name || '',
    countryId:              center?.countryId?._id || center?.countryId || '',
    city:                   center?.city || '',
    address:                center?.address || '',
    email:                  center?.email || '',
    phone:                  center?.phone || '',
    accreditationNumber:    center?.accreditationNumber || '',
    accreditationGrantDate: toDateInput(center?.accreditationGrantDate),
    accreditationExpiry:    toDateInput(center?.accreditationExpiry),
    accreditationWithdrawn: !!center?.accreditationWithdrawn,
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); setApiErr(''); }

  async function handleSave() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.countryId) e.countryId = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        name: form.name.trim(),
        countryId: form.countryId,
        city: form.city.trim(),
        address: form.address.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        accreditationNumber: form.accreditationNumber.trim(),
        accreditationGrantDate: form.accreditationGrantDate || null,
        accreditationExpiry: form.accreditationExpiry || null,
        accreditationWithdrawn: form.accreditationWithdrawn,
      };
      const res = isEdit
        ? await api.patch(`/api/registry/centers/${center._id}`, payload)
        : await api.post('/api/registry/centers', payload);
      onSaved(res.data?.data || res.data, isEdit);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  const countryOptions = countries.map(c => ({ value: c._id, label: `${c.name} (${c.code})` }));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg" dir={dir} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{isEdit ? t('editCenter') : t('newCenter')}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>{t('name')} *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="admin-field full">
              <label>{t('country')} *</label>
              <SearchableSelect value={form.countryId} onChange={v => set('countryId', v)} options={countryOptions} placeholder={t('country')} error={errors.countryId} />
            </div>
            <div className="admin-field">
              <label>{t('city')}</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('phone')}</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="admin-field full">
              <label>{t('address')}</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
            <div className="admin-field full">
              <label>{t('email')}</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('accNo')}</label>
              <input value={form.accreditationNumber} onChange={e => set('accreditationNumber', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('accGrant')}</label>
              <input type="date" value={form.accreditationGrantDate} onChange={e => set('accreditationGrantDate', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('accExpiry')}</label>
              <input type="date" value={form.accreditationExpiry} onChange={e => set('accreditationExpiry', e.target.value)} />
            </div>
            <div className="admin-field full">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                <input type="checkbox" checked={form.accreditationWithdrawn} onChange={e => set('accreditationWithdrawn', e.target.checked)} />
                {t('withdrawn')}
              </label>
            </div>
          </div>
          {apiErr && (
            <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{apiErr}</div>
          )}
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
        </div>
      </div>
    </div>
  );
}

export default function RegistryCenters() {
  const navigate = useNavigate();
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [centers, setCenters] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [modal, setModal] = useState(null); // { center? } | null
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [cRes, coRes] = await Promise.allSettled([
      api.get('/api/registry/centers'),
      api.get('/api/countries'),
    ]);
    if (cRes.status === 'fulfilled') setCenters(cRes.value.data?.data || cRes.value.data || []);
    else showToast(t('loadFailed'), 'error');
    if (coRes.status === 'fulfilled') setCountries(coRes.value.data?.data || coRes.value.data || []);
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function handleSaved(saved, isEdit) {
    load();
    setModal(null);
    showToast(isEdit ? t('updated') : t('created'));
  }

  const countryFilterOptions = [{ value: '', label: t('allCountries') }, ...countries.map(c => ({ value: c._id, label: `${c.name} (${c.code})` }))];

  const filtered = centers.filter(c => {
    if (countryFilter && (c.countryId?._id || c.countryId) !== countryFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !(c.name || '').toLowerCase().includes(q)) return false;
    return true;
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /><Sk w={170} h={36} r={8} /><Sk w={120} h={36} r={8} /></div>
          <div className="management-card-grid">
            {[...Array(6)].map((_, i) => (
              <div className="management-card" key={i}>
                <Sk w={140} h={15} /><Sk w={100} h={12} /><Sk w={80} h={22} r={20} />
              </div>
            ))}
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
              <SearchableSelect value={countryFilter} onChange={setCountryFilter} options={countryFilterOptions} placeholder={t('allCountries')} />
            </div>
            <button className="btn-primary" onClick={() => setModal({ center: null })}>+ {t('addCenter')}</button>
          </div>

          <div className="management-card-grid">
            {filtered.length === 0 && (
              <div className="admin-empty" style={{ gridColumn: '1/-1' }}>{centers.length === 0 ? t('noCenters') : t('noMatch')}</div>
            )}
            {filtered.map(c => (
              <div className="management-card" key={c._id} onClick={() => navigate(`/registry/centers/${c._id}`)} style={{ cursor: 'pointer' }}>
                <div className="management-card-title">{c.name}</div>
                <div className="management-card-sub">
                  {c.countryId?.name ? `${c.countryId.name} (${c.countryId.code})` : '—'}{c.city ? ` · ${c.city}` : ''}
                </div>
                <div className="management-card-meta">
                  <AccreditationBadge status={c.accreditationStatus} />
                  {typeof c.programsCount === 'number' && (
                    <span className="badge badge-blue">{t('programs')}: {c.programsCount}</span>
                  )}
                </div>
                <div className="management-card-actions">
                  <button className="btn-action edit" title={t('edit')} aria-label={t('edit')}
                    onClick={e => { e.stopPropagation(); setModal({ center: c }); }}><IconPencil /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {modal && (
          <CenterModal center={modal.center} countries={countries} t={t} dir={dir}
            onClose={() => setModal(null)} onSaved={handleSaved} />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
