// frontend/src/pages/AnalyzerStaff.jsx
//
// Data Analyzer's staff management — the two account types an analyzer owns:
// Data Entry clerks and Central Secretaries. Contract:
//   GET   /api/analyzer/staff?includeInactive=true → { success, data: [users] }
//   POST  /api/analyzer/staff  { name, idNumber, password, email?, phone?, role }
//   PATCH /api/analyzer/staff/:id  { name?, phone?, email?, locked?, isActive? }
// Duplicate idNumber/email surface as 409 { message } shown in-modal.
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import { roleLabel } from '../config/roles';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import { IconPencil } from '../components/icons';
import api from '../api/axios';

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
  },
};

function ErrBox({ msg }) {
  if (!msg) return null;
  return <div style={{ marginTop: 14, background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{msg}</div>;
}

function AddStaffModal({ t, dir, lang, onClose, onSaved }) {
  const [form, setForm] = useState({ role: '', name: '', idNumber: '', password: '', email: '', phone: '' });
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
    if (!STAFF_ROLES.includes(form.role)) e.role = true;
    if (!form.name.trim()) e.name = true;
    if (!form.idNumber.trim()) e.idNumber = true;
    if (!form.password || form.password.length < 6) e.password = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        role: form.role,
        name: form.name.trim(),
        idNumber: form.idNumber.trim(),
        password: form.password,
      };
      if (form.email.trim()) payload.email = form.email.trim();
      if (form.phone.trim()) payload.phone = form.phone.trim();
      const res = await api.post('/api/analyzer/staff', payload);
      onSaved(res.data?.data || res.data);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" dir={dir}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('newStaff')}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>{t('role')} *</label>
              <select className={errors.role ? 'invalid' : ''} value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="">{t('selectRole')}</option>
                {STAFF_ROLES.map(r => <option key={r} value={r}>{roleLabel(r, lang)}</option>)}
              </select>
            </div>
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

function EditStaffModal({ staff, t, dir, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: staff.name || '',
    phone: staff.phone || '',
    email: staff.email || '',
    locked: !!staff.locked,
    isActive: staff.isActive !== false,
  });
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
    if (!form.name.trim()) { setErrors({ name: true }); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        locked: form.locked,
        isActive: form.isActive,
      };
      // Email: send the trimmed value when set; send '' ONLY to clear a
      // previously-set email (the backend maps '' → $unset, never storing '').
      // We never send null here — the backend would String(null) it to "null".
      const em = form.email.trim();
      if (em) payload.email = em;
      else if (staff.email) payload.email = '';
      const res = await api.patch(`/api/analyzer/staff/${staff._id}`, payload);
      onSaved(res.data?.data || res.data);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" dir={dir}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{t('editStaff')} · {staff.name}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>{t('name')} *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('phone')}</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div className="admin-field">
              <label>{t('email')}</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
            <div className="admin-field full">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                <input type="checkbox" checked={form.isActive} onChange={e => set('isActive', e.target.checked)} />
                {t('accountActive')}
              </label>
            </div>
            <div className="admin-field full">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
                <input type="checkbox" checked={form.locked} onChange={e => set('locked', e.target.checked)} />
                {t('accountLocked')}
              </label>
            </div>
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

export default function AnalyzerStaff() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/analyzer/staff', { params: includeInactive ? { includeInactive: 'true' } : {}, cache: false });
      setStaff(r.data?.data || r.data || []);
    } catch { showToast(t('loadFailed'), 'error'); }
    setLoading(false);
  }, [includeInactive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const filtered = staff.filter(s => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (s.name || '').toLowerCase().includes(q)
      || (s.idNumber || '').toLowerCase().includes(q)
      || (s.email || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /><Sk w={130} h={36} r={8} /><Sk w={120} h={36} r={8} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(6)].map((_, i) => (
                <tr key={i}><td><Sk w={90} h={22} r={20} /></td><td><Sk w={130} h={13} /></td><td><Sk w={80} h={13} /></td><td><Sk w={150} h={13} /></td><td><Sk w={90} h={13} /></td><td><Sk w={70} h={22} r={20} /></td><td><Sk w={36} h={36} r={8} /></td></tr>
              ))}
            </tbody></table>
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeInactive} onChange={e => setIncludeInactive(e.target.checked)} />
              {t('includeInactive')}
            </label>
            <button className="btn-primary" onClick={() => setAddOpen(true)}>+ {t('addStaff')}</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('role')}</th><th>{t('name')}</th><th>{t('idNumber')}</th>
                  <th>{t('email')}</th><th>{t('phone')}</th><th>{t('status')}</th><th>{t('action')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{staff.length === 0 ? t('none') : t('noMatch')}</td></tr>
                )}
                {filtered.map(s => {
                  const active = s.isActive !== false;
                  return (
                    <tr key={s._id}>
                      <td><span className="badge badge-blue">{roleLabel(s.role, lang)}</span></td>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.idNumber || '—'}</td>
                      <td>{s.email || '—'}</td>
                      <td>{s.phone || '—'}</td>
                      <td>
                        <span className={`badge ${active ? 'badge-green' : 'badge-blue'}`} style={active ? {} : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                          {active ? t('active') : t('inactive')}
                        </span>
                        {s.locked && <span className="badge" style={{ marginInlineStart: 6, background: 'var(--danger-bg)', color: 'var(--danger-fg)' }}>{t('locked')}</span>}
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action edit" title={t('editStaff')} aria-label={t('editStaff')} onClick={() => setEditStaff(s)}><IconPencil /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {addOpen && (
          <AddStaffModal t={t} dir={dir} lang={lang}
            onClose={() => setAddOpen(false)}
            onSaved={() => { setAddOpen(false); load(); showToast(t('created')); }} />
        )}
        {editStaff && (
          <EditStaffModal staff={editStaff} t={t} dir={dir}
            onClose={() => setEditStaff(null)}
            onSaved={() => { setEditStaff(null); load(); showToast(t('updated')); }} />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
