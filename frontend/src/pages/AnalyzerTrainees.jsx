// W1-Analyzer — Trainees (read-only account cards). Full filter set.
// GET /api/analyzer/trainees?countryId=&city=&centerId=&specialtyId=&programId=&search=
//   → data:[{ ...trainee, programId:{name}, specialtyId:{name}, pdId:{name},
//              hospitalId:{name}, trainingYear, changeHistory }]  (capped at 1000)
// countryId is stored but not populated → the Country column is substituted with
// the trainee's center; year is appended to the Program value.
import { useState } from 'react';
import { IconGrad } from '../components/icons';
import AccountCard from '../components/AccountCard';
import RevealOnScroll from '../components/RevealOnScroll';
import {
  ListShell, CardGrid, SearchBox, FilterSelect, EmptyState,
  useAnalyzerList, useOptions, distinctOptions, useClientList, histLines, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

export default function AnalyzerTrainees() {
  const [search, setSearch] = useState('');
  const [countryId, setCountryId] = useState('');
  const [centerId, setCenterId] = useState('');
  const [programId, setProgramId] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const countryOpts = useOptions('/api/analyzer/countries', (c) => ({ value: c._id, label: c.name }));
  const centerOpts = useOptions('/api/analyzer/centers', (c) => ({ value: c._id, label: c.name }));
  const programOpts = useOptions('/api/analyzer/programs', (p) => ({ value: p._id, label: p.name }));
  const specialtyOpts = useOptions('/api/analyzer/specialties', (s) => ({ value: s._id, label: s.name }));

  const { data, loading, error } = useAnalyzerList('/api/analyzer/trainees', { countryId, centerId, programId, specialtyId });
  const rows = Array.isArray(data) ? data : [];
  const cityOpts = distinctOptions(rows, 'city');
  const scoped = city ? rows.filter((t) => t.city === city) : rows;
  const { pageRows, total } = useClientList(scoped, { search, fields: ['name', 'idNumber', 'studentId'], page });
  const isEmpty = !loading && total === 0;

  const programValue = (t) => {
    const base = t.programId?.name || '—';
    return t.trainingYear ? `${base} · Year ${t.trainingYear}` : base;
  };

  return (
    <ListShell
      title="Trainees" subtitle="Data Analyzer"
      filters={<>
        <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search by name or ID…" />
        <FilterSelect value={countryId} onChange={reset(setCountryId)} allLabel="Country: All" options={countryOpts} />
        <FilterSelect value={city} onChange={reset(setCity)} allLabel="City: All" options={cityOpts} />
        <FilterSelect value={centerId} onChange={reset(setCenterId)} allLabel="Center: All" options={centerOpts} />
        <FilterSelect value={programId} onChange={reset(setProgramId)} allLabel="Program: All" options={programOpts} />
        <FilterSelect value={specialtyId} onChange={reset(setSpecialtyId)} allLabel="Specialty: All" options={specialtyOpts} />
      </>}
      count={`${total.toLocaleString('en-US')} trainees`}
      loading={loading} error={error} empty={isEmpty} skeleton="cards"
      page={page} total={total}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
    >
      {isEmpty ? (
        <EmptyState icon={<IconGrad size={22} />} title="No trainees found"
          sub={search || countryId || centerId || programId || specialtyId || city ? 'No trainees match your filters.' : 'Trainees will appear here.'} />
      ) : (
        <CardGrid>
          {pageRows.map((u, i) => (
            <RevealOnScroll key={u._id} delay={i * 0.06}>
              <AccountCard
                name={u.name} id={u.idNumber || u.studentId} role="Trainee"
                fields={[
                  { label: 'Center', value: u.hospitalId?.name || '—' },
                  { label: 'City', value: u.city || '—' },
                  { label: 'Program', value: programValue(u) },
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
