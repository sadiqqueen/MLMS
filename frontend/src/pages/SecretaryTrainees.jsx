import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';
import { IconEdit, IconBan } from '../components/icons';

const API_BASE = '';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function weeksBetween(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(1, Math.ceil((end - start) / (7 * 24 * 60 * 60 * 1000)));
}

function ConfirmDelete({ name, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>Deactivate Trainee</h3>
        <p>Deactivate <strong>{name}</strong>? The account will no longer be able to sign in.</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red" onClick={onConfirm}>Deactivate</button>
        </div>
      </div>
    </div>
  );
}

function TraineeModal({ editTrainee, hospitals, supervisors, secretarySpecialty, onSave, onClose, saving }) {
  const specId   = secretarySpecialty?._id || secretarySpecialty || '';
  const specName = secretarySpecialty?.name || '';

  const empty = {
    name: '', email: '', password: '', phone: '', gender: '', city: '',
    year: '', studentId: '', hospitalId: '', supervisorId: '',
    specialtyId: specId,
  };

  const [form, setForm] = useState(editTrainee ? {
    name:        editTrainee.name        || '',
    email:       editTrainee.email       || '',
    phone:       editTrainee.phone       || '',
    gender:      editTrainee.gender      || '',
    city:        editTrainee.city        || '',
    year:        editTrainee.year        || '',
    studentId:   editTrainee.studentId   || '',
    hospitalId:  editTrainee.hospitalId?._id   || editTrainee.hospitalId   || '',
    supervisorId:editTrainee.supervisorId?._id  || editTrainee.supervisorId  || '',
    specialtyId: editTrainee.specialtyId?._id  || editTrainee.specialtyId  || specId,
  } : empty);

  const [errors, setErrors] = useState({});

  const filteredSups = supervisors.filter(s => {
    if (!specId) return true;
    const sid = (s.specialtyId?._id || s.specialtyId || '')?.toString();
    return sid === specId.toString();
  });
  const hospitalOptions = hospitals.map(h => ({ value: h._id, label: h.name }));
  const supervisorOptions = filteredSups.map(s => ({ value: s._id, label: s.name }));

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function validate() {
    const e = {};
    if (!form.name.trim())  e.name  = true;
    if (!form.email.trim()) e.email = true;
    if (!editTrainee && (!form.password || form.password.length < 6)) e.password = true;
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
                <input className={errors.password ? 'invalid' : ''} type="password" value={form.password || ''}
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
              <label>Specialty</label>
              {specName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
                    background: '#EEEDFE', color: '#1B1464'
                  }}>{specName}</span>
                  <span style={{ fontSize: 11, color: '#8B8FA8' }}>(auto-set)</span>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: '#8B8FA8', paddingTop: 6, display: 'block' }}>
                  No specialty assigned to your account
                </span>
              )}
            </div>

            <div className="admin-field">
              <label>Hospital</label>
              <SearchableSelect
                value={form.hospitalId}
                onChange={value => set('hospitalId', value)}
                options={hospitalOptions}
                placeholder="Search hospital..."
              />
            </div>

            <div className="admin-field">
              <label>Supervisor</label>
              <SearchableSelect
                value={form.supervisorId}
                onChange={value => set('supervisorId', value)}
                options={supervisorOptions}
                placeholder="Search supervisor..."
              />
              {specName && filteredSups.length === 0 && (
                <span style={{ fontSize: 11, color: '#8B8FA8', marginTop: 3, display: 'block' }}>
                  No supervisors found for {specName}
                </span>
              )}
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

function RotationModal({ trainees, supervisors, hospitals, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    traineeId:     '',
    hospitalId:    '',
    supervisorId:  '',
    startDate:     '',
    endDate:       '',
  });
  const [errors, setErrors] = useState({});

  const selectedTrainee     = trainees.find(t => t._id === form.traineeId);
  const traineeSpecialtyId  = selectedTrainee
    ? (selectedTrainee.specialtyId?._id || selectedTrainee.specialtyId || '')?.toString()
    : '';

  const filteredSups = supervisors.filter(s => {
    if (!traineeSpecialtyId) return true;
    const sid = (s.specialtyId?._id || s.specialtyId || '')?.toString();
    return sid === traineeSpecialtyId;
  });
  const traineeOptions = trainees.map(t => ({ value: t._id, label: `${t.name}${t.studentId ? ` (${t.studentId})` : ''}` }));
  const hospitalOptions = hospitals.map(h => ({ value: h._id, label: h.name }));
  const supervisorOptions = filteredSups.map(s => ({ value: s._id, label: s.name }));

  function set(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === 'traineeId') next.supervisorId = '';
      return next;
    });
    setErrors(e => ({ ...e, [k]: false }));
  }

  function validate() {
    const e = {};
    if (!form.traineeId)     e.traineeId     = true;
    if (!form.hospitalId)    e.hospitalId    = true;
    if (!form.supervisorId)  e.supervisorId  = true;
    if (!form.startDate)     e.startDate     = true;
    if (!form.endDate)       e.endDate       = true;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSave() {
    if (!validate()) return;
    onSave(form);
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
            <SearchableSelect
              value={form.traineeId}
              onChange={value => set('traineeId', value)}
              options={traineeOptions}
              placeholder="Search trainee..."
              error={errors.traineeId}
            />
            {errors.traineeId && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Required</div>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 5 }}>
              Hospital *
            </label>
            <SearchableSelect
              value={form.hospitalId}
              onChange={value => set('hospitalId', value)}
              options={hospitalOptions}
              placeholder="Search hospital..."
              error={errors.hospitalId}
            />
            {errors.hospitalId && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Required</div>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 5 }}>
              Supervisor *{form.traineeId ? ' (filtered by trainee specialty)' : ''}
            </label>
            <SearchableSelect
              value={form.supervisorId}
              onChange={value => set('supervisorId', value)}
              options={supervisorOptions}
              placeholder="Search supervisor..."
              error={errors.supervisorId}
            />
            {errors.supervisorId && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Required</div>}
            {form.traineeId && filteredSups.length === 0 && (
              <div style={{ fontSize: 11, color: '#8B8FA8', marginTop: 3 }}>
                No supervisors match this trainee's specialty
              </div>
            )}
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
  const { user: me }    = useAuth();
  const [trainees,      setTrainees     ] = useState([]);
  const [supervisors,   setSupervisors  ] = useState([]);
  const [hospitals,     setHospitals    ] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [search,        setSearch       ] = useState('');
  const [activeTab,     setActiveTab    ] = useState('trainees');
  const [rotFilter,     setRotFilter    ] = useState('all');
  const [showModal,     setShowModal    ] = useState(false);
  const [showRotModal,  setShowRotModal ] = useState(false);
  const [editTrainee,   setEditTrainee  ] = useState(null);
  const [delTrainee,    setDelTrainee   ] = useState(null);
  const [saving,        setSaving       ] = useState(false);
  const [toasts,        setToasts       ] = useState([]);

  const secretarySpecialty = me?.specialtyId || null;

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
      api.get('/api/hospitals'),
    ]).then(([tRes, sRes, dRes, hRes]) => {
      setTrainees(     tRes.data?.data || tRes.data || []);
      setSupervisors(  sRes.data?.data || sRes.data || []);
      setDistributions(dRes.data?.data || dRes.data || []);
      setHospitals(    hRes.data?.data || hRes.data || []);
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
      showToast('Trainee deactivated');
    } catch { showToast('Deactivate failed', 'error'); }
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

        {/* Centered toggle */}
        <div className="filter-tabs" style={{ justifyContent: 'center', marginBottom: 14 }}>
          <button
            className={`filter-tab${activeTab === 'trainees' ? ' active' : ''}`}
            style={{ height: 42, padding: '0 26px', fontSize: 14, fontWeight: 600 }}
            onClick={() => setActiveTab('trainees')}
          >
            Trainees ({trainees.length})
          </button>
          <button
            className={`filter-tab${activeTab === 'rotations' ? ' active' : ''}`}
            style={{ height: 42, padding: '0 26px', fontSize: 14, fontWeight: 600 }}
            onClick={() => setActiveTab('rotations')}
          >
            Rotations ({distributions.length})
          </button>
        </div>

        {/* Action button (own right-aligned row) */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
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

        {/* Trainees Card Grid */}
        {activeTab === 'trainees' && (
          <div className="management-card-grid">
            {filteredTrainees.length === 0 && (
              <div className="admin-empty" style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎓</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                  {trainees.length === 0 ? 'No trainees yet' : 'No trainees match your search'}
                </div>
                {trainees.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click "+ Add Trainee" to add the first trainee to this specialty.</div>
                )}
              </div>
            )}
            {filteredTrainees.map(t => (
              <div className="management-card" key={t._id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {t.photoUrl
                    ? <img src={`${API_BASE}${t.photoUrl}`} alt="" className="cell-photo" />
                    : <div className="cell-initials">{t.initials || t.name?.[0] || '?'}</div>
                  }
                  <div style={{ minWidth: 0 }}>
                    <div className="management-card-title">{t.name}</div>
                    <div className="management-card-sub">{t.email}</div>
                  </div>
                </div>
                <div className="management-card-meta">
                  <span className="specialty-tag">{t.studentId ? `ID ${t.studentId}` : (t.specialtyId?.name || '—')}</span>
                  {t.year && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Year {t.year}</span>}
                  {t.phone && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.phone}</span>}
                </div>
                <div className="management-card-actions">
                  <button className="btn-action edit" onClick={() => { setEditTrainee(t); setShowModal(true); }}>
                    <IconEdit />
                  </button>
                  <button className="btn-action delete" onClick={() => setDelTrainee(t)}>
                    <IconBan />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rotation status filter */}
        {activeTab === 'rotations' && (
          <div className="filter-tabs" style={{ marginBottom: 14 }}>
            {[
              { key: 'all',       label: 'All' },
              { key: 'upcoming',  label: 'Upcoming' },
              { key: 'current',   label: 'Current' },
              { key: 'completed', label: 'Completed' },
            ].map(f => (
              <button
                key={f.key}
                className={`filter-tab${rotFilter === f.key ? ' active' : ''}`}
                onClick={() => setRotFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Rotations Card Grid */}
        {activeTab === 'rotations' && (() => {
          const rotList = filteredDists.filter(d => rotFilter === 'all' || (d.status || 'upcoming') === rotFilter);
          return (
            <div className="management-card-grid">
              {rotList.length === 0 && (
                <div className="admin-empty" style={{ gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                    {distributions.length === 0 ? 'No rotations assigned yet' : 'No rotations match your search'}
                  </div>
                  {distributions.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click "+ Assign Rotation" to create the first rotation.</div>
                  )}
                </div>
              )}
              {rotList.map(d => {
                const trainee    = d.traineeId    || d.student  || {};
                const supervisor = d.supervisorId  || d.doctor   || {};
                const hospital   = d.hospitalId || d.hospital || {};
                const status     = d.status || 'upcoming';
                const duration   = d.durationWeeks || weeksBetween(d.startDate, d.endDate);
                const statusColor = status === 'current' ? 'var(--success-fg)' : status === 'completed' ? 'var(--info-fg)' : status === 'cancelled' ? 'var(--danger-fg)' : 'var(--warning-fg)';
                const statusBg    = status === 'current' ? 'var(--success-bg)' : status === 'completed' ? 'var(--info-bg)' : status === 'cancelled' ? 'var(--danger-bg)' : 'var(--warning-bg)';
                return (
                  <div className="management-card" key={d._id}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="management-card-title">{trainee.name || '—'}</div>
                        {trainee.studentId && <div className="management-card-sub">{trainee.studentId}</div>}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 9px',
                        borderRadius: 20, background: statusBg, color: statusColor, whiteSpace: 'nowrap'
                      }}>{status}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Hospital</span>
                        <span style={{ color: 'var(--text-2)', textAlign: 'right' }}>{hospital.name || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Supervisor</span>
                        <span style={{ color: 'var(--text-2)', textAlign: 'right' }}>{supervisor.name || '—'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Dates</span>
                        <span style={{ color: 'var(--text-2)', textAlign: 'right' }}>{fmtDate(d.startDate)} – {fmtDate(d.endDate)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Duration</span>
                        <span style={{ color: 'var(--text-2)', textAlign: 'right' }}>{duration ? `${duration} weeks` : '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {showModal && (
          <TraineeModal
            editTrainee={editTrainee}
            hospitals={hospitals}
            supervisors={supervisors}
            secretarySpecialty={secretarySpecialty}
            onSave={handleSaveTrainee}
            onClose={() => { setShowModal(false); setEditTrainee(null); }}
            saving={saving}
          />
        )}

        {showRotModal && (
          <RotationModal
            trainees={trainees}
            supervisors={supervisors}
            hospitals={hospitals}
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

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
