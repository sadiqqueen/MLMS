// frontend/src/pages/AdminCountries.jsx
//
// Developer (super_admin) — Countries management. Full CRUD: add / edit /
// deactivate / restore. Countries are the geography that training centres and
// users belong to (Hospital.countryId / User.countryId), so "delete" is a
// reversible deactivation (isActive:false) rather than a hard purge.
//   GET/POST/PATCH/DELETE /api/countries  (POST: data_entry + super_admin;
//   PATCH/DELETE: super_admin). This page passes ?includeInactive=true so the
//   Developer can see and restore deactivated rows.
import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import MtModal from '../components/MtModal';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { NavIcon, IconPencil, IconBan, IconUserCheck } from '../components/icons';
import { MagnifierIcon } from './devkit';
import api from '../api/axios';
import './developer.css';

// ── Add / edit country modal (name + code) ───────────────────────────────────
function CountryModal({ item, onSave, onClose, saving }) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name || '');
  const [code, setCode] = useState(item?.code || '');
  const [errors, setErrors] = useState({});
  const [apiErr, setApiErr] = useState('');

  function submit() {
    const e = {};
    if (!name.trim()) e.name = true;
    if (!code.trim()) e.code = true;
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ name: name.trim(), code: code.trim() }, setApiErr);
  }

  return (
    <MtModal open title={isEdit ? 'Edit country' : 'Add country'} sub={isEdit ? item.name : 'New country record'} meta="Developer" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={submit} disabled={saving}>{saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Create country')}</button>
      </>}>
      <div className="mt-banner">This record will be added to the registry.</div>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">Name <span className="mt-label-req">*</span></label>
          <input className={`mt-input${errors.name ? ' dev-invalid' : ''}`} value={name}
            onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: false })); setApiErr(''); }} placeholder="Country name" />
        </div>
        <div className="mt-field">
          <label className="mt-label">Code <span className="mt-label-req">*</span></label>
          <input className={`mt-input mt-input--mono${errors.code ? ' dev-invalid' : ''}`} value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setErrors((x) => ({ ...x, code: false })); setApiErr(''); }} placeholder="e.g. SA" />
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

  const q = search.trim().toLowerCase();
  const rows = countries
    .filter((c) => showInactive || c.isActive !== false)
    .filter((c) => !q || (c.name || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q));

  return (
    <>
      <Navbar title="Countries" subtitle="Developer" />
      <main className="mt-content">
        <div className="dev-intro">Countries are the geography training centres and users belong to. Deactivating hides a country from every dropdown; it can be restored anytime.</div>

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
                    <th className="mt-th">#</th><th className="mt-th">Country</th><th className="mt-th">Code</th><th className="mt-th">Status</th><th className="mt-th" />
                  </tr></thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td className="mt-td mt-td--muted" colSpan={5} style={{ textAlign: 'center', padding: 40 }}>{countries.length === 0 ? 'No countries yet.' : 'No matching countries.'}</td></tr>
                    )}
                    {rows.map((c, i) => {
                      const active = c.isActive !== false;
                      return (
                        <tr key={c._id} style={{ opacity: active ? 1 : 0.6 }}>
                          <td className="mt-td mt-td--muted">{i + 1}</td>
                          <td className="mt-td mt-td--name">{c.name}</td>
                          <td className="mt-td mt-td--mono">{c.code || '—'}</td>
                          <td className="mt-td">{active ? <span className="mt-pill mt-pill--active">Active</span> : <span className="mt-pill mt-pill--rejected">Inactive</span>}</td>
                          <td className="mt-td mt-td--actions">
                            <div className="mt-row-actions">
                              <button className="mt-icon-action" onClick={() => setModal({ item: c })} title="Edit" aria-label={`Edit ${c.name}`}><IconPencil size={15} /></button>
                              {active
                                ? <button className="mt-icon-action dev-act-danger" onClick={() => setActive(c, false)} title="Deactivate" aria-label={`Deactivate ${c.name}`}><IconBan size={15} /></button>
                                : <button className="mt-icon-action" onClick={() => setActive(c, true)} title="Restore" aria-label={`Restore ${c.name}`}><IconUserCheck size={15} /></button>}
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
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
