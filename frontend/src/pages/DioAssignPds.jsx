// frontend/src/pages/DioAssignPds.jsx
//
// "Program Directors" assignment panel for the DIO Assignments page. Lets the
// DIO assign each Program Director to ONE specialty inline. A PD oversees that
// specialty across every hospital that offers it, and each specialty may have
// only one PD (the backend enforces uniqueness → 409, surfaced here as a toast).
//
// Rendered as a tab body inside DioAssignments and as the standalone ODIO
// "PD Assignment" screen (DioPdAssignment) — both own the Navbar + <main>, so
// this component renders only its own card.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMtToast, MtToastHost } from '../components/MtToast';
import SearchableSelect from '../components/SearchableSelect';
import Sk               from '../components/Skeleton';
import { IconBriefcase } from '../components/icons';
import api              from '../api/axios';
import { specialtyName } from '../utils/specialtyName';
import './dio.css';

const API_BASE = '';

function initialsOf(p) {
  return p.initials || p.name?.trim()?.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export function ProgramDirectorsPanel() {
  const [pds,         setPds        ] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [search,      setSearch     ] = useState('');
  const [savingId,    setSavingId   ] = useState(null);
  const { toasts, showToast } = useMtToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        api.get('/api/dio/program-directors'),
        api.get('/api/specialties'),
      ]);
      setPds(pRes.data?.data || pRes.data || []);
      setSpecialties((sRes.data?.data || sRes.data || []).filter(s => s.isActive !== false));
    } catch { showToast('Failed to load program directors', 'dng'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const name = specialtyName(pd.specialtyId);
    return name ? (repIdByName[name] || '') : '';
  }

  async function assignSpecialty(pd, specialtyId) {
    if (!specialtyId || specialtyId === currentValue(pd)) return;
    setSavingId(pd._id);
    try {
      const res = await api.patch(`/api/dio/program-directors/${pd._id}`, { specialtyId });
      const saved = res.data?.data || res.data;
      setPds(prev => prev.map(p => p._id === pd._id ? { ...p, ...saved } : p));
      showToast(`${pd.name} assigned to ${specialtyName(saved.specialtyId) || 'specialty'}`, 'ok');
    } catch (err) {
      showToast(err.response?.data?.message || 'Assignment failed', 'dng');
    } finally { setSavingId(null); }
  }

  const filtered = pds.filter(p => {
    const q = search.toLowerCase();
    return !q
      || p.name?.toLowerCase().includes(q)
      || (p.email || '').toLowerCase().includes(q)
      || (specialtyName(p.specialtyId) || '').toLowerCase().includes(q);
  });

  if (loading) return (
    <div className="mt-card">
      <div className="mt-filterbar"><Sk h={38} r={8} style={{ flex: 1 }} /></div>
      {[...Array(5)].map((_, i) => <Sk key={i} h={44} r={8} style={{ marginBottom: 8 }} />)}
    </div>
  );

  return (
    <div className="mt-card">
      <div className="mt-filterbar">
        <div className="mt-search">
          <input placeholder="Search by name, email, specialty…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="mt-filterbar-spacer" />
        <span className="mt-count">{filtered.length} program director{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="mt-table-wrap">
        <table className="mt-table mt-table--stack">
          <thead>
            <tr><th className="mt-th">#</th><th className="mt-th">Program Director</th><th className="mt-th">Assigned Specialty</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td className="mt-td" colSpan={3} style={{ padding: 0 }}>
                  <div className="mt-empty" style={{ margin: 12 }}>
                    <div className="mt-empty-icon"><IconBriefcase size={22} /></div>
                    <div className="mt-empty-title">{pds.length === 0 ? 'No program directors yet.' : 'No match.'}</div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((p, i) => (
              <tr key={p._id}>
                <td className="mt-td mt-td--muted">{i + 1}</td>
                <td className="mt-td" data-label="Program Director">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    {p.photoUrl
                      ? <img src={`${API_BASE}${p.photoUrl}`} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
                      : <span className="mt-acct-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>{initialsOf(p)}</span>}
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{p.name}</div>
                      {p.email && <div className="mt-acct-id">{p.email}</div>}
                    </div>
                  </div>
                </td>
                <td className="mt-td" data-label="Assigned Specialty" style={{ minWidth: 240, maxWidth: 320 }}>
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

      <MtToastHost toasts={toasts} />
    </div>
  );
}
