// W1-Analyzer — Specialties (read-only). tbl, Type filter (server-side `type=`).
// GET /api/analyzer/specialties?type=&councilId=
//   → data:[{ ...specialty, councilId:{name,nameEn}, type, code, nameEn }]
// Type pill: Main → warn, Precise → ok (lists_views §2). Programs/Trainees/HOC
// aggregates are not in the contract payload → "—" (see report QUESTIONS).
import { useState } from 'react';
import { IconBook } from '../components/icons';
import {
  ListShell, TableCard, SearchBox, FilterSelect, Pill, EmptyState,
  useAnalyzerList, useClientList, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

export default function AnalyzerSpecialties() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const { data, loading, error } = useAnalyzerList('/api/analyzer/specialties', { type });
  const rows = Array.isArray(data) ? data : [];
  const { pageRows, total } = useClientList(rows, { search, fields: ['name', 'nameEn', 'code'], page });
  const isEmpty = !loading && total === 0;

  const mainCount = rows.filter((s) => s.type === 'main').length;
  const preciseCount = rows.filter((s) => s.type === 'precise').length;

  return (
    <ListShell
      title="Specialties" subtitle="Data Analyzer"
      filters={<>
        <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search…" />
        <FilterSelect value={type} onChange={reset(setType)} allLabel="Type: All"
          options={[{ value: 'main', label: 'Specialty' }, { value: 'precise', label: 'Sub-specialty' }]} />
      </>}
      count={`${total.toLocaleString('en-US')} total · ${mainCount} specialties, ${preciseCount} sub-specialties`}
      loading={loading} error={error} empty={isEmpty}
      page={page} total={total}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
    >
      {isEmpty ? (
        <EmptyState icon={<IconBook size={22} />} title="No specialties found"
          sub={search || type ? 'No specialties match your filters.' : 'Specialties will appear here.'} />
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
  );
}
