// frontend/src/pages/RegistryPds.jsx
//
// Data-entry clerk's Program Director registry. A PD is a `program_director`
// user carrying a specialty; each may have Sub-PD(s) (`sub_pd`) linked via
// `pdId` and copying the PD's specialty. Contract:
//   GET  /api/registry/users?role=program_director|sub_pd
//   GET  /api/registry/specialties
//   POST /api/registry/pds · POST /api/registry/pds/:id/sub-pd
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    title: 'مدراء البرامج', search: 'ابحث بالاسم أو الرقم التعريفي…', allSpecialties: 'كل الاختصاصات',
    addPd: 'إضافة مدير برنامج', newPd: 'مدير برنامج جديد', addSubPd: 'إضافة نائب', newSubPd: 'نائب مدير برنامج جديد',
    name: 'الاسم', idNumber: 'الرقم التعريفي', password: 'كلمة المرور', email: 'البريد الإلكتروني', phone: 'الهاتف',
    specialty: 'الاختصاص', subPds: 'النواب', none: 'لا يوجد',
    noPds: 'لا يوجد مدراء برامج بعد.', noMatch: 'لا توجد نتائج مطابقة.',
    cancel: 'إلغاء', saving: 'جارٍ الحفظ…', create: 'إنشاء',
    created: 'تم إنشاء مدير البرنامج', subPdCreated: 'تم إنشاء النائب',
    loadFailed: 'فشل التحميل', passwordHint: '(6 أحرف على الأقل)',
  },
  en: {
    title: 'Program Directors', search: 'Search by name or ID number…', allSpecialties: 'All specialties',
    addPd: 'Add PD', newPd: 'New Program Director', addSubPd: 'Add Sub-PD', newSubPd: 'New Sub-PD',
    name: 'Name', idNumber: 'ID Number', password: 'Password', email: 'Email', phone: 'Phone',
    specialty: 'Specialty', subPds: 'Sub-PDs', none: 'None',
    noPds: 'No program directors yet.', noMatch: 'No matching results.',
    cancel: 'Cancel', saving: 'Saving…', create: 'Create',
    created: 'Program director created', subPdCreated: 'Sub-PD created',
    loadFailed: 'Failed to load', passwordHint: '(min 6 chars)',
  },
};

function ErrBox({ msg }) {
  if (!msg) return null;
  return <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{msg}</div>;
}

function PdFormModal({ specialties, t, dir, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', idNumber: '', password: '', email: '', phone: '', specialtyId: '' });
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
    if (!form.idNumber.trim()) e.idNumber = true;
    if (!form.password || form.password.length < 6) e.password = true;
    if (!form.specialtyId) e.specialtyId = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = { name: form.name.trim(), idNumber: form.idNumber.trim(), password: form.password, specialtyId: form.specialtyId };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      const res = await api.post('/api/registry/pds', payload);
      onSaved(res.data?.data || res.data);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  const specialtyOptions = specialties.map(s => ({ value: s._id, label: s.name }));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg" dir={dir} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('newPd')}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>{t('name')} *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('idNumber')} *</label>
              <input className={errors.idNumber ? 'invalid' : ''} value={form.idNumber} onChange={e => set('idNumber', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('password')} * <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>{t('passwordHint')}</span></label>
              <input type="password" autoComplete="new-password" className={errors.password ? 'invalid' : ''} value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('phone')}</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="admin-field full">
              <label>{t('email')}</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="admin-field full">
              <label>{t('specialty')} *</label>
              <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)} options={specialtyOptions} placeholder={t('specialty')} error={errors.specialtyId} />
            </div>
          </div>
          <ErrBox msg={apiErr} />
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('create')}</button>
        </div>
      </div>
    </div>
  );
}

function SubPdFormModal({ pd, t, dir, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', idNumber: '', password: '', email: '' });
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
    if (!form.idNumber.trim()) e.idNumber = true;
    if (!form.password || form.password.length < 6) e.password = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = { name: form.name.trim(), idNumber: form.idNumber.trim(), password: form.password };
      if (form.email.trim()) payload.email = form.email.trim();
      const res = await api.post(`/api/registry/pds/${pd._id}/sub-pd`, payload);
      onSaved(res.data?.data || res.data);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" dir={dir}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('newSubPd')} · {pd.name}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field">
              <label>{t('name')} *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('idNumber')} *</label>
              <input className={errors.idNumber ? 'invalid' : ''} value={form.idNumber} onChange={e => set('idNumber', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('password')} * <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>{t('passwordHint')}</span></label>
              <input type="password" autoComplete="new-password" className={errors.password ? 'invalid' : ''} value={form.password} onChange={e => set('password', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('email')}</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
          <ErrBox msg={apiErr} />
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('create')}</button>
        </div>
      </div>
    </div>
  );
}

export default function RegistryPds() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [pds, setPds] = useState([]);
  const [subPds, setSubPds] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [addPd, setAddPd] = useState(false);
  const [subPdModal, setSubPdModal] = useState(null); // { pd } | null
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.get('/api/registry/users', { params: { role: 'program_director' } }),
      api.get('/api/registry/users', { params: { role: 'sub_pd' } }),
      api.get('/api/registry/specialties'),
    ]);
    const [pRes, sRes, spRes] = results;
    if (pRes.status === 'fulfilled') setPds(pRes.value.data?.data || pRes.value.data || []);
    else showToast(t('loadFailed'), 'error');
    if (sRes.status === 'fulfilled') setSubPds(sRes.value.data?.data || sRes.value.data || []);
    if (spRes.status === 'fulfilled') setSpecialties(spRes.value.data?.data || spRes.value.data || []);
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function subPdsFor(pd) { return subPds.filter(s => (s.pdId?._id || s.pdId) === pd._id); }

  const specialtyFilterOptions = [{ value: '', label: t('allSpecialties') }, ...specialties.map(s => ({ value: s._id, label: s.name }))];

  const filtered = pds.filter(pd => {
    if (specialtyFilter && (pd.specialtyId?._id || pd.specialtyId) !== specialtyFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !((pd.name || '').toLowerCase().includes(q) || (pd.idNumber || '').toLowerCase().includes(q))) return false;
    return true;
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /><Sk w={170} h={36} r={8} /><Sk w={120} h={36} r={8} /></div>
          <div className="management-card-grid">
            {[...Array(6)].map((_, i) => (<div className="management-card" key={i}><Sk w={140} h={15} /><Sk w={100} h={12} /><Sk w={80} h={22} r={20} /></div>))}
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
              <SearchableSelect value={specialtyFilter} onChange={setSpecialtyFilter} options={specialtyFilterOptions} placeholder={t('allSpecialties')} />
            </div>
            <button className="btn-primary" onClick={() => setAddPd(true)}>+ {t('addPd')}</button>
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
                  <div className="management-card-sub">{t('idNumber')}: {pd.idNumber || '—'}</div>
                  <div className="management-card-meta">
                    <span className="badge badge-blue">{pd.specialtyId?.name || '—'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    <strong>{t('subPds')}:</strong> {mySubs.length ? mySubs.map(s => s.name).join('، ') : t('none')}
                  </div>
                  <div className="management-card-actions" style={{ justifyContent: 'flex-start' }}>
                    <button className="btn-outline" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setSubPdModal({ pd })}>+ {t('addSubPd')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {addPd && (
          <PdFormModal specialties={specialties} t={t} dir={dir}
            onClose={() => setAddPd(false)}
            onSaved={() => { setAddPd(false); load(); showToast(t('created')); }} />
        )}
        {subPdModal && (
          <SubPdFormModal pd={subPdModal.pd} t={t} dir={dir}
            onClose={() => setSubPdModal(null)}
            onSaved={() => { setSubPdModal(null); load(); showToast(t('subPdCreated')); }} />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
