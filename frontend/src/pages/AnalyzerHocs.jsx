// W1-Analyzer — Heads of Council / HOCs (read-only account cards).
// GET /api/analyzer/hocs?includeInactive= → data:[{ ...hoc, councilId:{name,nameEn}, changeHistory }]
// "Main specialty" = the HOC's Scientific Council (RULINGS §39). The endpoint
// populates councilId only (not countryId) → the "Country" column is substituted
// with the council/city we do have.
import { useState } from 'react';
import { IconBook } from '../components/icons';
import AccountCard from '../components/AccountCard';
import RevealOnScroll from '../components/RevealOnScroll';
import { specialtyName } from '../utils/specialtyName';
import {
  ListShell, CardGrid, SearchBox, FilterSelect, EmptyState,
  useAnalyzerList, useClientList, distinctOptions, getField, histLines, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

export default function AnalyzerHocs() {
  const [search, setSearch] = useState('');
  const [council, setCouncil] = useState('');
  const [page, setPage] = useState(1);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const { data, loading, error } = useAnalyzerList('/api/analyzer/hocs');
  const rows = Array.isArray(data) ? data : [];
  const councilOpts = distinctOptions(rows, 'councilId.name');
  const scoped = council ? rows.filter((h) => getField(h, 'councilId.name') === council) : rows;
  const { pageRows, total } = useClientList(scoped, { search, fields: ['name', 'idNumber', 'email'], page });
  const isEmpty = !loading && total === 0;

  return (
    <ListShell
      title="HOCs" subtitle="Data Analyzer"
      filters={<>
        <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search by name or ID…" />
        <FilterSelect value={council} onChange={reset(setCouncil)} allLabel="Specialty: All" options={councilOpts} />
      </>}
      count={`${total.toLocaleString('en-US')} HOCs — one per specialty`}
      loading={loading} error={error} empty={isEmpty} skeleton="cards"
      page={page} total={total}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
    >
      {isEmpty ? (
        <EmptyState icon={<IconBook size={22} />} title="No HOCs found"
          sub={search || council ? 'No HOCs match your filters.' : 'Head-of-Council accounts will appear here.'} />
      ) : (
        <CardGrid>
          {pageRows.map((u, i) => (
            <RevealOnScroll key={u._id} delay={i * 0.06}>
              <AccountCard
                name={u.name} id={u.idNumber} role="HOC"
                fields={[
                  { label: 'Specialty', value: specialtyName(u.specialtyId) || u.councilId?.name || '—' },
                  { label: 'City', value: u.city || '—' },
                  { label: 'Phone', value: u.phone || '—' },
                  { label: 'Email', value: u.email || '—' },
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
