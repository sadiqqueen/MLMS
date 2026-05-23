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

export default function DirectorDashboard() {
  const [students,      setStudents     ] = useState([]);
  const [loading,       setLoading      ] = useState(true);
  const [search,        setSearch       ] = useState('');
  const [selected,      setSelected     ] = useState(null);
  const [detail,        setDetail       ] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api.get('/api/users/students')
      .then(r => setStudents(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function openStudent(student) {
    setSelected(student);
    setDetail(null);
    setDetailLoading(true);
    try {
      const [rotRes, repRes] = await Promise.all([
        api.get(`/api/rotations/student/${student._id}`),
        api.get(`/api/reports/student/${student._id}`),
      ]);
      setDetail({ rotations: rotRes.data, reports: repRes.data });
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeModal() {
    setSelected(null);
    setDetail(null);
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.studentId || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card" style={{ marginBottom: 20 }}>
          <div className="admin-toolbar">
            <input
              className="admin-search"
              placeholder="Search by name or student ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ fontSize: 13, color: '#888', flexShrink: 0 }}>
              {filtered.length} student{filtered.length !== 1 ? 's' : ''}
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
                <Sk w={70}  h={12} style={{ marginTop: 4 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            No students found
          </div>
        ) : (
          <div className="admin-card-grid">
            {filtered.map(student => (
              <button
                key={student._id}
                className="user-card"
                style={{ border: 'none', width: '100%' }}
                onClick={() => openStudent(student)}
              >
                {student.photoUrl
                  ? <img src={`${student.photoUrl}`} alt={student.name} className="user-card-photo" />
                  : <div className="user-card-initials">
                      {student.initials || student.name.slice(0, 2).toUpperCase()}
                    </div>
                }
                <div className="user-card-name">{student.name}</div>
                <div className="user-card-sub">{student.studentId || 'No ID'}</div>
                <div className="user-card-sub">Year {student.year || '—'}</div>
              </button>
            ))}
          </div>
        )}

        {/* ── STUDENT DETAIL MODAL ── */}
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
                    <span className="modal-label">Student ID</span>
                    <span className="modal-value">{selected.studentId || '—'}</span>
                  </div>
                  <div className="modal-row">
                    <span className="modal-label">Phone</span>
                    <span className="modal-value">{selected.phone || '—'}</span>
                  </div>
                  <div className="modal-row">
                    <span className="modal-label">Year</span>
                    <span className="modal-value">{selected.year || '—'}</span>
                  </div>
                  <div className="modal-row">
                    <span className="modal-label">City</span>
                    <span className="modal-value">{selected.city || '—'}</span>
                  </div>
                </div>

                {detailLoading ? (
                  <div style={{ padding: '8px 0' }}>
                    <Sk w={150} h={14} style={{ marginBottom: 12 }} />
                    {[...Array(3)].map((_, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #f0f0f0' }}>
                        <Sk w={140} h={13} />
                        <Sk w={70}  h={20} r={20} />
                        <Sk w={100} h={13} />
                        <Sk w={80}  h={13} />
                      </div>
                    ))}
                  </div>
                ) : detail && (
                  <>
                    {/* Rotations */}
                    <div className="modal-section-title" style={{ marginBottom: 10 }}>Rotations</div>
                    {detail.rotations.length === 0
                      ? <div style={{ fontSize: 13, color: '#aaa', marginBottom: 20 }}>No rotations yet</div>
                      : detail.rotations.map(r => (
                          <div key={r._id} style={{
                            background: '#f8f9fa', borderRadius: 10, padding: '12px 14px',
                            marginBottom: 10,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600, fontSize: 14, color: '#111' }}>
                                {r.hospital?.name || '—'}
                              </span>
                              <span className={STATUS_BADGE[r.status] || 'badge-inactive'}>{r.status}</span>
                            </div>
                            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                              {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
                              {r.doctor && <span> · Dr. {r.doctor.name}</span>}
                            </div>
                            <div style={{ fontSize: 12, color: '#888', display: 'flex', gap: 16 }}>
                              <span>Weekly avg: <b>{r.weeklyAvg ?? '—'}</b></span>
                              <span>Monthly avg: <b>{r.monthlyAvg ?? '—'}</b></span>
                              <span>Final: <b>{r.finalGrade ?? '—'}</b></span>
                            </div>
                          </div>
                        ))
                    }

                    {/* Reports */}
                    <div className="modal-section-title" style={{ margin: '16px 0 10px' }}>
                      Reports & Assessments
                    </div>
                    {detail.reports.length === 0
                      ? <div style={{ fontSize: 13, color: '#aaa' }}>No reports yet</div>
                      : (
                          <div className="admin-table-wrap" style={{ borderRadius: 10, border: '1px solid #f0f2f5' }}>
                            <table className="admin-table">
                              <thead>
                                <tr>
                                  <th>Title</th>
                                  <th>Type</th>
                                  <th>Date</th>
                                  <th>Grade</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.reports.map(rep => (
                                  <tr key={rep._id}>
                                    <td>{rep.title}</td>
                                    <td>{rep.type}</td>
                                    <td>{fmtDate(rep.date)}</td>
                                    <td>{rep.grade || '—'}</td>
                                    <td>
                                      <span className={rep.status === 'graded' ? 'badge-completed' : 'badge-pending'}>
                                        {rep.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                    }
                  </>
                )}
              </div>

            </div>
          </div>
        )}

      </main>
    </>
  );
}
