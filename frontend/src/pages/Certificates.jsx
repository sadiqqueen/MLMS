import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import SearchableSelect from '../components/SearchableSelect';
import ViewToggle from '../components/ViewToggle';
import api from '../api/axios';
import Sk from '../components/Skeleton';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function asArray(v) {
  return Array.isArray(v?.data) ? v.data : Array.isArray(v) ? v : [];
}

function textValue(value, fallback = '—') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.name || value.title || fallback;
  return fallback;
}

const IconDelete = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

const IconPrint = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </svg>
);

const EMPTY_FORM = {
  studentSearch: '',
  student:       null,
  specialty:     '',
  hospital:      null,
  issueDate:     today(),
};

const lbl = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#666',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
};

export default function Certificates() {
  const navigate = useNavigate();
  const [students,     setStudents    ] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading,      setLoading     ] = useState(true);
  const [view,         setView        ] = useState('list');
  const [showForm,     setShowForm    ] = useState(false);
  const [submitting,   setSubmitting  ] = useState(false);
  const [form,         setForm        ] = useState(EMPTY_FORM);
  const [dropOpen,     setDropOpen    ] = useState(false);
  const [specialtyOptions, setSpecialtyOptions] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/api/users/students'),
      api.get('/api/certificates'),
      api.get('/api/specialties').catch(() => ({ data: { data: [] } })),
    ]).then(([sRes, cRes, spRes]) => {
      setStudents(asArray(sRes.data));
      setCertificates(asArray(cRes.data));
      const names = asArray(spRes.data).map(s => s.name).filter(Boolean);
      if (names.length) setSpecialtyOptions(names);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function selectStudent(student) {
    setForm(f => ({
      ...f,
      studentSearch: student.name,
      student,
      specialty: textValue(student.specialtyId || student.specialty, ''),
      hospital: student.hospitalId || student.hospital || null,
    }));
    setDropOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.student) return;
    setSubmitting(true);
    try {
      const payload = {
        student:   form.student._id,
        specialty: form.specialty,
        hospital:  form.hospital?._id || undefined,
        issueDate: form.issueDate,
        notes:     undefined,
      };
      const res = await api.post('/api/certificates', payload);
      setCertificates(prev => [res.data, ...prev]);
      setShowForm(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCert(id) {
    if (!window.confirm('Delete this certificate?')) return;
    await api.delete(`/api/certificates/${id}`);
    setCertificates(prev => prev.filter(c => c._id !== id));
  }

  const filtered = form.studentSearch.trim() === ''
    ? students
    : students.filter(s =>
        s.name.toLowerCase().includes(form.studentSearch.toLowerCase()) ||
        (s.studentId || '').toLowerCase().includes(form.studentSearch.toLowerCase())
      );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        <div className="admin-toolbar" style={{ marginBottom: 16 }}>
          <ViewToggle value={view} onChange={setView} />
          <span style={{ fontSize:13, color:'#8B8FA8', flexShrink:0 }}>
            {certificates.length} certificate{certificates.length !== 1 ? 's' : ''}
          </span>
          <button className="btn-purple" onClick={() => { setShowForm(true); setForm(EMPTY_FORM); }}>
            + New Certificate
          </button>
        </div>

        {loading ? (
          <div className="admin-card">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    {['#', 'Trainee', 'Specialty', 'Hospital', 'Issue Date', 'Notes', ''].map(c => <th key={c}>{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...Array(8)].map((_, i) => (
                    <tr key={i}>
                      <td><Sk w={20}  h={13} /></td>
                      <td>
                        <Sk w={130} h={13} />
                        <Sk w={70}  h={11} style={{ marginTop: 4 }} />
                      </td>
                      <td><Sk w={110} h={13} /></td>
                      <td><Sk w={120} h={13} /></td>
                      <td><Sk w={80}  h={13} /></td>
                      <td><Sk w={140} h={13} /></td>
                      <td><Sk w={28}  h={28} r={6} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : certificates.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#aaa', fontSize: 14 }}>
            No certificates issued yet
          </div>
        ) : (
          <div className="admin-card">
            {view === 'list' && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th><th>Trainee</th><th>Specialty</th>
                    <th>Hospital</th><th>Issue Date</th><th>Notes</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((c, i) => (
                    <tr key={c._id}>
                      <td style={{ color: '#aaa', width: 36 }}>{i + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.student?.name || '—'}</div>
                        <div style={{ fontSize: 11, color: '#aaa' }}>{c.student?.studentId || ''}</div>
                      </td>
                      <td>{textValue(c.specialty)}</td>
                      <td>{c.hospital?.name || '—'}</td>
                      <td>{fmtDate(c.issueDate)}</td>
                      <td style={{ maxWidth: 180, color: '#666', fontSize: 13 }}>{c.notes || '—'}</td>
                      <td>
                        <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                          {!c.revokedAt && c._id && (
                            <button
                              type="button"
                              className="btn-action edit"
                              style={{ width:'auto', padding:'0 10px', gap:6 }}
                              onClick={() => navigate(`/admin/certificates/${c._id}/print`)}
                              title="Print Certificate"
                              aria-label={`Print Certificate for ${c.student?.name || 'trainee'}`}
                            >
                              <IconPrint />
                              Print Certificate
                            </button>
                          )}
                        <button className="btn-action btn-action-del" onClick={() => deleteCert(c._id)} title="Delete" aria-label={`Delete certificate for ${c.student?.name || 'trainee'}`}>
                          <IconDelete />
                        </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
            {view === 'card' && (
              <div className="management-card-grid">
                {certificates.map(c => (
                  <div className="management-card" key={c._id}>
                    <div>
                      <div className="management-card-title">{c.student?.name || '—'}</div>
                      <div className="management-card-sub">{c.student?.studentId || 'No student ID'}</div>
                    </div>
                    <div className="management-card-meta">
                      <span className="specialty-tag">{textValue(c.specialty)}</span>
                    </div>
                    <div className="management-card-sub">{c.hospital?.name || '—'} - {fmtDate(c.issueDate)}</div>
                    <div className="management-card-actions">
                      {!c.revokedAt && c._id && (
                        <button
                          type="button"
                          className="btn-action edit"
                          style={{ width:'auto', padding:'0 10px', gap:6 }}
                          onClick={() => navigate(`/admin/certificates/${c._id}/print`)}
                          title="Print Certificate"
                          aria-label={`Print Certificate for ${c.student?.name || 'trainee'}`}
                        >
                          <IconPrint />
                          Print Certificate
                        </button>
                      )}
                      <button className="btn-action btn-action-del" onClick={() => deleteCert(c._id)} title="Delete" aria-label={`Delete certificate for ${c.student?.name || 'trainee'}`}>
                        <IconDelete />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {showForm && (
          <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
            <div className="admin-modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>

              <div className="admin-modal-header">
                <div className="admin-modal-title">New Certificate</div>
                <button className="admin-modal-close" onClick={() => setShowForm(false)}>✕</button>
              </div>

              <form className="admin-modal-body" onSubmit={handleSubmit}>

                {/* ── Student search ── */}
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Trainee *</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="admin-search"
                      style={{ width: '100%', boxSizing: 'border-box' }}
                      placeholder="Type a name or student ID…"
                      value={form.studentSearch}
                      autoComplete="off"
                      onFocus={() => setDropOpen(true)}
                      onBlur={() => setTimeout(() => setDropOpen(false), 150)}
                      onChange={e => {
                        setForm(f => ({ ...f, studentSearch: e.target.value, student: null, specialty: '', hospital: null }));
                        setDropOpen(true);
                      }}
                    />

                    {/* Dropdown list */}
                    {dropOpen && filtered.length > 0 && (
                      <ul style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 400,
                        margin: 0, padding: 0, listStyle: 'none',
                        background: '#fff', border: '1px solid #e8eaf0', borderRadius: 10,
                        boxShadow: '0 6px 24px rgba(0,0,0,0.13)', maxHeight: 240, overflowY: 'auto',
                      }}>
                        {filtered.map(s => (
                          <li key={s._id}>
                            <button
                              type="button"
                              onMouseDown={e => { e.preventDefault(); selectStudent(s); }}
                              style={{
                                width: '100%', textAlign: 'left', background: 'none',
                                border: 'none', borderBottom: '1px solid #f3f3f3',
                                padding: '10px 14px', cursor: 'pointer', display: 'block',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#f0f3ff'}
                              onMouseLeave={e => e.currentTarget.style.background = 'none'}
                            >
                              <span style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                              {s.studentId && <span style={{ marginLeft: 8, fontSize: 12, color: '#aaa' }}>{s.studentId}</span>}
                              {s.year      && <span style={{ marginLeft: 8, fontSize: 12, color: '#aaa' }}>Year {s.year}</span>}
                              {s.hospital?.name && <span style={{ marginLeft: 8, fontSize: 12, color: '#7c6fcd' }}>{s.hospital.name}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* ── Auto-filled student info ── */}
                {form.student && (
                  <div style={{
                    background: '#f5f7ff', border: '1px solid #e0e4ff',
                    borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#8b83d0', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      Selected Trainee
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px 16px', fontSize: 13 }}>
                      <div>
                        <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Full Name</div>
                        <div style={{ fontWeight: 600 }}>{form.student.name}</div>
                      </div>
                      {form.student.studentId && (
                        <div>
                          <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Student ID</div>
                          <div style={{ fontWeight: 600 }}>{form.student.studentId}</div>
                        </div>
                      )}
                      {form.student.year && (
                        <div>
                          <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Year</div>
                          <div style={{ fontWeight: 600 }}>Year {form.student.year}</div>
                        </div>
                      )}
                      {form.hospital?.name && (
                        <div>
                          <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Hospital</div>
                          <div style={{ fontWeight: 600 }}>{form.hospital.name}</div>
                        </div>
                      )}
                      {form.student.doctor?.name && (
                        <div>
                          <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Doctor</div>
                          <div style={{ fontWeight: 600 }}>{form.student.doctor.name}</div>
                          {form.student.doctor.specialty && (
                            <div style={{ fontSize: 11, color: '#aaa' }}>{textValue(form.student.doctor.specialty)}</div>
                          )}
                        </div>
                      )}
                      <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                        <div style={{ color: '#999', fontSize: 11, marginBottom: 4 }}>Specialty</div>
                        <SearchableSelect
                          value={form.specialty}
                          onChange={value => setForm(f => ({ ...f, specialty: value }))}
                          options={specialtyOptions.map(s => ({ value: s, label: s }))}
                          placeholder="Search specialty..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn-purple" disabled={!form.student || submitting}>
                    {submitting ? 'Saving…' : 'Issue Certificate'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
