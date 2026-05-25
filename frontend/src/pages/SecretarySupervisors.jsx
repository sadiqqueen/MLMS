import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const API_BASE = '';

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
        <h3>Delete Supervisor</h3>
        <p>Are you sure you want to delete <strong>{name}</strong>?</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function SupervisorModal({ editSupervisor, onSave, onClose, saving }) {
  const empty = { name: '', email: '', password: '', phone: '', gender: '', city: '', specialty: '', department: '' };
  const [form, setForm] = useState(editSupervisor ? {
    name:       editSupervisor.name       || '',
    email:      editSupervisor.email      || '',
    phone:      editSupervisor.phone      || '',
    gender:     editSupervisor.gender     || '',
    city:       editSupervisor.city       || '',
    specialty:  editSupervisor.specialty  || '',
    department: editSupervisor.department || '',
  } : empty);
  const [errors, setErrors] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function validate() {
    const e = {};
    if (!form.name.trim())  e.name  = true;
    if (!form.email.trim()) e.email = true;
    if (!editSupervisor && form.password.length < 6) e.password = true;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, role: 'supervisor' });
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
          <div className="admin-modal-title">{editSupervisor ? 'Edit Supervisor' : 'Add Supervisor'}</div>
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

            {!editSupervisor && (
              <div className="admin-field">
                <label>Password *</label>
                <input className={errors.password ? 'invalid' : ''} type="password" value={form.password}
                  onChange={e => set('password', e.target.value)} placeholder="Min. 6 characters" />
                {errors.password && <span style={{ fontSize: 11, color: '#e74c3c' }}>At least 6 characters</span>}
              </div>
            )}

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

            <div className="admin-field">
              <label>Specialty</label>
              <input value={form.specialty} onChange={e => set('specialty', e.target.value)} placeholder="e.g. Surgery" />
            </div>

            <div className="admin-field">
              <label>Department</label>
              <input value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. General Surgery" />
            </div>

          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editSupervisor ? 'Save Changes' : 'Add Supervisor'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SecretarySupervisors() {
  const [supervisors,    setSupervisors   ] = useState([]);
  const [loading,        setLoading       ] = useState(true);
  const [search,         setSearch        ] = useState('');
  const [showModal,      setShowModal     ] = useState(false);
  const [editSupervisor, setEditSupervisor] = useState(null);
  const [delSupervisor,  setDelSupervisor ] = useState(null);
  const [saving,         setSaving        ] = useState(false);
  const [toasts,         setToasts        ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/secretary/supervisors')
      .then(r => setSupervisors(r.data?.data || r.data || []))
      .catch(() => showToast('Failed to load supervisors', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(data) {
    setSaving(true);
    try {
      if (editSupervisor) {
        const res = await api.patch(`/api/secretary/supervisors/${editSupervisor._id}`, data);
        const updated = res.data?.data || res.data;
        setSupervisors(prev => prev.map(s => s._id === editSupervisor._id ? updated : s));
        showToast('Supervisor updated');
      } else {
        const res = await api.post('/api/secretary/supervisors', data);
        const created = res.data?.data || res.data;
        setSupervisors(prev => [created, ...prev]);
        showToast('Supervisor added');
      }
      setShowModal(false);
      setEditSupervisor(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/users/${delSupervisor._id}`);
      setSupervisors(prev => prev.filter(s => s._id !== delSupervisor._id));
      showToast('Supervisor removed');
    } catch { showToast('Delete failed', 'error'); }
    finally  { setDelSupervisor(null); }
  }

  const filtered = supervisors.filter(s => {
    const q = search.toLowerCase();
    return !q
      || s.name?.toLowerCase().includes(q)
      || s.email?.toLowerCase().includes(q)
      || (s.specialty  || '').toLowerCase().includes(q)
      || (s.department || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ marginBottom: 20 }}><Sk w={140} h={36} r={8} /></div>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(7)].map((_, i) => (
                  <tr key={i}>
                    <td><Sk w={20}  h={13} /></td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                    <td><Sk w={160} h={13} /></td>
                    <td><Sk w={100} h={13} /></td>
                    <td><Sk w={90}  h={13} /></td>
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#8B8FA8' }}>
            {supervisors.length} supervisor{supervisors.length !== 1 ? 's' : ''} in this specialty
          </div>
          <button className="btn-purple" onClick={() => { setEditSupervisor(null); setShowModal(true); }}>
            + Add Supervisor
          </button>
        </div>

        <div className="admin-card">
          <div className="admin-toolbar">
            <input
              className="admin-search"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Search by name, email, specialty, or department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th><th>Photo</th><th>Name</th><th>Email</th>
                  <th>Specialty</th><th>Department</th><th>Phone</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#8B8FA8' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>👨‍⚕️</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#4B5563', marginBottom: 4 }}>
                        {supervisors.length === 0 ? 'No supervisors yet' : 'No supervisors match your search'}
                      </div>
                      {supervisors.length === 0 && (
                        <div style={{ fontSize: 13 }}>Click "+ Add Supervisor" to add the first supervisor to this specialty.</div>
                      )}
                    </td>
                  </tr>
                )}
                {filtered.map((s, i) => (
                  <tr key={s._id}>
                    <td style={{ color: '#8B8FA8' }}>{i + 1}</td>
                    <td>
                      {s.photoUrl
                        ? <img src={`${API_BASE}${s.photoUrl}`} alt="" className="cell-photo" />
                        : <div className="cell-initials">{s.initials || s.name?.[0] || '?'}</div>
                      }
                    </td>
                    <td><strong>{s.name}</strong></td>
                    <td style={{ color: '#4B5563', fontSize: 13 }}>{s.email}</td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 9px',
                        borderRadius: 20, background: '#EEEDFE', color: '#3C3489'
                      }}>{s.specialty || '—'}</span>
                    </td>
                    <td style={{ color: '#4B5563', fontSize: 13 }}>{s.department || '—'}</td>
                    <td style={{ color: '#4B5563', fontSize: 13 }}>{s.phone || '—'}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-action edit" onClick={() => { setEditSupervisor(s); setShowModal(true); }}>
                          <IconEdit />
                        </button>
                        <button className="btn-action delete" onClick={() => setDelSupervisor(s)}>
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

        {showModal && (
          <SupervisorModal
            editSupervisor={editSupervisor}
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditSupervisor(null); }}
            saving={saving}
          />
        )}

        {delSupervisor && (
          <ConfirmDelete
            name={delSupervisor.name}
            onConfirm={handleDelete}
            onCancel={() => setDelSupervisor(null)}
          />
        )}

        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
      </main>
    </>
  );
}
