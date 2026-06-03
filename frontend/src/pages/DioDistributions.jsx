/**
 * DioDistributions.jsx
 * DIO supervisor placement management.
 *
 * Distribution means: supervisor -> hospital/specialty placement.
 * Trainee hospital movement lives in Rotations.
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const STATUS_OPTS = ['active', 'inactive'];

const STATUS_STYLE = {
  active:   { bg:'#D1FAE5', color:'#065F46' },
  inactive: { bg:'#FEE2E2', color:'#991B1B' },
};

// ── Inline SVG icons ──────────────────────────────────────────────────────
const IconPencil = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconBan = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
  </svg>
);
const IconUserCheck = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="8.5" cy="7" r="4"/>
    <polyline points="17 11 19 13 23 9"/>
  </svg>
);

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function getData(res) {
  return safeArr(res?.data?.data || res?.data);
}

function getId(value) {
  return value?._id || value || '';
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
        <h3>{title}</h3>
        <p>{message}</p>
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
    hospitalId:   getId(item?.hospitalId || item?.hospital),
    status:       item?.status || 'active',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: false }));
  }

  function validate() {
    const e = {};
    if (!form.supervisorId) e.supervisorId = true;
    if (!form.specialtyId)  e.specialtyId  = true;
    if (!form.hospitalId)   e.hospitalId   = true;
    return e;
  }

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    onSave({
      supervisorId: form.supervisorId,
      specialtyId:  form.specialtyId,
      hospitalId:   form.hospitalId,
      status:       form.status,
    });
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{isEdit ? 'Edit Supervisor Distribution' : 'Add Supervisor Distribution'}</div>
          <button className="admin-modal-close" onClick={onClose} aria-label="Close distribution form">x</button>
        </div>

        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>Supervisor *</label>
              <select
                className={errors.supervisorId ? 'invalid' : ''}
                value={form.supervisorId}
                onChange={e => set('supervisorId', e.target.value)}
              >
                <option value="">-- select supervisor --</option>
                {safeArr(supervisors).map(s => (
                  <option key={s._id} value={s._id}>{s.name}{s.specialty ? ` - ${s.specialty}` : ''}</option>
                ))}
              </select>
            </div>

            <div className="admin-field">
              <label>Specialty *</label>
              <select
                className={errors.specialtyId ? 'invalid' : ''}
                value={form.specialtyId}
                onChange={e => set('specialtyId', e.target.value)}
              >
                <option value="">-- select specialty --</option>
                {safeArr(specialties).map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>

            <div className="admin-field">
              <label>Hospital *</label>
              <select
                className={errors.hospitalId ? 'invalid' : ''}
                value={form.hospitalId}
                onChange={e => set('hospitalId', e.target.value)}
              >
                <option value="">-- select hospital --</option>
                {safeArr(hospitals).map(h => <option key={h._id} value={h._id}>{h.name}{h.city ? ` (${h.city})` : ''}</option>)}
              </select>
            </div>

            <div className="admin-field">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Supervisor Distribution'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DioDistributions() {
  const location = useLocation();

  const [items,       setItems      ] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [hospitals,   setHospitals  ] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [saving,      setSaving     ] = useState(false);
  const [search,      setSearch     ] = useState('');
  const [filterStatus,setFilterStatus] = useState('');
  const [filterHosp,  setFilterHosp ] = useState('');
  const [showModal,   setShowModal  ] = useState(false);
  const [editItem,    setEditItem   ] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [toasts,      setToasts     ] = useState([]);

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
      setItems(getData(dRes));
      setSupervisors(getData(sRes));
      setSpecialties(getData(spRes));
      setHospitals(getData(hRes));
    } catch (err) {
      console.error('Failed to load distributions:', err);
      showToast('Failed to load distributions', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('new') === '1') {
      setEditItem(null);
      setShowModal(true);
    }
  }, [location.search]);

  const filtered = safeArr(items).filter(d => {
    const supervisor = d?.supervisorId || d?.doctor || {};
    const hospital   = d?.hospitalId || d?.hospital || {};
    const specialty  = d?.specialtyId?.name || d?.specialty || '';
    const q = search.toLowerCase();
    const matchSearch = !q
      || supervisor?.name?.toLowerCase().includes(q)
      || hospital?.name?.toLowerCase().includes(q)
      || specialty.toLowerCase().includes(q);
    const matchStatus = !filterStatus || d?.status === filterStatus;
    const matchHosp   = !filterHosp || hospital?._id === filterHosp || hospital === filterHosp;
    return matchSearch && matchStatus && matchHosp;
  });

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (editItem) {
        const res = await api.put(`/api/distributions/${editItem._id}`, payload);
        const updated = res.data?.data || res.data;
        setItems(prev => safeArr(prev).map(d => d._id === editItem._id ? updated : d));
        showToast('Distribution updated');
      } else {
        const res = await api.post('/api/distributions', payload);
        const created = res.data?.data || res.data;
        setItems(prev => [created, ...safeArr(prev)]);
        showToast('Distribution created');
      }
      setShowModal(false);
      setEditItem(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(item) {
    try {
      const res = await api.delete(`/api/distributions/${item._id}`);
      const updated = res.data?.data || { ...item, status: 'inactive' };
      setItems(prev => safeArr(prev).map(d => d._id === item._id ? updated : d));
      showToast('Distribution deactivated');
    } catch (err) {
      showToast(err.response?.data?.message || 'Deactivate failed', 'error');
    } finally {
      setConfirmAction(null);
    }
  }

  async function handleReactivate(item) {
    try {
      const res = await api.patch(`/api/distributions/${item._id}/reactivate`);
      const updated = res.data?.data || { ...item, status: 'active' };
      setItems(prev => safeArr(prev).map(d => d._id === item._id ? updated : d));
      showToast('Distribution reactivated');
    } catch (err) {
      showToast(err.response?.data?.message || 'Reactivate failed', 'error');
    } finally {
      setConfirmAction(null);
    }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex:1 }} /><Sk w={130} h={36} r={8} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table"><tbody>
              {[...Array(8)].map((_,i) => (
                <tr key={i}>
                  {[20,150,120,120,80,120].map((w,j) => <td key={j}><Sk w={w} h={13} /></td>)}
                </tr>
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
      <main className="admin-main">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:'#1B1464' }}>Supervisor Distributions</div>
            <div style={{ fontSize:12, color:'#8B8FA8' }}>{items.length} supervisor–hospital assignment{items.length !== 1 ? 's' : ''}</div>
          </div>
          <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Supervisor Distribution</button>
        </div>

        <div className="admin-card">
          <div style={{ background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:10, padding:'10px 14px', margin:'0 0 12px', fontSize:13, color:'#1E40AF', lineHeight:1.5 }}>
            <strong>Supervisor Distributions</strong> record which supervisor is assigned to which hospital and specialty.
            For trainee movement between hospitals, use the <strong>Rotations</strong> page.
          </div>
          <div className="admin-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
            <input
              className="admin-search"
              style={{ flex:1, minWidth:200 }}
              placeholder="Search by supervisor, hospital, specialty..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className="admin-search" style={{ width:'auto', height:36 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select className="admin-search" style={{ width:'auto', height:36 }} value={filterHosp} onChange={e => setFilterHosp(e.target.value)}>
              <option value="">All Hospitals</option>
              {safeArr(hospitals).map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
            <span style={{ fontSize:13, color:'#8B8FA8' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Supervisor</th><th>Specialty</th><th>Hospital</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign:'center', padding:40 }}>
                      <div style={{ fontSize:15, fontWeight:600, color:'#4B5563' }}>
                        {items.length === 0 ? 'No distributions yet. Create the first one.' : 'No match for current filters.'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((d, i) => {
                  const supervisor = d?.supervisorId || d?.doctor || {};
                  const hospital   = d?.hospitalId || d?.hospital || {};
                  const specialty  = d?.specialtyId?.name || d?.specialty || '-';
                  const st = STATUS_STYLE[d?.status] || { bg:'#F3F4F6', color:'#374151' };
                  const isActive = d?.status === 'active';
                  return (
                    <tr key={d._id}>
                      <td style={{ color:'#8B8FA8' }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight:600 }}>{supervisor?.name || '-'}</div>
                        {supervisor?.email && <div style={{ fontSize:11, color:'#8B8FA8' }}>{supervisor.email}</div>}
                      </td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#EEEDFE', color:'#3C3489' }}>
                          {specialty}
                        </span>
                      </td>
                      <td style={{ fontSize:13 }}>{hospital?.name || '-'}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:st.bg, color:st.color }}>
                          {d?.status || '-'}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button
                            className="btn-action edit"
                            title="Edit supervisor distribution"
                            aria-label={`Edit distribution for ${supervisor?.name || 'supervisor'}`}
                            onClick={() => { setEditItem(d); setShowModal(true); }}
                          >
                            <IconPencil />
                          </button>
                          {isActive ? (
                            <button
                              className="btn-action delete"
                              title="Deactivate"
                              aria-label={`Deactivate distribution for ${supervisor?.name || 'supervisor'}`}
                              onClick={() => setConfirmAction({ type: 'deactivate', item: d })}
                            >
                              <IconBan />
                            </button>
                          ) : (
                            <button
                              className="btn-action reactivate"
                              title="Reactivate"
                              aria-label={`Reactivate distribution for ${supervisor?.name || 'supervisor'}`}
                              onClick={() => setConfirmAction({ type: 'reactivate', item: d })}
                            >
                              <IconUserCheck />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <DistModal
            item={editItem}
            supervisors={supervisors}
            specialties={specialties}
            hospitals={hospitals}
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditItem(null); }}
            saving={saving}
          />
        )}

        {confirmAction && (
          <ConfirmModal
            title={confirmAction.type === 'reactivate' ? 'Reactivate Distribution' : 'Deactivate Distribution'}
            message={`${confirmAction.type === 'reactivate' ? 'Reactivate' : 'Deactivate'} this supervisor distribution for ${(confirmAction.item?.supervisorId || confirmAction.item?.doctor)?.name || 'this supervisor'}?`}
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
