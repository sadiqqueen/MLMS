// W1-Analyzer — DIOs (read-only account cards). Merges DIOs + ODIOs + Sub-DIOs.
// GET /api/analyzer/dios?countryId=&city=&centerId=
//   → data:{ dios:[…], odios:[…], subDios:[…] }  (each with changeHistory)
// DIOs populate countryId + assignedCenterIds; ODIOs/Sub-DIOs populate their
// parent dioId (they inherit country/city/centers from the parent).
import { useState } from 'react';
import { IconBriefcase } from '../components/icons';
import AccountCard from '../components/AccountCard';
import RevealOnScroll from '../components/RevealOnScroll';
import {
  ListShell, CardGrid, SearchBox, FilterSelect, EmptyState,
  useAnalyzerList, useOptions, distinctOptions, useClientList, histLines, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

export default function AnalyzerDios() {
  const [search, setSearch] = useState('');
  const [countryId, setCountryId] = useState('');
  const [centerId, setCenterId] = useState('');
  const [city, setCity] = useState('');
  const [page, setPage] = useState(1);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const countryOpts = useOptions('/api/analyzer/countries', (c) => ({ value: c._id, label: c.name }));
  const centerOpts = useOptions('/api/analyzer/centers', (c) => ({ value: c._id, label: c.name }));

  const { data, loading, error } = useAnalyzerList('/api/analyzer/dios', { countryId, centerId });
  const merged = [
    ...((data?.dios) || []).map((d) => ({ ...d, _kind: 'DIO' })),
    ...((data?.odios) || []).map((o) => ({ ...o, _kind: 'ODIO' })),
    ...((data?.subDios) || []).map((s) => ({ ...s, _kind: 'Sub-DIO' })),
  ];
  const cityOpts = distinctOptions(merged, 'city');
  const scoped = city ? merged.filter((u) => u.city === city) : merged;
  const { pageRows, total } = useClientList(scoped, { search, fields: ['name', 'idNumber', 'email'], page });
  const isEmpty = !loading && total === 0;

  const fieldsFor = (u) => u._kind === 'DIO'
    ? [
        { label: 'Country', value: u.countryId?.name || '—' },
        { label: 'City', value: u.city || '—' },
        { label: 'Phone', value: u.phone || '—' },
        { label: 'Email', value: u.email || '—' },
      ]
    : [
        { label: 'Assigned DIO', value: u.dioId?.name || '—' },
        { label: 'City', value: u.city || '—' },
        { label: 'Phone', value: u.phone || '—' },
        { label: 'Email', value: u.email || '—' },
      ];

  return (
    <ListShell
      title="DIOs" subtitle="Data Analyzer"
      filters={<>
        <SearchBox value={search} onChange={reset(setSearch)} placeholder="Search by name or ID…" />
        <FilterSelect value={countryId} onChange={reset(setCountryId)} allLabel="Country: All" options={countryOpts} />
        <FilterSelect value={city} onChange={reset(setCity)} allLabel="City: All" options={cityOpts} />
        <FilterSelect value={centerId} onChange={reset(setCenterId)} allLabel="Center: All" options={centerOpts} />
      </>}
      count={`${total.toLocaleString('en-US')} DIOs`}
      loading={loading} error={error} empty={isEmpty} skeleton="cards"
      page={page} total={total}
      onPrev={() => setPage((p) => Math.max(1, p - 1))}
      onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
    >
      {isEmpty ? (
        <EmptyState icon={<IconBriefcase size={22} />} title="No DIOs found"
          sub={search || countryId || centerId || city ? 'No DIOs match your filters.' : 'DIO, ODIO and Sub-DIO accounts will appear here.'} />
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
