// W1-Analyzer — Central Secretaries. The data analyzer can ADD + EDIT central
// secretaries (POST/PATCH /api/analyzer/staff, role=central_secretary). Add + Edit
// pick one-or-more specialties (any mix of main + sub-specialty); edit also covers
// name/phone/email/active/locked.
// GET /api/analyzer/central-secretaries?includeInactive=
//   → data:[{ ...cs, specialtyIds:[{name,nameEn,type}], councilId:{name,nameEn} (legacy), changeHistory }]
import { useState } from 'react';
import { IconUsers } from '../components/icons';
import AccountCard from '../components/AccountCard';
import RevealOnScroll from '../components/RevealOnScroll';
import { MtToastHost, useMtToast } from '../components/MtToast';
import {
  ListShell, CardGrid, SearchBox, EmptyState,
  useAnalyzerList, useClientList, useOptions, histLines, fmtDate, PAGE_SIZE,
} from './AnalyzerListKit';
import { StaffFormModal } from './AnalyzerStaffForms';
import './Analyzer.css';

// The specialties a CS is scoped to, as a readable string. New-model accounts
// carry an explicit specialtyIds list; legacy accounts fall back to council/type.
function specialtyText(u) {
  const names = (u.specialtyIds || []).map((s) => s?.name).filter(Boolean);
  if (names.length) {
    const shown = names.slice(0, 3).join(', ');
    return names.length > 3 ? `${shown} +${names.length - 3} more` : shown;
  }
  if (u.councilId?.name) return u.councilId.name;              // legacy main CS
  if (u.secretaryType === 'precise') return 'All sub-specialties'; // legacy precise CS
  return '—';
}

// Short scope descriptor for the card's role line.
function scopeSuffix(u) {
  const n = (u.specialtyIds || []).length;
  if (n) return `${n} specialt${n === 1 ? 'y' : 'ies'}`;
  return u.secretaryType === 'precise' ? 'Sub-specialty' : 'Specialty'; // legacy
}

export default function AnalyzerCentralSecretaries() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const reset = (fn) => (v) => { fn(v); setPage(1); };

  const { data, loading, error, reload } = useAnalyzerList('/api/analyzer/central-secretaries');
  const specialties = useOptions('/api/analyzer/specialties', (s) => ({
    value: s._id,
    label: s.type === 'precise' ? `${s.name} (sub)` : s.name,
  }));
  const rows = Array.isArray(data) ? data : [];
  const { pageRows, total } = useClientList(rows, { search, fields: ['name', 'idNumber', 'email'], page });
  const isEmpty = !loading && total === 0;

  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const { toasts, showToast } = useMtToast();

  return (
    <>
      <ListShell
        title="Central Secretaries" subtitle="Data Analyzer"
        filters={<SearchBox value={search} onChange={reset(setSearch)} placeholder="Search by name or ID…" />}
        count={`${total.toLocaleString('en-US')} central secretaries`}
        actions={<button type="button" className="mt-btn" onClick={() => setAddOpen(true)}>+ Add central secretary</button>}
        loading={loading} error={error} empty={isEmpty} skeleton="cards"
        page={page} total={total}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => (p * PAGE_SIZE < total ? p + 1 : p))}
      >
        {isEmpty ? (
          <EmptyState icon={<IconUsers size={22} />} title="No central secretaries found"
            sub={search ? 'No secretaries match your search.' : 'Add a central secretary to get started.'} />
        ) : (
          <CardGrid>
            {pageRows.map((u, i) => (
              <RevealOnScroll key={u._id} delay={i * 0.06}>
                <AccountCard
                  name={u.name} id={u.idNumber}
                  role={`Central Secretary · ${scopeSuffix(u)}`}
                  canEdit onEdit={() => setEditUser(u)}
                  fields={[
                    { label: 'Specialties', value: specialtyText(u) },
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

      {addOpen && (
        <StaffFormModal role="central_secretary" mode="add" specialties={specialties} onClose={() => setAddOpen(false)}
          onSaved={(saved) => {
            setAddOpen(false); reload();
            showToast(saved?.role === 'data_entry'
              ? 'Data entry clerk added — see the Data Entry Clerks page.' : 'Central secretary added.', 'ok');
          }} />
      )}
      {editUser && (
        <StaffFormModal role="central_secretary" mode="edit" staff={editUser} specialties={specialties} onClose={() => setEditUser(null)}
          onSaved={() => { setEditUser(null); reload(); showToast('Central secretary updated.', 'ok'); }} />
      )}
      <MtToastHost toasts={toasts} />
    </>
  );
}
