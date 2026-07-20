// W1-Analyzer — Data Entry Clerks (read-only account cards). No filters.
// GET /api/analyzer/clerks?includeInactive= → data:[{ ...user, changeHistory }]
// Read-only: no edit pencil, no "Add" button (creation is a developer capability,
// RULINGS §37). "Records added" is not in the payload → "—".
import { useState } from 'react';
import { IconEdit } from '../components/icons';
import AccountCard from '../components/AccountCard';
import RevealOnScroll from '../components/RevealOnScroll';
import {
  ListShell, CardGrid, SearchBox, EmptyState,
  useAnalyzerList, useClientList, histLines, fmtDate, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

export default function AnalyzerClerks() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const onSearch = (v) => { setSearch(v); setPage(1); };

  const { data, loading, error } = useAnalyzerList('/api/analyzer/clerks');
  const rows = Array.isArray(data) ? data : [];
  const { pageRows, total } = useClientList(rows, { search, fields: ['name', 'idNumber', 'email'], page });
  const isEmpty = !loading && total === 0;

  return (
    <ListShell
      title="Data Entry Clerks" subtitle="Data Analyzer"
      filters={<SearchBox value={search} onChange={onSearch} placeholder="Search by name or ID…" />}
      count={`${total.toLocaleString('en-US')} ${total === 1 ? 'clerk' : 'clerks'}`}
      loading={loading} error={error} empty={isEmpty} skeleton="cards"
      page={page} total={total}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
    >
      {isEmpty ? (
        <EmptyState icon={<IconEdit size={22} />} title="No data entry clerks found"
          sub={search ? 'No clerks match your search.' : 'Data entry clerk accounts will appear here.'} />
      ) : (
        <CardGrid>
          {pageRows.map((u, i) => (
            <RevealOnScroll key={u._id} delay={i * 0.06}>
              <AccountCard
                name={u.name} id={u.idNumber} role="Data Entry Clerk"
                fields={[
                  { label: 'Phone', value: u.phone || '—' },
                  { label: 'Email', value: u.email || '—' },
                  { label: 'Records added', value: u.recordsAdded ?? '—' },
                  { label: 'Since', value: fmtDate(u.createdAt) },
                ]}
                history={histLines(u.changeHistory)}
              />
            </RevealOnScroll>
          ))}
        </CardGrid>
      )}
    </ListShell>
  );
}
