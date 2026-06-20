import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';
import { IconEdit, IconPower } from '../components/icons';

const ROWS_OPT = [8, 16, 32];
const STATUS_OPTS = ['active', 'inactive'];

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function getData(res) {
  return safeArr(res?.data?.data || res?.data);
}

function getId(value) {
  return value?._id || value || '';
}

function textValue(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.name || value.title || fallback;
  return fallback;
}

function getStatusClass(status) {
  return status === 'active' ? 'badge-active' : 'badge-inactive';
}

function DistModal({ item, supervisors, hospitals, specialties, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    supervisorId: getId(item?.supervisorId || item?.doctor),
    hospitalId:   getId(item?.hospitalId || item?.hospital),
    specialtyId:  getId(item?.specialtyId),
    status:       item?.status || 'active'
  });
  const [errors, setErrors] = useState({});

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: false }));
  }

  function handleSave() {
    const e = {};
    if (!form.supervisorId) e.supervisorId = true;
    if (!form.hospitalId)   e.hospitalId   = true;
    if (!form.specialtyId)  e.specialtyId  = true;
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave(form);
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  const supervisorOptions = safeArr(supervisors).map(s => ({ value: s._id, label: `${s.name}${textValue(s.specialty || s.specialtyId, '') ? ` (${textValue(s.specialty || s.specialtyId)})` : ''}` }));
  const hospitalOptions = safeArr(hospitals).map(h => ({ value: h._id, label: `${h.name}${h.city ? ` (${h.city})` : ''}` }));
  const specialtyOptions = safeArr(specialties).map(s => ({ value: s._id, label: s.name }));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{item ? 'Edit Distribution' : 'Add Distribution'}</div>
          <button className="admin-modal-close" onClick={onClose} aria-label="Close distribution form">x</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">
            <div className="admin-field full">
              <label>Supervisor *</label>
              <SearchableSelect value={form.supervisorId} onChange={v => set('supervisorId', v)} options={supervisorOptions} placeholder="Search supervisor..." error={errors.supervisorId} />
            </div>

            <div className="admin-field full">
              <label>Hospital *</label>
              <SearchableSelect value={form.hospitalId} onChange={v => set('hospitalId', v)} options={hospitalOptions} placeholder="Search hospital..." error={errors.hospitalId} />
            </div>

            <div className="admin-field full">
              <label>Specialty *</label>
              <SearchableSelect value={form.specialtyId} onChange={v => set('specialtyId', v)} options={specialtyOptions} placeholder="Search specialty..." error={errors.specialtyId} />
            </div>

            <div className="admin-field full">
              <label>Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}>
                {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Close</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmStatus({ item, action, onConfirm, onCancel }) {
  const supervisor = item?.supervisorId || item?.doctor || {};
  const verb = action === 'reactivate' ? 'Reactivate' : 'Deactivate';
  return (
    <div className="confirm-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="confirm-box">
        <h3>{verb} Distribution</h3>
        <p>{verb} distribution for <strong>{supervisor?.name || 'this supervisor'}</strong>?</p>
        <div className="confirm-btns">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className="btn-red" onClick={onConfirm}>{verb}</button>
        </div>
      </div>
    </div>
  );
}

export default function Distributions() {
  const [items,      setItems    ] = useState([]);
  const [supervisors,setSupervisors] = useState([]);
  const [hospitals,  setHospitals] = useState([]);
  const [specialties,setSpecialties] = useState([]);
  const [loading,    setLoading  ] = useState(true);
  const [view,       setView     ] = useState('table');
  const [search,     setSearch   ] = useState('');
  const [page,       setPage     ] = useState(1);
  const [rows,       setRows     ] = useState(16);
  const [toasts,     setToasts   ] = useState([]);
  const [showModal,  setShowModal] = useState(false);
  const [editItem,   setEditItem ] = useState(null);
  const [saving,     setSaving   ] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(null);

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
      api.get('/api/users/supervisors'),
      api.get('/api/hospitals'),
      api.get('/api/specialties')
    ]).then(([d, sup, h, sp]) => {
      setItems(getData(d));
      setSupervisors(getData(sup));
      setHospitals(getData(h));
      setSpecialties(getData(sp));
    }).catch(() => showToast('Failed to load', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = safeArr(items).filter(item => {
    const supervisor = item?.supervisorId || item?.doctor || {};
    const hospital = item?.hospitalId || item?.hospital || {};
    const specialty = textValue(item?.specialtyId || item?.specialty, '');
    const q = search.toLowerCase();
    const matchSearch = !q ||
      supervisor?.name?.toLowerCase().includes(q) ||
      hospital?.name?.toLowerCase().includes(q) ||
      specialty.toLowerCase().includes(q);
    const matchHosp   = !filterHosp || hospital?._id === filterHosp || hospital === filterHosp;
    const matchSpec   = !filterSpec || specialty.toLowerCase().includes(filterSpec.toLowerCase());
    const matchStatus = !filterStatus || item?.status === filterStatus;
    return matchSearch && matchHosp && matchSpec && matchStatus;
  });

  const totalPages   = Math.max(1, Math.ceil(filtered.length / rows));
  const currentItems = filtered.slice((page - 1) * rows, page * rows);

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (editItem) {
        const res = await api.put(`/api/distributions/${editItem._id}`, payload);
        const updated = res.data?.data || res.data;
        setItems(p => safeArr(p).map(d => d._id === editItem._id ? updated : d));
        showToast('Updated');
      } else {
        const res = await api.post('/api/distributions', payload);
        const created = res.data?.data || res.data;
        setItems(p => [created, ...safeArr(p)]);
        showToast('Created');
      }
      setShowModal(false);
      setEditItem(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function applyStatusAction() {
    const { item, action } = confirmStatus;
    try {
      const res = action === 'reactivate'
        ? await api.patch(`/api/distributions/${item._id}/reactivate`)
        : await api.delete(`/api/distributions/${item._id}`);
      const updated = res.data?.data || { ...item, status: action === 'reactivate' ? 'active' : 'inactive' };
      setItems(p => safeArr(p).map(d => d._id === item._id ? updated : d));
      showToast(action === 'reactivate' ? 'Reactivated' : 'Deactivated');
    } catch {
      showToast('Status update failed', 'error');
    } finally {
      setConfirmStatus(null);
    }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1, minWidth: 200 }} /><Sk w={70} h={36} r={8} /><Sk w={110} h={36} r={8} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(8)].map((_, i) => (
                  <tr key={i}>
                    {[20,150,120,100,70,80].map((w, j) => <td key={j}><Sk w={w} h={13} /></td>)}
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
        <div className="admin-card">
          <div className="admin-toolbar">
            <input className="admin-search" placeholder="Search by supervisor, hospital, specialty..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            <button className="btn-purple" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add Distribution</button>
            <ViewToggle value={view} onChange={setView} listValue="table" />
            <select className="rows-select" value={rows} onChange={e => { setRows(+e.target.value); setPage(1); }}>
              {ROWS_OPT.map(r => <option key={r} value={r}>{r} / page</option>)}
            </select>
          </div>

          <div className="filter-bar">
            <select value={filterHosp} onChange={e => { setFilterHosp(e.target.value); setPage(1); }}>
              <option value="">All Hospitals</option>
              {safeArr(hospitals).map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
            <input
              placeholder="Filter by specialty"
              value={filterSpec}
              onChange={e => { setFilterSpec(e.target.value); setPage(1); }}
              style={{ height: 34, border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 10px', fontSize: 13 }}
            />
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>

          {view === 'table' && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Supervisor</th>
                    <th>Hospital</th>
                    <th>Specialty</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length === 0 && (
                    <tr><td colSpan={6} className="admin-empty">No distributions found</td></tr>
                  )}
                  {currentItems.map((item, i) => {
                    const supervisor = item?.supervisorId || item?.doctor || {};
                    const hospital = item?.hospitalId || item?.hospital || {};
                    const specialty = textValue(item?.specialtyId || item?.specialty);
                    const isActive = item?.status === 'active';
                    return (
                      <tr key={item._id}>
                        <td style={{ color: '#aaa' }}>{(page - 1) * rows + i + 1}</td>
                        <td><strong>{supervisor?.name || '-'}</strong></td>
                        <td>{hospital?.name || '-'}</td>
                        <td><span className="specialty-tag">{specialty}</span></td>
                        <td><span className={getStatusClass(item?.status)}>{item?.status || '-'}</span></td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-action edit" title="Edit" aria-label={`Edit distribution for ${supervisor?.name || 'supervisor'}`} onClick={() => { setEditItem(item); setShowModal(true); }}><IconEdit /></button>
                            <button className="btn-action delete" title={isActive ? 'Deactivate' : 'Reactivate'} aria-label={`${isActive ? 'Deactivate' : 'Reactivate'} distribution for ${supervisor?.name || 'supervisor'}`} onClick={() => setConfirmStatus({ item, action: isActive ? 'deactivate' : 'reactivate' })}><IconPower /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {view === 'card' && (
            <div className="admin-card-grid">
              {currentItems.length === 0 && <div className="admin-empty">No distributions found</div>}
              {currentItems.map(item => {
                const supervisor = item?.supervisorId || item?.doctor || {};
                const hospital = item?.hospitalId || item?.hospital || {};
                const specialty = textValue(item?.specialtyId || item?.specialty);
                const isActive = item?.status === 'active';
                return (
                  <div className="dist-card" key={item._id}>
                    <div className="dist-card-header">
                      <div>
                        <div className="dist-card-name">{supervisor?.name || '-'}</div>
                        <div className="dist-card-sub">{hospital?.name || '-'}</div>
                      </div>
                    </div>
                    <div className="dist-card-row">
                      <span className="specialty-tag">{specialty}</span>
                      <span className={getStatusClass(item?.status)}>{item?.status || '-'}</span>
                    </div>
                    <div className="dist-card-actions">
                      <button className="btn-action edit" title="Edit" aria-label={`Edit distribution for ${supervisor?.name || 'supervisor'}`} onClick={() => { setEditItem(item); setShowModal(true); }}><IconEdit /></button>
                      <button className="btn-action delete" title={isActive ? 'Deactivate' : 'Reactivate'} aria-label={`${isActive ? 'Deactivate' : 'Reactivate'} distribution for ${supervisor?.name || 'supervisor'}`} onClick={() => setConfirmStatus({ item, action: isActive ? 'deactivate' : 'reactivate' })}><IconPower /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="admin-pagination">
            <span>Showing {filtered.length ? Math.min((page - 1) * rows + 1, filtered.length) : 0}-{Math.min(page * rows, filtered.length)} of {filtered.length}</span>
            <div className="pagination-btns">
              <button className="pg-btn" disabled={page === 1} onClick={() => setPage(1)}>&lt;&lt;</button>
              <button className="pg-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>&lt;</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .map(n => <button key={n} className={`pg-btn${n === page ? ' active-pg' : ''}`} onClick={() => setPage(n)}>{n}</button>)
              }
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>&gt;</button>
              <button className="pg-btn" disabled={page === totalPages} onClick={() => setPage(totalPages)}>&gt;&gt;</button>
            </div>
          </div>
        </div>
      </main>

      {showModal && (
        <DistModal item={editItem} supervisors={supervisors} hospitals={hospitals} specialties={specialties} onSave={handleSave} onClose={() => setShowModal(false)} saving={saving} />
      )}
      {confirmStatus && (
        <ConfirmStatus item={confirmStatus.item} action={confirmStatus.action} onConfirm={applyStatusAction} onCancel={() => setConfirmStatus(null)} />
      )}
      <Toast toasts={toasts} />
    </>
  );
}
