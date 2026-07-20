// W1-Analyzer — Programs (read-only). tbl, Country/Center/Specialty (server) + City (client).
// GET /api/analyzer/programs?countryId=&city=&centerId=&specialtyId=&search=
//   → data:[{ ...program, specialtyId:{name,nameEn,type,code},
//              trainingCenterId:{name,countryId,city}, programDirectorId:{name},
//              subProgramDirectorId:{name}, accreditation*, changeHistory }]
import { useState } from 'react';
import { IconLayers } from '../components/icons';
import {
  ListShell, TableCard, SearchBox, FilterSelect, EmptyState,
  useAnalyzerList, useOptions, distinctOptions, useClientList, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

function capacityText(p) {
  if (p.capacityUsed != null && p.yearlyCapacity != null) return `${p.capacityUsed} / ${p.yearlyCapacity}`;
  if (p.yearlyCapacity != null) return `${p.yearlyCapacity} / yr`;
  return '—';
}
function durationText(p) {
  if (p.durationYears != null) return `${p.durationYears} yr${p.durationYears === 1 ? '' : 's'}`;
  return p.accreditationType || '—';
}

export default function AnalyzerPrograms() {
  const [search, setSearch] = useState('');
  const [countryId, setCountryId] = useState('');
  const [centerId, setCenterId] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const countryOpts = useOptions('/api/analyzer/countries', (c) => ({ value: c._id, label: c.name }));
  const centerOpts = useOptions('/api/analyzer/centers', (c) => ({ value: c._id, label: c.name }));
  const specialtyOpts = useOptions('/api/analyzer/specialties', (s) => ({ value: s._id, label: s.name }));

  const { data, loading, error } = useAnalyzerList('/api/analyzer/programs', { countryId, centerId, specialtyId });
  const rows = Array.isArray(data) ? data : [];
  const cityOpts = distinctOptions(rows.map((p) => ({ city: p.trainingCenterId?.city })), 'city');
  const cityFiltered = city ? rows.filter((p) => p.trainingCenterId?.city === city) : rows;
  const { pageRows, total } = useClientList(cityFiltered, { search, fields: ['name', 'idNumber', 'accreditationNumber'], page });
  const isEmpty = !loading && total === 0;

  return (
    <ListShell
      title="Programs" subtitle="Data Analyzer"
      filters={<>
        <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search…" />
        <FilterSelect value={countryId} onChange={reset(setCountryId)} allLabel="Country: All" options={countryOpts} />
        <FilterSelect value={city} onChange={reset(setCity)} allLabel="City: All" options={cityOpts} />
        <FilterSelect value={centerId} onChange={reset(setCenterId)} allLabel="Center: All" options={centerOpts} />
        <FilterSelect value={specialtyId} onChange={reset(setSpecialtyId)} allLabel="Specialty: All" options={specialtyOpts} />
      </>}
      count={`${total.toLocaleString('en-US')} programs`}
      loading={loading} error={error} empty={isEmpty}
      page={page} total={total}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
    >
      {isEmpty ? (
        <EmptyState icon={<IconLayers size={22} />} title="No programs found"
          sub={search || countryId || centerId || specialtyId || city ? 'No programs match your filters.' : 'Programs will appear here.'} />
      ) : (
        <TableCard columns={['Program', 'ID', 'Specialty', 'Center', 'PD', 'Capacity', 'Duration']}>
          {pageRows.map((p) => (
            <tr key={p._id}>
              <td className="mt-td mt-td--name">{p.name}</td>
              <td className="mt-td mt-td--mono">{p.idNumber || p.accreditationNumber || '—'}</td>
              <td className="mt-td">{p.specialtyId?.name || '—'}</td>
              <td className="mt-td mt-td--muted">{p.trainingCenterId?.name || '—'}</td>
              <td className="mt-td mt-td--muted">{p.programDirectorId?.name || '—'}</td>
              <td className="mt-td">{capacityText(p)}</td>
              <td className="mt-td">{durationText(p)}</td>
            </tr>
          ))}
        </TableCard>
      )}
    </ListShell>
  );
}
