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
import { useMtToast, MtToastHost } from '../components/MtToast';
import MtModal          from '../components/MtModal';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle       from '../components/ViewToggle';
import api  from '../api/axios';
import Sk   from '../components/Skeleton';
import { IconPencil, IconBan, IconUserCheck } from '../components/icons';
import { specialtyName } from '../utils/specialtyName';
import './dio.css';

const STATUS_OPTS = ['active', 'inactive'];

function safeArr(v) { return Array.isArray(v) ? v : []; }
function getId(v)   { return v?._id || v || ''; }
function textValue(v, fallback = '—') {
  if (v === null || v === undefined || v === '') return fallback;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.name || v.title || fallback;
  return fallback;
}
function statusPill(status) {
  return status === 'active' ? 'mt-pill--active' : status === 'inactive' ? 'mt-pill--rejected' : 'mt-pill--neutral';
}

function ConfirmModal({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <MtModal open title={title} onClose={onCancel}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onCancel}>Cancel</button>
          <button className="mt-btn--danger-solid" onClick={onConfirm}>{confirmLabel || 'Confirm'}</button>
        </>
      )}>
      <div style={{ fontSize: 13.5, color: 'var(--text)' }}>{message}</div>
    </MtModal>
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
  const specialtyOpts = safeArr(specialties).map(s => ({ value: s._id, label: specialtyName(s) }));
  const hospitalOpts  = safeArr(hospitals).map(h => ({
    value: h._id,
    label: h.name + (h.city ? ` (${h.city})` : ''),
  }));

  return (
    <MtModal open title={isEdit ? 'Edit Supervisor Distribution' : 'Add Supervisor Distribution'} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="mt-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Distribution'}
          </button>
        </>
      )}>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">Supervisor <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.supervisorId} onChange={v => set('supervisorId', v)}
            options={supervisorOpts} placeholder="Search supervisor…" error={errors.supervisorId} />
        </div>
        <div className="mt-field">
          <label className="mt-label">Specialty <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)}
            options={specialtyOpts} placeholder="Search specialty…" error={errors.specialtyId} />
        </div>
        <div className="mt-field">
          <label className="mt-label">Hospital <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.hospitalId} onChange={v => set('hospitalId', v)}
            options={hospitalOpts} placeholder="Search hospital…" error={errors.hospitalId} />
        </div>
        <div className="mt-field">
          <label className="mt-label">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="mt-select">
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>
    </MtModal>
  );
}

export function DistributionsPanel({ autoOpenNew = false }) {
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
  const { toasts, showToast } = useMtToast();

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
    } catch { showToast('Failed to load', 'dng'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoOpenNew) { setEditItem(null); setShowModal(true); }
  }, [autoOpenNew]);

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
        showToast('Distribution updated', 'ok');
      } else {
        const res = await api.post('/api/distributions', payload);
        setItems(prev => [res.data?.data || res.data, ...safeArr(prev)]);
        showToast('Distribution created', 'ok');
      }
      setShowModal(false); setEditItem(null);
    } catch (err) { showToast(err.response?.data?.message || 'Save failed', 'dng'); }
    finally { setSaving(false); }
  }

  async function handleDeactivate(item) {
    try {
      await api.delete(`/api/distributions/${item._id}`);
      setItems(prev => safeArr(prev).map(d => d._id === item._id ? { ...d, status:'inactive' } : d));
      showToast('Deactivated', 'ok');
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'dng'); }
    finally { setConfirmAction(null); }
  }

  async function handleReactivate(item) {
    try {
      const res = await api.patch(`/api/distributions/${item._id}/reactivate`);
      setItems(prev => safeArr(prev).map(d => d._id === item._id ? (res.data?.data || { ...d, status:'active' }) : d));
      showToast('Reactivated', 'ok');
    } catch (err) { showToast(err.response?.data?.message || 'Failed', 'dng'); }
    finally { setConfirmAction(null); }
  }

  if (loading) return (
    <div className="mt-card">
      <div className="mt-filterbar"><Sk h={38} r={8} style={{ flex:1 }} /></div>
      {[...Array(6)].map((_,i) => <Sk key={i} h={40} r={8} style={{ marginBottom:8 }} />)}
    </div>
  );

  return (
    <>
      <div className="mt-card">
        {/* Toolbar */}
        <div className="mt-filterbar">
          <div className="mt-search">
            <input placeholder="Search by supervisor, hospital, specialty…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="mt-filter" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select className="mt-filter" value={filterHosp} onChange={e => setFilterHosp(e.target.value)}>
            <option value="">All Hospitals</option>
            {safeArr(hospitals).map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
          <div className="mt-filterbar-spacer" />
          <ViewToggle value={view} onChange={setView} />
          <button className="mt-btn mt-btn--small" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add</button>
        </div>
        <div className="mt-count" style={{ marginBlockEnd: 12 }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</div>

        {/* LIST VIEW */}
        {view === 'list' && (
          <div className="mt-table-wrap">
            <table className="mt-table mt-table--stack">
              <thead><tr>
                <th className="mt-th">#</th><th className="mt-th">Supervisor</th><th className="mt-th">Specialty</th>
                <th className="mt-th">Hospital</th><th className="mt-th">Status</th><th className="mt-th">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td className="mt-td mt-td--muted" colSpan={6} style={{ textAlign:'center', padding:32 }}>
                    {items.length === 0 ? 'No distributions yet.' : 'No match.'}
                  </td></tr>
                )}
                {filtered.map((d, i) => {
                  const sup  = d?.supervisorId || d?.doctor || {};
                  const hosp = d?.hospitalId   || d?.hospital || {};
                  const spec = textValue(d?.specialtyId || d?.specialty);
                  return (
                    <tr key={d._id}>
                      <td className="mt-td mt-td--muted">{i+1}</td>
                      <td className="mt-td mt-td--name" data-label="Supervisor">
                        <div>{sup?.name || '—'}</div>
                        {sup?.email && <div className="mt-acct-id">{sup.email}</div>}
                      </td>
                      <td className="mt-td" data-label="Specialty"><span className="mt-pill mt-pill--neutral">{spec}</span></td>
                      <td className="mt-td mt-td--muted" data-label="Hospital">{hosp?.name || '—'}</td>
                      <td className="mt-td" data-label="Status"><span className={`mt-pill ${statusPill(d?.status)}`}>{d?.status || '—'}</span></td>
                      <td className="mt-td mt-td--actions" data-label="Actions">
                        <div className="mt-row-actions">
                          <button className="mt-icon-action" title="Edit" aria-label={`Edit distribution for ${sup?.name}`}
                            onClick={() => { setEditItem(d); setShowModal(true); }}><IconPencil size={15} /></button>
                          {d?.status === 'active'
                            ? <button className="mt-icon-action mt-icon-action--danger" title="Deactivate" aria-label="Deactivate"
                                onClick={() => setConfirmAction({ type:'deactivate', item:d })}><IconBan size={15} /></button>
                            : <button className="mt-icon-action" title="Reactivate" aria-label="Reactivate"
                                onClick={() => setConfirmAction({ type:'reactivate', item:d })}><IconUserCheck size={15} /></button>
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
          <div className="mt-acct-grid">
            {filtered.length === 0 && <div className="mt-empty" style={{ gridColumn:'1/-1' }}><div className="mt-empty-sub">No distributions found.</div></div>}
            {filtered.map(d => {
              const sup  = d?.supervisorId || d?.doctor || {};
              const hosp = d?.hospitalId   || d?.hospital || {};
              const spec = textValue(d?.specialtyId || d?.specialty, '');
              return (
                <div className="mt-card" key={d._id} style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{sup?.name || '—'}</div>
                    {sup?.email && <div className="mt-acct-id">{sup.email}</div>}
                  </div>
                  <div className="dio-chip-row">
                    {spec && <span className="mt-pill mt-pill--neutral">{spec}</span>}
                    <span className={`mt-pill ${statusPill(d?.status)}`}>{d?.status || '—'}</span>
                  </div>
                  <div className="mt-card-sub">{hosp?.name || '—'}</div>
                  <div className="mt-row-actions" style={{ justifyContent:'flex-start' }}>
                    <button className="mt-icon-action" title="Edit" onClick={() => { setEditItem(d); setShowModal(true); }}><IconPencil size={15} /></button>
                    {d?.status === 'active'
                      ? <button className="mt-icon-action mt-icon-action--danger" title="Deactivate" onClick={() => setConfirmAction({ type:'deactivate', item:d })}><IconBan size={15} /></button>
                      : <button className="mt-icon-action" title="Reactivate" onClick={() => setConfirmAction({ type:'reactivate', item:d })}><IconUserCheck size={15} /></button>
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
      <MtToastHost toasts={toasts} />
    </>
  );
}

export default function DioDistributions() {
  const location = useLocation();
  const autoOpenNew = new URLSearchParams(location.search).get('new') === '1';
  return (
    <>
      <Navbar />
      <main className="mt-content">
        <DistributionsPanel autoOpenNew={autoOpenNew} />
      </main>
    </>
  );
}
