// frontend/src/pages/RegistryCountries.jsx
//
// Data-entry clerk's Countries registry. GET returns active countries only, so
// soft-delete removes a row from the list. Contract:
// GET /api/countries, POST/PATCH /api/countries, DELETE /api/countries/:id.
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import { IconPencil, IconTrash } from '../components/icons';
import api from '../api/axios';

const STRINGS = {
  ar: {
    title: 'الدول', search: 'ابحث بالاسم أو الرمز…', add: 'إضافة دولة', edit: 'تعديل الدولة',
    newItem: 'دولة جديدة', name: 'اسم الدولة', code: 'الرمز', codeHint: '(أحرف كبيرة، مثل IRQ)',
    active: 'نشط', colNum: '#', colName: 'الاسم', colCode: 'الرمز', colStatus: 'الحالة', colAction: 'الإجراء',
    none: 'لا توجد دول بعد.', noMatch: 'لا توجد نتائج مطابقة.', cancel: 'إلغاء', save: 'حفظ', saving: 'جارٍ الحفظ…',
    created: 'تمت الإضافة', updated: 'تم التحديث', deleted: 'تم الحذف', loadFailed: 'فشل التحميل',
    delTitle: 'حذف الدولة', delMsg: 'حذف', delConfirm: 'حذف', nameReq: 'الاسم مطلوب', codeReq: 'الرمز مطلوب',
  },
  en: {
    title: 'Countries', search: 'Search by name or code…', add: 'Add Country', edit: 'Edit Country',
    newItem: 'New Country', name: 'Country Name', code: 'Code', codeHint: '(uppercase, e.g. IRQ)',
    active: 'Active', colNum: '#', colName: 'Name', colCode: 'Code', colStatus: 'Status', colAction: 'Action',
    none: 'No countries yet.', noMatch: 'No matching results.', cancel: 'Cancel', save: 'Save', saving: 'Saving…',
    created: 'Country added', updated: 'Country updated', deleted: 'Country deleted', loadFailed: 'Failed to load',
    delTitle: 'Delete Country', delMsg: 'Delete', delConfirm: 'Delete', nameReq: 'Name is required', codeReq: 'Code is required',
  },
};

function CountryModal({ item, t, dir, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({ name: item?.name || '', code: item?.code || '' });
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
    if (!form.code.trim()) e.code = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true); setApiErr('');
    try {
      const payload = { name: form.name.trim(), code: form.code.trim().toUpperCase() };
      const res = isEdit
        ? await api.patch(`/api/countries/${item._id}`, payload)
        : await api.post('/api/countries', payload);
      onSaved(res.data?.data || res.data, isEdit);
    } catch (err) {
      setApiErr(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal" dir={dir}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{isEdit ? t('edit') : t('newItem')}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>{t('name')} *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="admin-field full">
              <label>{t('code')} * <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>{t('codeHint')}</span></label>
              <input className={errors.code ? 'invalid' : ''} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} maxLength={6} />
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

function ConfirmModal({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onCancel]);
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>{title}</h3><p>{message}</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn-red" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export default function RegistryCountries() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // { item? } | null
  const [delItem, setDelItem] = useState(null);
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/countries');
      setCountries(r.data?.data || r.data || []);
    } catch { showToast(t('loadFailed'), 'error'); }
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function handleSaved(saved, isEdit) {
    load();
    setModal(null);
    showToast(isEdit ? t('updated') : t('created'));
  }

  async function handleDelete() {
    const item = delItem;
    try {
      await api.delete(`/api/countries/${item._id}`);
      setCountries(prev => prev.filter(c => c._id !== item._id));
      showToast(t('deleted'));
    } catch (err) { showToast(err.response?.data?.message || 'Delete failed', 'error'); }
    finally { setDelItem(null); }
  }

  const filtered = countries.filter(c => {
    const q = search.trim().toLowerCase();
    return !q || (c.name || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /><Sk w={120} h={36} r={8} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(6)].map((_, i) => (<tr key={i}><td><Sk w={20} h={13} /></td><td><Sk w={140} h={13} /></td><td><Sk w={50} h={13} /></td><td><Sk w={60} h={22} r={20} /></td><td><div style={{ display: 'flex', gap: 6 }}><Sk w={36} h={36} r={8} /><Sk w={36} h={36} r={8} /></div></td></tr>))}
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
            <button className="btn-primary" onClick={() => setModal({ item: null })}>+ {t('add')}</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>{t('colNum')}</th><th>{t('colName')}</th><th>{t('colCode')}</th><th>{t('colStatus')}</th><th>{t('colAction')}</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{countries.length === 0 ? t('none') : t('noMatch')}</td></tr>
                )}
                {filtered.map((c, i) => (
                  <tr key={c._id}>
                    <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                    <td><strong>{c.name}</strong></td>
                    <td><span className="badge badge-blue">{c.code}</span></td>
                    <td><span className="badge badge-green">{t('active')}</span></td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-action edit" title={t('edit')} aria-label={t('edit')} onClick={() => setModal({ item: c })}><IconPencil /></button>
                        <button className="btn-action delete" title={t('delConfirm')} aria-label={t('delConfirm')} onClick={() => setDelItem(c)}><IconTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {modal && <CountryModal item={modal.item} t={t} dir={dir} onClose={() => setModal(null)} onSaved={handleSaved} />}
        {delItem && (
          <ConfirmModal title={t('delTitle')} message={`${t('delMsg')} ${delItem.name}?`} confirmLabel={t('delConfirm')} cancelLabel={t('cancel')}
            onConfirm={handleDelete} onCancel={() => setDelItem(null)} />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
