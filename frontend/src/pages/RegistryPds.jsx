// frontend/src/pages/RegistryPds.jsx
//
// Data-entry clerk's Program Director registry (design clerk › PDs). One
// account-card grid of PDs (program_director) and Sub-PDs (sub_pd); a PD card
// shows the program it directs, a Sub-PD card its parent under "Assigned PD".
// PD & Sub-PD passwords are REQUIRED (RULINGS §F30); Add-PD has no specialty
// field (a PD's specialty derives from program attachment). Card edit/delete
// route through the analyzer approval flow. Contract:
//   GET /api/registry/users?role=program_director|sub_pd, /api/programs, /api/countries
//   POST /api/registry/pds, /api/registry/pds/:id/sub-pd
import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import RevealOnScroll from '../components/RevealOnScroll';
import AccountCard from '../components/AccountCard';
import MtModal from '../components/MtModal';
import SearchableSelect from '../components/SearchableSelect';
import { MtToastHost, useMtToast } from '../components/MtToast';
import {
  SearchBox, ApprovalModal, ViewModal, normId, refName, histLine, useCanWriteRegistry,
} from './registryShared';
import api from '../api/axios';
import './registry.css';

const STR = {
  ar: {
    addPd: 'إضافة مدير برنامج', addSubPd: 'إضافة نائب', count: (n) => `${n} حساب`, search: 'ابحث بالاسم أو الرقم…', allCountries: 'الدولة: الكل',
    badgePd: 'PD', badgeSub: 'Sub-PD', country: 'الدولة', city: 'المدينة', program: 'البرنامج', assignedPd: 'المدير المسؤول', email: 'البريد الإلكتروني', phone: 'الهاتف',
    empty: 'لا يوجد مدراء برامج بعد.', noMatch: 'لا توجد نتائج مطابقة.',
    name: 'الاسم', idNumber: 'الرقم التعريفي', password: 'كلمة المرور', pwHint: '(6 أحرف على الأقل)', parentPd: 'المدير الأصل',
    cancel: 'إلغاء', create: 'إنشاء', saving: 'جارٍ الحفظ…', newPd: 'مدير برنامج جديد', newPdSub: 'حساب مدير برنامج',
    newSubPd: 'نائب جديد', newSubPdSub: 'مساعد لمدير برنامج', createBanner: 'ستتم إضافة هذا السجل إلى السجل مباشرة.',
    pdCreated: 'تم إنشاء المدير', subPdCreated: 'تم إنشاء النائب', submitted: 'أُرسل للموافقة', loadFailed: 'فشل التحميل',
    saveFailed: 'فشل الحفظ', required: 'الحقول المطلوبة ناقصة', editPd: 'تعديل المدير', editSubPd: 'تعديل النائب',
  },
  en: {
    addPd: 'Add PD', addSubPd: 'Add Sub-PD', count: (n) => `${n} accounts`, search: 'Search by name or ID…', allCountries: 'Country: All',
    badgePd: 'PD', badgeSub: 'Sub-PD', country: 'Country', city: 'City', program: 'Program', assignedPd: 'Assigned PD', email: 'Email', phone: 'Phone',
    empty: 'No program directors yet.', noMatch: 'No matching results.',
    name: 'Name', idNumber: 'ID number', password: 'Password', pwHint: '(min 6 chars)', parentPd: 'Parent PD',
    cancel: 'Cancel', create: 'Create', saving: 'Saving…', newPd: 'New Program Director', newPdSub: 'New Program Director account',
    newSubPd: 'New Sub-PD', newSubPdSub: 'Assistant to a Program Director', createBanner: 'This record will be added to the registry.',
    pdCreated: 'Program director created', subPdCreated: 'Sub-PD created', submitted: 'Submitted for approval', loadFailed: 'Failed to load',
    saveFailed: 'Save failed', required: 'Required fields are missing', editPd: 'Edit Program Director', editSubPd: 'Edit Sub-PD',
  },
};

function AddPdModal({ lang, countries, onClose, onSaved }) {
  const t = (k) => STR[lang]?.[k] ?? STR.en[k] ?? k;
  const [f, setF] = useState({ name: '', idNumber: '', password: '', countryId: '', city: '', phone: '', email: '' });
  const [err, setErr] = useState({}); const [saving, setSaving] = useState(false); const [apiErr, setApiErr] = useState('');
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErr((e) => ({ ...e, [k]: false })); setApiErr(''); };
  async function save() {
    const e = {};
    if (!f.name.trim()) e.name = true;
    if (!f.idNumber.trim()) e.idNumber = true;
    if (!f.password || f.password.length < 6) e.password = true;
    if (Object.keys(e).length) { setErr(e); setApiErr(t('required')); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = { name: f.name.trim(), idNumber: f.idNumber.trim(), password: f.password };
      if (f.countryId) payload.countryId = f.countryId;
      if (f.city.trim()) payload.city = f.city.trim();
      if (f.phone.trim()) payload.phone = f.phone.trim();
      if (f.email.trim()) payload.email = f.email.trim();
      const res = await api.post('/api/registry/pds', payload);
      onSaved(res.data?.data || res.data);
    } catch (ex) { setApiErr(ex.response?.data?.message || t('saveFailed')); } finally { setSaving(false); }
  }
  const countryOpts = countries.map((c) => ({ value: c._id, label: c.code ? `${c.name} (${c.code})` : c.name }));
  return (
    <MtModal open title={t('newPd')} sub={t('newPdSub')} onClose={onClose}
      footer={<><button type="button" className="mt-btn--cancel" onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="mt-btn" onClick={save} disabled={saving}>{saving ? t('saving') : t('create')}</button></>}>
      <div className="mt-banner">{t('createBanner')}</div>
      <div className="mt-field-grid">
        <div className="mt-field"><label className="mt-label">{t('name')}<span className="mt-label-req">*</span></label>
          <input className="mt-input" value={f.name} onChange={(e) => set('name', e.target.value)} style={err.name ? { borderColor: 'var(--danger)' } : undefined} /></div>
        <div className="mt-field"><label className="mt-label">{t('idNumber')}<span className="mt-label-req">*</span></label>
          <input className="mt-input mt-input--mono" value={f.idNumber} placeholder="PD-…" onChange={(e) => set('idNumber', e.target.value)} style={err.idNumber ? { borderColor: 'var(--danger)' } : undefined} /></div>
        <div className="mt-field"><label className="mt-label">{t('password')}<span className="mt-label-req">*</span> <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>{t('pwHint')}</span></label>
          <input className="mt-input" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set('password', e.target.value)} style={err.password ? { borderColor: 'var(--danger)' } : undefined} /></div>
        <div className="mt-field"><label className="mt-label">{t('city')}</label>
          <input className="mt-input" value={f.city} onChange={(e) => set('city', e.target.value)} /></div>
        <div className="mt-field mt-field-full"><label className="mt-label">{t('country')}</label>
          <SearchableSelect value={f.countryId} onChange={(v) => set('countryId', v)} options={countryOpts} placeholder={t('country')} /></div>
        <div className="mt-field"><label className="mt-label">{t('phone')}</label>
          <input className="mt-input" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="mt-field"><label className="mt-label">{t('email')}</label>
          <input className="mt-input" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      </div>
      {apiErr && <div className="reg-del-note" style={{ marginBlockStart: 14, marginBlockEnd: 0 }}>{apiErr}</div>}
    </MtModal>
  );
}

function AddSubPdModal({ lang, pds, onClose, onSaved }) {
  const t = (k) => STR[lang]?.[k] ?? STR.en[k] ?? k;
  const [f, setF] = useState({ pdId: '', name: '', idNumber: '', password: '', city: '', phone: '', email: '' });
  const [err, setErr] = useState({}); const [saving, setSaving] = useState(false); const [apiErr, setApiErr] = useState('');
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErr((e) => ({ ...e, [k]: false })); setApiErr(''); };
  async function save() {
    const e = {};
    if (!f.pdId) e.pdId = true;
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
      const res = await api.post(`/api/registry/pds/${f.pdId}/sub-pd`, payload);
      onSaved(res.data?.data || res.data);
    } catch (ex) { setApiErr(ex.response?.data?.message || t('saveFailed')); } finally { setSaving(false); }
  }
  const pdOpts = pds.map((p) => ({ value: p._id, label: `${p.name}${p.idNumber ? ` · ${p.idNumber}` : ''}` }));
  return (
    <MtModal open title={t('newSubPd')} sub={t('newSubPdSub')} onClose={onClose}
      footer={<><button type="button" className="mt-btn--cancel" onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="mt-btn" onClick={save} disabled={saving}>{saving ? t('saving') : t('create')}</button></>}>
      <div className="mt-banner">{t('createBanner')}</div>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full"><label className="mt-label">{t('parentPd')}<span className="mt-label-req">*</span></label>
          <SearchableSelect value={f.pdId} onChange={(v) => set('pdId', v)} options={pdOpts} placeholder={t('parentPd')} error={err.pdId} /></div>
        <div className="mt-field"><label className="mt-label">{t('name')}<span className="mt-label-req">*</span></label>
          <input className="mt-input" value={f.name} onChange={(e) => set('name', e.target.value)} style={err.name ? { borderColor: 'var(--danger)' } : undefined} /></div>
        <div className="mt-field"><label className="mt-label">{t('idNumber')}<span className="mt-label-req">*</span></label>
          <input className="mt-input mt-input--mono" value={f.idNumber} placeholder="PD-…" onChange={(e) => set('idNumber', e.target.value)} style={err.idNumber ? { borderColor: 'var(--danger)' } : undefined} /></div>
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

export default function RegistryPds() {
  const { lang } = usePrefs();
  const t = (k) => STR[lang]?.[k] ?? STR.en[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const { toasts, showToast } = useMtToast();

  const [pds, setPds] = useState([]);
  const [subPds, setSubPds] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryF, setCountryF] = useState('');
  const [addPd, setAddPd] = useState(false);
  const [addSub, setAddSub] = useState(false);
  const [editItem, setEditItem] = useState(null);   // { user, kind }
  const canWrite = useCanWriteRegistry();
  const [viewItem, setViewItem] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s, pr, co] = await Promise.allSettled([
      api.get('/api/registry/users', { params: { role: 'program_director' } }),
      api.get('/api/registry/users', { params: { role: 'sub_pd' } }),
      api.get('/api/programs'),
      api.get('/api/countries'),
    ]);
    if (p.status === 'fulfilled') setPds(p.value.data?.data || p.value.data || []);
    else showToast(t('loadFailed'), 'dng');
    if (s.status === 'fulfilled') setSubPds(s.value.data?.data || s.value.data || []);
    if (pr.status === 'fulfilled') setPrograms(pr.value.data?.data || pr.value.data || []);
    if (co.status === 'fulfilled') setCountries(co.value.data?.data || co.value.data || []);
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // PD _id → the name of a program they direct (first match).
  const pdProgram = useMemo(() => {
    const m = new Map();
    for (const pr of programs) { const k = normId(pr.programDirectorId); if (k && !m.has(k)) m.set(k, pr.name); }
    return m;
  }, [programs]);

  const rows = useMemo(() => {
    const all = [
      ...pds.map((u) => ({ u, kind: 'pd' })),
      ...subPds.map((u) => ({ u, kind: 'sub' })),
    ];
    return all.filter(({ u }) => {
      if (countryF && normId(u.countryId) !== countryF) return false;
      const q = search.trim().toLowerCase();
      if (q && !((u.name || '').toLowerCase().includes(q) || (u.idNumber || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [pds, subPds, countryF, search]);

  const countryOpts = countries.map((c) => ({ value: c._id, label: c.code ? `${c.name} (${c.code})` : c.name }));

  function fieldsFor({ u, kind }) {
    return kind === 'sub'
      ? [{ label: t('country'), value: refName(u.countryId) }, { label: t('city'), value: u.city || '—' },
         { label: t('assignedPd'), value: refName(u.pdId) }, { label: t('email'), value: u.email || '—' }]
      : [{ label: t('country'), value: refName(u.countryId) }, { label: t('city'), value: u.city || '—' },
         { label: t('program'), value: pdProgram.get(u._id) || '—' }, { label: t('email'), value: u.email || '—' }];
  }

  function editConfig({ u, kind }) {
    if (kind === 'sub') {
      return {
        routeKey: 'sub-pds', title: t('editSubPd'),
        fields: [
          { key: 'name', label: t('name'), type: 'text', full: true },
          { key: 'email', label: t('email'), type: 'text' },
          { key: 'phone', label: t('phone'), type: 'text' },
        ],
        initialValues: { name: u.name || '', email: u.email || '', phone: u.phone || '' },
      };
    }
    return {
      routeKey: 'pds', title: t('editPd'),
      fields: [
        { key: 'name', label: t('name'), type: 'text', full: true },
        { key: 'city', label: t('city'), type: 'text' },
        { key: 'email', label: t('email'), type: 'text' },
        { key: 'phone', label: t('phone'), type: 'text' },
      ],
      initialValues: { name: u.name || '', city: u.city || '', email: u.email || '', phone: u.phone || '' },
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
          {canWrite && <button type="button" className="mt-btn" onClick={() => setAddPd(true)}>+ {t('addPd')}</button>}
          {canWrite && <button type="button" className="mt-btn" onClick={() => setAddSub(true)}>+ {t('addSubPd')}</button>}
          <span className="mt-count">{t('count')(rows.length)}</span>
        </div>

        {loading ? (
          <div className="mt-acct-grid">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton mt-skel" style={{ height: 190 }} />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-empty"><div className="mt-empty-title">{pds.length + subPds.length === 0 ? t('empty') : t('noMatch')}</div></div>
        ) : (
          <div className="mt-acct-grid">
            {rows.map((row, i) => (
              <RevealOnScroll key={row.u._id} delay={i * 0.06}>
                <AccountCard
                  name={row.u.name} id={row.u.idNumber}
                  role={row.kind === 'sub' ? t('badgeSub') : t('badgePd')}
                  fields={fieldsFor(row)} canEdit={canWrite}
                  history={(row.u.changeHistory || []).map(histLine)}
                  onView={() => setViewItem(row)} onEdit={() => setEditItem(row)}
                />
              </RevealOnScroll>
            ))}
          </div>
        )}

        {addPd && (
          <AddPdModal lang={lang} countries={countries}
            onClose={() => setAddPd(false)}
            onSaved={() => { setAddPd(false); showToast(t('pdCreated'), 'ok'); load(); }} />
        )}
        {addSub && (
          <AddSubPdModal lang={lang} pds={pds}
            onClose={() => setAddSub(false)}
            onSaved={() => { setAddSub(false); showToast(t('subPdCreated'), 'ok'); load(); }} />
        )}

        {editItem && ec && (
          <ApprovalModal open lang={lang} routeKey={ec.routeKey} entityId={editItem.u._id} entityLabel={editItem.u.name}
            title={ec.title} sub={editItem.u.name} fields={ec.fields} initialValues={ec.initialValues}
            onClose={() => setEditItem(null)}
            onSubmitted={() => { showToast(t('submitted'), 'warn'); load(); }} />
        )}

        {viewItem && (
          <ViewModal open lang={lang} title={viewItem.u.name} sub={viewItem.u.idNumber}
            meta={viewItem.kind === 'sub' ? t('badgeSub') : t('badgePd')}
            rows={fieldsFor(viewItem)} history={(viewItem.u.changeHistory || []).map(histLine)}
            onClose={() => setViewItem(null)} />
        )}
      </main>
      <MtToastHost toasts={toasts} />
    </>
  );
}
