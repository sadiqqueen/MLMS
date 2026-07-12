// frontend/src/pages/DioAssignPds.jsx
//
// "Program Directors" assignment panel for the DIO Assignments page. Lets the
// DIO assign each Program Director to ONE specialty inline. A PD oversees that
// specialty across every hospital that offers it, and each specialty may have
// only one PD (the backend enforces uniqueness → 409, surfaced here as a toast).
//
// Rendered as a tab body inside DioAssignments (which owns the Navbar + <main>),
// so this component renders only its own card — no Navbar/main wrapper.
import { useState, useEffect, useCallback, useMemo } from 'react';
import Toast            from '../components/Toast';
import SearchableSelect from '../components/SearchableSelect';
import Sk               from '../components/Skeleton';
import api              from '../api/axios';

const API_BASE = '';

export function ProgramDirectorsPanel() {
  const [pds,         setPds        ] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [search,      setSearch     ] = useState('');
  const [savingId,    setSavingId   ] = useState(null);
  const [toasts,      setToasts     ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        api.get('/api/dio/program-directors'),
        api.get('/api/specialties'),
      ]);
      setPds(pRes.data?.data || pRes.data || []);
      setSpecialties((sRes.data?.data || sRes.data || []).filter(s => s.isActive !== false));
    } catch { showToast('Failed to load program directors', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // De-duplicate specialties by name (the DB carries one row per hospital); each
  // distinct name maps to one representative id. The backend re-expands scope by
  // name, so any row of a given name is an equivalent assignment target.
  const { options: specialtyOptions, repIdByName } = useMemo(() => {
    const byName = {};
    for (const s of specialties) {
      if (s?.name && !byName[s.name]) byName[s.name] = s._id;
    }
    const options = Object.entries(byName)
      .map(([name, value]) => ({ value, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return { options, repIdByName: byName };
  }, [specialties]);

  // The PD's stored specialtyId may be any per-hospital row of its name; map it
  // to the representative id so the dropdown shows the current selection.
  function currentValue(pd) {
    const name = pd.specialtyId?.name;
    return name ? (repIdByName[name] || '') : '';
  }

  async function assignSpecialty(pd, specialtyId) {
    if (!specialtyId || specialtyId === currentValue(pd)) return;
    setSavingId(pd._id);
    try {
      const res = await api.patch(`/api/dio/program-directors/${pd._id}`, { specialtyId });
      const saved = res.data?.data || res.data;
      setPds(prev => prev.map(p => p._id === pd._id ? { ...p, ...saved } : p));
      showToast(`${pd.name} assigned to ${saved.specialtyId?.name || 'specialty'}`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Assignment failed', 'error');
    } finally { setSavingId(null); }
  }

  const filtered = pds.filter(p => {
    const q = search.toLowerCase();
    return !q
      || p.name?.toLowerCase().includes(q)
      || (p.email || '').toLowerCase().includes(q)
      || (p.specialtyId?.name || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <div className="admin-card">
      <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
      <div className="admin-table-wrap">
        <table className="admin-table"><tbody>
          {[...Array(5)].map((_, i) => (
            <tr key={i}>
              <td><Sk w={20} h={13} /></td>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sk w={36} h={36} r="50%" /><Sk w={140} h={13} /></div></td>
              <td><Sk w={220} h={34} r={8} /></td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </div>
  );

  return (
    <div className="admin-card">
      <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <input
          className="admin-search"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search by name, email, specialty…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 13, color: 'var(--text-muted, #8B8FA8)', flexShrink: 0 }}>
          {filtered.length} program director{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table admin-table--stack">
          <thead>
            <tr><th>#</th><th>Program Director</th><th>Assigned Specialty</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>⭐</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>
                    {pds.length === 0 ? 'No program directors yet.' : 'No match.'}
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((p, i) => (
              <tr key={p._id}>
                <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                <td data-label="Program Director">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.photoUrl
                      ? <img src={`${API_BASE}${p.photoUrl}`} alt="" className="cell-photo" />
                      : <div className="cell-initials">{p.initials || p.name?.[0] || '?'}</div>}
                    <div>
                      <strong>{p.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.email}</div>
                    </div>
                  </div>
                </td>
                <td data-label="Assigned Specialty" style={{ minWidth: 240, maxWidth: 320 }}>
                  <SearchableSelect
                    value={currentValue(p)}
                    onChange={v => assignSpecialty(p, v)}
                    options={specialtyOptions}
                    placeholder="Assign specialty…"
                    disabled={savingId === p._id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Toast toasts={toasts} />
    </div>
  );
}
