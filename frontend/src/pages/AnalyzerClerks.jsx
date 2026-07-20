// W1-Analyzer — Data Entry Clerks. The data analyzer can ADD + EDIT clerks
// (POST/PATCH /api/analyzer/staff, role=data_entry). AccountCard edit pencil is
// enabled; "+ Add clerk" opens the shared staff form.
// GET /api/analyzer/clerks?includeInactive= → data:[{ ...user, changeHistory }]
import { useState } from 'react';
import { IconEdit } from '../components/icons';
import AccountCard from '../components/AccountCard';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import {
  ListShell, CardGrid, SearchBox, EmptyState,
  useAnalyzerList, useClientList, histLines, fmtDate, PAGE_SIZE,
} from './AnalyzerListKit';
import { StaffFormModal } from './AnalyzerStaffForms';
import './Analyzer.css';

export default function AnalyzerClerks() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const onSearch = (v) => { setSearch(v); setPage(1); };

  const { data, loading, error, reload } = useAnalyzerList('/api/analyzer/clerks');
  const rows = Array.isArray(data) ? data : [];
  const { pageRows, total } = useClientList(rows, { search, fields: ['name', 'idNumber', 'email'], page });
  const isEmpty = !loading && total === 0;

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const { toasts, showToast } = useMtToast();

  return (
    <>
      <ListShell
        title="Data Entry Clerks" subtitle="Data Analyzer"
        filters={<SearchBox value={search} onChange={onSearch} placeholder="Search by name or ID…" />}
        count={`${total.toLocaleString('en-US')} ${total === 1 ? 'clerk' : 'clerks'}`}
        actions={<button type="button" className="mt-btn" onClick={() => setAddOpen(true)}>+ Add clerk</button>}
        loading={loading} error={error} empty={isEmpty} skeleton="cards"
        page={page} total={total}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
      >
        {isEmpty ? (
          <EmptyState icon={<IconEdit size={22} />} title="No data entry clerks found"
            sub={search ? 'No clerks match your search.' : 'Add a data entry clerk to get started.'} />
        ) : (
          <CardGrid>
            {pageRows.map((u, i) => (
              <RevealOnScroll key={u._id} delay={i * 0.06}>
                <AccountCard
                  name={u.name} id={u.idNumber} role="Data Entry Clerk"
                  canEdit onEdit={() => setEditUser(u)}
                  fields={[
                    { label: 'Phone', value: u.phone || '—' },
                    { label: 'Email', value: u.email || '—' },
                    { label: 'Status', value: u.isActive === false ? 'Inactive' : 'Active' },
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
        <StaffFormModal role="data_entry" mode="add" onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); reload(); showToast('Clerk added.', 'ok'); }} />
      )}
      {editUser && (
        <StaffFormModal role="data_entry" mode="edit" staff={editUser} onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); reload(); showToast('Clerk updated.', 'ok'); }} />
      )}
      <MtToastHost toasts={toasts} />
    </>
  );
}
