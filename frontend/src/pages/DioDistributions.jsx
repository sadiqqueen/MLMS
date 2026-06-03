/**
 * DioDistributions.jsx
 * Full CRUD distribution management for DIO.
 *
 * Backend endpoints used:
 *   GET    /api/distributions?status=&hospital=&specialty=
 *   POST   /api/distributions  { traineeId, supervisorId, specialtyId, hospitalId, startDate, endDate, status }
 *   PUT    /api/distributions/:id  { supervisorId, specialtyId, hospitalId, startDate, endDate, status }
 *   DELETE /api/distributions/:id  (soft-cancels to status:'cancelled')
 */
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const STATUS_OPTS = ['upcoming', 'active', 'completed', 'cancelled'];

const STATUS_STYLE = {
  upcoming:  { bg:'#EFF6FF', color:'#1D4ED8' },
  active:    { bg:'#D1FAE5', color:'#065F46' },
  completed: { bg:'#E8E9EF', color:'#374151' },
  cancelled: { bg:'#FEE2E2', color:'#991B1B' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

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

// ── Distribution Form Modal ───────────────────────────────────────────────
function DistModal({ item, trainees, supervisors, specialties, hospitals, onSave, onClose, saving }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    traineeId:   item?.traineeId?._id || item?.traineeId || item?.student?._id || item?.student || '',
    supervisorId:item?.supervisorId?._id || item?.supervisorId || item?.doctor?._id || item?.doctor || '',
    specialtyId: item?.specialtyId?._id || item?.specialtyId || '',
    hospitalId:  item?.hospitalId?._id  || item?.hospitalId  || item?.hospital?._id || item?.hospital || '',
    startDate:   item?.startDate ? item.startDate.slice(0,10) : '',
    endDate:     item?.endDate   ? item.endDate.slice(0,10)   : '',
    status:      item?.status    || 'active',
    durationWeeks: item?.durationWeeks || '',
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
    if (!isEdit && !form.traineeId)    e.traineeId   = true;
    if (!form.supervisorId) e.supervisorId = true;
    if (!form.specialtyId)  e.specialtyId  = true;
    if (!form.hospitalId)   e.hospitalId   = true;
    if (form.startDate && form.endDate && form.endDate <= form.startDate) e.endDate = true;
    return e;
  }

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const payload = {
      supervisorId:  form.supervisorId,
      specialtyId:   form.specialtyId,
      hospitalId:    form.hospitalId,
      startDate:     form.startDate || undefined,
      endDate:       form.endDate   || undefined,
      status:        form.status,
      durationWeeks: form.durationWeeks ? Number(form.durationWeeks) : undefined,
    };
    if (!isEdit) payload.traineeId = form.traineeId;
    onSave(payload);
  }

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{isEdit ? 'Edit Distribution' : 'Add Distribution'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">

            {!isEdit && (
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
            )}

            <div className="admin-field full">
              <label>Supervisor *</label>
              <select className={errors.supervisorId ? 'invalid' : ''} value={form.supervisorId}
                onChange={e => set('supervisorId', e.target.value)}>
                <option value="">— select supervisor —</option>
                {supervisors.map(s => (
                  <option key={s._id} value={s._id}>{s.name}{s.specialty ? ` — ${s.specialty}` : ''}</option>
                ))}
              </select>
            </div>

            <div className="admin-field">
              <label>Specialty *</label>
              <select className={errors.specialtyId ? 'invalid' : ''} value={form.specialtyId}
                onChange={e => set('specialtyId', e.target.value)}>
                <option value="">— select specialty —</option>
                {specialties.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
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
              <label>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>

            <div className="admin-field">
              <label>End Date</label>
              <input type="date" className={errors.endDate ? 'invalid' : ''} value={form.endDate}
                onChange={e => set('endDate', e.target.value)} />
              {errors.endDate && <span style={{ color:'#DC2626', fontSize:11 }}>End date must be after start date</span>}
            </div>

            <div className="admin-field">
              <label>Duration (weeks)</label>
              <input type="number" min="1" value={form.durationWeeks}
                onChange={e => set('durationWeeks', e.target.value)} placeholder="e.g. 12" />
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
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Distribution'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function DioDistributions() {
  const location = useLocation();

  const [items,       setItems      ] = useState([]);
  const [trainees,    setTrainees   ] = useState([]);
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
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [toasts,      setToasts     ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, tRes, sRes, spRes, hRes] = await Promise.all([
        api.get('/api/distributions'),
        api.get('/api/dio/trainees'),
        api.get('/api/users/supervisors'),
        api.get('/api/specialties'),
        api.get('/api/hospitals'),
      ]);
      setItems(Array.isArray(dRes.data) ? dRes.data : (dRes.data?.data || []));
      setTrainees(tRes.data?.data || tRes.data || []);
      setSupervisors(sRes.data?.data || sRes.data || []);
      setSpecialties(spRes.data?.data || spRes.data || []);
      setHospitals(hRes.data?.data || hRes.data || []);
    } catch { showToast('Failed to load distributions', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-open add form if navigated with ?new=1
  useEffect(() => {
    if (new URLSearchParams(location.search).get('new') === '1') {
      setEditItem(null);
      setShowModal(true);
    }
  }, [location.search]);

  const filtered = items.filter(d => {
    const trainee    = d.traineeId  || d.student   || {};
    const supervisor = d.supervisorId || d.doctor  || {};
    const hospital   = d.hospitalId || d.hospital  || {};
    const specialty  = d.specialtyId?.name || d.specialty || '';
    const q = search.toLowerCase();
    const matchSearch = !q
      || trainee?.name?.toLowerCase().includes(q)
      || supervisor?.name?.toLowerCase().includes(q)
      || hospital?.name?.toLowerCase().includes(q)
      || specialty.toLowerCase().includes(q);
    const matchStatus = !filterStatus || d.status === filterStatus;
    const matchHosp   = !filterHosp   || (hospital?._id === filterHosp || hospital === filterHosp);
    return matchSearch && matchStatus && matchHosp;
  });

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (editItem) {
        const res = await api.put(`/api/distributions/${editItem._id}`, payload);
        const updated = res.data?.data || res.data;
        setItems(prev => prev.map(d => d._id === editItem._id ? updated : d));
        showToast('Distribution updated');
      } else {
        const res = await api.post('/api/distributions', payload);
        const created = res.data?.data || res.data;
        setItems(prev => [created, ...prev]);
        showToast('Distribution created');
      }
      setShowModal(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally { setSaving(false); }
  }

  async function handleCancel() {
    try {
      await api.delete(`/api/distributions/${confirmCancel._id}`);
      setItems(prev => prev.map(d =>
        d._id === confirmCancel._id ? { ...d, status: 'cancelled' } : d
      ));
      showToast('Distribution cancelled');
    } catch (err) { showToast(err.response?.data?.message || 'Cancel failed', 'error'); }
    finally { setConfirmCancel(null); }
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
                  {[20,140,100,90,80,80,70,80].map((w,j) => <td key={j}><Sk w={w} h={13} /></td>)}
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
            <div style={{ fontSize:20, fontWeight:700, color:'#1B1464' }}>Distributions</div>
            <div style={{ fontSize:12, color:'#8B8FA8' }}>{items.length} total</div>
          </div>
          <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Distribution</button>
        </div>

        <div className="admin-card">
          {/* Toolbar */}
          <div className="admin-toolbar" style={{ flexWrap:'wrap', gap:8 }}>
            <input className="admin-search" style={{ flex:1, minWidth:200 }}
              placeholder="Search by trainee, supervisor, hospital, specialty…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <select className="admin-search" style={{ width:'auto', height:36 }}
              value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <select className="admin-search" style={{ width:'auto', height:36 }}
              value={filterHosp} onChange={e => setFilterHosp(e.target.value)}>
              <option value="">All Hospitals</option>
              {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
            <span style={{ fontSize:13, color:'#8B8FA8' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Trainee</th><th>Supervisor</th><th>Specialty</th><th>Hospital</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign:'center', padding:40 }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                      <div style={{ fontSize:15, fontWeight:600, color:'#4B5563' }}>
                        {items.length === 0 ? 'No distributions yet. Create the first one.' : 'No match for current filters.'}
                      </div>
                    </td>
                  </tr>
                )}
                {filtered.map((d, i) => {
                  const trainee    = d.traineeId  || d.student   || {};
                  const supervisor = d.supervisorId || d.doctor  || {};
                  const hospital   = d.hospitalId || d.hospital  || {};
                  const specialty  = d.specialtyId?.name || d.specialty || '—';
                  const st = STATUS_STYLE[d.status] || { bg:'#F3F4F6', color:'#374151' };
                  const canCancel  = d.status !== 'cancelled' && d.status !== 'completed';
                  return (
                    <tr key={d._id}>
                      <td style={{ color:'#8B8FA8' }}>{i+1}</td>
                      <td>
                        <div style={{ fontWeight:600 }}>{trainee?.name || '—'}</div>
                        {trainee?.studentId && <div style={{ fontSize:11, color:'#8B8FA8' }}>{trainee.studentId}</div>}
                      </td>
                      <td style={{ fontSize:13 }}>{supervisor?.name || '—'}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:20, background:'#EEEDFE', color:'#3C3489' }}>
                          {specialty}
                        </span>
                      </td>
                      <td style={{ fontSize:13 }}>{hospital?.name || '—'}</td>
                      <td style={{ fontSize:13 }}>{fmtDate(d.startDate)}</td>
                      <td style={{ fontSize:13 }}>{fmtDate(d.endDate)}</td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, background:st.bg, color:st.color }}>
                          {d.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:5 }}>
                          <button className="btn-action edit"
                            onClick={() => { setEditItem(d); setShowModal(true); }}>Edit</button>
                          {canCancel && (
                            <button className="btn-action delete"
                              onClick={() => setConfirmCancel(d)}>Cancel</button>
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
            trainees={trainees}
            supervisors={supervisors}
            specialties={specialties}
            hospitals={hospitals}
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditItem(null); }}
            saving={saving}
          />
        )}

        {confirmCancel && (
          <ConfirmModal
            title="Cancel Distribution"
            message={`Cancel this distribution for ${(confirmCancel.traineeId || confirmCancel.student)?.name || 'this trainee'}? Status will change to "cancelled".`}
            confirmLabel="Cancel Distribution"
            onConfirm={handleCancel}
            onCancel={() => setConfirmCancel(null)}
          />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
