import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import api from '../api/axios';
import Sk from '../components/Skeleton';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_BADGE = {
  current:   'badge-active',
  completed: 'badge-completed',
  upcoming:  'badge-inactive',
};

export default function DirectorDoctors() {
  const [doctors,       setDoctors      ] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [search,        setSearch       ] = useState('');
  const [selected,      setSelected     ] = useState(null);
  const [rotations,     setRotations    ] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api.get('/api/users/doctors')
      .then(r => setDoctors(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function openDoctor(doctor) {
    setSelected(doctor);
    setRotations([]);
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/rotations/doctor/${doctor._id}`);
      setRotations(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeModal() {
    setSelected(null);
    setRotations([]);
  }

  const filtered = doctors.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.specialty || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.department || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card" style={{ marginBottom: 20 }}>
          <div className="admin-toolbar">
            <input
              className="admin-search"
              placeholder="Search by name, specialty, or department…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ fontSize: 13, color: '#888', flexShrink: 0 }}>
              {filtered.length} doctor{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="admin-card-grid">
            {[...Array(8)].map((_, i) => (
              <div className="user-card" key={i} style={{ border: '1px solid #e5e7eb' }}>
                <Sk w={72} h={72} r="50%" />
                <Sk w={130} h={14} style={{ marginTop: 10 }} />
                <Sk w={100} h={12} style={{ marginTop: 6 }} />
                <Sk w={80}  h={12} style={{ marginTop: 4 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            No doctors found
          </div>
        ) : (
          <div className="admin-card-grid">
            {filtered.map(doctor => (
              <button
                key={doctor._id}
                className="user-card"
                style={{ border: 'none', width: '100%' }}
                onClick={() => openDoctor(doctor)}
              >
                {doctor.photoUrl
                  ? <img src={`${doctor.photoUrl}`} alt={doctor.name} className="user-card-photo" />
                  : <div className="user-card-initials">
                      {doctor.initials || doctor.name.slice(0, 2).toUpperCase()}
                    </div>
                }
                <div className="user-card-name">{doctor.name}</div>
                <div className="user-card-sub">{doctor.specialty || 'No specialty'}</div>
                <div className="user-card-sub">{doctor.department || ''}</div>
              </button>
            ))}
          </div>
        )}

        {/* ── DOCTOR DETAIL MODAL ── */}
        {selected && (
          <div className="admin-modal-overlay" onClick={closeModal}>
            <div className="admin-modal admin-modal-lg" onClick={e => e.stopPropagation()}>

              <div className="admin-modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {selected.photoUrl
                    ? <img
                        src={`${selected.photoUrl}`}
                        alt={selected.name}
                        style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    : <div className="user-card-initials" style={{ width: 48, height: 48, fontSize: 18, flexShrink: 0 }}>
                        {selected.initials || selected.name.slice(0, 2).toUpperCase()}
                      </div>
                  }
                  <div>
                    <div className="admin-modal-title">{selected.name}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{selected.email}</div>
                  </div>
                </div>
                <button className="admin-modal-close" onClick={closeModal}>✕</button>
              </div>

              <div className="admin-modal-body">

                {/* Basic info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', marginBottom: 20 }}>
                  <div className="modal-row">
                    <span className="modal-label">Specialty</span>
                    <span className="modal-value">{selected.specialty || '—'}</span>
                  </div>
                  <div className="modal-row">
                    <span className="modal-label">Phone</span>
                    <span className="modal-value">{selected.phone || '—'}</span>
                  </div>
                  <div className="modal-row">
                    <span className="modal-label">Department</span>
                    <span className="modal-value">{selected.department || '—'}</span>
                  </div>
                  <div className="modal-row">
                    <span className="modal-label">City</span>
                    <span className="modal-value">{selected.city || '—'}</span>
                  </div>
                </div>

                {/* Rotations supervised by this doctor */}
                <div className="modal-section-title" style={{ marginBottom: 10 }}>Supervised Rotations</div>
                {detailLoading ? (
                  <div style={{ padding: '4px 0' }}>
                    {[...Array(3)].map((_, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #f0f0f0' }}>
                        <Sk w={140} h={13} />
                        <Sk w={70}  h={20} r={20} />
                        <Sk w={100} h={13} />
                        <Sk w={80}  h={13} />
                      </div>
                    ))}
                  </div>
                ) : rotations.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#aaa' }}>No rotations assigned</div>
                ) : (
                  <div className="admin-table-wrap" style={{ borderRadius: 10, border: '1px solid #f0f2f5' }}>
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Hospital</th>
                          <th>Start</th>
                          <th>End</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rotations.map(r => (
                          <tr key={r._id}>
                            <td>{r.student?.name || '—'}</td>
                            <td>{r.hospital?.name || '—'}</td>
                            <td>{fmtDate(r.startDate)}</td>
                            <td>{fmtDate(r.endDate)}</td>
                            <td>
                              <span className={STATUS_BADGE[r.status] || 'badge-inactive'}>
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
