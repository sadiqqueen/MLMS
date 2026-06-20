/**
 * DioDistributions.jsx  —  Supervisor placement management for DIO.
 *
 * Distribution = which supervisor is assigned to which hospital + specialty.
 * Backend endpoints:
 *   GET    /api/distributions
 *   POST   /api/distributions    { supervisorId, specialtyId, hospitalId, status }
 *   PUT    /api/distributions/:id
 *   DELETE /api/distributions/:id  → status:'inactive'
 *   PATCH  /api/distributions/:id/reactivate
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar           from '../components/Navbar';
import Toast            from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle       from '../components/ViewToggle';
import api  from '../api/axios';
import Sk   from '../components/Skeleton';
import { IconPencil, IconBan, IconUserCheck } from '../components/icons';

const STATUS_OPTS  = ['active', 'inactive'];
const STATUS_STYLE = {
  active:   { bg:'#D1FAE5', color:'#065F46' },
  inactive: { bg:'#FEE2E2', color:'#991B1B' },
};

function safeArr(v) { return Array.isArray(v) ? v : []; }
function getId(v)   { return v?._id || v || ''; }
function textValue(v, fallback = '—') {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.name || v.title || fallback;
  return fallback;
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }) {
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
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red" onClick={onConfirm}>{confirmLabel || 'Confirm'}</button>
        </div>
      </div>
    </div>
  );
}

function DistModal({ item, supervisors, specialties, hospitals, onSave, onClose, saving }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    supervisorId: getId(item?.supervisorId || item?.doctor),
    specialtyId:  getId(item?.specialtyId),
    hospitalId:   getId(item?.hospitalId  || item?.hospital),
    status:       item?.status || 'active',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function validate() {
    const e = {};
    if (!form.supervisorId) e.supervisorId = true;
    if (!form.specialtyId)  e.specialtyId  = true;
    if (!form.hospitalId)   e.hospitalId   = true;
    return e;
  }

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ supervisorId: form.supervisorId, specialtyId: form.specialtyId, hospitalId: form.hospitalId, status: form.status });
  }

  const supervisorOpts = safeArr(supervisors).map(s => ({
    value: s._id,
    label: s.name + (textValue(s.specialty || s.specialtyId, '') ? ` - ${textValue(s.specialty || s.specialtyId)}` : ''),
  }));
  const specialtyOpts = safeArr(specialties).map(s => ({ value: s._id, label: s.name }));
  const hospitalOpts  = safeArr(hospitals).map(h => ({
    value: h._id,
    label: h.name + (h.city ? ` (${h.city})` : ''),
  }));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{isEdit ? 'Edit Supervisor Distribution' : 'Add Supervisor Distribution'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>Supervisor *</label>
              <SearchableSelect
                value={form.supervisorId} onChange={v => set('supervisorId', v)}
                options={supervisorOpts} placeholder="Search supervisor…" error={errors.supervisorId}
              />
            </div>
            <div className="admin-field">
              <label>Specialty *</label>
              <SearchableSelect
                value={form.specialtyId} onChange={v => set('specialtyId', v)}
                options={specialtyOpts} placeholder="Search specialty…" error={errors.specialtyId}
              />
            </div>
            <div className="admin-field">
              <label>Hospital *</label>
              <SearchableSelect
                value={form.hospitalId} onChange={v => set('hospitalId', v)}
                options={hospitalOpts} placeholder="Search hospital…" error={errors.hospitalId}
              />
            </div>
            <div className="admin-field">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className="admin-search">
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Distribution'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DioDistributions() {
  const location = useLocation();

  const [items,         setItems        ] = useState([]);
  const [supervisors,   setSupervisors  ] = useState([]);
  const [specialties,   setSpecialties  ] = useState([]);
  const [hospitals,     setHospitals    ] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [saving,        setSaving       ] = useState(false);
  const [search,        setSearch       ] = useState('');
  const [filterStatus,  setFilterStatus ] = useState('');
  const [filterHosp,    setFilterHosp   ] = useState('');
  const [view,          setView         ] = useState('list');
  const [showModal,     setShowModal    ] = useState(false);
  const [editItem,      setEditItem     ] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toasts,        setToasts       ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, sRes, spRes, hRes] = await Promise.all([
        api.get('/api/distributions'),
        api.get('/api/users/supervisors'),
        api.get('/api/specialties'),
        api.get('/api/hospitals'),
      ]);
      setItems(safeArr(dRes.data?.data || dRes.data));
      setSupervisors(safeArr(sRes.data?.data || sRes.data));
      setSpecialties(safeArr(spRes.data?.data || spRes.data));
      setHospitals(safeArr(hRes.data?.data || hRes.data));
    } catch { showToast('Failed to load', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('new') === '1') {
      setEditItem(null); setShowModal(true);
    }
  }, [location.search]);

  const filtered = safeArr(items).filter(d => {
    const sup  = d?.supervisorId || d?.doctor || {};
    const hosp = d?.hospitalId   || d?.hospital || {};
    const spec = textValue(d?.specialtyId || d?.specialty, '');
    const q    = search.toLowerCase();
    return (!q || sup?.name?.toLowerCase().includes(q) || hosp?.name?.toLowerCase().includes(q) || spec.toLowerCase().includes(q))
      && (!filterStatus || d?.status === filterStatus)
      && (!filterHosp   || hosp?._id === filterHosp);
  });

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (editItem) {
        const res = await api.put(`/api/distributions/${editItem._id}`, payload);
        setItems(prev => safeArr(prev).map(d => d._id === editItem._id ? (res.data?.data || res.data) : d));
        showToast('Distribution updated');
      } else {
        const res = await api.post('/api/distributions', payload);
        setItems(prev => [res.data?.data || res.data, ...safeArr(prev)]);
        showToast('Distribution created');
      }
      setShowModal(false); setEditItem(null);
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDeactivate(item) {
    try {
      await api.delete(`/api/distributions/${item._id}`);
      setItems(prev => safeArr(prev).map(d => d._id === item._id ? { ...d, status:'inactive' } : d));
      showToast('Deactivated');
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setConfirmAction(null); }
  }

  async function handleReactivate(item) {
    try {
      const res = await api.patch(`/api/distributions/${item._id}/reactivate`);
      setItems(prev => safeArr(prev).map(d => d._id === item._id ? (res.data?.data || { ...d, status:'active' }) : d));
      showToast('Reactivated');
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setConfirmAction(null); }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /></div>
          <div className="admin-table-wrap"><table className="admin-table"><tbody>
            {[...Array(6)].map((_,i) => (
              <tr key={i}>{[20,150,120,120,80,120].map((w,j)=><td key={j}><Sk w={w} h={13}/></td>)}</tr>
            ))}
          </tbody></table></div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          {/* Toolbar */}
          <div className="admin-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
            <input className="admin-search" style={{ flex:1, minWidth:180 }}
              placeholder="Search by supervisor, hospital, specialty…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="admin-search" style={{ width:'auto', height:36 }}
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select className="admin-search" style={{ width:'auto', height:36 }}
              value={filterHosp} onChange={e => setFilterHosp(e.target.value)}>
              <option value="">All Hospitals</option>
              {safeArr(hospitals).map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
            <ViewToggle value={view} onChange={setView} />
            <button className="btn-purple" style={{ height:36 }} onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add</button>
          </div>
          <div style={{ padding:'0 20px 8px', fontSize:12, color:'#8B8FA8' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</div>

          {/* LIST VIEW */}
          {view === 'list' && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>#</th><th>Supervisor</th><th>Specialty</th><th>Hospital</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="admin-empty">
                      {items.length === 0 ? 'No distributions yet.' : 'No match.'}
                    </td></tr>
                  )}
                  {filtered.map((d, i) => {
                    const sup  = d?.supervisorId || d?.doctor || {};
                    const hosp = d?.hospitalId   || d?.hospital || {};
                    const spec = textValue(d?.specialtyId || d?.specialty);
                    const st   = STATUS_STYLE[d?.status] || { bg:'#F3F4F6', color:'#374151' };
                    return (
                      <tr key={d._id}>
                        <td style={{ color:'#8B8FA8' }}>{i+1}</td>
                        <td>
                          <div style={{ fontWeight:600 }}>{sup?.name || '—'}</div>
                          {sup?.email && <div style={{ fontSize:11, color:'#8B8FA8' }}>{sup.email}</div>}
                        </td>
                        <td><span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#EEEDFE', color:'#3C3489' }}>{spec}</span></td>
                        <td style={{ fontSize:13 }}>{hosp?.name || '—'}</td>
                        <td><span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:st.bg, color:st.color }}>{d?.status || '—'}</span></td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-action edit" title="Edit" aria-label={`Edit distribution for ${sup?.name}`}
                              onClick={() => { setEditItem(d); setShowModal(true); }}><IconPencil /></button>
                            {d?.status === 'active'
                              ? <button className="btn-action delete" title="Deactivate" aria-label="Deactivate"
                                  onClick={() => setConfirmAction({ type:'deactivate', item:d })}><IconBan /></button>
                              : <button className="btn-action reactivate" title="Reactivate" aria-label="Reactivate"
                                  onClick={() => setConfirmAction({ type:'reactivate', item:d })}><IconUserCheck /></button>
                            }
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD VIEW */}
          {view === 'card' && (
            <div className="item-card-grid">
              {filtered.length === 0 && <div className="admin-empty" style={{ gridColumn:'1/-1' }}>No distributions found.</div>}
              {filtered.map(d => {
                const sup  = d?.supervisorId || d?.doctor || {};
                const hosp = d?.hospitalId   || d?.hospital || {};
                const spec = textValue(d?.specialtyId || d?.specialty, '');
                const st   = STATUS_STYLE[d?.status] || { bg:'#F3F4F6', color:'#374151' };
                return (
                  <div className="item-card" key={d._id}>
                    <div>
                      <div className="item-card-title">{sup?.name || '—'}</div>
                      {sup?.email && <div className="item-card-sub">{sup.email}</div>}
                    </div>
                    <div className="item-card-meta">
                      {spec && <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#EEEDFE', color:'#3C3489' }}>{spec}</span>}
                      <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20, background:st.bg, color:st.color }}>{d?.status || '—'}</span>
                    </div>
                    <div className="item-card-sub">🏥 {hosp?.name || '—'}</div>
                    <div className="item-card-actions">
                      <button className="btn-action edit" title="Edit" onClick={() => { setEditItem(d); setShowModal(true); }}><IconPencil /></button>
                      {d?.status === 'active'
                        ? <button className="btn-action delete" title="Deactivate" onClick={() => setConfirmAction({ type:'deactivate', item:d })}><IconBan /></button>
                        : <button className="btn-action reactivate" title="Reactivate" onClick={() => setConfirmAction({ type:'reactivate', item:d })}><IconUserCheck /></button>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showModal && (
          <DistModal item={editItem} supervisors={supervisors} specialties={specialties} hospitals={hospitals}
            onSave={handleSave} onClose={() => { setShowModal(false); setEditItem(null); }} saving={saving} />
        )}
        {confirmAction && (
          <ConfirmModal
            title={confirmAction.type === 'reactivate' ? 'Reactivate Distribution' : 'Deactivate Distribution'}
            message={`${confirmAction.type === 'reactivate' ? 'Reactivate' : 'Deactivate'} distribution for ${(confirmAction.item?.supervisorId || confirmAction.item?.doctor)?.name || 'this supervisor'}?`}
            confirmLabel={confirmAction.type === 'reactivate' ? 'Reactivate' : 'Deactivate'}
            onConfirm={() => confirmAction.type === 'reactivate' ? handleReactivate(confirmAction.item) : handleDeactivate(confirmAction.item)}
            onCancel={() => setConfirmAction(null)}
          />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
