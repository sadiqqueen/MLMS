// frontend/src/pages/RegistryDios.jsx
//
// Data-entry clerk's DIO registry. A DIO is a `dio_view` user scoped to a
// country + a multi-select subset of that country's training centers. Each DIO
// may have one ODIO (`dio`) and Sub-DIO(s) (`sub_dio`), both linked back through
// `dioId`. Contract:
//   GET  /api/registry/users?role=dio_view|dio|sub_dio
//   GET  /api/countries · GET /api/registry/centers?countryId=
//   POST /api/registry/dios · POST /api/registry/dios/:id/odio|/sub-dio
//   PATCH /api/registry/dios/:id  (assignedCenterIds)
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import Sk from '../components/Skeleton';
import api from '../api/axios';

const STRINGS = {
  ar: {
    title: 'مديرو التدريب (DIOs)', search: 'ابحث بالاسم أو الرقم التعريفي…', allCountries: 'كل الدول',
    addDio: 'إضافة DIO', newDio: 'DIO جديد', addOdio: 'إضافة ODIO', addSubDio: 'إضافة Sub-DIO',
    newOdio: 'ODIO جديد', newSubDio: 'Sub-DIO جديد', editCenters: 'تعديل المراكز',
    name: 'الاسم', idNumber: 'الرقم التعريفي', password: 'كلمة المرور', email: 'البريد الإلكتروني', phone: 'الهاتف',
    country: 'الدولة', centers: 'المراكز', selectCountryFirst: 'اختر الدولة أولاً', noCentersInCountry: 'لا توجد مراكز في هذه الدولة',
    centersCount: 'مركز', odio: 'ODIO', subDios: 'Sub-DIOs', none: 'لا يوجد',
    noDios: 'لا يوجد مديرو تدريب بعد.', noMatch: 'لا توجد نتائج مطابقة.',
    cancel: 'إلغاء', save: 'حفظ', saving: 'جارٍ الحفظ…', create: 'إنشاء',
    created: 'تم إنشاء DIO', odioCreated: 'تم إنشاء ODIO', subDioCreated: 'تم إنشاء Sub-DIO', centersUpdated: 'تم تحديث المراكز',
    loadFailed: 'فشل التحميل', passwordHint: '(6 أحرف على الأقل)',
  },
  en: {
    title: 'DIOs', search: 'Search by name or ID number…', allCountries: 'All countries',
    addDio: 'Add DIO', newDio: 'New DIO', addOdio: 'Add ODIO', addSubDio: 'Add Sub-DIO',
    newOdio: 'New ODIO', newSubDio: 'New Sub-DIO', editCenters: 'Edit centers',
    name: 'Name', idNumber: 'ID Number', password: 'Password', email: 'Email', phone: 'Phone',
    country: 'Country', centers: 'Centers', selectCountryFirst: 'Select a country first', noCentersInCountry: 'No centers in this country',
    centersCount: 'centers', odio: 'ODIO', subDios: 'Sub-DIOs', none: 'None',
    noDios: 'No DIOs yet.', noMatch: 'No matching results.',
    cancel: 'Cancel', save: 'Save', saving: 'Saving…', create: 'Create',
    created: 'DIO created', odioCreated: 'ODIO created', subDioCreated: 'Sub-DIO created', centersUpdated: 'Centers updated',
    loadFailed: 'Failed to load', passwordHint: '(min 6 chars)',
  },
};

function ErrBox({ msg }) {
  if (!msg) return null;
  return <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{msg}</div>;
}

// Scrollable checkbox list of centers for a country.
function CenterChecklist({ centers, selected, onToggle, t, loading }) {
  if (loading) return <Sk h={140} r={8} />;
  if (!centers.length) return <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 4px' }}>{t('noCentersInCountry')}</div>;
  return (
    <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px' }}>
      {centers.map(c => (
        <label key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px', cursor: 'pointer', borderRadius: 6 }}>
          <input type="checkbox" checked={selected.includes(c._id)} onChange={() => onToggle(c._id)} />
          <span style={{ fontSize: 13, color: 'var(--brand-secondary)', fontWeight: 500 }}>{c.name}</span>
          {c.city && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.city}</span>}
        </label>
      ))}
    </div>
  );
}

function DioFormModal({ countries, t, dir, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', idNumber: '', password: '', email: '', phone: '', countryId: '' });
  const [assignedCenterIds, setAssigned] = useState([]);
  const [centers, setCenters] = useState([]);
  const [loadingCenters, setLoadingCenters] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    if (!form.countryId) { setCenters([]); setAssigned([]); return; }
    let cancelled = false;
    setLoadingCenters(true); setAssigned([]);
    api.get('/api/registry/centers', { params: { countryId: form.countryId } })
      .then(r => { if (!cancelled) setCenters(r.data?.data || r.data || []); })
      .catch(() => { if (!cancelled) setCenters([]); })
      .finally(() => { if (!cancelled) setLoadingCenters(false); });
    return () => { cancelled = true; };
  }, [form.countryId]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); setApiErr(''); }
  function toggleCenter(cid) { setAssigned(prev => prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid]); }

  async function handleSave() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    if (!form.idNumber.trim()) e.idNumber = true;
    if (!form.password || form.password.length < 6) e.password = true;
    if (!form.countryId) e.countryId = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        name: form.name.trim(), idNumber: form.idNumber.trim(), password: form.password,
        countryId: form.countryId, assignedCenterIds,
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      const res = await api.post('/api/registry/dios', payload);
      onSaved(res.data?.data || res.data);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  const countryOptions = countries.map(c => ({ value: c._id, label: `${c.name} (${c.code})` }));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg" dir={dir} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('newDio')}</div>
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
              <label>{t('country')} *</label>
              <SearchableSelect value={form.countryId} onChange={v => set('countryId', v)} options={countryOptions} placeholder={t('country')} error={errors.countryId} />
            </div>
            <div className="admin-field full">
              <label>{t('centers')}</label>
              {form.countryId
                ? <CenterChecklist centers={centers} selected={assignedCenterIds} onToggle={toggleCenter} t={t} loading={loadingCenters} />
                : <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 4px' }}>{t('selectCountryFirst')}</div>}
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

function ChildFormModal({ dio, kind, t, dir, onClose, onSaved }) {
  // kind: 'odio' | 'sub-dio'
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
      const res = await api.post(`/api/registry/dios/${dio._id}/${kind}`, payload);
      onSaved(res.data?.data || res.data, kind);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" dir={dir}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{kind === 'odio' ? t('newOdio') : t('newSubDio')} · {dio.name}</div>
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

function EditCentersModal({ dio, t, dir, onClose, onSaved }) {
  const countryId = dio.countryId?._id || dio.countryId || '';
  const [centers, setCenters] = useState([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [assignedCenterIds, setAssigned] = useState(() => (dio.assignedCenterIds || []).map(c => c._id || c));
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCenters(true);
    api.get('/api/registry/centers', { params: { countryId } })
      .then(r => { if (!cancelled) setCenters(r.data?.data || r.data || []); })
      .catch(() => { if (!cancelled) setCenters([]); })
      .finally(() => { if (!cancelled) setLoadingCenters(false); });
    return () => { cancelled = true; };
  }, [countryId]);

  function toggleCenter(cid) { setAssigned(prev => prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid]); }

  async function handleSave() {
    setSaving(true); setApiErr('');
    try {
      const res = await api.patch(`/api/registry/dios/${dio._id}`, { assignedCenterIds });
      onSaved(res.data?.data || res.data);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" dir={dir}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('editCenters')} · {dio.name}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-field full">
            <label>{t('centers')}</label>
            <CenterChecklist centers={centers} selected={assignedCenterIds} onToggle={toggleCenter} t={t} loading={loadingCenters} />
          </div>
          <ErrBox msg={apiErr} />
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>{t('cancel')}</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
        </div>
      </div>
    </div>
  );
}

export default function RegistryDios() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [dios, setDios] = useState([]);
  const [odios, setOdios] = useState([]);
  const [subDios, setSubDios] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [addDio, setAddDio] = useState(false);
  const [childModal, setChildModal] = useState(null); // { dio, kind } | null
  const [centersModal, setCentersModal] = useState(null); // { dio } | null
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      api.get('/api/registry/users', { params: { role: 'dio_view' } }),
      api.get('/api/registry/users', { params: { role: 'dio' } }),
      api.get('/api/registry/users', { params: { role: 'sub_dio' } }),
      api.get('/api/countries'),
    ]);
    const [dRes, oRes, sRes, coRes] = results;
    if (dRes.status === 'fulfilled') setDios(dRes.value.data?.data || dRes.value.data || []);
    else showToast(t('loadFailed'), 'error');
    if (oRes.status === 'fulfilled') setOdios(oRes.value.data?.data || oRes.value.data || []);
    if (sRes.status === 'fulfilled') setSubDios(sRes.value.data?.data || sRes.value.data || []);
    if (coRes.status === 'fulfilled') setCountries(coRes.value.data?.data || coRes.value.data || []);
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function odiosFor(d) { return odios.filter(o => (o.dioId?._id || o.dioId) === d._id); }
  function subDiosFor(d) { return subDios.filter(s => (s.dioId?._id || s.dioId) === d._id); }

  const countryFilterOptions = [{ value: '', label: t('allCountries') }, ...countries.map(c => ({ value: c._id, label: `${c.name} (${c.code})` }))];

  const filtered = dios.filter(d => {
    if (countryFilter && (d.countryId?._id || d.countryId) !== countryFilter) return false;
    const q = search.trim().toLowerCase();
    if (q && !((d.name || '').toLowerCase().includes(q) || (d.idNumber || '').toLowerCase().includes(q))) return false;
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
              <SearchableSelect value={countryFilter} onChange={setCountryFilter} options={countryFilterOptions} placeholder={t('allCountries')} />
            </div>
            <button className="btn-primary" onClick={() => setAddDio(true)}>+ {t('addDio')}</button>
          </div>

          <div className="management-card-grid">
            {filtered.length === 0 && (
              <div className="admin-empty" style={{ gridColumn: '1/-1' }}>{dios.length === 0 ? t('noDios') : t('noMatch')}</div>
            )}
            {filtered.map(d => {
              const myOdios = odiosFor(d);
              const mySubs = subDiosFor(d);
              const centerCount = (d.assignedCenterIds || []).length;
              return (
                <div className="management-card" key={d._id}>
                  <div className="management-card-title">{d.name}</div>
                  <div className="management-card-sub">{t('idNumber')}: {d.idNumber || '—'}</div>
                  <div className="management-card-meta">
                    <span className="badge badge-blue">{d.countryId?.name ? `${d.countryId.name} (${d.countryId.code})` : '—'}</span>
                    <span className="badge badge-green">{centerCount} {t('centersCount')}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    <div><strong>{t('odio')}:</strong> {myOdios.length ? myOdios.map(o => o.name).join('، ') : t('none')}</div>
                    <div><strong>{t('subDios')}:</strong> {mySubs.length ? mySubs.map(s => s.name).join('، ') : t('none')}</div>
                  </div>
                  <div className="management-card-actions" style={{ justifyContent: 'flex-start' }}>
                    <button className="btn-outline" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setChildModal({ dio: d, kind: 'odio' })}>+ {t('odio')}</button>
                    <button className="btn-outline" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setChildModal({ dio: d, kind: 'sub-dio' })}>+ {t('subDios')}</button>
                    <button className="btn-outline" style={{ fontSize: 12, padding: '5px 10px' }} onClick={() => setCentersModal({ dio: d })}>{t('editCenters')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {addDio && (
          <DioFormModal countries={countries} t={t} dir={dir}
            onClose={() => setAddDio(false)}
            onSaved={() => { setAddDio(false); load(); showToast(t('created')); }} />
        )}
        {childModal && (
          <ChildFormModal dio={childModal.dio} kind={childModal.kind} t={t} dir={dir}
            onClose={() => setChildModal(null)}
            onSaved={(_saved, kind) => { setChildModal(null); load(); showToast(kind === 'odio' ? t('odioCreated') : t('subDioCreated')); }} />
        )}
        {centersModal && (
          <EditCentersModal dio={centersModal.dio} t={t} dir={dir}
            onClose={() => setCentersModal(null)}
            onSaved={() => { setCentersModal(null); load(); showToast(t('centersUpdated')); }} />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
