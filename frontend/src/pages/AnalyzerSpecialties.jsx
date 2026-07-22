// W1-Analyzer — Specialties. The Data Analyzer adds specialties AND
// sub-specialties (two buttons → a name-only modal that sets the type). POST
// /api/specialties { name, type: 'main' | 'precise' }. List is read-only otherwise.
// GET /api/analyzer/specialties?type= → data:[{ ...specialty, councilId, type, code }]
import { useState } from 'react';
import { IconBook } from '../components/icons';
import MtModal from '../components/MtModal';
import { MtToastHost, useMtToast } from '../components/MtToast';
import api from '../api/axios';
import { specialtyName } from '../utils/specialtyName';
import {
  ListShell, TableCard, SearchBox, FilterSelect, Pill, EmptyState,
  useAnalyzerList, useClientList, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

// Name-only add modal. `kind` ('main' | 'precise') sets the title and the type
// that is persisted — the analyzer picks it via which button opened the modal.
function AddSpecialtyModal({ kind, onCreate, onClose, saving }) {
  const isSub = kind === 'precise';
  const [name, setName] = useState('');
  const [err, setErr] = useState(false);
  function submit() {
    if (!name.trim()) { setErr(true); return; }
    onCreate(name.trim());
  }
  return (
    <MtModal open tone="data"
      title={isSub ? 'New sub-specialty' : 'New specialty'}
      sub={isSub ? 'Sub-specialty' : 'Specialty'} meta="Data Analyzer" onClose={onClose}
      footer={<>
        <button type="button" className="mt-btn--cancel" onClick={onClose}>Cancel</button>
        <button type="button" className="mt-btn" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}>
      <div className="mt-banner">This record will be added to the registry.</div>
      <div className="mt-field-grid">
        <div className="mt-field mt-field-full">
          <label className="mt-label">{isSub ? 'Sub-specialty name' : 'Specialty name'} <span className="mt-label-req">*</span></label>
          <input className="mt-input" style={err ? { borderColor: 'var(--danger)' } : undefined}
            value={name} onChange={(e) => { setName(e.target.value); setErr(false); }}
            placeholder="e.g. Internal Medicine" />
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
  const rows = Array.isArray(data) ? data : [];
  const { pageRows, total } = useClientList(rows, { search, fields: ['name', 'nameEn', 'code'], page });
  const isEmpty = !loading && total === 0;

  const mainCount = rows.filter((s) => s.type === 'main').length;
  const preciseCount = rows.filter((s) => s.type === 'precise').length;

  const [addKind, setAddKind] = useState(null);   // 'main' | 'precise' | null
  const [saving, setSaving] = useState(false);
  const { toasts, showToast } = useMtToast();

  async function handleCreate(name) {
    setSaving(true);
    try {
      await api.post('/api/specialties', { name, type: addKind });
      showToast(addKind === 'precise' ? 'Sub-specialty added.' : 'Specialty added.', 'ok');
      setAddKind(null);
      reload();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to add.', 'dng');
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
        actions={<>
          <button type="button" className="mt-btn" onClick={() => setAddKind('main')}>+ Add specialty</button>
          <button type="button" className="mt-btn--outline" onClick={() => setAddKind('precise')}>+ Add sub-specialty</button>
        </>}
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
                  {specialtyName(s)}
                  {s.name && s.name !== specialtyName(s)
                    ? <span className="mt-td--muted" style={{ fontWeight: 400 }}> · {s.name}</span> : null}
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

      {addKind && (
        <AddSpecialtyModal kind={addKind} onCreate={handleCreate} onClose={() => setAddKind(null)} saving={saving} />
      )}
      <MtToastHost toasts={toasts} />
    </>
  );
}
