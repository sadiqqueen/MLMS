// frontend/src/pages/RegistrySpecialties.jsx
//
// Data-entry clerk's Specialties registry (advanced track). The backend exposes
// GET/POST/PATCH only (no DELETE) — deactivation is a PATCH { isActive:false },
// and GET returns both active and inactive rows so they can be toggled back.
// Contract: GET/POST/PATCH /api/registry/specialties.
import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import { IconPencil, IconBan, IconUserCheck } from '../components/icons';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const STRINGS = {
  ar: {
    title: 'الاختصاصات', search: 'ابحث بالاسم…', add: 'إضافة اختصاص', edit: 'تعديل الاختصاص',
    newItem: 'اختصاص جديد', name: 'اسم الاختصاص', active: 'نشط', inactive: 'غير نشط',
    colNum: '#', colName: 'الاسم', colStatus: 'الحالة', colAction: 'الإجراء',
    none: 'لا توجد اختصاصات بعد.', noMatch: 'لا توجد نتائج مطابقة.', cancel: 'إلغاء', save: 'حفظ', saving: 'جارٍ الحفظ…',
    created: 'تمت الإضافة', updated: 'تم التحديث', deactivated: 'تم التعطيل', reactivated: 'تمت إعادة التفعيل',
    loadFailed: 'فشل التحميل', deactivate: 'تعطيل', reactivate: 'إعادة تفعيل', nameReq: 'الاسم مطلوب',
    showInactive: 'إظهار غير النشطة',
  },
  en: {
    title: 'Specialties', search: 'Search by name…', add: 'Add Specialty', edit: 'Edit Specialty',
    newItem: 'New Specialty', name: 'Specialty Name', active: 'Active', inactive: 'Inactive',
    colNum: '#', colName: 'Name', colStatus: 'Status', colAction: 'Action',
    none: 'No specialties yet.', noMatch: 'No matching results.', cancel: 'Cancel', save: 'Save', saving: 'Saving…',
    created: 'Specialty added', updated: 'Specialty updated', deactivated: 'Specialty deactivated', reactivated: 'Specialty reactivated',
    loadFailed: 'Failed to load', deactivate: 'Deactivate', reactivate: 'Reactivate', nameReq: 'Name is required',
    showInactive: 'Show inactive',
  },
};

function SpecialtyModal({ item, t, dir, onClose, onSaved }) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name || '');
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function handleSave() {
    if (!name.trim()) { setError(true); return; }
    setSaving(true); setApiErr('');
    try {
      const res = isEdit
        ? await api.patch(`/api/registry/specialties/${item._id}`, { name: name.trim() })
        : await api.post('/api/registry/specialties', { name: name.trim() });
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
              <input className={error ? 'invalid' : ''} value={name} onChange={e => { setName(e.target.value); setError(false); setApiErr(''); }} />
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

export default function RegistrySpecialties() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  // Specialty management moved to the Data Analyzer (Change 1) — the clerk sees a
  // read-only list. Writes stay open to data_analyzer + developer (backend-gated).
  const { user } = useAuth();
  const canWrite = ['data_analyzer', 'developer'].includes(user?.role);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/registry/specialties');
      setSpecialties(r.data?.data || r.data || []);
    } catch { showToast(t('loadFailed'), 'error'); }
    setLoading(false);
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function handleSaved(saved, isEdit) {
    load();
    setModal(null);
    showToast(isEdit ? t('updated') : t('created'));
  }

  async function toggleActive(item) {
    const next = item.isActive === false;
    try {
      await api.patch(`/api/registry/specialties/${item._id}`, { isActive: next });
      setSpecialties(prev => prev.map(s => s._id === item._id ? { ...s, isActive: next } : s));
      showToast(next ? t('reactivated') : t('deactivated'));
    } catch (err) { showToast(err.response?.data?.message || 'Update failed', 'error'); }
  }

  const filtered = specialties.filter(s => {
    if (!showInactive && s.isActive === false) return false;
    const q = search.trim().toLowerCase();
    return !q || (s.name || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /><Sk w={120} h={36} r={8} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(6)].map((_, i) => (<tr key={i}><td><Sk w={20} h={13} /></td><td><Sk w={160} h={13} /></td><td><Sk w={60} h={22} r={20} /></td><td><Sk w={36} h={36} r={8} /></td></tr>))}
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> {t('showInactive')}
            </label>
            {canWrite && <button className="btn-primary" onClick={() => setModal({ item: null })}>+ {t('add')}</button>}
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>{t('colNum')}</th><th>{t('colName')}</th><th>{t('colStatus')}</th><th>{t('colAction')}</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{specialties.length === 0 ? t('none') : t('noMatch')}</td></tr>
                )}
                {filtered.map((s, i) => {
                  const active = s.isActive !== false;
                  return (
                    <tr key={s._id} style={{ opacity: active ? 1 : 0.6 }}>
                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td><strong>{s.name}</strong></td>
                      <td><span className={active ? 'badge badge-green' : 'badge'} style={active ? undefined : { background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{active ? t('active') : t('inactive')}</span></td>
                      <td>
                        <div className="action-btns">
                          {canWrite ? (
                            <>
                              <button className="btn-action edit" title={t('edit')} aria-label={t('edit')} onClick={() => setModal({ item: s })}><IconPencil /></button>
                              {active
                                ? <button className="btn-action delete" title={t('deactivate')} aria-label={t('deactivate')} onClick={() => toggleActive(s)}><IconBan /></button>
                                : <button className="btn-action reactivate" title={t('reactivate')} aria-label={t('reactivate')} onClick={() => toggleActive(s)}><IconUserCheck /></button>}
                            </>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {modal && <SpecialtyModal item={modal.item} t={t} dir={dir} onClose={() => setModal(null)} onSaved={handleSaved} />}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
