// W1-Analyzer — Central Secretaries (read-only account cards). Type filter.
// GET /api/analyzer/central-secretaries?includeInactive=
//   → data:[{ ...cs, councilId:{name,nameEn}, secretaryType:'main'|'precise', changeHistory }]
// Badge: "Central Secretary · Main/Precise". Main → council specialty; the single
// precise CS covers every precise specialty (RULINGS §40).
import { useState } from 'react';
import { IconUsers } from '../components/icons';
import AccountCard from '../components/AccountCard';
import RevealOnScroll from '../components/RevealOnScroll';
import {
  ListShell, CardGrid, SearchBox, FilterSelect, EmptyState,
  useAnalyzerList, useClientList, histLines, fmtDate, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

export default function AnalyzerCentralSecretaries() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const { data, loading, error } = useAnalyzerList('/api/analyzer/central-secretaries');
  const rows = Array.isArray(data) ? data : [];
  const scoped = type ? rows.filter((c) => (c.secretaryType || 'main') === type) : rows;
  const { pageRows, total } = useClientList(scoped, { search, fields: ['name', 'idNumber', 'email'], page });
  const isEmpty = !loading && total === 0;

  const specialtyValue = (u) => u.councilId?.name || (u.secretaryType === 'precise' ? 'All sub-specialties' : '—');
  const typeLabel = (u) => (u.secretaryType === 'precise' ? 'Sub-specialty' : 'Specialty');

  return (
    <ListShell
      title="Central Secretaries" subtitle="Data Analyzer"
      filters={<>
        <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search by name or ID…" />
        <FilterSelect value={type} onChange={reset(setType)} allLabel="Type: All"
          options={[{ value: 'main', label: 'Specialty' }, { value: 'precise', label: 'Sub-specialty' }]} />
      </>}
      count={`${total.toLocaleString('en-US')} central secretaries`}
      loading={loading} error={error} empty={isEmpty} skeleton="cards"
      page={page} total={total}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
    >
      {isEmpty ? (
        <EmptyState icon={<IconUsers size={22} />} title="No central secretaries found"
          sub={search || type ? 'No secretaries match your filters.' : 'Central secretary accounts will appear here.'} />
      ) : (
        <CardGrid>
          {pageRows.map((u, i) => (
            <RevealOnScroll key={u._id} delay={i * 0.06}>
              <AccountCard
                name={u.name} id={u.idNumber}
                role={`Central Secretary · ${typeLabel(u)}`}
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
  );
}
