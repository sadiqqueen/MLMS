// frontend/src/pages/RegistryDios.jsx
//
// Data-entry clerk's DIO registry (design clerk › DIOs). One account-card grid
// holding both DIOs (dio_view) and Sub-DIOs (sub_dio) — a Sub-DIO card shows its
// parent under "Assigned DIO". "+ Add DIO" / "+ Add Sub-DIO" are direct creates;
// card edit/delete route through the analyzer approval flow (book-of-changes).
// Contract: GET /api/registry/users?role=dio_view|sub_dio, /api/countries;
// POST /api/registry/dios, /api/registry/dios/:id/sub-dio.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import RevealOnScroll from '../components/RevealOnScroll';
import AccountCard from '../components/AccountCard';
import MtModal from '../components/MtModal';
import SearchableSelect from '../components/SearchableSelect';
import { MtToastHost, useMtToast } from '../components/MtToast';
import {
  SearchBox, ApprovalModal, ViewModal, normId, refName, histLine,
} from './registryShared';
import api from '../api/axios';
import './registry.css';

const STR = {
  ar: {
    addDio: 'إضافة DIO', addSubDio: 'إضافة Sub-DIO', count: (n) => `${n} حساب`, search: 'ابحث بالاسم أو الرقم…', allCountries: 'الدولة: الكل',
    badgeDio: 'DIO', badgeSub: 'Sub-DIO', country: 'الدولة', city: 'المدينة', phone: 'الهاتف', email: 'البريد الإلكتروني', assignedDio: 'DIO المسؤول',
    empty: 'لا يوجد مديرو تدريب بعد.', noMatch: 'لا توجد نتائج مطابقة.',
    name: 'الاسم', idNumber: 'الرقم التعريفي', password: 'كلمة المرور', pwHint: '(6 أحرف على الأقل)', parentDio: 'DIO الأصل',
    cancel: 'إلغاء', create: 'إنشاء', saving: 'جارٍ الحفظ…', newDio: 'DIO جديد', newDioSub: 'حساب مدير تدريب مؤسسي',
    newSubDio: 'Sub-DIO جديد', newSubDioSub: 'مساعد لمدير تدريب', createBanner: 'ستتم إضافة هذا السجل إلى السجل مباشرة.',
    dioCreated: 'تم إنشاء DIO', subDioCreated: 'تم إنشاء Sub-DIO', submitted: 'أُرسل للموافقة', loadFailed: 'فشل التحميل',
    saveFailed: 'فشل الحفظ', required: 'الحقول المطلوبة ناقصة', editDio: 'تعديل DIO', editSubDio: 'تعديل Sub-DIO',
  },
  en: {
    addDio: 'Add DIO', addSubDio: 'Add Sub-DIO', count: (n) => `${n} accounts`, search: 'Search by name or ID…', allCountries: 'Country: All',
    badgeDio: 'DIO', badgeSub: 'Sub-DIO', country: 'Country', city: 'City', phone: 'Phone', email: 'Email', assignedDio: 'Assigned DIO',
    empty: 'No DIOs yet.', noMatch: 'No matching results.',
    name: 'Name', idNumber: 'ID number', password: 'Password', pwHint: '(min 6 chars)', parentDio: 'Parent DIO',
    cancel: 'Cancel', create: 'Create', saving: 'Saving…', newDio: 'New DIO', newDioSub: 'New institutional DIO',
    newSubDio: 'New Sub-DIO', newSubDioSub: 'Assistant to a DIO', createBanner: 'This record will be added to the registry.',
    dioCreated: 'DIO created', subDioCreated: 'Sub-DIO created', submitted: 'Submitted for approval', loadFailed: 'Failed to load',
    saveFailed: 'Save failed', required: 'Required fields are missing', editDio: 'Edit DIO', editSubDio: 'Edit Sub-DIO',
  },
};

function AddDioModal({ lang, countries, onClose, onSaved }) {
  const t = (k) => STR[lang]?.[k] ?? STR.en[k] ?? k;
  const [f, setF] = useState({ name: '', idNumber: '', password: '', countryId: '', city: '', phone: '', email: '' });
  const [err, setErr] = useState({}); const [saving, setSaving] = useState(false); const [apiErr, setApiErr] = useState('');
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErr((e) => ({ ...e, [k]: false })); setApiErr(''); };
  async function save() {
    const e = {};
    if (!f.name.trim()) e.name = true;
    if (!f.idNumber.trim()) e.idNumber = true;
    if (!f.password || f.password.length < 6) e.password = true;
    if (!f.countryId) e.countryId = true;
    if (Object.keys(e).length) { setErr(e); setApiErr(t('required')); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = { name: f.name.trim(), idNumber: f.idNumber.trim(), password: f.password, countryId: f.countryId };
      if (f.city.trim()) payload.city = f.city.trim();
      if (f.phone.trim()) payload.phone = f.phone.trim();
      if (f.email.trim()) payload.email = f.email.trim();
      const res = await api.post('/api/registry/dios', payload);
      onSaved(res.data?.data || res.data);
    } catch (ex) { setApiErr(ex.response?.data?.message || t('saveFailed')); } finally { setSaving(false); }
  }
  const countryOpts = countries.map((c) => ({ value: c._id, label: `${c.name} (${c.code})` }));
  return (
    <MtModal open title={t('newDio')} sub={t('newDioSub')} onClose={onClose}
      footer={<><button type="button" className="mt-btn--cancel" onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="mt-btn" onClick={save} disabled={saving}>{saving ? t('saving') : t('create')}</button></>}>
      <div className="mt-banner">{t('createBanner')}</div>
      <div className="mt-field-grid">
        <div className="mt-field"><label className="mt-label">{t('name')}<span className="mt-label-req">*</span></label>
          <input className="mt-input" value={f.name} onChange={(e) => set('name', e.target.value)} style={err.name ? { borderColor: 'var(--danger)' } : undefined} /></div>
        <div className="mt-field"><label className="mt-label">{t('idNumber')}<span className="mt-label-req">*</span></label>
          <input className="mt-input mt-input--mono" value={f.idNumber} placeholder="DIO-…" onChange={(e) => set('idNumber', e.target.value)} style={err.idNumber ? { borderColor: 'var(--danger)' } : undefined} /></div>
        <div className="mt-field"><label className="mt-label">{t('password')}<span className="mt-label-req">*</span> <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>{t('pwHint')}</span></label>
          <input className="mt-input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} style={err.password ? { borderColor: 'var(--danger)' } : undefined} /></div>
        <div className="mt-field"><label className="mt-label">{t('city')}</label>
          <input className="mt-input" value={f.city} onChange={(e) => set('city', e.target.value)} /></div>
        <div className="mt-field mt-field-full"><label className="mt-label">{t('country')}<span className="mt-label-req">*</span></label>
          <SearchableSelect value={f.countryId} onChange={(v) => set('countryId', v)} options={countryOpts} placeholder={t('country')} error={err.countryId} /></div>
        <div className="mt-field"><label className="mt-label">{t('phone')}</label>
          <input className="mt-input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="mt-field"><label className="mt-label">{t('email')}</label>
          <input className="mt-input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      </div>
      {apiErr && <div className="reg-del-note" style={{ marginBlockStart: 14, marginBlockEnd: 0 }}>{apiErr}</div>}
    </MtModal>
  );
}

function AddSubDioModal({ lang, dios, onClose, onSaved }) {
  const t = (k) => STR[lang]?.[k] ?? STR.en[k] ?? k;
  const [f, setF] = useState({ dioId: '', name: '', idNumber: '', password: '', city: '', phone: '', email: '' });
  const [err, setErr] = useState({}); const [saving, setSaving] = useState(false); const [apiErr, setApiErr] = useState('');
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErr((e) => ({ ...e, [k]: false })); setApiErr(''); };
  async function save() {
    const e = {};
    if (!f.dioId) e.dioId = true;
    if (!f.name.trim()) e.name = true;
    if (!f.idNumber.trim()) e.idNumber = true;
    if (!f.password || f.password.length < 6) e.password = true;
    if (Object.keys(e).length) { setErr(e); setApiErr(t('required')); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = { name: f.name.trim(), idNumber: f.idNumber.trim(), password: f.password };
      if (f.city.trim()) payload.city = f.city.trim();
      if (f.phone.trim()) payload.phone = f.phone.trim();
      if (f.email.trim()) payload.email = f.email.trim();
      const res = await api.post(`/api/registry/dios/${f.dioId}/sub-dio`, payload);
      onSaved(res.data?.data || res.data);
    } catch (ex) { setApiErr(ex.response?.data?.message || t('saveFailed')); } finally { setSaving(false); }
  }
  const dioOpts = dios.map((d) => ({ value: d._id, label: `${d.name}${d.idNumber ? ` · ${d.idNumber}` : ''}` }));
  return (
    <MtModal open title={t('newSubDio')} sub={t('newSubDioSub')} onClose={onClose}
      footer={<><button type="button" className="mt-btn--cancel" onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="mt-btn" onClick={save} disabled={saving}>{saving ? t('saving') : t('create')}</button></>}>
      <div className="mt-banner">{t('createBanner')}</div>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full"><label className="mt-label">{t('parentDio')}<span className="mt-label-req">*</span></label>
          <SearchableSelect value={f.dioId} onChange={(v) => set('dioId', v)} options={dioOpts} placeholder={t('parentDio')} error={err.dioId} /></div>
        <div className="mt-field"><label className="mt-label">{t('name')}<span className="mt-label-req">*</span></label>
          <input className="mt-input" value={f.name} onChange={(e) => set('name', e.target.value)} style={err.name ? { borderColor: 'var(--danger)' } : undefined} /></div>
        <div className="mt-field"><label className="mt-label">{t('idNumber')}<span className="mt-label-req">*</span></label>
          <input className="mt-input mt-input--mono" value={f.idNumber} placeholder="DIO-…" onChange={(e) => set('idNumber', e.target.value)} style={err.idNumber ? { borderColor: 'var(--danger)' } : undefined} /></div>
        <div className="mt-field"><label className="mt-label">{t('password')}<span className="mt-label-req">*</span> <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>{t('pwHint')}</span></label>
          <input className="mt-input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} style={err.password ? { borderColor: 'var(--danger)' } : undefined} /></div>
        <div className="mt-field"><label className="mt-label">{t('city')}</label>
          <input className="mt-input" value={f.city} onChange={(e) => set('city', e.target.value)} /></div>
        <div className="mt-field"><label className="mt-label">{t('phone')}</label>
          <input className="mt-input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="mt-field mt-field-full"><label className="mt-label">{t('email')}</label>
          <input className="mt-input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      </div>
      {apiErr && <div className="reg-del-note" style={{ marginBlockStart: 14, marginBlockEnd: 0 }}>{apiErr}</div>}
    </MtModal>
  );
}

export default function RegistryDios() {
  const { lang } = usePrefs();
  const t = (k) => STR[lang]?.[k] ?? STR.en[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [dios, setDios] = useState([]);
  const [subDios, setSubDios] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryF, setCountryF] = useState('');
  const [addDio, setAddDio] = useState(false);
  const [addSub, setAddSub] = useState(false);
  const [editItem, setEditItem] = useState(null);   // { user, kind }
  const [viewItem, setViewItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, s, co] = await Promise.allSettled([
      api.get('/api/registry/users', { params: { role: 'dio_view' } }),
      api.get('/api/registry/users', { params: { role: 'sub_dio' } }),
      api.get('/api/countries'),
    ]);
    if (d.status === 'fulfilled') setDios(d.value.data?.data || d.value.data || []);
    else showToast(t('loadFailed'), 'dng');
    if (s.status === 'fulfilled') setSubDios(s.value.data?.data || s.value.data || []);
    if (co.status === 'fulfilled') setCountries(co.value.data?.data || co.value.data || []);
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const all = [
      ...dios.map((u) => ({ u, kind: 'dio' })),
      ...subDios.map((u) => ({ u, kind: 'sub' })),
    ];
    return all.filter(({ u }) => {
      if (countryF && normId(u.countryId) !== countryF) return false;
      const q = search.trim().toLowerCase();
      if (q && !((u.name || '').toLowerCase().includes(q) || (u.idNumber || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [dios, subDios, countryF, search]);

  const countryOpts = countries.map((c) => ({ value: c._id, label: `${c.name} (${c.code})` }));

  function fieldsFor({ u, kind }) {
    return kind === 'sub'
      ? [{ label: t('country'), value: refName(u.countryId) }, { label: t('city'), value: u.city || '—' },
         { label: t('assignedDio'), value: refName(u.dioId) }, { label: t('email'), value: u.email || '—' }]
      : [{ label: t('country'), value: refName(u.countryId) }, { label: t('city'), value: u.city || '—' },
         { label: t('phone'), value: u.phone || '—' }, { label: t('email'), value: u.email || '—' }];
  }

  function editConfig({ u, kind }) {
    if (kind === 'sub') {
      return {
        routeKey: 'sub-dios', title: t('editSubDio'),
        fields: [
          { key: 'name', label: t('name'), type: 'text', full: true },
          { key: 'email', label: t('email'), type: 'text' },
          { key: 'phone', label: t('phone'), type: 'text' },
        ],
        initialValues: { name: u.name || '', email: u.email || '', phone: u.phone || '' },
      };
    }
    return {
      routeKey: 'dios', title: t('editDio'),
      fields: [
        { key: 'name', label: t('name'), type: 'text', full: true },
        { key: 'countryId', label: t('country'), type: 'select', options: countryOpts },
        { key: 'city', label: t('city'), type: 'text' },
        { key: 'email', label: t('email'), type: 'text' },
        { key: 'phone', label: t('phone'), type: 'text' },
      ],
      initialValues: { name: u.name || '', countryId: normId(u.countryId), city: u.city || '', email: u.email || '', phone: u.phone || '' },
    };
  }

  const ec = editItem ? editConfig(editItem) : null;

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        <div className="mt-filterbar">
          <SearchBox value={search} onChange={setSearch} placeholder={t('search')} />
          <select className="mt-filter" value={countryF} onChange={(e) => setCountryF(e.target.value)}>
            <option value="">{t('allCountries')}</option>
            {countries.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
          <span className="mt-filterbar-spacer" />
          <button type="button" className="mt-btn" onClick={() => setAddDio(true)}>+ {t('addDio')}</button>
          <button type="button" className="mt-btn" onClick={() => setAddSub(true)}>+ {t('addSubDio')}</button>
          <span className="mt-count">{t('count')(rows.length)}</span>
        </div>

        {loading ? (
          <div className="mt-acct-grid">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton mt-skel" style={{ height: 190 }} />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-empty"><div className="mt-empty-title">{dios.length + subDios.length === 0 ? t('empty') : t('noMatch')}</div></div>
        ) : (
          <div className="mt-acct-grid">
            {rows.map((row, i) => (
              <RevealOnScroll key={row.u._id} delay={i * 0.06}>
                <AccountCard
                  name={row.u.name} id={row.u.idNumber}
                  role={row.kind === 'sub' ? t('badgeSub') : t('badgeDio')}
                  fields={fieldsFor(row)} canEdit
                  history={(row.u.changeHistory || []).map(histLine)}
                  onView={() => setViewItem(row)} onEdit={() => setEditItem(row)}
                />
              </RevealOnScroll>
            ))}
          </div>
        )}

        {addDio && (
          <AddDioModal lang={lang} countries={countries}
            onClose={() => setAddDio(false)}
            onSaved={() => { setAddDio(false); showToast(t('dioCreated'), 'ok'); load(); }} />
        )}
        {addSub && (
          <AddSubDioModal lang={lang} dios={dios}
            onClose={() => setAddSub(false)}
            onSaved={() => { setAddSub(false); showToast(t('subDioCreated'), 'ok'); load(); }} />
        )}

        {editItem && ec && (
          <ApprovalModal open lang={lang} routeKey={ec.routeKey} entityId={editItem.u._id} entityLabel={editItem.u.name}
            title={ec.title} sub={editItem.u.name} fields={ec.fields} initialValues={ec.initialValues}
            onClose={() => setEditItem(null)}
            onSubmitted={() => { showToast(t('submitted'), 'warn'); load(); }} />
        )}

        {viewItem && (
          <ViewModal open lang={lang} title={viewItem.u.name} sub={viewItem.u.idNumber}
            meta={viewItem.kind === 'sub' ? t('badgeSub') : t('badgeDio')}
            rows={fieldsFor(viewItem)} history={(viewItem.u.changeHistory || []).map(histLine)}
            onClose={() => setViewItem(null)} />
        )}
      </main>
      <MtToastHost toasts={toasts} />
    </>
  );
}
