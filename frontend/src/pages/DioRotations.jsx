/**
 * DioRotations.jsx
 * Trainee rotation management for DIO.
 * Rotation = where a trainee trains over a time period.
 *
 * Backend endpoints:
 *   GET  /api/rotations                       — list all
 *   POST /api/rotations                       — create { traineeId, hospitalId, supervisorId?, specialtyId?, startDate, endDate, status? }
 *   PUT  /api/rotations/:id                   — update
 *   DELETE /api/rotations/:id                 — soft-cancel to status:'cancelled'
 */
import { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const ROTATION_STATUSES = ['upcoming', 'current', 'completed', 'cancelled'];

const STATUS_STYLE = {
  upcoming:  { bg:'#EFF6FF', color:'#1D4ED8' },
  current:   { bg:'#D1FAE5', color:'#065F46' },
  completed: { bg:'#E8E9EF', color:'#374151' },
  cancelled: { bg:'#FEE2E2', color:'#991B1B' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function traineeOf(r) { return r?.traineeId || r?.student || {}; }
function supervisorOf(r) { return r?.supervisorId || r?.doctor || {}; }
function hospitalOf(r) { return r?.hospitalId || r?.hospital || {}; }
function specialtyOf(r) { return r?.specialtyId?.name || r?.specialty || '—'; }

// ── Inline SVG icons ──────────────────────────────────────────────────────
const IconPencil = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconXCircle = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
  </svg>
);

// ── Confirm Modal ─────────────────────────────────────────────────────────
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

// ── Rotation Form Modal ───────────────────────────────────────────────────
function RotationModal({ item, trainees, supervisors, hospitals, specialties, onSave, onClose, saving }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    traineeId:   item?.traineeId?._id  || item?.student?._id   || item?.traineeId   || item?.student   || '',
    hospitalId:  item?.hospitalId?._id || item?.hospital?._id  || item?.hospitalId  || item?.hospital  || '',
    supervisorId:item?.supervisorId?._id || item?.doctor?._id  || item?.supervisorId || item?.doctor    || '',
    specialtyId: item?.specialtyId?._id || item?.specialtyId   || '',
    startDate:   item?.startDate ? item.startDate.slice(0,10) : '',
    endDate:     item?.endDate   ? item.endDate.slice(0,10)   : '',
    status:      item?.status    || 'upcoming',
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
    if (!form.traineeId)  e.traineeId  = true;
    if (!form.hospitalId) e.hospitalId = true;
    if (!form.startDate)  e.startDate  = true;
    if (!form.endDate)    e.endDate    = true;
    if (form.startDate && form.endDate && form.endDate <= form.startDate) e.endDate = true;
    return e;
  }

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({
      traineeId:   form.traineeId,
      hospitalId:  form.hospitalId,
      supervisorId:form.supervisorId || undefined,
      specialtyId: form.specialtyId  || undefined,
      startDate:   form.startDate,
      endDate:     form.endDate,
      status:      form.status,
    });
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{isEdit ? 'Edit Rotation' : 'Add Rotation'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div style={{ background:'#F0FDF4', border:'1px solid #BBF7D0', borderRadius:8, padding:'9px 13px', marginBottom:14, fontSize:12, color:'#065F46' }}>
            Status is auto-set from dates if not changed: past → completed, today → current, future → upcoming.
          </div>
          <div className="admin-form-grid">

            <div className="admin-field full">
              <label>Trainee *</label>
              <select className={errors.traineeId ? 'invalid' : ''} value={form.traineeId}
                onChange={e => set('traineeId', e.target.value)}>
                <option value="">— select trainee —</option>
                {trainees.map(t => (
                  <option key={t._id} value={t._id}>{t.name}{t.studentId ? ` (${t.studentId})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="admin-field">
              <label>Hospital *</label>
              <select className={errors.hospitalId ? 'invalid' : ''} value={form.hospitalId}
                onChange={e => set('hospitalId', e.target.value)}>
                <option value="">— select hospital —</option>
                {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}{h.city ? ` (${h.city})` : ''}</option>)}
              </select>
            </div>

            <div className="admin-field">
              <label>Supervisor (optional)</label>
              <select value={form.supervisorId} onChange={e => set('supervisorId', e.target.value)}>
                <option value="">— none —</option>
                {supervisors.map(s => (
                  <option key={s._id} value={s._id}>{s.name}{s.specialty ? ` — ${s.specialty}` : ''}</option>
                ))}
              </select>
            </div>

            <div className="admin-field">
              <label>Specialty (optional)</label>
              <select value={form.specialtyId} onChange={e => set('specialtyId', e.target.value)}>
                <option value="">— none —</option>
                {specialties.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>

            <div className="admin-field">
              <label>Start Date *</label>
              <input type="date" className={errors.startDate ? 'invalid' : ''} value={form.startDate}
                onChange={e => set('startDate', e.target.value)} />
            </div>

            <div className="admin-field">
              <label>End Date *</label>
              <input type="date" className={errors.endDate ? 'invalid' : ''} value={form.endDate}
                onChange={e => set('endDate', e.target.value)} />
              {errors.endDate && <span style={{ color:'#DC2626', fontSize:11 }}>End date must be after start date</span>}
            </div>

            <div className="admin-field full">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {ROTATION_STATUSES.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Rotation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function DioRotations() {
  const [rotations,   setRotations  ] = useState([]);
  const [trainees,    setTrainees   ] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [hospitals,   setHospitals  ] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [saving,      setSaving     ] = useState(false);
  const [search,      setSearch     ] = useState('');
  const [filterStatus,setFilterStatus] = useState('');
  const [showModal,   setShowModal  ] = useState(false);
  const [editItem,    setEditItem   ] = useState(null);
  const [confirmDel,  setConfirmDel ] = useState(null);
  const [toasts,      setToasts     ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, tRes, sRes, hRes, spRes] = await Promise.all([
        api.get('/api/rotations'),
        api.get('/api/dio/trainees'),
        api.get('/api/users/supervisors'),
        api.get('/api/hospitals'),
        api.get('/api/specialties'),
      ]);
      setRotations(Array.isArray(rRes.data) ? rRes.data : (rRes.data?.data || []));
      setTrainees(tRes.data?.data || tRes.data || []);
      setSupervisors(sRes.data?.data || sRes.data || []);
      setHospitals(hRes.data?.data || hRes.data || []);
      setSpecialties(spRes.data?.data || spRes.data || []);
    } catch { showToast('Failed to load rotations', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rotations.filter(r => {
    const trainee    = traineeOf(r);
    const supervisor = supervisorOf(r);
    const hospital   = hospitalOf(r);
    const q = search.toLowerCase();
    const matchSearch = !q
      || trainee?.name?.toLowerCase().includes(q)
      || supervisor?.name?.toLowerCase().includes(q)
      || hospital?.name?.toLowerCase().includes(q)
      || specialtyOf(r).toLowerCase().includes(q);
    const matchStatus = !filterStatus || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (editItem) {
        const res = await api.put(`/api/rotations/${editItem._id}`, payload);
        setRotations(prev => prev.map(r => r._id === editItem._id ? (res.data?.data || res.data) : r));
        showToast('Rotation updated');
      } else {
        const res = await api.post('/api/rotations', payload);
        setRotations(prev => [res.data?.data || res.data, ...prev]);
        showToast('Rotation created');
      }
      setShowModal(false);
      setEditItem(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally { setSaving(false); }
  }

  async function handleCancel() {
    try {
      const res = await api.delete(`/api/rotations/${confirmDel._id}`);
      const updated = res.data?.data || { ...confirmDel, status: 'cancelled' };
      setRotations(prev => prev.map(r => r._id === confirmDel._id ? updated : r));
      showToast('Rotation cancelled');
    } catch (err) { showToast(err.response?.data?.message || 'Cancel failed', 'error'); }
    finally { setConfirmDel(null); }
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
                  {[20,140,110,110,100,80,80,70,80].map((w,j) => <td key={j}><Sk w={w} h={13} /></td>)}
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
            <div style={{ fontSize:20, fontWeight:700, color:'#1B1464' }}>Trainee Rotations</div>
            <div style={{ fontSize:12, color:'#8B8FA8' }}>{rotations.length} total · trainee hospital placements over time</div>
          </div>
          <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Rotation</button>
        </div>

        {/* Status filter pills */}
        <div className="filter-tabs" style={{ marginBottom:14 }}>
          {[['', 'All'], ...ROTATION_STATUSES.map(s => [s, s.charAt(0).toUpperCase() + s.slice(1)])].map(([val, label]) => {
            const count = val ? rotations.filter(r => r.status === val).length : rotations.length;
            return (
              <button key={val} className={`filter-tab${filterStatus === val ? ' active' : ''}`}
                onClick={() => setFilterStatus(val)}>
                {label} ({count})
              </button>
            );
          })}
        </div>

        <div className="admin-card">
          <div className="admin-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
            <input className="admin-search" style={{ flex:1, minWidth:200 }}
              placeholder="Search by trainee, supervisor, hospital, specialty…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <span style={{ fontSize:13, color:'#8B8FA8' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Trainee</th><th>Hospital</th><th>Supervisor</th><th>Specialty</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign:'center', padding:40 }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>📅</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'#4B5563' }}>
                        {rotations.length === 0 ? 'No rotations yet. Create the first one.' : 'No match.'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((r, i) => {
                  const trainee    = traineeOf(r);
                  const supervisor = supervisorOf(r);
                  const hospital   = hospitalOf(r);
                  const specialty  = specialtyOf(r);
                  const st = STATUS_STYLE[r.status] || { bg:'#F3F4F6', color:'#374151' };
                  const canCancel  = r.status !== 'completed' && r.status !== 'cancelled';
                  return (
                    <tr key={r._id}>
                      <td style={{ color:'#8B8FA8' }}>{i+1}</td>
                      <td>
                        <div style={{ fontWeight:600 }}>{trainee?.name || '—'}</div>
                        {trainee?.studentId && <div style={{ fontSize:11, color:'#8B8FA8' }}>{trainee.studentId}</div>}
                      </td>
                      <td style={{ fontSize:13 }}>{hospital?.name || '—'}</td>
                      <td style={{ fontSize:13 }}>{supervisor?.name || '—'}</td>
                      <td>
                        {specialty !== '—'
                          ? <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#EEEDFE', color:'#3C3489' }}>{specialty}</span>
                          : <span style={{ color:'#B8BBC8' }}>—</span>
                        }
                      </td>
                      <td style={{ fontSize:13 }}>{fmtDate(r.startDate)}</td>
                      <td style={{ fontSize:13 }}>{fmtDate(r.endDate)}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:st.bg, color:st.color }}>
                          {r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : '—'}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action edit"
                            title="Edit rotation"
                            aria-label={`Edit rotation for ${trainee?.name || 'trainee'}`}
                            onClick={() => { setEditItem(r); setShowModal(true); }}>
                            <IconPencil />
                          </button>
                          {canCancel && (
                            <button className="btn-action delete"
                              title="Cancel rotation"
                              aria-label={`Cancel rotation for ${trainee?.name || 'trainee'}`}
                              onClick={() => setConfirmDel(r)}>
                              <IconXCircle />
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
          <RotationModal
            item={editItem}
            trainees={trainees}
            supervisors={supervisors}
            hospitals={hospitals}
            specialties={specialties}
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditItem(null); }}
            saving={saving}
          />
        )}

        {confirmDel && (
          <ConfirmModal
            title="Cancel Rotation"
            message={`Cancel the rotation for ${traineeOf(confirmDel)?.name || 'this trainee'} at ${hospitalOf(confirmDel)?.name || 'the hospital'}? Status will change to "cancelled".`}
            confirmLabel="Cancel Rotation"
            onConfirm={handleCancel}
            onCancel={() => setConfirmDel(null)}
          />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
