// W2-Developer — Specialties (RULINGS §B14 wires the orphaned AdminSpecialties;
// §C15/§39 make the REAL hierarchy authoritative: 20 Scientific Councils → main /
// precise specialties with string codes). Rebuilt per design as a council →
// main/precise browse table (Specialty · Type · Council · Code · HOC · Status),
// with an Add-Specialty modal (fields adapted to the real hierarchy) and the
// legacy per-specialty PDF report/eval template manager preserved behind a
// per-row "Templates" action (no-feature-removal).
//
// Data: GET /api/specialties (super_admin → all rows incl. type/code/councilId),
//       GET /api/admin/councils (council names), GET /api/admin/users?role=hoc.
import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import MtModal from '../components/MtModal';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { IconBook, IconFileText } from '../components/icons';
import api from '../api/axios';
import { MagnifierIcon } from './devkit';
import './developer.css';

const PDF_TYPES = [
  { key: 'weekly', label: 'Weekly report', field: 'weeklyReportPdf', path: 'upload-weekly' },
  { key: 'monthly', label: 'Monthly report', field: 'monthlyReportPdf', path: 'upload-monthly' },
  { key: 'final', label: 'Final report', field: 'finalReportPdf', path: 'upload-final' },
];
const EVAL_TYPES = [1, 2, 3, 4, 5].map((n) => ({ key: `eval${n}`, label: `Eval form ${n}`, field: `evaluationPdf${n}`, path: `upload-eval${n}` }));

// ── Add specialty modal (real-hierarchy fields) ──────────────────────────────
function AddSpecialtyModal({ councils, onCreate, onClose, saving }) {
  const [f, setF] = useState({ name: '', nameEn: '', type: 'precise', councilId: '', code: '' });
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setF((s) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: false })); };
  function submit() {
    const e = {};
    if (!f.name.trim()) e.name = true;
    setErrors(e);
    if (Object.keys(e).length) return;
    onCreate(f);
  }
  return (
    <MtModal open title="Add specialty" sub="Main or precise specialty" meta="Developer" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create specialty'}</button>
      </>}>
      <div className="mt-banner">This record will be added to the registry.</div>
      <div className="mt-field-grid">
        <div className="mt-field"><label className="mt-label">Name <span className="mt-label-req">*</span></label><input className={`mt-input${errors.name ? ' dev-invalid' : ''}`} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Specialty name" /></div>
        <div className="mt-field"><label className="mt-label">English name</label><input className="mt-input" value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} placeholder="English name" /></div>
        <div className="mt-field">
          <label className="mt-label">Type</label>
          <div className="mt-radio-group">
            <label className="mt-check-label"><input type="radio" className="mt-check" name="spType" checked={f.type === 'main'} onChange={() => set('type', 'main')} /> Main</label>
            <label className="mt-check-label"><input type="radio" className="mt-check" name="spType" checked={f.type === 'precise'} onChange={() => set('type', 'precise')} /> Precise</label>
          </div>
        </div>
        <div className="mt-field"><label className="mt-label">Code</label><input className="mt-input mt-input--mono" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder='e.g. "05" or "05d1"' /></div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Council</label>
          <select className="mt-select" value={f.councilId} onChange={(e) => set('councilId', e.target.value)}>
            <option value="">— Select council —</option>
            {councils.map((c) => <option key={c._id} value={c._id}>{c.name}{c.nameEn ? ` — ${c.nameEn}` : ''}</option>)}
          </select>
        </div>
      </div>
    </MtModal>
  );
}

// ── Templates modal (legacy PDF report / eval upload — preserved feature) ─────
function TemplatesModal({ specialty, onClose, onUpdated, showToast }) {
  const [busy, setBusy] = useState({});
  const fileRefs = useRef({});

  async function upload(field, path, key, file) {
    if (!file) return;
    if (!file.type.includes('pdf')) { showToast('Only PDF files are allowed', 'dng'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('File must be under 10 MB', 'dng'); return; }
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post(`/api/specialties/${specialty._id}/${path}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onUpdated(res.data?.data || res.data);
      showToast('Template uploaded', 'ok');
    } catch (err) { showToast(err.response?.data?.message || 'Upload failed', 'dng'); } finally { setBusy((b) => ({ ...b, [key]: false })); }
  }

  const Slot = ({ t }) => {
    const has = !!specialty[t.field];
    const loading = !!busy[t.key];
    return (
      <div className="dev-tpl-slot">
        <div className="dev-tpl-slot-title">{t.label}</div>
        <div className="dev-tpl-slot-state">
          {has
            ? <a className="dev-tpl-link" href={specialty[t.field]} target="_blank" rel="noreferrer">Template uploaded ↗</a>
            : <span>No template yet</span>}
        </div>
        <button className="mt-btn--small-outline" disabled={loading} onClick={() => fileRefs.current[t.key]?.click()}>
          {loading ? 'Uploading…' : has ? 'Replace PDF' : 'Upload PDF'}
        </button>
        <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} ref={(el) => { fileRefs.current[t.key] = el; }}
          onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(t.field, t.path, t.key, file); e.target.value = ''; }} />
      </div>
    );
  };

  return (
    <MtModal open title="Report & evaluation templates" sub={specialty.name} onClose={onClose}
      footer={<button type="button" className="mt-btn--cancel" onClick={onClose}>Close</button>}>
      <div className="dev-tpl-section-label">Report templates</div>
      <div className="dev-tpl-grid">{PDF_TYPES.map((t) => <Slot key={t.key} t={t} />)}</div>
      <div className="dev-tpl-section-label">Evaluation form templates</div>
      <div className="dev-tpl-grid">{EVAL_TYPES.map((t) => <Slot key={t.key} t={t} />)}</div>
    </MtModal>
  );
}

export default function AdminSpecialties() {
  const { toasts, showToast } = useMtToast();
  const [specialties, setSpecialties] = useState([]);
  const [councils, setCouncils] = useState([]);
  const [hocByCouncil, setHocByCouncil] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [councilFilter, setCouncilFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tplSpecialty, setTplSpecialty] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/api/specialties'),
      api.get('/api/admin/councils').catch(() => ({ data: { data: [] } })),
      api.get('/api/admin/users', { params: { role: 'hoc', limit: 100 } }).catch(() => ({ data: { data: [] } })),
    ]).then(([sp, co, hoc]) => {
      setSpecialties(sp.data?.data || sp.data || []);
      setCouncils(co.data?.data || co.data || []);
      const map = {};
      (hoc.data?.data || hoc.data || []).forEach((h) => { const cid = h.councilId?._id || h.councilId; if (cid) map[String(cid)] = h.name; });
      setHocByCouncil(map);
    }).catch(() => showToast('Failed to load specialties', 'dng')).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const councilName = (id) => { const c = councils.find((x) => String(x._id) === String(id)); return c ? (c.nameEn || c.name) : null; };

  async function handleCreate(f) {
    setSaving(true);
    try {
      // TODO(fable): the backend whitelist SPECIALTY_FIELDS (routes/specialties.js
      // + routes/adminV2.js) omits type/code/councilId/nameEn, so only `name`
      // persists here — a full hierarchy create needs those fields added server-side.
      const res = await api.post('/api/specialties', { name: f.name, nameEn: f.nameEn, type: f.type, councilId: f.councilId || undefined, code: f.code || undefined });
      const created = res.data?.data || res.data;
      setSpecialties((prev) => [created, ...prev]);
      showToast('Specialty added', 'ok');
      setShowAdd(false);
    } catch (err) { showToast(err.response?.data?.message || 'Failed to create specialty', 'dng'); } finally { setSaving(false); }
  }

  const q = search.trim().toLowerCase();
  const rows = specialties
    .filter((s) => !typeFilter || (s.type || 'precise') === typeFilter)
    .filter((s) => {
      if (!councilFilter) return true;
      if (councilFilter === '__none__') return !(s.councilId);
      return String(s.councilId?._id || s.councilId) === councilFilter;
    })
    .filter((s) => !q || s.name?.toLowerCase().includes(q) || s.nameEn?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q))
    .sort((a, b) => {
      const ca = councilName(a.councilId?._id || a.councilId) || 'zzz';
      const cb = councilName(b.councilId?._id || b.councilId) || 'zzz';
      if (ca !== cb) return ca.localeCompare(cb);
      const ta = a.type === 'main' ? 0 : 1; const tb = b.type === 'main' ? 0 : 1;
      if (ta !== tb) return ta - tb;
      return String(a.code || a.name || '').localeCompare(String(b.code || b.name || ''));
    });

  const typePill = (t) => t === 'main'
    ? <span className="mt-pill mt-pill--warn">Main</span>
    : <span className="mt-pill mt-pill--active">Precise</span>;

  return (
    <>
      <Navbar title="Specialties" subtitle="Developer" />
      <main className="mt-content">
        <div className="dev-intro">20 Scientific Councils → their main &amp; precise specialties with codes.</div>

        <div className="mt-filterbar">
          <div className="mt-search">
            <MagnifierIcon />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or code…" aria-label="Search specialties" />
          </div>
          <select className="mt-filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Type filter">
            <option value="">Type: All</option><option value="main">Main</option><option value="precise">Precise</option>
          </select>
          <select className="mt-filter" value={councilFilter} onChange={(e) => setCouncilFilter(e.target.value)} aria-label="Council filter">
            <option value="">Council: All</option>
            {councils.map((c) => <option key={c._id} value={c._id}>{c.nameEn || c.name}</option>)}
            <option value="__none__">— Ungrouped —</option>
          </select>
          <span className="mt-filterbar-spacer" />
          <button className="mt-btn" onClick={() => setShowAdd(true)}>+ Add specialty</button>
          <span className="mt-count">{specialties.length} specialties</span>
        </div>

        {loading ? <div className="skeleton mt-skel" style={{ height: 320 }} /> : (
          <RevealOnScroll>
            <div className="mt-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="mt-table-wrap">
                <table className="mt-table">
                  <thead><tr>
                    <th className="mt-th">Specialty</th><th className="mt-th">Type</th><th className="mt-th">Council</th>
                    <th className="mt-th">Code</th><th className="mt-th">HOC</th><th className="mt-th">Status</th><th className="mt-th" />
                  </tr></thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr><td className="mt-td mt-td--muted" colSpan={7} style={{ textAlign: 'center', padding: 40 }}>No specialties found.</td></tr>
                    )}
                    {rows.map((s) => {
                      const cid = s.councilId?._id || s.councilId;
                      return (
                        <tr key={s._id}>
                          <td className="mt-td">
                            <div className="mt-td--name">{s.name}</div>
                            {s.nameEn && <div className="mt-td--muted" style={{ fontSize: 11.5 }}>{s.nameEn}</div>}
                          </td>
                          <td className="mt-td">{typePill(s.type)}</td>
                          <td className="mt-td mt-td--muted">{councilName(cid) || '—'}</td>
                          <td className="mt-td mt-td--mono">{s.code || '—'}</td>
                          <td className="mt-td mt-td--muted">{(cid && hocByCouncil[String(cid)]) || '—'}</td>
                          <td className="mt-td">{s.isActive !== false ? <span className="mt-pill mt-pill--active">Active</span> : <span className="mt-pill mt-pill--rejected">Inactive</span>}</td>
                          <td className="mt-td mt-td--actions">
                            <button className="mt-btn--small-outline" onClick={() => setTplSpecialty(s)} title="Manage report & evaluation templates">
                              <IconFileText size={13} /> Templates
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </RevealOnScroll>
        )}

        {!loading && specialties.length === 0 && (
          <div className="mt-empty" style={{ marginBlockStart: 16 }}>
            <div className="mt-empty-icon"><IconBook size={22} /></div>
            <div className="mt-empty-title">No specialties yet</div>
            <div className="mt-empty-sub">Seed the councils &amp; specialties, or add one above.</div>
          </div>
        )}

        {showAdd && <AddSpecialtyModal councils={councils} onCreate={handleCreate} onClose={() => setShowAdd(false)} saving={saving} />}
        {tplSpecialty && (
          <TemplatesModal specialty={tplSpecialty} onClose={() => setTplSpecialty(null)} showToast={showToast}
            onUpdated={(updated) => { setSpecialties((prev) => prev.map((x) => (x._id === updated._id ? { ...x, ...updated } : x))); setTplSpecialty((cur) => (cur && cur._id === updated._id ? { ...cur, ...updated } : cur)); }} />
        )}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
