// W1-Analyzer — Countries (read-only, RULINGS §37/§43). tbl, no filters.
// GET /api/analyzer/countries → data:[{ _id, name, code, isActive }]
// Per-country aggregate counts (Centers/DIOs/Programs/Trainees) are NOT in the
// contract payload → shown as "—". See QUESTIONS(fable) in the report.
import { useState } from 'react';
import { IconGlobe } from '../components/icons';
import {
  ListShell, TableCard, SearchBox, EmptyState,
  useAnalyzerList, useClientList, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

export default function AnalyzerCountries() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const onSearch = (v) => { setSearch(v); setPage(1); };

  const { data, loading, error } = useAnalyzerList('/api/analyzer/countries');
  const rows = Array.isArray(data) ? data : [];
  const { pageRows, total } = useClientList(rows, { search, fields: ['name', 'code'], page });
  const isEmpty = !loading && total === 0;

  return (
    <ListShell
      title="Countries" subtitle="Data Analyzer"
      filters={<SearchBox value={search} onChange={onSearch} placeholder="Search…" />}
      count={`${total.toLocaleString('en-US')} ${total === 1 ? 'country' : 'countries'}`}
      loading={loading} error={error} empty={isEmpty}
      page={page} total={total}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
    >
      {isEmpty ? (
        <EmptyState icon={<IconGlobe size={22} />} title="No countries found"
          sub={search ? 'No countries match your search.' : 'Active countries will appear here.'} />
      ) : (
        <TableCard columns={['Country', 'Code', 'Centers', 'DIOs', 'Programs', 'Trainees']}>
          {pageRows.map((c) => (
            <tr key={c._id}>
              <td className="mt-td mt-td--name">{c.name}</td>
              <td className="mt-td mt-td--mono">{c.code || '—'}</td>
              <td className="mt-td mt-td--muted">{c.centersCount ?? '—'}</td>
              <td className="mt-td mt-td--muted">{c.diosCount ?? '—'}</td>
              <td className="mt-td mt-td--muted">{c.programsCount ?? '—'}</td>
              <td className="mt-td mt-td--muted">{c.traineesCount ?? '—'}</td>
            </tr>
          ))}
        </TableCard>
      )}
    </ListShell>
  );
}
