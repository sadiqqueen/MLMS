// W2-Developer — Hospitals (& Universities). RULINGS §B14 keeps Hospitals on the
// developer nav (no-feature-removal). mt- restyle; all behaviour kept: hospital
// modal with PD select + supervisor multi-select, university modal, delete,
// table+card views, search, pagination. For super_admin the page is Hospitals-only
// (Universities tab shows for other managers via the legacy route).
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MtModal from '../components/MtModal';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import ViewToggle from '../components/ViewToggle';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconPencil, IconDelete } from '../components/icons';
import api from '../api/axios';
import { MagnifierIcon } from './devkit';
import './developer.css';

const ROWS_OPT = [8, 16, 32];

// ── Hospital modal ────────────────────────────────────────────────────────────
function HospitalModal({ item, programDirectors, supervisors, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name: item?.name || '', city: item?.city || '', governorate: item?.governorate || '',
    address: item?.address || '', phone: item?.phone || '', email: item?.email || '',
    programDirector: item?.programDirector?._id || item?.programDirector || '',
    supervisors: (item?.supervisors || []).map((s) => s._id || s),
  });
  const [supSearch, setSupSearch] = useState('');
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: false })); };
  const toggleSupervisor = (id) => setForm((f) => ({ ...f, supervisors: f.supervisors.includes(id) ? f.supervisors.filter((s) => s !== id) : [...f.supervisors, id] }));

  function handleSave() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave(form);
  }

  const filteredSups = supervisors.filter((s) => !supSearch || s.name?.toLowerCase().includes(supSearch.toLowerCase()));
  const selectedSupObjs = supervisors.filter((s) => form.supervisors.includes(s._id));

  return (
    <MtModal open title={item ? 'Edit training center' : 'Add training center'} sub="Training center record" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">Training center name <span className="mt-label-req">*</span></label>
          <input className={`mt-input${errors.name ? ' dev-invalid' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Training center name" />
        </div>
        <div className="mt-field"><label className="mt-label">City</label><input className="mt-input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" /></div>
        <div className="mt-field"><label className="mt-label">Governorate</label><input className="mt-input" value={form.governorate} onChange={(e) => set('governorate', e.target.value)} placeholder="Governorate" /></div>
        <div className="mt-field mt-field-full"><label className="mt-label">Address</label><input className="mt-input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Full address" /></div>
        <div className="mt-field"><label className="mt-label">Phone</label><input className="mt-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+249 …" /></div>
        <div className="mt-field"><label className="mt-label">Email</label><input className="mt-input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="hospital@example.com" /></div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Program Director</label>
          <select className="mt-select" value={form.programDirector} onChange={(e) => set('programDirector', e.target.value)}>
            <option value="">— None —</option>
            {programDirectors.map((pd) => <option key={pd._id} value={pd._id}>{pd.name}{pd.specialty ? ` (${pd.specialty})` : ''}</option>)}
          </select>
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Trainers</label>
          {selectedSupObjs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBlockEnd: 8 }}>
              {selectedSupObjs.map((s) => (
                <span key={s._id} className="mt-pill mt-pill--role" style={{ gap: 4 }}>
                  {s.name}
                  <button type="button" onClick={() => toggleSupervisor(s._id)} aria-label={`Remove ${s.name}`}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 15, lineHeight: 1, padding: 0, marginInlineStart: 2 }}>×</button>
                </span>
              ))}
            </div>
          )}
          <input className="mt-input" style={{ marginBlockEnd: 8 }} placeholder="Search trainers…" value={supSearch} onChange={(e) => setSupSearch(e.target.value)} />
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px' }}>
            {filteredSups.length === 0 && <div className="mt-td--muted" style={{ fontSize: 13, padding: '10px 4px' }}>No trainers found</div>}
            {filteredSups.map((s) => (
              <label key={s._id} className="mt-check-label" style={{ padding: '7px 4px' }}>
                <input type="checkbox" className="mt-check" checked={form.supervisors.includes(s._id)} onChange={() => toggleSupervisor(s._id)} />
                <span>{s.name}</span>
                {s.specialty && <span className="mt-td--muted" style={{ fontSize: 11 }}>{s.specialty}</span>}
              </label>
            ))}
          </div>
        </div>
      </div>
    </MtModal>
  );
}

// ── University modal ──────────────────────────────────────────────────────────
function UniversityModal({ item, onSave, onClose, saving }) {
  const [form, setForm] = useState({ name: item?.name || '', city: item?.city || '', address: item?.address || '', contactEmail: item?.contactEmail || '' });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: false })); };
  function handleSave() { const e = {}; if (!form.name.trim()) e.name = true; setErrors(e); if (Object.keys(e).length) return; onSave(form); }
  return (
    <MtModal open title={item ? 'Edit university' : 'Add university'} onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full"><label className="mt-label">University name <span className="mt-label-req">*</span></label><input className={`mt-input${errors.name ? ' dev-invalid' : ''}`} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="University name" /></div>
        <div className="mt-field"><label className="mt-label">City</label><input className="mt-input" value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" /></div>
        <div className="mt-field"><label className="mt-label">Address</label><input className="mt-input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Address" /></div>
        <div className="mt-field mt-field-full"><label className="mt-label">Contact email</label><input className="mt-input" type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} placeholder="contact@university.edu" /></div>
      </div>
    </MtModal>
  );
}

function ConfirmDelete({ name, onConfirm, onCancel }) {
  return (
    <MtModal open title="Delete record" onClose={onCancel}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className="mt-btn--danger-solid" onClick={onConfirm}>Delete</button>
      </>}>
      <p className="dev-confirm-text">Delete <strong>{name}</strong>? This cannot be undone.</p>
    </MtModal>
  );
}

export default function HospitalsUniversities() {
  const { user: me } = useAuth();
  const { toasts, showToast } = useMtToast();
  const isAdmin = me?.role === 'developer';
  const canManage = ['developer', 'odio'].includes(me?.role);

  const [tab, setTab] = useState(0);
  const [hospitals, setHospitals] = useState([]);
  const [universities, setUnis] = useState([]);
  const [programDirectors, setProgramDirectors] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(16);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [delItem, setDelItem] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/api/hospitals'),
      api.get('/api/universities'),
      api.get('/api/users/program-directors'),
      api.get('/api/users/supervisors'),
    ]).then(([h, u, pd, sv]) => {
      setHospitals(h.data?.data || h.data || []);
      setUnis(u.data?.data || u.data || []);
      setProgramDirectors(pd.data?.data || pd.data || []);
      setSupervisors(sv.data?.data || sv.data || []);
    }).catch(() => showToast('Failed to load data', 'dng')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isHospital = isAdmin || tab === 0;
  const data = isHospital ? hospitals : universities;
  const filtered = data.filter((item) => { const q = search.toLowerCase(); return !q || item.name?.toLowerCase().includes(q) || item.city?.toLowerCase().includes(q); });
  const currentItems = filtered.slice((page - 1) * rows, page * rows);

  async function handleSave(payload) {
    setSaving(true);
    try {
      let res;
      if (isHospital) {
        const url = editItem ? `/api/hospitals/${editItem._id}` : '/api/hospitals';
        res = await api[editItem ? 'patch' : 'post'](url, payload);
        const saved = res.data?.data || res.data;
        setHospitals((prev) => (editItem ? prev.map((h) => (h._id === editItem._id ? saved : h)) : [saved, ...prev]));
      } else {
        const url = editItem ? `/api/universities/${editItem._id}` : '/api/universities';
        res = await api[editItem ? 'put' : 'post'](url, payload);
        const saved = res.data?.data || res.data;
        setUnis((prev) => (editItem ? prev.map((u) => (u._id === editItem._id ? saved : u)) : [saved, ...prev]));
      }
      showToast(editItem ? 'Updated' : 'Created', 'ok');
      setShowModal(false); setEditItem(null);
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'dng'); } finally { setSaving(false); }
  }

  async function confirmDelete() {
    const url = isHospital ? `/api/hospitals/${delItem._id}` : `/api/universities/${delItem._id}`;
    try {
      await api.delete(url);
      if (isHospital) setHospitals((p) => p.filter((h) => h._id !== delItem._id));
      else setUnis((p) => p.filter((u) => u._id !== delItem._id));
      showToast('Deleted', 'ok');
    } catch { showToast('Delete failed', 'dng'); } finally { setDelItem(null); }
  }

  const rowActions = (item) => (
    <div className="mt-row-actions">
      <button className="mt-icon-action" title="Edit" aria-label={`Edit ${item.name}`} onClick={() => { setEditItem(item); setShowModal(true); }}><IconPencil size={15} /></button>
      <button className="mt-icon-action dev-act-danger" title="Delete" aria-label={`Delete ${item.name}`} onClick={() => setDelItem(item)}><IconDelete size={15} /></button>
    </div>
  );

  return (
    <>
      <Navbar title={isHospital ? 'Training Centers' : 'Universities'} subtitle="Developer" />
      <main className="mt-content">
        {!isAdmin && (
          <div className="dev-tabs">
            <button className={`dev-tab${tab === 0 ? ' is-active' : ''}`} onClick={() => { setTab(0); setPage(1); }}>Hospitals</button>
            <button className={`dev-tab${tab === 1 ? ' is-active' : ''}`} onClick={() => { setTab(1); setPage(1); }}>Universities</button>
          </div>
        )}

        <div className="mt-filterbar">
          <div className="mt-search">
            <MagnifierIcon />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or city…" aria-label="Search" />
          </div>
          <span className="mt-filterbar-spacer" />
          {canManage && <button className="mt-btn" onClick={() => { setEditItem(null); setShowModal(true); }}>+ {isHospital ? 'Add training center' : 'Add university'}</button>}
          <ViewToggle value={view} onChange={setView} listValue="table" />
          <select className="mt-filter" value={rows} onChange={(e) => { setRows(+e.target.value); setPage(1); }} aria-label="Rows per page">
            {ROWS_OPT.map((r) => <option key={r} value={r}>{r} / page</option>)}
          </select>
          <span className="mt-count">{filtered.length} {isHospital ? 'training centers' : 'universities'}</span>
        </div>

        {loading ? <div className="skeleton mt-skel" style={{ height: 320 }} /> : view === 'table' ? (
          <RevealOnScroll>
            <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table">
                  <thead><tr>
                    <th className="mt-th">Name</th><th className="mt-th">City</th>
                    {isHospital ? <><th className="mt-th">Program Director</th><th className="mt-th">Trainers</th></> : <th className="mt-th">Contact email</th>}
                    {canManage && <th className="mt-th" />}
                  </tr></thead>
                  <tbody>
                    {currentItems.length === 0 && (
                      <tr><td className="mt-td mt-td--muted" colSpan={canManage ? 5 : 4} style={{ textAlign: 'center', padding: 40 }}>No records found.</td></tr>
                    )}
                    {currentItems.map((item) => (
                      <tr key={item._id}>
                        <td className="mt-td mt-td--name">{item.name}</td>
                        <td className="mt-td">{item.city || '—'}</td>
                        {isHospital ? (
                          <>
                            <td className="mt-td mt-td--muted">{item.programDirector?.name || '—'}</td>
                            <td className="mt-td">{(item.supervisors || []).length > 0 ? <span className="mt-pill mt-pill--neutral">{(item.supervisors || []).length} trainer{(item.supervisors || []).length !== 1 ? 's' : ''}</span> : '—'}</td>
                          </>
                        ) : (
                          <td className="mt-td mt-td--muted">{item.contactEmail || '—'}</td>
                        )}
                        {canManage && <td className="mt-td mt-td--actions">{rowActions(item)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </RevealOnScroll>
        ) : (
          <div className="mt-acct-grid">
            {currentItems.length === 0 && <div className="mt-empty"><div className="mt-empty-title">No records found.</div></div>}
            {currentItems.map((item) => (
              <div className="dev-card" key={item._id}>
                <div className="dev-card-avatar">{isHospital ? '🏥' : '🏛️'}</div>
                <div className="dev-card-name">{item.name}</div>
                <div className="dev-card-sub">{item.city || '—'}</div>
                {isHospital ? (
                  <>
                    {item.programDirector?.name && <div className="dev-card-sub">PD: <strong style={{ color: 'var(--text)' }}>{item.programDirector.name}</strong></div>}
                    {(item.supervisors || []).length > 0 && <div className="dev-card-sub">{(item.supervisors || []).length} trainer{(item.supervisors || []).length !== 1 ? 's' : ''}</div>}
                  </>
                ) : (<div className="dev-card-sub">{item.contactEmail || '—'}</div>)}
                {canManage && <div className="dev-card-actions">{rowActions(item)}</div>}
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length > rows && (
          <Pagination page={page} pageSize={rows} total={filtered.length}
            onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
        )}

        {showModal && isHospital && (
          <HospitalModal item={editItem} programDirectors={programDirectors} supervisors={supervisors} onSave={handleSave} onClose={() => { setShowModal(false); setEditItem(null); }} saving={saving} />
        )}
        {showModal && !isHospital && (
          <UniversityModal item={editItem} onSave={handleSave} onClose={() => { setShowModal(false); setEditItem(null); }} saving={saving} />
        )}
        {delItem && <ConfirmDelete name={delItem.name} onConfirm={confirmDelete} onCancel={() => setDelItem(null)} />}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
