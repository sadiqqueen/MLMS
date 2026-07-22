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
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useMtToast, MtToastHost } from '../components/MtToast';
import MtModal from '../components/MtModal';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';
import { IconPencil, IconXCircle } from '../components/icons';
import { specialtyName } from '../utils/specialtyName';
import './dio.css';

const ROTATION_STATUSES = ['upcoming', 'current', 'completed', 'cancelled'];

// Status → mt- pill class (lists_views §status colours): upcoming=warn,
// current=ok, completed=neutral, cancelled=dng.
function statusPill(status) {
  return status === 'current' ? 'mt-pill--active'
    : status === 'upcoming' ? 'mt-pill--warn'
    : status === 'cancelled' ? 'mt-pill--rejected'
    : 'mt-pill--neutral';
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function traineeOf(r) { return r?.traineeId || r?.student || {}; }
function supervisorOf(r) { return r?.supervisorId || r?.doctor || {}; }
function hospitalOf(r) { return r?.hospitalId || r?.hospital || {}; }
function textValue(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.name || value.title || fallback;
  return fallback;
}
function specialtyOf(r) { return textValue(r?.specialtyId || r?.specialty); }
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'; }

// ── Confirm Modal ─────────────────────────────────────────────────────────
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
  const traineeOptions = trainees.map(t => ({ value: t._id, label: `${t.name}${t.studentId ? ` (${t.studentId})` : ''}` }));
  const hospitalOptions = hospitals.map(h => ({ value: h._id, label: `${h.name}${h.city ? ` (${h.city})` : ''}` }));
  const supervisorOptions = supervisors.map(s => ({ value: s._id, label: `${s.name}${textValue(s.specialty || s.specialtyId, '') ? ` - ${textValue(s.specialty || s.specialtyId)}` : ''}` }));
  const specialtyOptions = specialties.map(s => ({ value: s._id, label: specialtyName(s) }));

  return (
    <MtModal open title={isEdit ? 'Edit Rotation' : 'Add Rotation'} onClose={onClose}
      footer={(
        <>
          <button className="mt-btn--cancel" onClick={onClose}>Cancel</button>
          <button className="mt-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Rotation'}
          </button>
        </>
      )}>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">Trainee <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.traineeId} onChange={v => set('traineeId', v)}
            options={traineeOptions} placeholder="Search trainee…" error={errors.traineeId} />
        </div>
        <div className="mt-field">
          <label className="mt-label">Hospital <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.hospitalId} onChange={v => set('hospitalId', v)}
            options={hospitalOptions} placeholder="Search hospital…" error={errors.hospitalId} />
        </div>
        <div className="mt-field">
          <label className="mt-label">Supervisor (optional)</label>
          <SearchableSelect value={form.supervisorId} onChange={v => set('supervisorId', v)}
            options={supervisorOptions} placeholder="Search supervisor or leave empty…" />
        </div>
        <div className="mt-field">
          <label className="mt-label">Specialty (optional)</label>
          <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)}
            options={specialtyOptions} placeholder="Search specialty or leave empty…" />
        </div>
        <div className="mt-field">
          <label className="mt-label">Start Date <span className="mt-label-req">*</span></label>
          <input type="date" className="mt-input" style={{ borderColor: errors.startDate ? 'var(--danger)' : undefined }}
            value={form.startDate} onChange={e => set('startDate', e.target.value)} />
        </div>
        <div className="mt-field">
          <label className="mt-label">End Date <span className="mt-label-req">*</span></label>
          <input type="date" className="mt-input" style={{ borderColor: errors.endDate ? 'var(--danger)' : undefined }}
            value={form.endDate} onChange={e => set('endDate', e.target.value)} />
          {errors.endDate && <span style={{ color:'var(--danger)', fontSize:11 }}>End date must be after start date</span>}
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Status</label>
          <select className="mt-select" value={form.status} onChange={e => set('status', e.target.value)}>
            {ROTATION_STATUSES.map(s => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
        </div>
      </div>
    </MtModal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export function RotationsPanel({ autoOpenNew = false }) {
  const [rotations,   setRotations  ] = useState([]);
  const [trainees,    setTrainees   ] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [hospitals,   setHospitals  ] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [saving,      setSaving     ] = useState(false);
  const [search,      setSearch     ] = useState('');
  const [filterStatus,setFilterStatus] = useState('');
  const [view,        setView       ] = useState('list');
  const [showModal,   setShowModal  ] = useState(false);
  const [editItem,    setEditItem   ] = useState(null);
  const [confirmDel,  setConfirmDel ] = useState(null);
  const { toasts, showToast } = useMtToast();

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
    } catch { showToast('Failed to load rotations', 'dng'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (autoOpenNew) { setEditItem(null); setShowModal(true); }
  }, [autoOpenNew]);

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
        showToast('Rotation updated', 'ok');
      } else {
        const res = await api.post('/api/rotations', payload);
        setRotations(prev => [res.data?.data || res.data, ...prev]);
        showToast('Rotation created', 'ok');
      }
      setShowModal(false);
      setEditItem(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'dng');
    } finally { setSaving(false); }
  }

  async function handleCancel() {
    try {
      const res = await api.delete(`/api/rotations/${confirmDel._id}`);
      const updated = res.data?.data || { ...confirmDel, status: 'cancelled' };
      setRotations(prev => prev.map(r => r._id === confirmDel._id ? updated : r));
      showToast('Rotation cancelled', 'ok');
    } catch (err) { showToast(err.response?.data?.message || 'Cancel failed', 'dng'); }
    finally { setConfirmDel(null); }
  }

  if (loading) return (
    <div className="mt-card">
      <div className="mt-filterbar"><Sk h={38} r={8} style={{ flex:1 }} /><Sk w={130} h={38} r={9} /></div>
      {[...Array(8)].map((_,i) => <Sk key={i} h={40} r={8} style={{ marginBottom:8 }} />)}
    </div>
  );

  return (
    <>
      {/* Status filter tabs */}
      <div className="dio-tabs">
        {[['', 'All'], ...ROTATION_STATUSES.map(s => [s, cap(s)])].map(([val, label]) => {
          const count = val ? rotations.filter(r => r.status === val).length : rotations.length;
          return (
            <button key={val} className={`dio-tab${filterStatus === val ? ' is-active' : ''}`}
              onClick={() => setFilterStatus(val)}>
              {label}<span className="dio-tab-badge">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-card">
        <div className="mt-filterbar">
          <div className="mt-search">
            <input placeholder="Search by trainee, supervisor, hospital, specialty…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="mt-filterbar-spacer" />
          <ViewToggle value={view} onChange={setView} />
          <span className="mt-count">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          <button className="mt-btn mt-btn--small" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Rotation</button>
        </div>

        {view === 'list' && <div className="mt-table-wrap">
          <table className="mt-table mt-table--stack">
            <thead>
              <tr>
                <th className="mt-th">#</th><th className="mt-th">Trainee</th><th className="mt-th">Hospital</th>
                <th className="mt-th">Supervisor</th><th className="mt-th">Specialty</th><th className="mt-th">Start</th>
                <th className="mt-th">End</th><th className="mt-th">Status</th><th className="mt-th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td className="mt-td mt-td--muted" colSpan={9} style={{ textAlign:'center', padding:32 }}>
                    {rotations.length === 0 ? 'No rotations yet. Create the first one.' : 'No match.'}
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => {
                const trainee    = traineeOf(r);
                const supervisor = supervisorOf(r);
                const hospital   = hospitalOf(r);
                const specialty  = specialtyOf(r);
                const canCancel  = r.status !== 'completed' && r.status !== 'cancelled';
                return (
                  <tr key={r._id}>
                    <td className="mt-td mt-td--muted">{i+1}</td>
                    <td className="mt-td mt-td--name" data-label="Trainee">
                      <div>{trainee?.name || '—'}</div>
                      {trainee?.studentId && <div className="mt-acct-id">{trainee.studentId}</div>}
                    </td>
                    <td className="mt-td mt-td--muted" data-label="Hospital">{hospital?.name || '—'}</td>
                    <td className="mt-td mt-td--muted" data-label="Supervisor">{supervisor?.name || '—'}</td>
                    <td className="mt-td" data-label="Specialty">
                      {specialty !== '-'
                        ? <span className="mt-pill mt-pill--neutral">{specialty}</span>
                        : <span className="mt-td--muted">—</span>}
                    </td>
                    <td className="mt-td mt-td--mono" data-label="Start">{fmtDate(r.startDate)}</td>
                    <td className="mt-td mt-td--mono" data-label="End">{fmtDate(r.endDate)}</td>
                    <td className="mt-td" data-label="Status">
                      <span className={`mt-pill ${statusPill(r.status)}`}>{cap(r.status)}</span>
                    </td>
                    <td className="mt-td mt-td--actions" data-label="Actions">
                      <div className="mt-row-actions">
                        <button className="mt-icon-action" title="Edit rotation"
                          aria-label={`Edit rotation for ${trainee?.name || 'trainee'}`}
                          onClick={() => { setEditItem(r); setShowModal(true); }}><IconPencil size={15} /></button>
                        {canCancel && (
                          <button className="mt-icon-action mt-icon-action--danger" title="Cancel rotation"
                            aria-label={`Cancel rotation for ${trainee?.name || 'trainee'}`}
                            onClick={() => setConfirmDel(r)}><IconXCircle size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}

        {view === 'card' && (
          <div className="mt-acct-grid">
            {filtered.length === 0 && <div className="mt-empty" style={{ gridColumn:'1/-1' }}><div className="mt-empty-sub">{rotations.length === 0 ? 'No rotations yet. Create the first one.' : 'No match.'}</div></div>}
            {filtered.map(r => {
              const trainee = traineeOf(r);
              const supervisor = supervisorOf(r);
              const hospital = hospitalOf(r);
              const specialty = specialtyOf(r);
              const canCancel = r.status !== 'completed' && r.status !== 'cancelled';
              return (
                <div className="mt-card" key={r._id} style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{trainee?.name || '-'}</div>
                  <div className="mt-card-sub">{hospital?.name || '-'} · {fmtDate(r.startDate)} to {fmtDate(r.endDate)}</div>
                  <div className="mt-card-sub">Supervisor: {supervisor?.name || '-'}</div>
                  <div className="dio-chip-row">
                    {specialty !== '-' && <span className="mt-pill mt-pill--neutral">{specialty}</span>}
                    <span className={`mt-pill ${statusPill(r.status)}`}>{cap(r.status)}</span>
                  </div>
                  <div className="mt-row-actions" style={{ justifyContent:'flex-start' }}>
                    <button className="mt-icon-action" title="Edit rotation" aria-label={`Edit rotation for ${trainee?.name || 'trainee'}`} onClick={() => { setEditItem(r); setShowModal(true); }}><IconPencil size={15} /></button>
                    {canCancel && <button className="mt-icon-action mt-icon-action--danger" title="Cancel rotation" aria-label={`Cancel rotation for ${trainee?.name || 'trainee'}`} onClick={() => setConfirmDel(r)}><IconXCircle size={15} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      <MtToastHost toasts={toasts} />
    </>
  );
}

export default function DioRotations() {
  const location = useLocation();
  const autoOpenNew = new URLSearchParams(location.search).get('new') === '1';
  return (
    <>
      <Navbar />
      <main className="mt-content">
        <RotationsPanel autoOpenNew={autoOpenNew} />
      </main>
    </>
  );
}
