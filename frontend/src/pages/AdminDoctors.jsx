import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const API_BASE = '';
function photoSrc(url) { return url ? `${API_BASE}${url}` : null; }

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

// ── Doctor Modal ───────────────────────────────────────────────────────────
function DoctorModal({ editDoc, hospitals, onSave, onClose, saving }) {
  const empty = { name: '', email: '', password: '', phone: '', gender: '', city: '', hospital: '', specialty: '' };
  const [form,    setForm   ] = useState(editDoc ? {
    name:      editDoc.name      || '',
    email:     editDoc.email     || '',
    phone:     editDoc.phone     || '',
    gender:    editDoc.gender    || '',
    city:      editDoc.city      || '',
    hospital:  editDoc.hospital?._id || editDoc.hospital || '',
    specialty: editDoc.specialty || '',
  } : empty);
  const [photo,   setPhoto  ] = useState(null);
  const [preview, setPreview] = useState(editDoc?.photoUrl ? photoSrc(editDoc.photoUrl) : null);
  const [errors,  setErrors ] = useState({});
  const fileRef = useRef();

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function pickPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function validate() {
    const e = {};
    if (!form.name.trim())  e.name  = true;
    if (!form.email.trim()) e.email = true;
    if (!editDoc && form.password.length < 6) e.password = true;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSave() {
    if (!validate()) return;
    const fd = new FormData();
    fd.append('role', 'doctor');
    Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
    if (photo) fd.append('photo', photo);
    onSave(fd);
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
          <div className="admin-modal-title">{editDoc ? 'Edit Doctor' : 'Add Doctor'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">

            <div className="admin-field full">
              <label>Profile Photo</label>
              <div className="photo-preview-wrap">
                {preview
                  ? <img src={preview} alt="preview" className="photo-preview" />
                  : <div className="photo-preview-placeholder">👤</div>}
                <button type="button" className="btn-outline" onClick={() => fileRef.current.click()}>
                  {preview ? 'Change Photo' : 'Upload Photo'}
                </button>
                <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png" style={{ display: 'none' }} onChange={pickPhoto} />
              </div>
            </div>

            <div className="admin-field">
              <label>Name *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
            </div>

            <div className="admin-field">
              <label>Email *</label>
              <input className={errors.email ? 'invalid' : ''} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@domain.com" />
            </div>

            {!editDoc && (
              <div className="admin-field">
                <label>Password *</label>
                <input className={errors.password ? 'invalid' : ''} type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min. 6 characters" />
                {errors.password && <span style={{ fontSize: 11, color: '#e74c3c' }}>At least 6 characters required</span>}
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
              <label>Hospital</label>
              <select value={form.hospital} onChange={e => set('hospital', e.target.value)}>
                <option value="">— Select hospital —</option>
                {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
              </select>
            </div>

          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Close</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Delete ─────────────────────────────────────────────────────────
function ConfirmDelete({ name, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>Delete Doctor</h3>
        <p>Are you sure you want to delete <strong>{name}</strong>? This cannot be undone.</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red"     onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AdminDoctors() {
  const [doctors,   setDoctors  ] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading,   setLoading  ] = useState(true);
  const [search,    setSearch   ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editDoc,   setEditDoc  ] = useState(null);
  const [saving,    setSaving   ] = useState(false);
  const [delDoc,    setDelDoc   ] = useState(null);
  const [toasts,    setToasts   ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.all([api.get('/api/users'), api.get('/api/hospitals')])
      .then(([u, h]) => {
        setDoctors(u.data.filter(x => x.role === 'doctor'));
        setHospitals(h.data);
      })
      .catch(() => showToast('Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const displayed = doctors.filter(d => {
    const q = search.toLowerCase();
    return !q || d.name?.toLowerCase().includes(q) || d.email?.toLowerCase().includes(q) || d.specialty?.toLowerCase().includes(q) || d.hospital?.name?.toLowerCase().includes(q);
  });

  async function handleSave(fd) {
    setSaving(true);
    try {
      if (editDoc) {
        const res = await api.put(`/api/users/${editDoc._id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setDoctors(prev => prev.map(d => d._id === editDoc._id ? res.data : d));
        showToast('Doctor updated');
      } else {
        const res = await api.post('/api/users', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setDoctors(prev => [res.data, ...prev]);
        showToast('Doctor added');
      }
      setShowModal(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    try {
      await api.delete(`/api/users/${delDoc._id}`);
      setDoctors(prev => prev.filter(d => d._id !== delDoc._id));
      showToast('Doctor deleted');
    } catch { showToast('Delete failed', 'error'); }
    finally  { setDelDoc(null); }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-page-header">
          <Sk w={140} h={38} r={8} />
        </div>
        <div className="admin-card">
          <div className="admin-toolbar">
            <Sk h={36} r={8} style={{ flex: 1, minWidth: 200 }} />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {['#', 'Photo', 'Name', 'Email', 'Specialty', 'Hospital', 'City', 'Phone', 'Actions'].map(c => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td><Sk w={20}  h={13} /></td>
                    <td><Sk w={36}  h={36} r="50%" /></td>
                    <td><Sk w={130} h={13} /></td>
                    <td><Sk w={160} h={13} /></td>
                    <td><Sk w={110} h={13} /></td>
                    <td><Sk w={130} h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
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

        <div className="admin-page-header">
          <button className="btn-purple" onClick={() => { setEditDoc(null); setShowModal(true); }}>
            + Add Doctor
          </button>
        </div>

        <div className="admin-card">
          <div className="admin-toolbar">
            <input
              className="admin-search"
              placeholder="Search by name, email, specialty, hospital…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Specialty</th>
                  <th>Hospital</th>
                  <th>City</th>
                  <th>Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '28px', color: '#999' }}>No doctors found</td></tr>
                )}
                {displayed.map((d, i) => {
                  const src = photoSrc(d.photoUrl);
                  return (
                    <tr key={d._id}>
                      <td>{i + 1}</td>
                      <td>
                        {src
                          ? <img src={src} alt="" className="cell-photo" />
                          : <div className="cell-initials">{d.initials || d.name?.[0] || '?'}</div>}
                      </td>
                      <td>{d.name}</td>
                      <td>{d.email}</td>
                      <td>{d.specialty || '—'}</td>
                      <td>{d.hospital?.name || '—'}</td>
                      <td>{d.city || '—'}</td>
                      <td>{d.phone || '—'}</td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action edit"   title="Edit"   onClick={() => { setEditDoc(d); setShowModal(true); }}><IconEdit /></button>
                          <button className="btn-action delete" title="Delete" onClick={() => setDelDoc(d)}><IconDelete /></button>
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
          <DoctorModal
            editDoc={editDoc}
            hospitals={hospitals}
            onSave={handleSave}
            onClose={() => setShowModal(false)}
            saving={saving}
          />
        )}

        {delDoc && (
          <ConfirmDelete
            name={delDoc.name}
            onConfirm={confirmDelete}
            onCancel={() => setDelDoc(null)}
          />
        )}

        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
      </main>
    </>
  );
}
