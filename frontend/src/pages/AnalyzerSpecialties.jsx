// W1-Analyzer — Specialties. The data analyzer manages the council taxonomy:
// it can ADD specialties + sub-specialties (POST /api/specialties with
// type/code/councilId/nameEn) but not edit/delete. List is read-only otherwise.
// GET /api/analyzer/specialties?type=&councilId=
//   → data:[{ ...specialty, councilId:{name,nameEn}, type, code, nameEn }]
// GET /api/analyzer/councils → the 20 councils for the Add-specialty selector.
import { useState } from 'react';
import { IconBook } from '../components/icons';
import MtModal from '../components/MtModal';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import {
  ListShell, TableCard, SearchBox, FilterSelect, Pill, EmptyState,
  useAnalyzerList, useClientList, useOptions, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

// ── Add specialty / sub-specialty modal ──────────────────────────────────────
function AddSpecialtyModal({ councils, onCreate, onClose, saving }) {
  const [f, setF] = useState({ name: '', nameEn: '', type: 'main', councilId: '', code: '' });
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
    <MtModal open title="Add specialty" sub="Specialty or sub-specialty" meta="Data Analyzer" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create specialty'}</button>
      </>}>
      <div className="mt-banner">This record will be added to the registry.</div>
      <div className="mt-field-grid">
        <div className="mt-field"><label className="mt-label">Name <span className="mt-label-req">*</span></label><input className="mt-input" style={errors.name ? { borderColor: 'var(--danger)' } : undefined} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Specialty name" /></div>
        <div className="mt-field"><label className="mt-label">English name</label><input className="mt-input" value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} placeholder="English name" /></div>
        <div className="mt-field">
          <label className="mt-label">Type</label>
          <div className="mt-radio-group">
            <label className="mt-check-label"><input type="radio" className="mt-check" name="spType" checked={f.type === 'main'} onChange={() => set('type', 'main')} /> Specialty</label>
            <label className="mt-check-label"><input type="radio" className="mt-check" name="spType" checked={f.type === 'precise'} onChange={() => set('type', 'precise')} /> Sub-specialty</label>
          </div>
        </div>
        <div className="mt-field"><label className="mt-label">Code</label><input className="mt-input mt-input--mono" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder='e.g. "05" or "05d1"' /></div>
        <div className="mt-field mt-field-full">
          <label className="mt-label">Council</label>
          <select className="mt-select" value={f.councilId} onChange={(e) => set('councilId', e.target.value)}>
            <option value="">— Select council —</option>
            {councils.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>
    </MtModal>
  );
}

export default function AnalyzerSpecialties() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const { data, loading, error, reload } = useAnalyzerList('/api/analyzer/specialties', { type });
  const councils = useOptions('/api/analyzer/councils', (c) => ({ value: c._id, label: c.nameEn ? `${c.name} — ${c.nameEn}` : c.name }));
  const rows = Array.isArray(data) ? data : [];
  const { pageRows, total } = useClientList(rows, { search, fields: ['name', 'nameEn', 'code'], page });
  const isEmpty = !loading && total === 0;

  const mainCount = rows.filter((s) => s.type === 'main').length;
  const preciseCount = rows.filter((s) => s.type === 'precise').length;

  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toasts, showToast } = useMtToast();

  async function handleCreate(f) {
    setSaving(true);
    try {
      await api.post('/api/specialties', {
        name: f.name.trim(),
        nameEn: f.nameEn.trim() || undefined,
        type: f.type,
        councilId: f.councilId || undefined,
        code: f.code.trim() || undefined,
      });
      showToast('Specialty added.', 'ok');
      setShowAdd(false);
      reload();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to add specialty.', 'dng');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ListShell
        title="Specialties" subtitle="Data Analyzer"
        filters={<>
          <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search…" />
          <FilterSelect value={type} onChange={reset(setType)} allLabel="Type: All"
            options={[{ value: 'main', label: 'Specialty' }, { value: 'precise', label: 'Sub-specialty' }]} />
        </>}
        count={`${total.toLocaleString('en-US')} total · ${mainCount} specialties, ${preciseCount} sub-specialties`}
        actions={<button type="button" className="mt-btn" onClick={() => setShowAdd(true)}>+ Add specialty</button>}
        loading={loading} error={error} empty={isEmpty}
        page={page} total={total}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
      >
        {isEmpty ? (
          <EmptyState icon={<IconBook size={22} />} title="No specialties found"
            sub={search || type ? 'No specialties match your filters.' : 'Add a specialty to get started.'} />
        ) : (
          <TableCard columns={['Specialty', 'Type', 'Council', 'Code', 'Programs', 'Trainees', 'HOC']}>
            {pageRows.map((s) => (
              <tr key={s._id}>
                <td className="mt-td mt-td--name">
                  {s.name}
                  {s.nameEn && s.nameEn !== s.name
                    ? <span className="mt-td--muted" style={{ fontWeight: 400 }}> · {s.nameEn}</span> : null}
                </td>
                <td className="mt-td">
                  {s.type === 'main' ? <Pill tone="warn">Specialty</Pill> : <Pill tone="ok">Sub-specialty</Pill>}
                </td>
                <td className="mt-td mt-td--muted">{s.councilId?.name || '—'}</td>
                <td className="mt-td mt-td--mono">{s.code || '—'}</td>
                <td className="mt-td mt-td--muted">{s.programsCount ?? '—'}</td>
                <td className="mt-td mt-td--muted">{s.traineesCount ?? '—'}</td>
                <td className="mt-td mt-td--muted">{s.hocName ?? '—'}</td>
              </tr>
            ))}
          </TableCard>
        )}
      </ListShell>

      {showAdd && (
        <AddSpecialtyModal councils={councils} onCreate={handleCreate} onClose={() => setShowAdd(false)} saving={saving} />
      )}
      <MtToastHost toasts={toasts} />
    </>
  );
}
