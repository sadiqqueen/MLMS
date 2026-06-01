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
        <h3>Delete Program Director</h3>
        <p>Are you sure you want to delete <strong>{name}</strong>?</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

function PDModal({ editPD, onSave, onClose, saving }) {
  const empty = { name: '', email: '', password: '', phone: '', department: '' };
  const [form, setForm] = useState(editPD ? {
    name:       editPD.name       || '',
    email:      editPD.email      || '',
    phone:      editPD.phone      || '',
    department: editPD.department || '',
  } : empty);
  const [errors, setErrors] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function validate() {
    const e = {};
    if (!form.name.trim())  e.name  = true;
    if (!form.email.trim()) e.email = true;
    if (!editPD && form.password.length < 6) e.password = true;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, role: 'program_director' });
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
          <div className="admin-modal-title">{editPD ? 'Edit Program Director' : 'Add Program Director'}</div>
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

            {!editPD && (
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

            <div className="admin-field full">
              <label>Department</label>
              <input value={form.department} onChange={e => set('department', e.target.value)} placeholder="e.g. Clinical Training" />
            </div>

          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editPD ? 'Save Changes' : 'Add Program Director'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SecretaryProgramDirectors() {
  const [pds,       setPds      ] = useState([]);
  const [loading,   setLoading  ] = useState(true);
  const [search,    setSearch   ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editPD,    setEditPD   ] = useState(null);
  const [delPD,     setDelPD    ] = useState(null);
  const [saving,    setSaving   ] = useState(false);
  const [toasts,    setToasts   ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/secretary/program-directors')
      .then(r => setPds(r.data?.data || r.data || []))
      .catch(() => showToast('Failed to load program directors', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(data) {
    setSaving(true);
    try {
      if (editPD) {
        const res = await api.patch(`/api/users/${editPD._id}`, data);
        const updated = res.data?.data || res.data;
        setPds(prev => prev.map(p => p._id === editPD._id ? updated : p));
        showToast('Program Director updated');
      } else {
        const res = await api.post('/api/secretary/program-directors', data);
        const created = res.data?.data || res.data;
        setPds(prev => [created, ...prev]);
        showToast('Program Director added');
      }
      setShowModal(false);
      setEditPD(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/users/${delPD._id}`);
      setPds(prev => prev.filter(p => p._id !== delPD._id));
      showToast('Program Director removed');
    } catch { showToast('Delete failed', 'error'); }
    finally  { setDelPD(null); }
  }

  const filtered = pds.filter(p => {
    const q = search.toLowerCase();
    return !q
      || p.name?.toLowerCase().includes(q)
      || p.email?.toLowerCase().includes(q)
      || (p.department || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ marginBottom: 20 }}><Sk w={180} h={36} r={8} /></div>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td><Sk w={20}  h={13} /></td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sk w={36} h={36} r="50%" /><Sk w={130} h={13} /></div></td>
                    <td><Sk w={160} h={13} /></td>
                    <td><Sk w={90}  h={13} /></td>
                    <td><Sk w={100} h={13} /></td>
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
            {pds.length} program director{pds.length !== 1 ? 's' : ''}
          </div>
          <button className="btn-purple" onClick={() => { setEditPD(null); setShowModal(true); }}>
            + Add Program Director
          </button>
        </div>

        <div className="admin-card">
          <div className="admin-toolbar">
            <input
              className="admin-search"
              style={{ flex: 1, minWidth: 200 }}
              placeholder="Search by name, email, or department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th><th>Photo</th><th>Name</th><th>Email</th>
                  <th>Department</th><th>Phone</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#8B8FA8' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🧑‍💼</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#4B5563', marginBottom: 4 }}>
                        {pds.length === 0 ? 'No program directors yet' : 'No program directors match your search'}
                      </div>
                      {pds.length === 0 && (
                        <div style={{ fontSize: 13 }}>Click "+ Add Program Director" to create one.</div>
                      )}
                    </td>
                  </tr>
                )}
                {filtered.map((p, i) => (
                  <tr key={p._id}>
                    <td style={{ color: '#8B8FA8' }}>{i + 1}</td>
                    <td>
                      {p.photoUrl
                        ? <img src={`${API_BASE}${p.photoUrl}`} alt="" className="cell-photo" />
                        : <div className="cell-initials">{p.initials || p.name?.[0] || '?'}</div>
                      }
                    </td>
                    <td><strong>{p.name}</strong></td>
                    <td style={{ color: '#4B5563', fontSize: 13 }}>{p.email}</td>
                    <td style={{ color: '#4B5563', fontSize: 13 }}>{p.department || '—'}</td>
                    <td style={{ color: '#4B5563', fontSize: 13 }}>{p.phone || '—'}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-action edit" onClick={() => { setEditPD(p); setShowModal(true); }}>
                          <IconEdit />
                        </button>
                        <button className="btn-action delete" onClick={() => setDelPD(p)}>
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
          <PDModal
            editPD={editPD}
            onSave={handleSave}
            onClose={() => { setShowModal(false); setEditPD(null); }}
            saving={saving}
          />
        )}

        {delPD && (
          <ConfirmDelete
            name={delPD.name}
            onConfirm={handleDelete}
            onCancel={() => setDelPD(null)}
          />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
