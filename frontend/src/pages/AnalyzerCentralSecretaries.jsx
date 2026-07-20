// W1-Analyzer — Central Secretaries. The data analyzer can ADD + EDIT central
// secretaries (POST/PATCH /api/analyzer/staff, role=central_secretary). Add picks
// Specialty/Sub-specialty + council; edit covers name/phone/email/active/locked.
// GET /api/analyzer/central-secretaries?includeInactive=
//   → data:[{ ...cs, councilId:{name,nameEn}, secretaryType:'main'|'precise', changeHistory }]
import { useState } from 'react';
import { IconUsers } from '../components/icons';
import AccountCard from '../components/AccountCard';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import {
  ListShell, CardGrid, SearchBox, FilterSelect, EmptyState,
  useAnalyzerList, useClientList, useOptions, histLines, fmtDate, PAGE_SIZE,
} from './AnalyzerListKit';
import { StaffFormModal } from './AnalyzerStaffForms';
import './Analyzer.css';

export default function AnalyzerCentralSecretaries() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const { data, loading, error, reload } = useAnalyzerList('/api/analyzer/central-secretaries');
  const councils = useOptions('/api/analyzer/councils', (c) => ({ value: c._id, label: c.nameEn ? `${c.name} — ${c.nameEn}` : c.name }));
  const rows = Array.isArray(data) ? data : [];
  const scoped = type ? rows.filter((c) => (c.secretaryType || 'main') === type) : rows;
  const { pageRows, total } = useClientList(scoped, { search, fields: ['name', 'idNumber', 'email'], page });
  const isEmpty = !loading && total === 0;

  const specialtyValue = (u) => u.councilId?.name || (u.secretaryType === 'precise' ? 'All sub-specialties' : '—');
  const typeLabel = (u) => (u.secretaryType === 'precise' ? 'Sub-specialty' : 'Specialty');

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const { toasts, showToast } = useMtToast();

  return (
    <>
      <ListShell
        title="Central Secretaries" subtitle="Data Analyzer"
        filters={<>
          <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search by name or ID…" />
          <FilterSelect value={type} onChange={reset(setType)} allLabel="Type: All"
            options={[{ value: 'main', label: 'Specialty' }, { value: 'precise', label: 'Sub-specialty' }]} />
        </>}
        count={`${total.toLocaleString('en-US')} central secretaries`}
        actions={<button type="button" className="mt-btn" onClick={() => setAddOpen(true)}>+ Add central secretary</button>}
        loading={loading} error={error} empty={isEmpty} skeleton="cards"
        page={page} total={total}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
      >
        {isEmpty ? (
          <EmptyState icon={<IconUsers size={22} />} title="No central secretaries found"
            sub={search || type ? 'No secretaries match your filters.' : 'Add a central secretary to get started.'} />
        ) : (
          <CardGrid>
            {pageRows.map((u, i) => (
              <RevealOnScroll key={u._id} delay={i * 0.06}>
                <AccountCard
                  name={u.name} id={u.idNumber}
                  role={`Central Secretary · ${typeLabel(u)}`}
                  canEdit onEdit={() => setEditUser(u)}
                  fields={[
                    { label: 'Specialty', value: specialtyValue(u) },
                    { label: 'Phone', value: u.phone || '—' },
                    { label: 'Email', value: u.email || '—' },
                    { label: 'Since', value: fmtDate(u.createdAt) },
                  ]}
                  history={histLines(u.changeHistory)}
                />
              </RevealOnScroll>
            ))}
          </CardGrid>
        )}
      </ListShell>

      {addOpen && (
        <StaffFormModal role="central_secretary" mode="add" councils={councils} onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); reload(); showToast('Central secretary added.', 'ok'); }} />
      )}
      {editUser && (
        <StaffFormModal role="central_secretary" mode="edit" staff={editUser} onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); reload(); showToast('Central secretary updated.', 'ok'); }} />
      )}
      <MtToastHost toasts={toasts} />
    </>
  );
}
