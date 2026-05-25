import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const API_BASE = '';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);
const IconDelete = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

function ConfirmDelete({ name, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>Confirm Delete</h3>
        <p>Are you sure you want to delete <strong>{name}</strong>? This cannot be undone.</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function TraineeModal({ editTrainee, onSave, onClose, saving }) {
  const empty = { name: '', email: '', password: '', phone: '', gender: '', city: '', year: '', studentId: '' };
  const [form, setForm] = useState(editTrainee ? {
    name:      editTrainee.name      || '',
    email:     editTrainee.email     || '',
    phone:     editTrainee.phone     || '',
    gender:    editTrainee.gender    || '',
    city:      editTrainee.city      || '',
    year:      editTrainee.year      || '',
    studentId: editTrainee.studentId || '',
  } : empty);
  const [errors, setErrors] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function validate() {
    const e = {};
    if (!form.name.trim())  e.name  = true;
    if (!form.email.trim()) e.email = true;
    if (!editTrainee && form.password.length < 6) e.password = true;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, role: 'trainee' });
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{editTrainee ? 'Edit Trainee' : 'Add Trainee'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">

            <div className="admin-field">
              <label>Full Name *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name}
                onChange={e => set('name', e.target.value)} placeholder="Full name" />
            </div>

            <div className="admin-field">
              <label>Email *</label>
              <input className={errors.email ? 'invalid' : ''} type="email" value={form.email}
                onChange={e => set('email', e.target.value)} placeholder="email@domain.com" />
            </div>

            {!editTrainee && (
              <div className="admin-field">
                <label>Password *</label>
                <input className={errors.password ? 'invalid' : ''} type="password" value={form.password}
                  onChange={e => set('password', e.target.value)} placeholder="Min. 6 characters" />
                {errors.password && <span style={{ fontSize: 11, color: '#e74c3c' }}>At least 6 characters required</span>}
              </div>
            )}

            <div className="admin-field">
              <label>Student ID</label>
              <input value={form.studentId} onChange={e => set('studentId', e.target.value)} placeholder="e.g. STD-001" />
            </div>

            <div className="admin-field">
              <label>Year</label>
              <select value={form.year} onChange={e => set('year', e.target.value)}>
                <option value="">— Select year —</option>
                {[1,2,3,4,5,6].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>

            <div className="admin-field">
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+964 xxx xxx xxxx" />
            </div>

            <div className="admin-field">
              <label>Gender</label>
              <select value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">— Select —</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="admin-field">
              <label>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </div>

          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editTrainee ? 'Save Changes' : 'Add Trainee'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RotationModal({ trainees, supervisors, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    traineeId:     '',
    supervisorId:  '',
    startDate:     '',
    endDate:       '',
    durationWeeks: '',
  });
  const [errors, setErrors] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function validate() {
    const e = {};
    if (!form.traineeId)     e.traineeId     = true;
    if (!form.supervisorId)  e.supervisorId  = true;
    if (!form.startDate)     e.startDate     = true;
    if (!form.endDate)       e.endDate       = true;
    if (!form.durationWeeks) e.durationWeeks = true;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, durationWeeks: Number(form.durationWeeks) });
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div className="admin-modal-title">Assign Rotation</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 5 }}>
              Trainee *
            </label>
            <select
              className={errors.traineeId ? 'invalid admin-search' : 'admin-search'}
              style={{ width: '100%' }}
              value={form.traineeId}
              onChange={e => set('traineeId', e.target.value)}
            >
              <option value="">— Select trainee —</option>
              {trainees.map(t => (
                <option key={t._id} value={t._id}>{t.name}{t.studentId ? ` (${t.studentId})` : ''}</option>
              ))}
            </select>
            {errors.traineeId && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Required</div>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 5 }}>
              Supervisor *
            </label>
            <select
              className={errors.supervisorId ? 'invalid admin-search' : 'admin-search'}
              style={{ width: '100%' }}
              value={form.supervisorId}
              onChange={e => set('supervisorId', e.target.value)}
            >
              <option value="">— Select supervisor —</option>
              {supervisors.map(s => (
                <option key={s._id} value={s._id}>{s.name}{s.specialty ? ` · ${s.specialty}` : ''}</option>
              ))}
            </select>
            {errors.supervisorId && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Required</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 5 }}>
                Start Date *
              </label>
              <input
                type="date"
                className={errors.startDate ? 'invalid admin-search' : 'admin-search'}
                style={{ width: '100%' }}
                value={form.startDate}
                onChange={e => set('startDate', e.target.value)}
              />
              {errors.startDate && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Required</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 5 }}>
                End Date *
              </label>
              <input
                type="date"
                className={errors.endDate ? 'invalid admin-search' : 'admin-search'}
                style={{ width: '100%' }}
                value={form.endDate}
                onChange={e => set('endDate', e.target.value)}
              />
              {errors.endDate && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Required</div>}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 5 }}>
              Duration (weeks) *
            </label>
            <input
              type="number"
              min="1"
              max="52"
              className={errors.durationWeeks ? 'invalid admin-search' : 'admin-search'}
              style={{ width: '100%' }}
              placeholder="e.g. 8"
              value={form.durationWeeks}
              onChange={e => set('durationWeeks', e.target.value)}
            />
            {errors.durationWeeks && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Required</div>}
            <div style={{ fontSize: 11, color: '#8B8FA8', marginTop: 3 }}>
              Number of weeks the trainee will be in this rotation
            </div>
          </div>

        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Assign Rotation'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SecretaryTrainees() {
  const [trainees,      setTrainees     ] = useState([]);
  const [supervisors,   setSupervisors  ] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [search,        setSearch       ] = useState('');
  const [activeTab,     setActiveTab    ] = useState('trainees');
  const [showModal,     setShowModal    ] = useState(false);
  const [showRotModal,  setShowRotModal ] = useState(false);
  const [editTrainee,   setEditTrainee  ] = useState(null);
  const [delTrainee,    setDelTrainee   ] = useState(null);
  const [saving,        setSaving       ] = useState(false);
  const [toasts,        setToasts       ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/secretary/trainees'),
      api.get('/api/secretary/supervisors'),
      api.get('/api/secretary/distributions'),
    ]).then(([tRes, sRes, dRes]) => {
      setTrainees(     tRes.data?.data || tRes.data || []);
      setSupervisors(  sRes.data?.data || sRes.data || []);
      setDistributions(dRes.data?.data || dRes.data || []);
    }).catch(() => showToast('Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveTrainee(data) {
    setSaving(true);
    try {
      if (editTrainee) {
        const res = await api.patch(`/api/secretary/trainees/${editTrainee._id}`, data);
        const updated = res.data?.data || res.data;
        setTrainees(prev => prev.map(t => t._id === editTrainee._id ? updated : t));
        showToast('Trainee updated');
      } else {
        const res = await api.post('/api/secretary/trainees', data);
        const created = res.data?.data || res.data;
        setTrainees(prev => [created, ...prev]);
        showToast('Trainee added');
      }
      setShowModal(false);
      setEditTrainee(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTrainee() {
    try {
      await api.delete(`/api/users/${delTrainee._id}`);
      setTrainees(prev => prev.filter(t => t._id !== delTrainee._id));
      showToast('Trainee removed');
    } catch { showToast('Delete failed', 'error'); }
    finally  { setDelTrainee(null); }
  }

  async function handleSaveRotation(data) {
    setSaving(true);
    try {
      const res = await api.post('/api/secretary/distributions', data);
      const created = res.data?.data || res.data;
      setDistributions(prev => [created, ...prev]);
      setShowRotModal(false);
      showToast('Rotation assigned successfully');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to assign rotation', 'error');
    } finally {
      setSaving(false);
    }
  }

  const filteredTrainees = trainees.filter(t => {
    const q = search.toLowerCase();
    return !q
      || t.name?.toLowerCase().includes(q)
      || t.email?.toLowerCase().includes(q)
      || (t.studentId || '').toLowerCase().includes(q);
  });

  const filteredDists = distributions.filter(d => {
    const q = search.toLowerCase();
    const tName = d.traineeId?.name || d.student?.name || '';
    const sName = d.supervisorId?.name || d.doctor?.name || '';
    return !q || tName.toLowerCase().includes(q) || sName.toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <Sk w={120} h={36} r={8} /><Sk w={140} h={36} r={8} />
        </div>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(7)].map((_, i) => (
                  <tr key={i}>
                    <td><Sk w={24} h={13} /></td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                    <td><Sk w={160} h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
                    <td><Sk w={70}  h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
                    <td><div style={{ display: 'flex', gap: 6 }}><Sk w={28} h={28} r={6} /><Sk w={28} h={28} r={6} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        {/* Tabs + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`filter-tab${activeTab === 'trainees' ? ' active' : ''}`}
              onClick={() => setActiveTab('trainees')}
            >
              Trainees ({trainees.length})
            </button>
            <button
              className={`filter-tab${activeTab === 'rotations' ? ' active' : ''}`}
              onClick={() => setActiveTab('rotations')}
            >
              Rotations ({distributions.length})
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {activeTab === 'trainees' && (
              <button className="btn-purple" onClick={() => { setEditTrainee(null); setShowModal(true); }}>
                + Add Trainee
              </button>
            )}
            {activeTab === 'rotations' && (
              <button className="btn-purple" onClick={() => setShowRotModal(true)}>
                + Assign Rotation
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            className="admin-search"
            style={{ width: '100%', height: 38 }}
            placeholder={activeTab === 'trainees' ? 'Search by name, email, or student ID…' : 'Search by trainee or supervisor name…'}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Trainees Table */}
        {activeTab === 'trainees' && (
          <div className="admin-card">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Photo</th><th>Name</th><th>Email</th>
                    <th>Student ID</th><th>Year</th><th>Phone</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrainees.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#8B8FA8' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🎓</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#4B5563', marginBottom: 4 }}>
                          {trainees.length === 0 ? 'No trainees yet' : 'No trainees match your search'}
                        </div>
                        {trainees.length === 0 && (
                          <div style={{ fontSize: 13 }}>Click "+ Add Trainee" to add the first trainee to this specialty.</div>
                        )}
                      </td>
                    </tr>
                  )}
                  {filteredTrainees.map((t, i) => (
                    <tr key={t._id}>
                      <td style={{ color: '#8B8FA8' }}>{i + 1}</td>
                      <td>
                        {t.photoUrl
                          ? <img src={`${API_BASE}${t.photoUrl}`} alt="" className="cell-photo" />
                          : <div className="cell-initials">{t.initials || t.name?.[0] || '?'}</div>
                        }
                      </td>
                      <td><strong>{t.name}</strong></td>
                      <td style={{ color: '#4B5563', fontSize: 13 }}>{t.email}</td>
                      <td style={{ color: '#4B5563', fontSize: 13 }}>{t.studentId || '—'}</td>
                      <td style={{ color: '#4B5563', fontSize: 13 }}>{t.year ? `Year ${t.year}` : '—'}</td>
                      <td style={{ color: '#4B5563', fontSize: 13 }}>{t.phone || '—'}</td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action edit" onClick={() => { setEditTrainee(t); setShowModal(true); }}>
                            <IconEdit />
                          </button>
                          <button className="btn-action delete" onClick={() => setDelTrainee(t)}>
                            <IconDelete />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rotations Table */}
        {activeTab === 'rotations' && (
          <div className="admin-card">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Trainee</th><th>Supervisor</th>
                    <th>Start</th><th>End</th><th>Duration</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDists.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#8B8FA8' }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#4B5563', marginBottom: 4 }}>
                          {distributions.length === 0 ? 'No rotations assigned yet' : 'No rotations match your search'}
                        </div>
                        {distributions.length === 0 && (
                          <div style={{ fontSize: 13 }}>Click "+ Assign Rotation" to create the first rotation.</div>
                        )}
                      </td>
                    </tr>
                  )}
                  {filteredDists.map((d, i) => {
                    const trainee    = d.traineeId   || d.student || {};
                    const supervisor = d.supervisorId || d.doctor  || {};
                    const status     = d.status || 'active';
                    const statusColor = status === 'active' ? '#059669' : status === 'completed' ? '#1B1464' : '#D97706';
                    const statusBg    = status === 'active' ? '#D1FAE5' : status === 'completed' ? '#EEEDFE'  : '#FEF3C7';
                    return (
                      <tr key={d._id}>
                        <td style={{ color: '#8B8FA8' }}>{i + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="cell-initials">{trainee.initials || trainee.name?.[0] || '?'}</div>
                            <div>
                              <strong>{trainee.name || '—'}</strong>
                              {trainee.studentId && <div style={{ fontSize: 11, color: '#8B8FA8' }}>{trainee.studentId}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 13, color: '#4B5563' }}>{supervisor.name || '—'}</td>
                        <td style={{ fontSize: 13, color: '#4B5563' }}>{fmtDate(d.startDate)}</td>
                        <td style={{ fontSize: 13, color: '#4B5563' }}>{fmtDate(d.endDate)}</td>
                        <td>
                          {d.durationWeeks
                            ? <span style={{ fontWeight: 600, color: '#1B1464' }}>{d.durationWeeks} weeks</span>
                            : <span style={{ color: '#D1D5DB' }}>—</span>
                          }
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 9px',
                            borderRadius: 20, background: statusBg, color: statusColor
                          }}>{status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showModal && (
          <TraineeModal
            editTrainee={editTrainee}
            onSave={handleSaveTrainee}
            onClose={() => { setShowModal(false); setEditTrainee(null); }}
            saving={saving}
          />
        )}

        {showRotModal && (
          <RotationModal
            trainees={trainees}
            supervisors={supervisors}
            onSave={handleSaveRotation}
            onClose={() => setShowRotModal(false)}
            saving={saving}
          />
        )}

        {delTrainee && (
          <ConfirmDelete
            name={delTrainee.name}
            onConfirm={handleDeleteTrainee}
            onCancel={() => setDelTrainee(null)}
          />
        )}

        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
      </main>
    </>
  );
}
