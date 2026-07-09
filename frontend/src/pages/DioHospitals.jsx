// frontend/src/pages/DioHospitals.jsx
//
// Read-only organisational overview for the DIO: every hospital in its track
// with its program director(s), supervisors, and specialties — each specialty
// showing its assigned secretary. Data from GET /api/dio/hospitals-overview.
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import api from '../api/axios';
import Sk from '../components/Skeleton';

function Section({ title, count, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        {title}{count !== undefined ? ` (${count})` : ''}
      </div>
      {children}
    </div>
  );
}

function Muted({ children }) {
  return <div style={{ fontSize: 13, color: '#B8BBC8' }}>{children}</div>;
}

function HospitalCard({ h }) {
  const location = [h.city, h.governorate].filter(Boolean).join(' · ') || '—';
  return (
    <div className="admin-card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border, #E8E9EF)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1B1464' }}>🏥 {h.name}</div>
          <div style={{ fontSize: 12, color: '#8B8FA8', marginTop: 2 }}>{location}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: '#EEEDFE', color: '#3C3489' }}>
            {h.specialties.length} spec.
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: '#DBEAFE', color: '#1E40AF' }}>
            {h.supervisors.length} sup.
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Program director(s) */}
        <Section title="Program Director">
          {h.programDirectors.length === 0
            ? <Muted>Not assigned</Muted>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {h.programDirectors.map(pd => (
                  <div key={pd._id} style={{ fontSize: 14, fontWeight: 600, color: '#1B1464' }}>
                    ⭐ {pd.name}
                    {pd.department ? <span style={{ fontSize: 12, color: '#8B8FA8', fontWeight: 400 }}> · {pd.department}</span> : null}
                  </div>
                ))}
              </div>
            )}
        </Section>

        {/* Specialties — each with its secretary */}
        <Section title="Specialties" count={h.specialties.length}>
          {h.specialties.length === 0
            ? <Muted>No specialties yet</Muted>
            : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {h.specialties.map(sp => (
                  <div key={sp._id || sp.name}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 10px', border: '1px solid var(--border-soft, #F0F0F0)', borderRadius: 8, background: 'var(--surface-2, #FAFAFC)' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: '#EEEDFE', color: '#3C3489', whiteSpace: 'nowrap' }}>
                      {sp.name}
                    </span>
                    <span style={{ fontSize: 12, color: sp.secretary ? '#4B5563' : '#B8BBC8', textAlign: 'right' }}>
                      {sp.secretary ? `📋 ${sp.secretary.name}` : 'No secretary'}
                    </span>
                  </div>
                ))}
              </div>
            )}
        </Section>

        {/* Supervisors */}
        <Section title="Supervisors" count={h.supervisors.length}>
          {h.supervisors.length === 0
            ? <Muted>None assigned</Muted>
            : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {h.supervisors.map(s => (
                  <span key={s._id}
                    title={s.email || ''}
                    style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 8, background: '#F1F5F9', color: '#334155' }}>
                    {s.name}{s.specialty ? <span style={{ color: '#8B8FA8' }}> · {s.specialty}</span> : null}
                  </span>
                ))}
              </div>
            )}
        </Section>
      </div>
    </div>
  );
}

export default function DioHospitals() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/dio/hospitals-overview')
      .then(r => setHospitals(r.data?.data || r.data || []))
      .catch(() => showToast('Failed to load hospitals', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = hospitals.filter(h => {
    const q = search.trim().toLowerCase();
    return !q
      || (h.name || '').toLowerCase().includes(q)
      || (h.city || '').toLowerCase().includes(q)
      || (h.governorate || '').toLowerCase().includes(q)
      || h.specialties.some(sp => (sp.name || '').toLowerCase().includes(q))
      || h.supervisors.some(s => (s.name || '').toLowerCase().includes(q));
  });

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-toolbar" style={{ marginBottom: 16 }}><Sk h={36} r={8} style={{ flex: 1 }} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="admin-card" style={{ padding: 18 }}>
              <Sk w="60%" h={18} style={{ marginBottom: 8 }} />
              <Sk w="40%" h={12} style={{ marginBottom: 18 }} />
              <Sk w="100%" h={60} r={8} style={{ marginBottom: 12 }} />
              <Sk w="100%" h={80} r={8} />
            </div>
          ))}
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-toolbar" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <input className="admin-search" style={{ flex: 1, minWidth: 200 }}
            placeholder="Search by hospital, city, specialty or supervisor…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <span style={{ fontSize: 13, color: '#8B8FA8', flexShrink: 0 }}>
            {filtered.length} hospital{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 56, color: '#8B8FA8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#4B5563' }}>
              {hospitals.length === 0 ? 'No hospitals yet.' : 'No hospitals match your search.'}
            </div>
          </div>
        )}

        <div key={search} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, animation: 'fadeIn .18s ease-out' }}>
          {filtered.map(h => <HospitalCard key={h._id} h={h} />)}
        </div>

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
