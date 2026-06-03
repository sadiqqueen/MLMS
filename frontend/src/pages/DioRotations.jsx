/**
 * DioRotations.jsx
 * Full CRUD rotation management for DIO.
 *
 * Backend endpoints used:
 *   GET    /api/rotations
 *   POST   /api/rotations  { student, hospital, doctor, startDate, endDate, status }
 *   PUT    /api/rotations/:id
 *   DELETE /api/rotations/:id  (cancels if linked records; hard-deletes if no links)
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

function RotationModal({ item, trainees, supervisors, hospitals, onSave, onClose, saving }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    student:   item?.student?._id   || item?.student   || '',
    hospital:  item?.hospital?._id  || item?.hospital  || '',
    doctor:    item?.doctor?._id    || item?.doctor    || '',
    startDate: item?.startDate ? item.startDate.slice(0,10) : '',
    endDate:   item?.endDate   ? item.endDate.slice(0,10)   : '',
    status:    item?.status    || 'upcoming',
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
    if (!form.student)    e.student   = true;
    if (!form.hospital)   e.hospital  = true;
    if (!form.startDate)  e.startDate = true;
    if (!form.endDate)    e.endDate   = true;
    if (form.startDate && form.endDate && form.endDate <= form.startDate) e.endDate = true;
    return e;
  }

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({
      student:   form.student,
      hospital:  form.hospital,
      doctor:    form.doctor  || undefined,
      startDate: form.startDate,
      endDate:   form.endDate,
      status:    form.status,
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
          <div className="admin-form-grid">

            <div className="admin-field full">
              <label>Trainee *</label>
              <select className={errors.student ? 'invalid' : ''} value={form.student}
                onChange={e => set('student', e.target.value)}>
                <option value="">— select trainee —</option>
                {trainees.map(t => (
                  <option key={t._id} value={t._id}>{t.name}{t.studentId ? ` (${t.studentId})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="admin-field full">
              <label>Hospital *</label>
              <select className={errors.hospital ? 'invalid' : ''} value={form.hospital}
                onChange={e => set('hospital', e.target.value)}>
                <option value="">— select hospital —</option>
                {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}{h.city ? ` (${h.city})` : ''}</option>)}
              </select>
            </div>

            <div className="admin-field full">
              <label>Supervisor (Doctor)</label>
              <select value={form.doctor} onChange={e => set('doctor', e.target.value)}>
                <option value="">— none / optional —</option>
                {supervisors.map(s => (
                  <option key={s._id} value={s._id}>{s.name}{s.specialty ? ` — ${s.specialty}` : ''}</option>
                ))}
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

export default function DioRotations() {
  const [rotations,   setRotations  ] = useState([]);
  const [trainees,    setTrainees   ] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [hospitals,   setHospitals  ] = useState([]);
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
      const [rRes, tRes, sRes, hRes] = await Promise.all([
        api.get('/api/rotations'),
        api.get('/api/dio/trainees'),
        api.get('/api/users/supervisors'),
        api.get('/api/hospitals'),
      ]);
      setRotations(Array.isArray(rRes.data) ? rRes.data : (rRes.data?.data || []));
      setTrainees(tRes.data?.data || tRes.data || []);
      setSupervisors(sRes.data?.data || sRes.data || []);
      setHospitals(hRes.data?.data || hRes.data || []);
    } catch { showToast('Failed to load rotations', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rotations.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || r.student?.name?.toLowerCase().includes(q)
      || r.doctor?.name?.toLowerCase().includes(q)
      || r.hospital?.name?.toLowerCase().includes(q);
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
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally { setSaving(false); }
  }

  async function handleCancel() {
    try {
      const res = await api.delete(`/api/rotations/${confirmDel._id}`);
      const message = res.data?.message || '';
      const cancelled = message.toLowerCase().includes('cancel');
      if (cancelled) {
        setRotations(prev => prev.map(r => r._id === confirmDel._id ? { ...r, status:'cancelled' } : r));
        showToast('Rotation cancelled');
      } else {
        setRotations(prev => prev.filter(r => r._id !== confirmDel._id));
        showToast('Rotation removed');
      }
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
                  {[20,140,110,110,80,80,70,80].map((w,j) => <td key={j}><Sk w={w} h={13} /></td>)}
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
            <div style={{ fontSize:20, fontWeight:700, color:'#1B1464' }}>Rotations</div>
            <div style={{ fontSize:12, color:'#8B8FA8' }}>{rotations.length} total</div>
          </div>
          <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Rotation</button>
        </div>

        <div className="admin-card">
          <div className="admin-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
            <input className="admin-search" style={{ flex:1, minWidth:200 }}
              placeholder="Search by trainee, supervisor, hospital…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="admin-search" style={{ width:'auto', height:36 }}
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {ROTATION_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <span style={{ fontSize:13, color:'#8B8FA8' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Trainee</th><th>Supervisor</th><th>Hospital</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign:'center', padding:40 }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>📅</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'#4B5563' }}>
                        {rotations.length === 0 ? 'No rotations yet. Create the first one.' : 'No match.'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((r, i) => {
                  const st = STATUS_STYLE[r.status] || { bg:'#F3F4F6', color:'#374151' };
                  const canDelete = r.status !== 'completed';
                  return (
                    <tr key={r._id}>
                      <td style={{ color:'#8B8FA8' }}>{i+1}</td>
                      <td>
                        <div style={{ fontWeight:600 }}>{r.student?.name || '—'}</div>
                        {r.student?.studentId && <div style={{ fontSize:11, color:'#8B8FA8' }}>{r.student.studentId}</div>}
                      </td>
                      <td style={{ fontSize:13 }}>{r.doctor?.name || '—'}</td>
                      <td style={{ fontSize:13 }}>{r.hospital?.name || '—'}</td>
                      <td style={{ fontSize:13 }}>{fmtDate(r.startDate)}</td>
                      <td style={{ fontSize:13 }}>{fmtDate(r.endDate)}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:st.bg, color:st.color }}>
                          {r.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:5 }}>
                          <button className="btn-action edit"
                            onClick={() => { setEditItem(r); setShowModal(true); }}>Edit</button>
                          {canDelete && (
                          <button className="btn-action delete"
                              onClick={() => setConfirmDel(r)}>Cancel</button>
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
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditItem(null); }}
            saving={saving}
          />
        )}

        {confirmDel && (
          <ConfirmModal
            title="Cancel Rotation"
            message={`Cancel rotation for ${confirmDel.student?.name || 'this trainee'}? If no reports or evaluations are linked, the unused draft record may be removed.`}
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
