// frontend/src/pages/AdminCountries.jsx
//
// Developer (super_admin) — Countries management. Full CRUD: add / edit /
// deactivate / restore / permanently delete. Countries are the geography that
// training centres and users belong to (Hospital.countryId / User.countryId),
// so the default "delete" is a reversible deactivation (isActive:false); the
// Developer can also HARD delete (?hard=true), which the backend blocks if any
// center or user still references the country.
//   GET/POST/PATCH/DELETE /api/countries  (POST: data_entry + super_admin;
//   PATCH/DELETE: super_admin). This page passes ?includeInactive=true so the
//   Developer can see and restore deactivated rows.
import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import MtModal from '../components/MtModal';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { NavIcon, IconPencil, IconBan, IconUserCheck, IconTrash } from '../components/icons';
import { MagnifierIcon } from './devkit';
import api from '../api/axios';
import './developer.css';

// ── Add / edit country modal — the source-sheet columns ──────────────────────
// التسلسل + official/short Arabic + official/short English are all required (the
// developer must fill every column). ISO code is optional (the sheet has none).
// Arabic inputs are forced RTL, English inputs LTR, regardless of UI language.
const EMPTY_COUNTRY = { order: '', officialNameAr: '', shortNameAr: '', officialNameEn: '', shortNameEn: '', code: '' };

function CountryModal({ item, onSave, onClose, saving }) {
  const isEdit = !!item;
  const [form, setForm] = useState(item ? {
    order: item.order ?? '', officialNameAr: item.officialNameAr || '', shortNameAr: item.shortNameAr || item.name || '',
    officialNameEn: item.officialNameEn || '', shortNameEn: item.shortNameEn || '', code: item.code || '',
  } : EMPTY_COUNTRY);
  const [errors, setErrors] = useState({});
  const [apiErr, setApiErr] = useState('');
  const set = (k, v) => { setForm((s) => ({ ...s, [k]: v })); setErrors((x) => ({ ...x, [k]: false })); setApiErr(''); };
  const inputCls = (k, extra = '') => `mt-input${extra}${errors[k] ? ' dev-invalid' : ''}`;

  function submit() {
    const e = {};
    const order = Number(form.order);
    if (!Number.isInteger(order) || order < 1) e.order = true;
    for (const k of ['officialNameAr', 'shortNameAr', 'officialNameEn', 'shortNameEn']) if (!form[k].trim()) e[k] = true;
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      order,
      officialNameAr: form.officialNameAr.trim(),
      shortNameAr: form.shortNameAr.trim(),
      officialNameEn: form.officialNameEn.trim(),
      shortNameEn: form.shortNameEn.trim(),
      code: form.code.trim(),
    }, setApiErr);
  }

  return (
    <MtModal open title={isEdit ? 'Edit country' : 'Add country'} sub={isEdit ? (item.shortNameAr || item.name) : 'New country record'} meta="Developer" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={submit} disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create country')}</button>
      </>}>
      <div className="mt-banner">Every column from the source sheet is required. ISO code is optional.</div>
      <div className="mt-field-grid">
        <div className="mt-field">
          <label className="mt-label">التسلسل · Sequence <span className="mt-label-req">*</span></label>
          <input type="number" min="1" dir="ltr" className={inputCls('order', ' mt-input--mono')} value={form.order}
            onChange={(e) => set('order', e.target.value)} placeholder="e.g. 23" />
        </div>
        <div className="mt-field">
          <label className="mt-label">Code (ISO)</label>
          <input dir="ltr" className={inputCls('code', ' mt-input--mono')} value={form.code}
            onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="optional, e.g. SA" />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">الاسم الرسمي بالعربية · Official name (Arabic) <span className="mt-label-req">*</span></label>
          <input dir="rtl" className={inputCls('officialNameAr')} value={form.officialNameAr}
            onChange={(e) => set('officialNameAr', e.target.value)} placeholder="مثال: المملكة العربية السعودية" />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">الاسم المختصر بالعربية · Short name (Arabic) <span className="mt-label-req">*</span></label>
          <input dir="rtl" className={inputCls('shortNameAr')} value={form.shortNameAr}
            onChange={(e) => set('shortNameAr', e.target.value)} placeholder="مثال: السعودية" />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">الاسم الرسمي بالإنجليزية · Official name (English) <span className="mt-label-req">*</span></label>
          <input dir="ltr" className={inputCls('officialNameEn')} value={form.officialNameEn}
            onChange={(e) => set('officialNameEn', e.target.value)} placeholder="e.g. Kingdom of Saudi Arabia" />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">الاسم المختصر بالإنجليزية · Short name (English) <span className="mt-label-req">*</span></label>
          <input dir="ltr" className={inputCls('shortNameEn')} value={form.shortNameEn}
            onChange={(e) => set('shortNameEn', e.target.value)} placeholder="e.g. Saudi Arabia" />
        </div>
      </div>
      {apiErr && (
        <div className="mt-banner" style={{ marginBlockStart: 12, background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger-fg)' }}>{apiErr}</div>
      )}
    </MtModal>
  );
}

export default function AdminCountries() {
  const { toasts, showToast } = useMtToast();
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState(null);      // { item } | null (null item = add)
  const [confirmDel, setConfirmDel] = useState(null); // country pending hard delete
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/countries', { params: { includeInactive: true }, cache: false });
      setCountries(r.data?.data || r.data || []);
    } catch { showToast('Failed to load countries', 'dng'); }
    finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function handleSave(fields, setApiErr) {
    setSaving(true);
    try {
      if (modal?.item) await api.patch(`/api/countries/${modal.item._id}`, fields);
      else await api.post('/api/countries', fields);
      setModal(null);
      showToast(modal?.item ? 'Country updated' : 'Country added', 'ok');
      load();
    } catch (err) { setApiErr(err.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function setActive(item, next) {
    try {
      if (next) await api.patch(`/api/countries/${item._id}`, { isActive: true });
      else await api.delete(`/api/countries/${item._id}`);       // soft delete (isActive:false)
      setCountries((prev) => prev.map((c) => (c._id === item._id ? { ...c, isActive: next } : c)));
      showToast(next ? 'Country restored' : 'Country deactivated', 'ok');
    } catch (err) { showToast(err.response?.data?.message || 'Update failed', 'dng'); }
  }

  async function hardDelete(item) {
    setSaving(true);
    try {
      await api.delete(`/api/countries/${item._id}`, { params: { hard: true } });
      setCountries((prev) => prev.filter((c) => c._id !== item._id));
      setConfirmDel(null);
      showToast('Country permanently deleted', 'ok');
    } catch (err) {
      // 409 = still referenced by centers/users; surface the backend's reason.
      showToast(err.response?.data?.message || 'Delete failed', 'dng');
    } finally { setSaving(false); }
  }

  const q = search.trim().toLowerCase();
  const rows = countries
    .filter((c) => showInactive || c.isActive !== false)
    .filter((c) => !q || [c.name, c.shortNameAr, c.shortNameEn, c.officialNameAr, c.officialNameEn, c.code]
      .some((v) => (v || '').toLowerCase().includes(q)));

  return (
    <>
      <Navbar title="Countries" subtitle="Developer" />
      <main className="mt-content">
        <div className="dev-intro">Countries are the geography training centres and users belong to. Deactivating hides a country from every dropdown and can be restored anytime; permanent delete removes it entirely and is only allowed when no center or user still belongs to it.</div>

        <div className="mt-filterbar">
          <div className="mt-search">
            <MagnifierIcon />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code…" aria-label="Search countries" />
          </div>
          <label className="mt-check-label" style={{ whiteSpace: 'nowrap' }}>
            <input type="checkbox" className="mt-check" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
          </label>
          <span className="mt-filterbar-spacer" />
          <button className="mt-btn" onClick={() => setModal({ item: null })}>+ Add country</button>
          <span className="mt-count">{rows.length} {rows.length === 1 ? 'country' : 'countries'}</span>
        </div>

        {loading ? <div className="skeleton mt-skel" style={{ height: 320 }} /> : (
          <RevealOnScroll>
            <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table">
                  <thead><tr>
                    <th className="mt-th">#</th><th className="mt-th">Country (AR)</th><th className="mt-th">Country (EN)</th><th className="mt-th">Code</th><th className="mt-th">Status</th><th className="mt-th" />
                  </tr></thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td className="mt-td mt-td--muted" colSpan={6} style={{ textAlign: 'center', padding: 40 }}>{countries.length === 0 ? 'No countries yet.' : 'No matching countries.'}</td></tr>
                    )}
                    {rows.map((c) => {
                      const active = c.isActive !== false;
                      return (
                        <tr key={c._id} style={{ opacity: active ? 1 : 0.6 }}>
                          <td className="mt-td mt-td--muted">{c.order ?? '—'}</td>
                          <td className="mt-td mt-td--name" title={c.officialNameAr || ''} dir="rtl">{c.shortNameAr || c.name}</td>
                          <td className="mt-td" title={c.officialNameEn || ''} dir="ltr">{c.shortNameEn || '—'}</td>
                          <td className="mt-td mt-td--mono">{c.code || '—'}</td>
                          <td className="mt-td">{active ? <span className="mt-pill mt-pill--active">Active</span> : <span className="mt-pill mt-pill--rejected">Inactive</span>}</td>
                          <td className="mt-td mt-td--actions">
                            <div className="mt-row-actions">
                              <button className="mt-icon-action" onClick={() => setModal({ item: c })} title="Edit" aria-label={`Edit ${c.name}`}><IconPencil size={15} /></button>
                              {active
                                ? <button className="mt-icon-action dev-act-danger" onClick={() => setActive(c, false)} title="Deactivate" aria-label={`Deactivate ${c.name}`}><IconBan size={15} /></button>
                                : <button className="mt-icon-action" onClick={() => setActive(c, true)} title="Restore" aria-label={`Restore ${c.name}`}><IconUserCheck size={15} /></button>}
                              <button className="mt-icon-action dev-act-danger" onClick={() => setConfirmDel(c)} title="Delete permanently" aria-label={`Delete ${c.name} permanently`}><IconTrash size={15} /></button>
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

        {!loading && countries.length === 0 && (
          <div className="mt-empty" style={{ marginBlockStart: 16 }}>
            <div className="mt-empty-icon"><NavIcon name="globe" size={22} /></div>
            <div className="mt-empty-title">No countries yet</div>
            <div className="mt-empty-sub">Add a country above.</div>
          </div>
        )}

        {modal && <CountryModal item={modal.item} onSave={handleSave} onClose={() => setModal(null)} saving={saving} />}

        {confirmDel && (
          <MtModal open title="Delete country permanently?" sub={confirmDel.name} meta="Developer" onClose={() => setConfirmDel(null)}
            footer={<>
              <button type="button" className="mt-btn--cancel" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button type="button" className="mt-btn" style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff' }}
                onClick={() => hardDelete(confirmDel)} disabled={saving}>{saving ? 'Deleting…' : 'Delete permanently'}</button>
            </>}>
            <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger-fg)' }}>
              This permanently removes <strong>{confirmDel.name}</strong> from the database — it cannot be undone or restored. If any training center or user still belongs to this country, the delete is blocked; deactivate it instead.
            </div>
          </MtModal>
        )}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
