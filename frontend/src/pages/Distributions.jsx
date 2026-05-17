import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';

const ROWS_OPT = [8, 16, 32];
const API_BASE = 'http://https://mlms-production.up.railway.app';

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

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Distribution Modal ─────────────────────────────────────────────────────
function DistModal({ item, doctors, hospitals, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    doctor:    item?.doctor?._id    || item?.doctor    || '',
    hospital:  item?.hospital?._id  || item?.hospital  || '',
    specialty: item?.specialty  || '',
    startDate: item?.startDate ? item.startDate.slice(0, 10) : '',
    endDate:   item?.endDate   ? item.endDate.slice(0, 10)   : '',
    status:    item?.status    || 'active'
  });
  const [errors, setErrors] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function handleSave() {
    const e = {};
    if (!form.doctor)    e.doctor    = true;
    if (!form.hospital)  e.hospital  = true;
    if (!form.specialty.trim()) e.specialty = true;
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
          <div className="admin-modal-title">{item ? 'Edit Distribution' : 'Add Distribution'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">

            <div className="admin-field full">
              <label>Doctor *</label>
              <select className={errors.doctor ? 'invalid' : ''} value={form.doctor} onChange={e => set('doctor', e.target.value)}>
                <option value="">— Select doctor —</option>
                {doctors.map(d => <option key={d._id} value={d._id}>{d.name} ({d.specialty || '—'})</option>)}
              </select>
            </div>

            <div className="admin-field full">
              <label>Hospital *</label>
              <select className={errors.hospital ? 'invalid' : ''} value={form.hospital} onChange={e => set('hospital', e.target.value)}>
                <option value="">— Select hospital —</option>
                {hospitals.map(h => <option key={h._id} value={h._id}>{h.name} ({h.city || '—'})</option>)}
              </select>
            </div>

            <div className="admin-field full">
              <label>Specialty *</label>
              <input className={errors.specialty ? 'invalid' : ''} value={form.specialty} onChange={e => set('specialty', e.target.value)} placeholder="e.g. Surgery" />
            </div>

            <div className="admin-field">
              <label>Start Date</label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
            </div>

            <div className="admin-field">
              <label>End Date</label>
              <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
            </div>

            <div className="admin-field full">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red"    onClick={onClose}>Close</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDelete({ name, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>Delete Distribution</h3>
        <p>Delete distribution for <strong>{name}</strong>?</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red"     onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function Distributions() {
  const [items,      setItems    ] = useState([]);
  const [doctors,    setDoctors  ] = useState([]);
  const [hospitals,  setHospitals] = useState([]);
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

  // Filters
  const [filterHosp,  setFilterHosp ] = useState('');
  const [filterSpec,  setFilterSpec ] = useState('');
  const [filterStatus,setFilterStatus] = useState('');

  function showToast(msg, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/distributions'),
      api.get('/api/users/doctors'),
      api.get('/api/hospitals')
    ]).then(([d, doc, h]) => {
      setItems(d.data);
      setDoctors(doc.data);
      setHospitals(h.data);
    }).catch(() => showToast('Failed to load', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(item => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      item.doctor?.name?.toLowerCase().includes(q) ||
      item.hospital?.name?.toLowerCase().includes(q) ||
      item.specialty?.toLowerCase().includes(q);
    const matchHosp   = !filterHosp   || item.hospital?._id === filterHosp;
    const matchSpec   = !filterSpec   || item.specialty?.toLowerCase().includes(filterSpec.toLowerCase());
    const matchStatus = !filterStatus || item.status === filterStatus;
    return matchSearch && matchHosp && matchSpec && matchStatus;
  });

  const totalPages   = Math.max(1, Math.ceil(filtered.length / rows));
  const currentItems = filtered.slice((page - 1) * rows, page * rows);

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (editItem) {
        const res = await api.put(`/api/distributions/${editItem._id}`, payload);
        setItems(p => p.map(d => d._id === editItem._id ? res.data : d));
        showToast('Updated');
      } else {
        const res = await api.post('/api/distributions', payload);
        setItems(p => [res.data, ...p]);
        showToast('Created');
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
      await api.delete(`/api/distributions/${delItem._id}`);
      setItems(p => p.filter(d => d._id !== delItem._id));
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
          <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Distribution</button>
        </div>

        <div className="admin-card">

          {/* Toolbar */}
          <div className="admin-toolbar">
            <input className="admin-search" placeholder="Search by doctor, hospital, specialty…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            <div className="view-toggle">
              <button className={`view-btn${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')}>☰</button>
              <button className={`view-btn${view === 'card'  ? ' active' : ''}`} onClick={() => setView('card')}>⊞</button>
            </div>
            <select className="rows-select" value={rows} onChange={e => { setRows(+e.target.value); setPage(1); }}>
              {ROWS_OPT.map(r => <option key={r} value={r}>{r} / page</option>)}
            </select>
          </div>

          {/* Filter bar */}
          <div className="filter-bar">
            <select value={filterHosp} onChange={e => { setFilterHosp(e.target.value); setPage(1); }}>
              <option value="">All Hospitals</option>
              {hospitals.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
            <input
              placeholder="Filter by specialty"
              value={filterSpec}
              onChange={e => { setFilterSpec(e.target.value); setPage(1); }}
              style={{ height: 34, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 10px', fontSize: 13 }}
            />
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* TABLE */}
          {view === 'table' && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Doctor</th>
                    <th>Hospital</th>
                    <th>Specialty</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 && (
                    <tr><td colSpan={8} className="admin-empty">No distributions found</td></tr>
                  )}
                  {currentItems.map((item, i) => (
                    <tr key={item._id}>
                      <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {item.doctor?.photoUrl
                            ? <img src={`${API_BASE}${item.doctor.photoUrl}`} alt="" className="cell-photo" />
                            : <div className="cell-initials">{item.doctor?.initials || '?'}</div>
                          }
                          <strong>{item.doctor?.name || '—'}</strong>
                        </div>
                      </td>
                      <td>{item.hospital?.name || '—'}</td>
                      <td><span className="specialty-tag">{item.specialty}</span></td>
                      <td>{fmtDate(item.startDate)}</td>
                      <td>{fmtDate(item.endDate)}</td>
                      <td>
                        <span className={item.status === 'active' ? 'badge-active' : 'badge-inactive'}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-action edit"   onClick={() => { setEditItem(item); setShowModal(true); }}><IconEdit /></button>
                          <button className="btn-action delete" onClick={() => setDelItem(item)}><IconDelete /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD VIEW */}
          {view === 'card' && (
            <div className="admin-card-grid">
              {currentItems.length === 0 && <div className="admin-empty">No distributions found</div>}
              {currentItems.map(item => (
                <div className="dist-card" key={item._id}>
                  <div className="dist-card-header">
                    {item.doctor?.photoUrl
                      ? <img src={`${API_BASE}${item.doctor.photoUrl}`} alt="" className="cell-photo" />
                      : <div className="cell-initials">{item.doctor?.initials || '?'}</div>
                    }
                    <div>
                      <div className="dist-card-name">{item.doctor?.name || '—'}</div>
                      <div className="dist-card-sub">{item.hospital?.name || '—'}</div>
                    </div>
                  </div>
                  <div className="dist-card-row">
                    <span className="specialty-tag">{item.specialty}</span>
                    <span className={item.status === 'active' ? 'badge-active' : 'badge-inactive'}>{item.status}</span>
                  </div>
                  <div className="dist-card-row" style={{ fontSize: 11, color: '#888' }}>
                    {fmtDate(item.startDate)} → {fmtDate(item.endDate)}
                  </div>
                  <div className="dist-card-actions">
                    <button className="btn-action edit"   onClick={() => { setEditItem(item); setShowModal(true); }}><IconEdit /></button>
                    <button className="btn-action delete" onClick={() => setDelItem(item)}><IconDelete /></button>
                  </div>
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

      {showModal && (
        <DistModal item={editItem} doctors={doctors} hospitals={hospitals} onSave={handleSave} onClose={() => setShowModal(false)} saving={saving} />
      )}
      {delItem && (
        <ConfirmDelete name={delItem.doctor?.name || 'this record'} onConfirm={confirmDelete} onCancel={() => setDelItem(null)} />
      )}
      <Toast toasts={toasts} />
    </>
  );
}
