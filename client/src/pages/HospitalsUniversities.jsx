import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';

const ROWS_OPT = [8, 16, 32];

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

// ── Hospital Modal ─────────────────────────────────────────────────────────
function HospitalModal({ item, doctors, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name:           item?.name           || '',
    city:           item?.city           || '',
    address:        item?.address        || '',
    assignedDoctor: item?.assignedDoctor?._id || item?.assignedDoctor || '',
    specialties:    (item?.specialties || []).join(', ')
  });
  const [errors, setErrors] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function handleSave() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    setErrors(e);
    if (Object.keys(e).length) return;

    const data = {
      ...form,
      specialties: form.specialties.split(',').map(s => s.trim()).filter(Boolean)
    };
    onSave(data);
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
          <div className="admin-modal-title">{item ? 'Edit Hospital' : 'Add Hospital'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>Hospital Name *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Hospital name" />
            </div>
            <div className="admin-field">
              <label>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </div>
            <div className="admin-field">
              <label>Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Address" />
            </div>
            <div className="admin-field">
              <label>Assigned Doctor</label>
              <select value={form.assignedDoctor} onChange={e => set('assignedDoctor', e.target.value)}>
                <option value="">— None —</option>
                {doctors.map(d => <option key={d._id} value={d._id}>{d.name} ({d.specialty || 'No specialty'})</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label>Specialties (comma-separated)</label>
              <input value={form.specialties} onChange={e => set('specialties', e.target.value)} placeholder="Surgery, Pediatrics, …" />
            </div>
          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Close</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ── University Modal ───────────────────────────────────────────────────────
function UniversityModal({ item, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name:         item?.name         || '',
    city:         item?.city         || '',
    address:      item?.address      || '',
    contactEmail: item?.contactEmail || ''
  });
  const [errors, setErrors] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function handleSave() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    setErrors(e);
    if (Object.keys(e).length) return;
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
          <div className="admin-modal-title">{item ? 'Edit University' : 'Add University'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>University Name *</label>
              <input className={errors.name ? 'invalid' : ''} value={form.name} onChange={e => set('name', e.target.value)} placeholder="University name" />
            </div>
            <div className="admin-field">
              <label>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </div>
            <div className="admin-field">
              <label>Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Address" />
            </div>
            <div className="admin-field full">
              <label>Contact Email</label>
              <input type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} placeholder="contact@university.edu" />
            </div>
          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Close</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
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
        <h3>Delete Record</h3>
        <p>Delete <strong>{name}</strong>? This cannot be undone.</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red"     onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function HospitalsUniversities() {
  const { user: me } = useAuth();
  const isAdmin   = me?.role === 'admin';
  const canManage = ['super_admin', 'professor', 'admin'].includes(me?.role);

  const [tab,        setTab      ] = useState(0);
  const [hospitals,  setHospitals] = useState([]);
  const [universities, setUnis   ] = useState([]);
  const [doctors,    setDoctors  ] = useState([]);
  const [loading,    setLoading  ] = useState(true);
  const [view,       setView     ] = useState('table');
  const [search,     setSearch   ] = useState('');
  const [page,       setPage     ] = useState(1);
  const [rows,       setRows     ] = useState(16);
  const [toasts,     setToasts   ] = useState([]);
  const [showModal,  setShowModal] = useState(false);
  const [editItem,   setEditItem ] = useState(null);
  const [saving,     setSaving   ] = useState(false);
  const [delItem,    setDelItem  ] = useState(null);

  function showToast(msg, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/hospitals'),
      api.get('/api/universities'),
      api.get('/api/users/doctors')
    ]).then(([h, u, d]) => {
      setHospitals(h.data);
      setUnis(u.data);
      setDoctors(d.data);
    }).catch(() => showToast('Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const isHospital = isAdmin || tab === 0;
  const data       = isHospital ? hospitals : universities;
  const filtered   = data.filter(item => {
    const q = search.toLowerCase();
    return !q || item.name?.toLowerCase().includes(q) || item.city?.toLowerCase().includes(q);
  });
  const totalPages   = Math.max(1, Math.ceil(filtered.length / rows));
  const currentItems = filtered.slice((page - 1) * rows, page * rows);

  async function handleSave(payload) {
    setSaving(true);
    const url    = isHospital ? '/api/hospitals' : '/api/universities';
    const urlId  = editItem ? `${url}/${editItem._id}` : url;
    const method = editItem ? 'put' : 'post';
    try {
      const res  = await api[method](urlId, payload);
      if (isHospital) {
        setHospitals(prev => editItem
          ? prev.map(h => h._id === editItem._id ? res.data : h)
          : [res.data, ...prev]
        );
      } else {
        setUnis(prev => editItem
          ? prev.map(u => u._id === editItem._id ? res.data : u)
          : [res.data, ...prev]
        );
      }
      showToast(editItem ? 'Updated' : 'Created');
      setShowModal(false);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const url = isHospital ? `/api/hospitals/${delItem._id}` : `/api/universities/${delItem._id}`;
    try {
      await api.delete(url);
      if (isHospital) setHospitals(p => p.filter(h => h._id !== delItem._id));
      else            setUnis(p => p.filter(u => u._id !== delItem._id));
      showToast('Deleted');
    } catch { showToast('Delete failed', 'error'); }
    finally   { setDelItem(null); }
  }

  if (loading) return (
    <><Navbar /><main className="admin-main"><div className="loading">Loading…</div></main></>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        <div className="admin-page-header">
          {canManage && (
            <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>
              + {isHospital ? 'Add Hospital' : 'Add University'}
            </button>
          )}
        </div>

        <div className="admin-card">

          {/* Tabs — admin only sees Hospitals */}
          {!isAdmin && (
            <div className="admin-tabs">
              <button className={`admin-tab${tab === 0 ? ' active' : ''}`} onClick={() => { setTab(0); setPage(1); }}>Hospitals</button>
              <button className={`admin-tab${tab === 1 ? ' active' : ''}`} onClick={() => { setTab(1); setPage(1); }}>Universities</button>
            </div>
          )}

          {/* Toolbar */}
          <div className="admin-toolbar">
            <input className="admin-search" placeholder="Search by name or city…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            <div className="view-toggle">
              <button className={`view-btn${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')}>☰</button>
              <button className={`view-btn${view === 'card'  ? ' active' : ''}`} onClick={() => setView('card')}>⊞</button>
            </div>
            <select className="rows-select" value={rows} onChange={e => { setRows(+e.target.value); setPage(1); }}>
              {ROWS_OPT.map(r => <option key={r} value={r}>{r} / page</option>)}
            </select>
          </div>

          {/* TABLE */}
          {view === 'table' && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>City</th>
                    <th>Address</th>
                    {isHospital
                      ? <><th>Assigned Doctor</th><th>Specialties</th></>
                      : <th>Contact Email</th>
                    }
                    {canManage && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 && (
                    <tr><td colSpan={8} className="admin-empty">No records found</td></tr>
                  )}
                  {currentItems.map((item, i) => (
                    <tr key={item._id}>
                      <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.city || '—'}</td>
                      <td>{item.address || '—'}</td>
                      {isHospital ? (
                        <>
                          <td>{item.assignedDoctor?.name || '—'}</td>
                          <td>
                            {(item.specialties || []).map(s => (
                              <span key={s} className="specialty-tag">{s}</span>
                            ))}
                            {(!item.specialties || item.specialties.length === 0) && '—'}
                          </td>
                        </>
                      ) : (
                        <td>{item.contactEmail || '—'}</td>
                      )}
                      {canManage && (
                        <td>
                          <div className="action-btns">
                            <button className="btn-action edit"   onClick={() => { setEditItem(item); setShowModal(true); }}><IconEdit /></button>
                            <button className="btn-action delete" onClick={() => setDelItem(item)}><IconDelete /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD VIEW */}
          {view === 'card' && (
            <div className="admin-card-grid">
              {currentItems.length === 0 && <div className="admin-empty">No records found</div>}
              {currentItems.map(item => (
                <div className="user-card" key={item._id}>
                  <div style={{ fontSize: 36 }}>{isHospital ? '🏥' : '🏛️'}</div>
                  <div className="user-card-name">{item.name}</div>
                  <div className="user-card-sub">{item.city || '—'}</div>
                  {isHospital && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
                      {(item.specialties || []).map(s => <span key={s} className="specialty-tag">{s}</span>)}
                    </div>
                  )}
                  {!isHospital && <div className="user-card-sub">{item.contactEmail || '—'}</div>}
                  {canManage && (
                    <div className="user-card-actions">
                      <button className="btn-action edit"   onClick={() => { setEditItem(item); setShowModal(true); }}><IconEdit /></button>
                      <button className="btn-action delete" onClick={() => setDelItem(item)}><IconDelete /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* PAGINATION */}
          <div className="admin-pagination">
            <span>Showing {Math.min((page - 1) * rows + 1, filtered.length)}–{Math.min(page * rows, filtered.length)} of {filtered.length}</span>
            <div className="pagination-btns">
              <button className="pg-btn" disabled={page === 1} onClick={() => setPage(1)}>«</button>
              <button className="pg-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .map(n => <button key={n} className={`pg-btn${n === page ? ' active-pg' : ''}`} onClick={() => setPage(n)}>{n}</button>)
              }
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</button>
            </div>
          </div>

        </div>
      </main>

      {showModal && isHospital && (
        <HospitalModal item={editItem} doctors={doctors} onSave={handleSave} onClose={() => setShowModal(false)} saving={saving} />
      )}
      {showModal && !isHospital && (
        <UniversityModal item={editItem} onSave={handleSave} onClose={() => setShowModal(false)} saving={saving} />
      )}
      {delItem && (
        <ConfirmDelete name={delItem.name} onConfirm={confirmDelete} onCancel={() => setDelItem(null)} />
      )}
      <Toast toasts={toasts} />
    </>
  );
}
