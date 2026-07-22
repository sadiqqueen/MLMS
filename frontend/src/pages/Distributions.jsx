// W2-Developer — Distributions (rotation distributions CRUD). mt- restyle; all
// existing behaviour kept: create/edit modal (SearchableSelect), status
// activate/deactivate, hospital/specialty/status filters, search, table+card
// views, per-page size. Shared with the de-scoped `secretary` role via the old
// shell — only super_admin renders the mt- shell here.
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import MtModal from '../components/MtModal';
import Pagination from '../components/Pagination';
import RevealOnScroll from '../components/RevealOnScroll';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconPencil, IconPower } from '../components/icons';
import api from '../api/axios';
import { MagnifierIcon } from './devkit';
import { specialtyName } from '../utils/specialtyName';
import './developer.css';

const ROWS_OPT = [8, 16, 32];
const STATUS_OPTS = ['active', 'inactive'];

const safeArr = (v) => (Array.isArray(v) ? v : []);
const getData = (res) => safeArr(res?.data?.data || res?.data);
const getId = (v) => v?._id || v || '';
function textValue(v, fallback = '—') {
  if (v == null || v === '') return fallback;
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.name || v.title || fallback;
  return fallback;
}

// ── Add / Edit modal ─────────────────────────────────────────────────────────
function DistModal({ item, supervisors, hospitals, specialties, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    supervisorId: getId(item?.supervisorId || item?.doctor),
    hospitalId: getId(item?.hospitalId || item?.hospital),
    specialtyId: getId(item?.specialtyId),
    status: item?.status || 'active',
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: false })); };

  function handleSave() {
    const e = {};
    if (!form.supervisorId) e.supervisorId = true;
    if (!form.hospitalId) e.hospitalId = true;
    if (!form.specialtyId) e.specialtyId = true;
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave(form);
  }

  const supervisorOptions = safeArr(supervisors).map((s) => ({ value: s._id, label: `${s.name}${textValue(s.specialty || s.specialtyId, '') !== '—' ? ` (${textValue(s.specialty || s.specialtyId)})` : ''}` }));
  const hospitalOptions = safeArr(hospitals).map((h) => ({ value: h._id, label: `${h.name}${h.city ? ` (${h.city})` : ''}` }));
  const specialtyOptions = safeArr(specialties).map((s) => ({ value: s._id, label: specialtyName(s) }));

  return (
    <MtModal open title={item ? 'Edit distribution' : 'Add distribution'} sub="Assign a trainer to a hospital & specialty"
      onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">Trainer <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.supervisorId} onChange={(v) => set('supervisorId', v)} options={supervisorOptions} placeholder="Search trainer…" error={errors.supervisorId} />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Hospital <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.hospitalId} onChange={(v) => set('hospitalId', v)} options={hospitalOptions} placeholder="Search hospital…" error={errors.hospitalId} />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Specialty <span className="mt-label-req">*</span></label>
          <SearchableSelect value={form.specialtyId} onChange={(v) => set('specialtyId', v)} options={specialtyOptions} placeholder="Search specialty…" error={errors.specialtyId} />
        </div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Status</label>
          <select className="mt-select" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>
    </MtModal>
  );
}

function ConfirmStatus({ item, action, onConfirm, onCancel }) {
  const supervisor = item?.supervisorId || item?.doctor || {};
  const verb = action === 'reactivate' ? 'Reactivate' : 'Deactivate';
  return (
    <MtModal open title={`${verb} distribution`} onClose={onCancel}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onCancel}>Cancel</button>
        <button type="button" className={action === 'reactivate' ? 'mt-btn' : 'mt-btn--danger-solid'} onClick={onConfirm}>{verb}</button>
      </>}>
      <p className="dev-confirm-text">{verb} the distribution for <strong>{supervisor?.name || 'this trainer'}</strong>?</p>
    </MtModal>
  );
}

export default function Distributions() {
  const { toasts, showToast } = useMtToast();
  const [items, setItems] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(16);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(null);
  const [filterHosp, setFilterHosp] = useState('');
  const [filterSpec, setFilterSpec] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/distributions'),
      api.get('/api/users/supervisors'),
      api.get('/api/hospitals'),
      api.get('/api/specialties'),
    ]).then(([d, sup, h, sp]) => {
      setItems(getData(d)); setSupervisors(getData(sup)); setHospitals(getData(h)); setSpecialties(getData(sp));
    }).catch(() => showToast('Failed to load', 'dng')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = safeArr(items).filter((item) => {
    const supervisor = item?.supervisorId || item?.doctor || {};
    const hospital = item?.hospitalId || item?.hospital || {};
    const specialty = textValue(item?.specialtyId || item?.specialty, '');
    const q = search.toLowerCase();
    const matchSearch = !q || supervisor?.name?.toLowerCase().includes(q) || hospital?.name?.toLowerCase().includes(q) || specialty.toLowerCase().includes(q);
    const matchHosp = !filterHosp || hospital?._id === filterHosp || hospital === filterHosp;
    const matchSpec = !filterSpec || specialty.toLowerCase().includes(filterSpec.toLowerCase());
    const matchStatus = !filterStatus || item?.status === filterStatus;
    return matchSearch && matchHosp && matchSpec && matchStatus;
  });
  const currentItems = filtered.slice((page - 1) * rows, page * rows);

  async function handleSave(payload) {
    setSaving(true);
    try {
      if (editItem) {
        const res = await api.put(`/api/distributions/${editItem._id}`, payload);
        const updated = res.data?.data || res.data;
        setItems((p) => safeArr(p).map((d) => (d._id === editItem._id ? updated : d)));
        showToast('Distribution updated', 'ok');
      } else {
        const res = await api.post('/api/distributions', payload);
        const created = res.data?.data || res.data;
        setItems((p) => [created, ...safeArr(p)]);
        showToast('Distribution created', 'ok');
      }
      setShowModal(false); setEditItem(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'dng');
    } finally { setSaving(false); }
  }

  async function applyStatusAction() {
    const { item, action } = confirmStatus;
    try {
      const res = action === 'reactivate'
        ? await api.patch(`/api/distributions/${item._id}/reactivate`)
        : await api.delete(`/api/distributions/${item._id}`);
      const updated = res.data?.data || { ...item, status: action === 'reactivate' ? 'active' : 'inactive' };
      setItems((p) => safeArr(p).map((d) => (d._id === item._id ? updated : d)));
      showToast(action === 'reactivate' ? 'Reactivated' : 'Deactivated', 'ok');
    } catch { showToast('Status update failed', 'dng'); } finally { setConfirmStatus(null); }
  }

  const statusPill = (st) => st === 'active'
    ? <span className="mt-pill mt-pill--active">Active</span>
    : <span className="mt-pill mt-pill--rejected">Inactive</span>;

  const rowActions = (item) => {
    const isActive = item?.status === 'active';
    return (
      <div className="mt-row-actions">
        <button className="mt-icon-action" title="Edit" aria-label="Edit distribution" onClick={() => { setEditItem(item); setShowModal(true); }}><IconPencil size={15} /></button>
        <button className="mt-icon-action dev-act-danger" title={isActive ? 'Deactivate' : 'Reactivate'} aria-label={isActive ? 'Deactivate' : 'Reactivate'} onClick={() => setConfirmStatus({ item, action: isActive ? 'deactivate' : 'reactivate' })}><IconPower size={15} /></button>
      </div>
    );
  };

  return (
    <>
      <Navbar title="Distributions" subtitle="Developer" />
      <main className="mt-content">
        <div className="mt-filterbar">
          <div className="mt-search">
            <MagnifierIcon />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" aria-label="Search distributions" />
          </div>
          <select className="mt-filter" value={filterHosp} onChange={(e) => { setFilterHosp(e.target.value); setPage(1); }} aria-label="Hospital filter">
            <option value="">Hospital: All</option>
            {safeArr(hospitals).map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
          <input className="mt-filter" style={{ minWidth: 140 }} placeholder="Specialty…" value={filterSpec} onChange={(e) => { setFilterSpec(e.target.value); setPage(1); }} aria-label="Specialty filter" />
          <select className="mt-filter" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} aria-label="Status filter">
            <option value="">Status: All</option>
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <span className="mt-filterbar-spacer" />
          <button className="mt-btn" onClick={() => { setEditItem(null); setShowModal(true); }}>+ Add distribution</button>
          <ViewToggle value={view} onChange={setView} listValue="table" />
          <select className="mt-filter" value={rows} onChange={(e) => { setRows(+e.target.value); setPage(1); }} aria-label="Rows per page">
            {ROWS_OPT.map((r) => <option key={r} value={r}>{r} / page</option>)}
          </select>
          <span className="mt-count">{filtered.length} distributions</span>
        </div>

        {loading ? <div className="skeleton mt-skel" style={{ height: 320 }} /> : view === 'table' ? (
          <RevealOnScroll>
            <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table">
                  <thead><tr>
                    <th className="mt-th">Trainer</th><th className="mt-th">Hospital</th>
                    <th className="mt-th">Specialty</th><th className="mt-th">Status</th><th className="mt-th" />
                  </tr></thead>
                  <tbody>
                    {currentItems.length === 0 && (
                      <tr><td className="mt-td mt-td--muted" colSpan={5} style={{ textAlign: 'center', padding: 40 }}>No distributions found.</td></tr>
                    )}
                    {currentItems.map((item) => {
                      const supervisor = item?.supervisorId || item?.doctor || {};
                      const hospital = item?.hospitalId || item?.hospital || {};
                      return (
                        <tr key={item._id}>
                          <td className="mt-td mt-td--name">{supervisor?.name || '—'}</td>
                          <td className="mt-td">{hospital?.name || '—'}</td>
                          <td className="mt-td mt-td--muted">{textValue(item?.specialtyId || item?.specialty)}</td>
                          <td className="mt-td">{statusPill(item?.status)}</td>
                          <td className="mt-td mt-td--actions">{rowActions(item)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </RevealOnScroll>
        ) : (
          <div className="mt-acct-grid">
            {currentItems.length === 0 && <div className="mt-empty"><div className="mt-empty-title">No distributions found.</div></div>}
            {currentItems.map((item) => {
              const supervisor = item?.supervisorId || item?.doctor || {};
              const hospital = item?.hospitalId || item?.hospital || {};
              return (
                <div className="dev-card" key={item._id}>
                  <div className="dev-card-name">{supervisor?.name || '—'}</div>
                  <div className="dev-card-sub">{hospital?.name || '—'}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBlockStart: 4 }}>
                    <span className="mt-pill mt-pill--neutral">{textValue(item?.specialtyId || item?.specialty)}</span>
                    {statusPill(item?.status)}
                  </div>
                  <div className="dev-card-actions">{rowActions(item)}</div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > rows && (
          <Pagination page={page} pageSize={rows} total={filtered.length}
            onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
        )}

        {showModal && (
          <DistModal item={editItem} supervisors={supervisors} hospitals={hospitals} specialties={specialties}
            onSave={handleSave} onClose={() => { setShowModal(false); setEditItem(null); }} saving={saving} />
        )}
        {confirmStatus && (
          <ConfirmStatus item={confirmStatus.item} action={confirmStatus.action} onConfirm={applyStatusAction} onCancel={() => setConfirmStatus(null)} />
        )}
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
