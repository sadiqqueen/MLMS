// W1-Analyzer — PDs (read-only account cards). Merges PDs + Sub-PDs.
// GET /api/analyzer/pds?specialtyId=&programId=&search=
//   → data:{ pds:[…], subPds:[…] }  (each with changeHistory)
// The endpoint populates specialtyId (+ Sub-PD's parent pdId) only, so the card
// shows Specialty in place of the design's Country/Program column (not populated).
import { useState } from 'react';
import { IconUsers } from '../components/icons';
import AccountCard from '../components/AccountCard';
import RevealOnScroll from '../components/RevealOnScroll';
import {
  ListShell, CardGrid, SearchBox, FilterSelect, EmptyState,
  useAnalyzerList, useOptions, useClientList, histLines, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

export default function AnalyzerPds() {
  const [search, setSearch] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [programId, setProgramId] = useState('');
  const [page, setPage] = useState(1);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const specialtyOpts = useOptions('/api/analyzer/specialties', (s) => ({ value: s._id, label: s.name }));
  const programOpts = useOptions('/api/analyzer/programs', (p) => ({ value: p._id, label: p.name }));

  const { data, loading, error } = useAnalyzerList('/api/analyzer/pds', { specialtyId, programId });
  const merged = [
    ...((data?.pds) || []).map((p) => ({ ...p, _kind: 'PD' })),
    ...((data?.subPds) || []).map((s) => ({ ...s, _kind: 'Sub-PD' })),
  ];
  const { pageRows, total } = useClientList(merged, { search, fields: ['name', 'idNumber', 'email'], page });
  const isEmpty = !loading && total === 0;

  const fieldsFor = (u) => u._kind === 'PD'
    ? [
        { label: 'Specialty', value: u.specialtyId?.name || '—' },
        { label: 'City', value: u.city || '—' },
        { label: 'Phone', value: u.phone || '—' },
        { label: 'Email', value: u.email || '—' },
      ]
    : [
        { label: 'Assigned PD', value: u.pdId?.name || '—' },
        { label: 'Specialty', value: u.specialtyId?.name || '—' },
        { label: 'City', value: u.city || '—' },
        { label: 'Email', value: u.email || '—' },
      ];

  return (
    <ListShell
      title="PDs" subtitle="Data Analyzer"
      filters={<>
        <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search by name or ID…" />
        <FilterSelect value={specialtyId} onChange={reset(setSpecialtyId)} allLabel="Specialty: All" options={specialtyOpts} />
        <FilterSelect value={programId} onChange={reset(setProgramId)} allLabel="Program: All" options={programOpts} />
      </>}
      count={`${total.toLocaleString('en-US')} PDs`}
      loading={loading} error={error} empty={isEmpty} skeleton="cards"
      page={page} total={total}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
    >
      {isEmpty ? (
        <EmptyState icon={<IconUsers size={22} />} title="No PDs found"
          sub={search || specialtyId || programId ? 'No PDs match your filters.' : 'Program Director and Sub-PD accounts will appear here.'} />
      ) : (
        <CardGrid>
          {pageRows.map((u, i) => (
            <RevealOnScroll key={`${u._kind}-${u._id}`} delay={i * 0.06}>
              <AccountCard name={u.name} id={u.idNumber} role={u._kind} fields={fieldsFor(u)} history={histLines(u.changeHistory)} />
            </RevealOnScroll>
          ))}
        </CardGrid>
      )}
    </ListShell>
  );
}
