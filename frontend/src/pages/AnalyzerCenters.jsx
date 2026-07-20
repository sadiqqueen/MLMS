// W1-Analyzer — Training Centers (read-only). tbl, Country (server) + City (client).
// GET /api/analyzer/centers?countryId=&city=&search=
//   → data:[{ ...center, countryId:{name,code}, dioId:{name}, subDioId:{name},
//              accreditationStatus, changeHistory }]
// Programs-per-center count is not in the payload → "—" (see report QUESTIONS).
import { useState } from 'react';
import { IconBuilding } from '../components/icons';
import {
  ListShell, TableCard, SearchBox, FilterSelect, AccreditationPill, EmptyState,
  useAnalyzerList, useOptions, distinctOptions, useClientList, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

export default function AnalyzerCenters() {
  const [search, setSearch] = useState('');
  const [countryId, setCountryId] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const countryOpts = useOptions('/api/analyzer/countries', (c) => ({ value: c._id, label: c.code ? `${c.name} (${c.code})` : c.name }));
  const { data, loading, error } = useAnalyzerList('/api/analyzer/centers', { countryId });
  const rows = Array.isArray(data) ? data : [];
  const cityOpts = distinctOptions(rows, 'city');
  const cityFiltered = city ? rows.filter((r) => r.city === city) : rows;
  const { pageRows, total } = useClientList(cityFiltered, { search, fields: ['name', 'idNumber', 'accreditationNumber'], page });
  const isEmpty = !loading && total === 0;

  return (
    <ListShell
      title="Training Centers" subtitle="Data Analyzer"
      filters={<>
        <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search…" />
        <FilterSelect value={countryId} onChange={reset(setCountryId)} allLabel="Country: All" options={countryOpts} />
        <FilterSelect value={city} onChange={reset(setCity)} allLabel="City: All" options={cityOpts} />
      </>}
      count={`${total.toLocaleString('en-US')} ${total === 1 ? 'center' : 'centers'}`}
      loading={loading} error={error} empty={isEmpty}
      page={page} total={total}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
    >
      {isEmpty ? (
        <EmptyState icon={<IconBuilding size={22} />} title="No training centers found"
          sub={search || countryId || city ? 'No centers match your filters.' : 'Training centers will appear here.'} />
      ) : (
        <TableCard columns={['Center', 'ID', 'Country', 'City', 'DIO', 'Programs', 'Status']}>
          {pageRows.map((c) => (
            <tr key={c._id}>
              <td className="mt-td mt-td--name">{c.name}</td>
              <td className="mt-td mt-td--mono">{c.idNumber || c.accreditationNumber || '—'}</td>
              <td className="mt-td">{c.countryId?.name || '—'}</td>
              <td className="mt-td">{c.city || '—'}</td>
              <td className="mt-td mt-td--muted">{c.dioId?.name || '—'}</td>
              <td className="mt-td mt-td--muted">{c.programsCount ?? '—'}</td>
              <td className="mt-td"><AccreditationPill status={c.accreditationStatus} /></td>
            </tr>
          ))}
        </TableCard>
      )}
    </ListShell>
  );
}
