// frontend/src/pages/AnalyzerStaff.jsx
//
// Data Analyzer's staff management (legacy, retained — RULINGS §37; unlinked from
// the redesigned nav, reachable at /analyzer/staff). Restyled to the mt- shell
// (W1-Analyzer); functionality unchanged. Contract:
//   GET   /api/analyzer/staff?includeInactive=true → { success, data: [users] }
//   POST  /api/analyzer/staff  { name, idNumber, password, email?, phone?, role }
//   PATCH /api/analyzer/staff/:id  { name?, phone?, email?, locked?, isActive? }
// Duplicate idNumber/email surface as 409 { message } shown in-modal.
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import { roleLabel } from '../config/roles';
import Navbar from '../components/Navbar';
import MtModal from '../components/MtModal';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconEdit } from '../components/icons';
import api from '../api/axios';
import { Pill, SearchBox } from './AnalyzerListKit';
import './Analyzer.css';

const STAFF_ROLES = ['data_entry', 'central_secretary'];

const STRINGS = {
  ar: {
    title: 'الموظفون', search: 'ابحث بالاسم أو الرقم التعريفي أو البريد…',
    addStaff: 'إضافة موظف', newStaff: 'موظف جديد', editStaff: 'تعديل الموظف',
    includeInactive: 'إظهار المعطّلين',
    role: 'الدور', name: 'الاسم', idNumber: 'الرقم التعريفي', password: 'كلمة المرور',
    email: 'البريد الإلكتروني', phone: 'الهاتف', status: 'الحالة',
    active: 'نشط', inactive: 'معطّل', locked: 'مقفل', action: 'الإجراء',
    accountActive: 'الحساب نشط', accountLocked: 'الحساب مقفل',
    none: 'لا يوجد موظفون بعد.', noMatch: 'لا توجد نتائج مطابقة.',
    cancel: 'إلغاء', save: 'حفظ', saving: 'جارٍ الحفظ…', create: 'إنشاء',
    created: 'تم إنشاء الموظف', updated: 'تم تحديث الموظف', loadFailed: 'فشل التحميل',
    passwordHint: '(6 أحرف على الأقل)', selectRole: '— اختر الدور —',
    staff: 'موظف',
  },
  en: {
    title: 'Staff', search: 'Search by name, ID number, or email…',
    addStaff: 'Add Staff', newStaff: 'New Staff', editStaff: 'Edit Staff',
    includeInactive: 'Show inactive',
    role: 'Role', name: 'Name', idNumber: 'ID Number', password: 'Password',
    email: 'Email', phone: 'Phone', status: 'Status',
    active: 'Active', inactive: 'Inactive', locked: 'Locked', action: 'Action',
    accountActive: 'Account active', accountLocked: 'Account locked',
    none: 'No staff yet.', noMatch: 'No matching results.',
    cancel: 'Cancel', save: 'Save', saving: 'Saving…', create: 'Create',
    created: 'Staff created', updated: 'Staff updated', loadFailed: 'Failed to load',
    passwordHint: '(min 6 chars)', selectRole: '— Select role —',
    staff: 'staff',
  },
};

const errStyle = (bad) => (bad ? { borderColor: 'var(--danger)', boxShadow: '0 0 0 3px var(--danger-bg)' } : undefined);

function ApiErr({ msg }) {
  if (!msg) return null;
  return <div className="mt-banner" style={{ marginBlockStart: 12, marginBlockEnd: 0, background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger-fg)' }}>{msg}</div>;
}

function AddStaffModal({ t, lang, onClose, onSaved }) {
  const [form, setForm] = useState({ role: '', name: '', idNumber: '', password: '', email: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: false })); setApiErr(''); };

  async function handleSave() {
    const e = {};
    if (!STAFF_ROLES.includes(form.role)) e.role = true;
    if (!form.name.trim()) e.name = true;
    if (!form.idNumber.trim()) e.idNumber = true;
    if (!form.password || form.password.length < 6) e.password = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = { role: form.role, name: form.name.trim(), idNumber: form.idNumber.trim(), password: form.password };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      const res = await api.post('/api/analyzer/staff', payload);
      onSaved(res.data?.data || res.data);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <MtModal open title={t('newStaff')} sub="Data entry clerk or central secretary" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="mt-btn" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('create')}</button>
      </>}>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">{t('role')} <span className="mt-label-req">*</span></label>
          <select className="mt-select" style={errStyle(errors.role)} value={form.role} onChange={(e) => set('role', e.target.value)}>
            <option value="">{t('selectRole')}</option>
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r, lang)}</option>)}
          </select>
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('name')} <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={errStyle(errors.name)} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('idNumber')} <span className="mt-label-req">*</span></label>
          <input className="mt-input mt-input--mono" style={errStyle(errors.idNumber)} value={form.idNumber} onChange={(e) => set('idNumber', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('password')} <span className="mt-label-req">*</span> <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>{t('passwordHint')}</span></label>
          <input type="password" autoComplete="new-password" className="mt-input" style={errStyle(errors.password)} value={form.password} onChange={(e) => set('password', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('phone')}</label>
          <input className="mt-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">{t('email')}</label>
          <input type="email" className="mt-input" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
      </div>
      <ApiErr msg={apiErr} />
    </MtModal>
  );
}

function EditStaffModal({ staff, t, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: staff.name || '', phone: staff.phone || '', email: staff.email || '',
    locked: !!staff.locked, isActive: staff.isActive !== false,
  });
  const [errName, setErrName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); if (k === 'name') setErrName(false); setApiErr(''); };

  async function handleSave() {
    if (!form.name.trim()) { setErrName(true); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = { name: form.name.trim(), phone: form.phone.trim(), locked: form.locked, isActive: form.isActive };
      const em = form.email.trim();
      if (em) payload.email = em; else if (staff.email) payload.email = '';
      const res = await api.patch(`/api/analyzer/staff/${staff._id}`, payload);
      onSaved(res.data?.data || res.data);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <MtModal open title={`${t('editStaff')} · ${staff.name}`} onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>{t('cancel')}</button>
        <button type="button" className="mt-btn" onClick={handleSave} disabled={saving}>{saving ? t('saving') : t('save')}</button>
      </>}>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">{t('name')} <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={errStyle(errName)} value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('phone')}</label>
          <input className="mt-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">{t('email')}</label>
          <input type="email" className="mt-input" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <label className="mt-check-label mt-field-full">
          <input type="checkbox" className="mt-check" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          {t('accountActive')}
        </label>
        <label className="mt-check-label mt-field-full">
          <input type="checkbox" className="mt-check" checked={form.locked} onChange={(e) => set('locked', e.target.checked)} />
          {t('accountLocked')}
        </label>
      </div>
      <ApiErr msg={apiErr} />
    </MtModal>
  );
}

export default function AnalyzerStaff() {
  const { lang } = usePrefs();
  const t = (k) => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const { toasts, showToast } = useMtToast();

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editStaff, setEditStaff] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/analyzer/staff', { params: includeInactive ? { includeInactive: 'true' } : {}, cache: false });
      setStaff(r.data?.data || r.data || []);
    } catch { showToast(t('loadFailed'), 'dng'); }
    setLoading(false);
  }, [includeInactive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? staff.filter((s) => [s.name, s.idNumber, s.email].some((v) => String(v || '').toLowerCase().includes(q)))
    : staff;

  return (
    <>
      <Navbar title={t('title')} subtitle="Data Analyzer" />
      <main className="mt-content">
        <div className="mt-filterbar">
          <SearchBox value={search} onChange={setSearch} placeholder={t('search')} />
          <label className="mt-check-label" style={{ fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
            <input type="checkbox" className="mt-check" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            {t('includeInactive')}
          </label>
          <span className="mt-filterbar-spacer" />
          <button type="button" className="mt-btn" onClick={() => setAddOpen(true)}>+ {t('addStaff')}</button>
          <span className="mt-count">{filtered.length.toLocaleString('en-US')} {t('staff')}</span>
        </div>

        {loading ? (
          <div className="skeleton mt-skel" style={{ height: 320 }} />
        ) : (
          <RevealOnScroll>
            <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table">
                  <thead>
                    <tr>
                      <th className="mt-th">{t('role')}</th><th className="mt-th">{t('name')}</th>
                      <th className="mt-th">{t('idNumber')}</th><th className="mt-th">{t('email')}</th>
                      <th className="mt-th">{t('phone')}</th><th className="mt-th">{t('status')}</th>
                      <th className="mt-th">{t('action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td className="mt-td" colSpan={7} style={{ textAlign: 'center', padding: '44px 16px', color: 'var(--text-2)' }}>
                        {staff.length === 0 ? t('none') : t('noMatch')}
                      </td></tr>
                    )}
                    {filtered.map((s) => {
                      const active = s.isActive !== false;
                      return (
                        <tr key={s._id}>
                          <td className="mt-td"><Pill tone="warn">{roleLabel(s.role, lang)}</Pill></td>
                          <td className="mt-td mt-td--name">{s.name}</td>
                          <td className="mt-td mt-td--mono">{s.idNumber || '—'}</td>
                          <td className="mt-td mt-td--muted">{s.email || '—'}</td>
                          <td className="mt-td mt-td--muted">{s.phone || '—'}</td>
                          <td className="mt-td">
                            <Pill tone={active ? 'ok' : 'neutral'}>{active ? t('active') : t('inactive')}</Pill>
                            {s.locked && <span style={{ marginInlineStart: 6 }}><Pill tone="dng">{t('locked')}</Pill></span>}
                          </td>
                          <td className="mt-td mt-td--actions">
                            <div className="mt-row-actions">
                              <button type="button" className="mt-icon-action" title={t('editStaff')} aria-label={t('editStaff')} onClick={() => setEditStaff(s)}>
                                <IconEdit size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </RevealOnScroll>
        )}

        {addOpen && (
          <AddStaffModal t={t} lang={lang} onClose={() => setAddOpen(false)}
            onSaved={() => { setAddOpen(false); load(); showToast(t('created'), 'ok'); }} />
        )}
        {editStaff && (
          <EditStaffModal staff={editStaff} t={t} onClose={() => setEditStaff(null)}
            onSaved={() => { setEditStaff(null); load(); showToast(t('updated'), 'ok'); }} />
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
