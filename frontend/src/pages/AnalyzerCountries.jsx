// W1-Analyzer — Countries. Country creation is now a Data-Analyzer (+ Developer)
// capability (moved off the Data-Entry clerk, Change 1). Reuses the shared,
// bilingual AddCountryModal → POST /api/countries.
// GET /api/analyzer/countries → data:[{ _id, name, code, isActive }]
import { useState } from 'react';
import { IconGlobe } from '../components/icons';
import { useAuth } from '../context/AuthContext';
import { MtToastHost, useMtToast } from '../components/MtToast';
import { AddCountryModal } from './registryShared';
import {
  ListShell, TableCard, SearchBox, EmptyState,
  useAnalyzerList, useClientList, PAGE_SIZE,
} from './AnalyzerListKit';
import './Analyzer.css';

export default function AnalyzerCountries() {
  const { user } = useAuth();
  const { toasts, showToast } = useMtToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const onSearch = (v) => { setSearch(v); setPage(1); };

  // POST /api/countries is gated to data_analyzer + developer — head_cs shares
  // this page (read-only) but would 403, so it never sees the button.
  const canCreate = ['data_analyzer', 'developer'].includes(user?.role);

  const { data, loading, error, reload } = useAnalyzerList('/api/analyzer/countries');
  const rows = Array.isArray(data) ? data : [];
  const { pageRows, total } = useClientList(rows, { search, fields: ['name', 'code'], page });
  const isEmpty = !loading && total === 0;

  return (
    <>
      <ListShell
        title="Countries" subtitle="Data Analyzer"
        filters={<SearchBox value={search} onChange={onSearch} placeholder="Search…" />}
        count={`${total.toLocaleString('en-US')} ${total === 1 ? 'country' : 'countries'}`}
        actions={canCreate && <button type="button" className="mt-btn" onClick={() => setAddOpen(true)}>+ Add country</button>}
        loading={loading} error={error} empty={isEmpty}
        page={page} total={total}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
      >
        {isEmpty ? (
          <EmptyState icon={<IconGlobe size={22} />} title="No countries found"
            sub={search ? 'No countries match your search.' : 'Add a country to get started.'} />
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

      {addOpen && (
        <AddCountryModal open lang="en" onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); reload(); showToast('Country added.', 'ok'); }} />
      )}
      <MtToastHost toasts={toasts} />
    </>
  );
}
