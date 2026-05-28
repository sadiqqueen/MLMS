import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

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
function HospitalModal({ item, programDirectors, supervisors, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name:            item?.name            || '',
    city:            item?.city            || '',
    governorate:     item?.governorate     || '',
    address:         item?.address         || '',
    phone:           item?.phone           || '',
    email:           item?.email           || '',
    programDirector: item?.programDirector?._id || item?.programDirector || '',
    supervisors:     (item?.supervisors || []).map(s => s._id || s),
  });
  const [supSearch, setSupSearch] = useState('');
  const [errors,    setErrors   ] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function toggleSupervisor(id) {
    setForm(f => ({
      ...f,
      supervisors: f.supervisors.includes(id)
        ? f.supervisors.filter(s => s !== id)
        : [...f.supervisors, id],
    }));
  }

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

  const filteredSups    = supervisors.filter(s =>
    !supSearch || s.name?.toLowerCase().includes(supSearch.toLowerCase())
  );
  const selectedSupObjs = supervisors.filter(s => form.supervisors.includes(s._id));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal admin-modal-lg" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="admin-modal-header">
          <div className="admin-modal-title">{item ? 'Edit Hospital' : 'Add Hospital'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="admin-modal-body">
          <div className="admin-form-grid">

            <div className="admin-field full">
              <label>Hospital Name *</label>
              <input
                className={errors.name ? 'invalid' : ''}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Hospital name"
              />
            </div>

            <div className="admin-field">
              <label>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </div>

            <div className="admin-field">
              <label>Governorate</label>
              <input value={form.governorate} onChange={e => set('governorate', e.target.value)} placeholder="Governorate" />
            </div>

            <div className="admin-field full">
              <label>Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full address" />
            </div>

            <div className="admin-field">
              <label>Phone</label>
              <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+964 xxx xxx xxxx" />
            </div>

            <div className="admin-field">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="hospital@example.com"
              />
            </div>

            <div className="admin-field full">
              <label>Program Director</label>
              <select value={form.programDirector} onChange={e => set('programDirector', e.target.value)}>
                <option value="">— None —</option>
                {programDirectors.map(pd => (
                  <option key={pd._id} value={pd._id}>
                    {pd.name}{pd.specialty ? ` (${pd.specialty})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-field full">
              <label>Supervisors</label>

              {selectedSupObjs.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {selectedSupObjs.map(s => (
                    <span key={s._id} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: '#EEEDFE', color: '#1B1464'
                    }}>
                      {s.name}
                      <button
                        type="button"
                        onClick={() => toggleSupervisor(s._id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#1B1464', fontSize: 16, lineHeight: 1, padding: 0, marginLeft: 2
                        }}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}

              <input
                className="admin-search"
                style={{ marginBottom: 8, height: 34, width: '100%' }}
                placeholder="Search supervisors…"
                value={supSearch}
                onChange={e => setSupSearch(e.target.value)}
              />

              <div style={{
                maxHeight: 180, overflowY: 'auto',
                border: '1px solid #E8E9EF', borderRadius: 8, padding: '4px 8px'
              }}>
                {filteredSups.length === 0 && (
                  <div style={{ fontSize: 13, color: '#8B8FA8', padding: '10px 4px' }}>No supervisors found</div>
                )}
                {filteredSups.map(s => (
                  <label key={s._id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 4px',
                    cursor: 'pointer', borderRadius: 6, marginBottom: 2,
                    background: form.supervisors.includes(s._id) ? '#F5F3FF' : 'transparent'
                  }}>
                    <input
                      type="checkbox"
                      checked={form.supervisors.includes(s._id)}
                      onChange={() => toggleSupervisor(s._id)}
                    />
                    <span style={{ fontSize: 13, color: '#1B1464', fontWeight: 500 }}>{s.name}</span>
                    {s.specialty && (
                      <span style={{ fontSize: 11, color: '#8B8FA8' }}>{s.specialty}</span>
                    )}
                  </label>
                ))}
              </div>
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

// ── University Modal ───────────────────────────────────────────────────────
function UniversityModal({ item, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name:         item?.name         || '',
    city:         item?.city         || '',
    address:      item?.address      || '',
    contactEmail: item?.contactEmail || '',
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

  const [tab,              setTab            ] = useState(0);
  const [hospitals,        setHospitals      ] = useState([]);
  const [universities,     setUnis           ] = useState([]);
  const [programDirectors, setProgramDirectors] = useState([]);
  const [supervisors,      setSupervisors    ] = useState([]);
  const [loading,          setLoading        ] = useState(true);
  const [view,             setView           ] = useState('table');
  const [search,           setSearch         ] = useState('');
  const [page,             setPage           ] = useState(1);
  const [rows,             setRows           ] = useState(16);
  const [toasts,           setToasts         ] = useState([]);
  const [showModal,        setShowModal      ] = useState(false);
  const [editItem,         setEditItem       ] = useState(null);
  const [saving,           setSaving         ] = useState(false);
  const [delItem,          setDelItem        ] = useState(null);

  function showToast(msg, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/hospitals'),
      api.get('/api/universities'),
      api.get('/api/users/program-directors'),
      api.get('/api/users/supervisors'),
    ]).then(([h, u, pd, sv]) => {
      setHospitals(h.data?.data || h.data || []);
      setUnis(u.data?.data || u.data || []);
      setProgramDirectors(pd.data?.data || pd.data || []);
      setSupervisors(sv.data?.data || sv.data || []);
    }).catch(() => showToast('Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const isHospital   = isAdmin || tab === 0;
  const data         = isHospital ? hospitals : universities;
  const filtered     = data.filter(item => {
    const q = search.toLowerCase();
    return !q || item.name?.toLowerCase().includes(q) || item.city?.toLowerCase().includes(q);
  });
  const totalPages   = Math.max(1, Math.ceil(filtered.length / rows));
  const currentItems = filtered.slice((page - 1) * rows, page * rows);

  async function handleSave(payload) {
    setSaving(true);
    try {
      let res;
      if (isHospital) {
        const url = editItem ? `/api/hospitals/${editItem._id}` : '/api/hospitals';
        res = await api[editItem ? 'patch' : 'post'](url, payload);
        const saved = res.data?.data || res.data;
        setHospitals(prev => editItem
          ? prev.map(h => h._id === editItem._id ? saved : h)
          : [saved, ...prev]
        );
      } else {
        const url = editItem ? `/api/universities/${editItem._id}` : '/api/universities';
        res = await api[editItem ? 'put' : 'post'](url, payload);
        const saved = res.data?.data || res.data;
        setUnis(prev => editItem
          ? prev.map(u => u._id === editItem._id ? saved : u)
          : [saved, ...prev]
        );
      }
      showToast(editItem ? 'Updated' : 'Created');
      setShowModal(false);
      setEditItem(null);
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
    finally  { setDelItem(null); }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-page-header"><Sk w={160} h={38} r={8} /></div>
        <div className="admin-card">
          <div className="admin-toolbar">
            <Sk h={36} r={8} style={{ flex: 1, minWidth: 200 }} />
            <Sk w={70}  h={36} r={8} />
            <Sk w={110} h={36} r={8} />
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {['#', 'Name', 'City', 'Program Director', 'Supervisors', 'Actions'].map(c => <th key={c}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td><Sk w={20}  h={13} /></td>
                    <td><Sk w={140} h={13} /></td>
                    <td><Sk w={80}  h={13} /></td>
                    <td><Sk w={120} h={13} /></td>
                    <td><Sk w={60}  h={20} r={20} /></td>
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
          {canManage && (
            <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>
              + {isHospital ? 'Add Hospital' : 'Add University'}
            </button>
          )}
        </div>

        <div className="admin-card">

          {!isAdmin && (
            <div className="admin-tabs">
              <button className={`admin-tab${tab === 0 ? ' active' : ''}`} onClick={() => { setTab(0); setPage(1); }}>Hospitals</button>
              <button className={`admin-tab${tab === 1 ? ' active' : ''}`} onClick={() => { setTab(1); setPage(1); }}>Universities</button>
            </div>
          )}

          <div className="admin-toolbar">
            <input
              className="admin-search"
              placeholder="Search by name or city…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <div className="view-toggle">
              <button className={`view-btn${view === 'table' ? ' active' : ''}`} onClick={() => setView('table')}>☰</button>
              <button className={`view-btn${view === 'card'  ? ' active' : ''}`} onClick={() => setView('card')}>⊞</button>
            </div>
            <select className="rows-select" value={rows} onChange={e => { setRows(+e.target.value); setPage(1); }}>
              {ROWS_OPT.map(r => <option key={r} value={r}>{r} / page</option>)}
            </select>
          </div>

          {view === 'table' && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>City</th>
                    {isHospital
                      ? <><th>Program Director</th><th>Supervisors</th></>
                      : <th>Contact Email</th>
                    }
                    {canManage && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 && (
                    <tr><td colSpan={7} className="admin-empty">No records found</td></tr>
                  )}
                  {currentItems.map((item, i) => (
                    <tr key={item._id}>
                      <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.city || '—'}</td>
                      {isHospital ? (
                        <>
                          <td>{item.programDirector?.name || '—'}</td>
                          <td>
                            {(item.supervisors || []).length > 0
                              ? <span className="specialty-tag">
                                  {(item.supervisors || []).length} supervisor{(item.supervisors || []).length !== 1 ? 's' : ''}
                                </span>
                              : '—'
                            }
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

          {view === 'card' && (
            <div className="admin-card-grid">
              {currentItems.length === 0 && <div className="admin-empty">No records found</div>}
              {currentItems.map(item => (
                <div className="user-card" key={item._id}>
                  <div style={{ fontSize: 36 }}>{isHospital ? '🏥' : '🏛️'}</div>
                  <div className="user-card-name">{item.name}</div>
                  <div className="user-card-sub">{item.city || '—'}</div>
                  {isHospital && (
                    <>
                      {item.programDirector?.name && (
                        <div style={{ fontSize: 12, color: '#4B5563', marginTop: 4 }}>
                          PD: <strong>{item.programDirector.name}</strong>
                        </div>
                      )}
                      {(item.supervisors || []).length > 0 && (
                        <div style={{ fontSize: 12, color: '#8B8FA8' }}>
                          {(item.supervisors || []).length} supervisor{(item.supervisors || []).length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </>
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
        <HospitalModal
          item={editItem}
          programDirectors={programDirectors}
          supervisors={supervisors}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          saving={saving}
        />
      )}
      {showModal && !isHospital && (
        <UniversityModal
          item={editItem}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditItem(null); }}
          saving={saving}
        />
      )}
      {delItem && (
        <ConfirmDelete name={delItem.name} onConfirm={confirmDelete} onCancel={() => setDelItem(null)} />
      )}
      <Toast toasts={toasts} />
    </>
  );
}
