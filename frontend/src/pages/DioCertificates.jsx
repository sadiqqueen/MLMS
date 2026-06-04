// frontend/src/pages/DioCertificates.jsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import ViewToggle from '../components/ViewToggle';
import api from '../api/axios';
import Sk from '../components/Skeleton';

const CERT_TYPES = ['Completion', 'Training', 'Achievement', 'Attendance', 'Other'];

const EMPTY_FORM = {
  student: '',
  studentName: '',
  studentId: '',
  hospital: '',
  supervisor: '',
  specialty: '',
  issueDate: new Date().toISOString().slice(0, 10),
  notes: '',
  type: 'Completion',
};

function fmt(d) {
  if (!d) return '-';
  try {
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '-';
  }
}

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function readListPayload(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function textValue(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') return value.name || value.title || fallback;
  return fallback;
}

function traineeFromCertificate(cert) {
  return cert?.student || cert?.traineeId || {};
}

export default function DioCertificates() {
  const navigate = useNavigate();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revoking, setRevoking] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toasts, setToasts] = useState([]);
  const dropdownRef = useRef(null);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => safeArr(prev).concat({ id, message, type }));
    setTimeout(() => setToasts(prev => safeArr(prev).filter(t => t.id !== id)), 3500);
  }

  useEffect(() => {
    let alive = true;

    async function loadCertificates() {
      try {
        const res = await api.get('/api/dio/certificates');
        if (alive) setCertificates(readListPayload(res.data));
      } catch (err) {
        console.error('Failed to load certificates:', err);
        if (alive) {
          setCertificates([]);
          showToast('Failed to load certificates', 'error');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadCertificates();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setSearchResults([]);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function searchTrainees(query) {
    setSearchQuery(query);
    if (!query || query.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const res = await api.get(`/api/dio/trainees?search=${encodeURIComponent(query.trim())}`);
      setSearchResults(readListPayload(res.data));
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function resetIssueForm() {
    setForm(EMPTY_FORM);
    setSearchQuery('');
    setSearchResults([]);
    setSearchLoading(false);
  }

  function openIssueForm() {
    resetIssueForm();
    setShowForm(true);
  }

  function closeIssueForm() {
    setShowForm(false);
    resetIssueForm();
  }

  function selectTrainee(trainee) {
    if (!trainee) return;

    setForm(prev => ({
      ...prev,
      student: trainee?._id || '',
      studentName: trainee?.name || '',
      studentId: trainee?.studentId || '',
      hospital: trainee?.hospitalId?.name || trainee?.hospital?.name || '-',
      supervisor: trainee?.supervisorId?.name || trainee?.supervisor?.name || '-',
      specialty: textValue(trainee?.specialtyId || trainee?.specialty),
    }));
    setSearchQuery(trainee?.name || '');
    setSearchResults([]);
  }

  async function handleSubmit() {
    if (!form.student) {
      showToast('Please select a trainee first', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/api/dio/certificates', {
        student: form.student,
        issueDate: form.issueDate,
        notes: form.notes,
        type: form.type,
      });
      const created = res.data?.data || res.data || {};
      setCertificates(prev => [created, ...safeArr(prev)]);
      setShowForm(false);
      resetIssueForm();
      showToast('Certificate issued successfully');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to issue certificate', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(cert) {
    if (!cert?._id) return;
    const trainee = traineeFromCertificate(cert);
    if (!window.confirm(`Revoke certificate for ${trainee?.name || 'this trainee'}?`)) return;

    setRevoking(cert._id);
    try {
      await api.patch(`/api/dio/certificates/${cert._id}/revoke`);
      setCertificates(prev => safeArr(prev).map(c => (
        c?._id === cert._id ? { ...c, revokedAt: new Date().toISOString() } : c
      )));
      showToast('Certificate revoked');
    } catch (err) {
      console.error('Revoke error:', err);
      showToast('Failed to revoke certificate', 'error');
    } finally {
      setRevoking(null);
    }
  }

  async function handleDelete(cert) {
    if (!cert?._id) return;
    if (!window.confirm('Delete this certificate permanently?')) return;

    setDeleting(cert._id);
    try {
      await api.delete(`/api/dio/certificates/${cert._id}`);
      setCertificates(prev => safeArr(prev).filter(c => c?._id !== cert._id));
      showToast('Certificate deleted');
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete certificate', 'error');
    } finally {
      setDeleting(null);
    }
  }

  const validCount = safeArr(certificates).filter(c => !c?.revokedAt).length;
  const revokedCount = safeArr(certificates).filter(c => c?.revokedAt).length;
  const totalCount = safeArr(certificates).length;

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="admin-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
            <Sk w={200} h={28} r={6} />
            <Sk w={140} h={36} r={8} />
          </div>
          <div className="admin-card">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <tbody>
                  {safeArr([0, 1, 2, 3, 4, 5]).map(i => (
                    <tr key={i}>
                      {safeArr([120, 140, 110, 100, 90, 70, 80]).map((w, j) => (
                        <td key={j}><Sk w={w} h={13} /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-toolbar" style={{ marginBottom: 16 }}>
          <ViewToggle value={view} onChange={setView} />
          <span style={{ fontSize: 13, color: '#8B8FA8', flexShrink: 0 }}>
            {validCount} valid - {revokedCount} revoked - {totalCount} total
          </span>
          <button className="btn-purple" onClick={openIssueForm}>
            + Issue Certificate
          </button>
        </div>

        {totalCount === 0 ? (
          <div style={{ textAlign: 'center', padding: 56, color: '#8B8FA8' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#4B5563', marginBottom: 6 }}>No certificates issued yet</div>
            <div style={{ fontSize: 13 }}>Click "+ Issue Certificate" to issue the first certificate.</div>
          </div>
        ) : (
          <div className="admin-card">
            {view === 'list' && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Trainee</th>
                    <th>Student ID</th>
                    <th>Specialty</th>
                    <th>Type</th>
                    <th>Issue Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {safeArr(certificates).map((c, i) => {
                    const trainee = traineeFromCertificate(c);
                    const isRevoked = !!c?.revokedAt;
                    return (
                      <tr key={c?._id || i} style={{ opacity: isRevoked ? 0.65 : 1 }}>
                        <td style={{ color: '#8B8FA8' }}>{i + 1}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{trainee?.name || '-'}</div>
                          <div style={{ fontSize: 11, color: '#8B8FA8' }}>{trainee?.email || ''}</div>
                        </td>
                        <td style={{ fontSize: 13, color: '#4B5563' }}>{trainee?.studentId || '-'}</td>
                        <td style={{ fontSize: 13, color: '#4B5563' }}>{textValue(c?.specialty)}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#EEEDFE', color: '#3C3489' }}>
                            {c?.type || 'Completion'}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: '#4B5563' }}>{fmt(c?.issueDate || c?.issuedAt)}</td>
                        <td>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '3px 9px',
                            borderRadius: 20,
                            background: isRevoked ? '#FEE2E2' : '#D1FAE5',
                            color: isRevoked ? '#991B1B' : '#065F46',
                          }}>
                            {isRevoked ? `Revoked ${fmt(c?.revokedAt)}` : 'Valid'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn-action edit"
                              title="Print"
                              aria-label={`Print certificate for ${trainee?.name || 'trainee'}`}
                              onClick={() => navigate(`/dio/certificates/${c?._id}/print`)}
                              disabled={!c?._id}
                            >
                              Print
                            </button>
                            {!isRevoked && (
                              <button
                                type="button"
                                style={{ padding: '5px 10px', borderRadius: 6, background: '#FEF3C7', color: '#92400E', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                title="Revoke"
                                aria-label={`Revoke certificate for ${trainee?.name || 'trainee'}`}
                                onClick={() => handleRevoke(c)}
                                disabled={revoking === c?._id}
                              >
                                {revoking === c?._id ? '...' : 'Revoke'}
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn-action delete"
                              title="Delete"
                              aria-label={`Delete certificate for ${trainee?.name || 'trainee'}`}
                              onClick={() => handleDelete(c)}
                              disabled={deleting === c?._id}
                            >
                              {deleting === c?._id ? '...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
            {view === 'card' && (
              <div className="management-card-grid">
                {safeArr(certificates).map((c, i) => {
                  const trainee = traineeFromCertificate(c);
                  const isRevoked = !!c?.revokedAt;
                  return (
                    <div className="management-card" key={c?._id || i} style={{ opacity: isRevoked ? 0.65 : 1 }}>
                      <div>
                        <div className="management-card-title">{trainee?.name || '-'}</div>
                        <div className="management-card-sub">{trainee?.studentId || 'No student ID'}</div>
                      </div>
                      <div className="management-card-meta">
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#EEEDFE', color: '#3C3489' }}>
                          {c?.type || 'Completion'}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: isRevoked ? '#FEE2E2' : '#D1FAE5', color: isRevoked ? '#991B1B' : '#065F46' }}>
                          {isRevoked ? `Revoked ${fmt(c?.revokedAt)}` : 'Valid'}
                        </span>
                      </div>
                      <div className="management-card-sub">{textValue(c?.specialty)} - {fmt(c?.issueDate || c?.issuedAt)}</div>
                      <div className="management-card-actions">
                        <button type="button" className="btn-action edit" title="Print" aria-label={`Print certificate for ${trainee?.name || 'trainee'}`} onClick={() => navigate(`/dio/certificates/${c?._id}/print`)} disabled={!c?._id}>Print</button>
                        {!isRevoked && (
                          <button type="button" style={{ padding: '5px 10px', borderRadius: 6, background: '#FEF3C7', color: '#92400E', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }} title="Revoke" aria-label={`Revoke certificate for ${trainee?.name || 'trainee'}`} onClick={() => handleRevoke(c)} disabled={revoking === c?._id}>
                            {revoking === c?._id ? '...' : 'Revoke'}
                          </button>
                        )}
                        <button type="button" className="btn-action delete" title="Delete" aria-label={`Delete certificate for ${trainee?.name || 'trainee'}`} onClick={() => handleDelete(c)} disabled={deleting === c?._id}>
                          {deleting === c?._id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {showForm && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={e => e.target === e.currentTarget && closeIssueForm()}
          >
            <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #E8E9EF', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#1B1464' }}>Issue Certificate</div>
                <button type="button" onClick={closeIssueForm} style={{ width: 30, height: 30, borderRadius: '50%', background: '#F5F6FA', border: 'none', fontSize: 18, color: '#8B8FA8', cursor: 'pointer' }}>x</button>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                    Search Trainee *
                  </label>
                  <input
                    className="admin-search"
                    style={{ width: '100%', boxSizing: 'border-box', height: 42 }}
                    placeholder="Type trainee name or student ID..."
                    value={searchQuery}
                    onChange={e => searchTrainees(e.target.value)}
                    autoComplete="off"
                  />

                  {searchLoading && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #E8E9EF', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#8B8FA8', boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 500 }}>
                      Searching...
                    </div>
                  )}

                  {!searchLoading && safeArr(searchResults).length > 0 && (
                    <ul style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 500, margin: 0, padding: 0, listStyle: 'none', background: '#fff', border: '1px solid #E8E9EF', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto' }}>
                      {safeArr(searchResults).map((t, i) => (
                        <li key={t?._id || i}>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); selectTrainee(t); }}
                            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f3f3f3', padding: '10px 14px', cursor: 'pointer', display: 'block', fontSize: 13 }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#f0f3ff'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                          >
                            <strong>{t?.name || 'Unknown'}</strong>
                            {t?.studentId && <span style={{ marginLeft: 8, fontSize: 11, color: '#8B8FA8' }}>{t?.studentId}</span>}
                            {t?.specialtyId?.name && <span style={{ marginLeft: 8, fontSize: 11, color: '#7c6fcd' }}>{t?.specialtyId?.name}</span>}
                            {t?.hospitalId?.name && <span style={{ marginLeft: 8, fontSize: 11, color: '#059669' }}>{t?.hospitalId?.name}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!searchLoading && searchQuery.trim().length > 1 && safeArr(searchResults).length === 0 && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', border: '1px solid #E8E9EF', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#8B8FA8', boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 500 }}>
                      No trainees found for "{searchQuery}"
                    </div>
                  )}
                </div>

                {form.student && (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>Selected Trainee</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
                      {safeArr([
                        ['Name', form.studentName || '-'],
                        ['Student ID', form.studentId || '-'],
                        ['Hospital', form.hospital || '-'],
                        ['Supervisor', form.supervisor || '-'],
                        ['Specialty', form.specialty || '-'],
                      ]).map(([label, value]) => (
                        <div key={label}>
                          <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>{label}</div>
                          <div style={{ fontWeight: 600, color: '#1B1464' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Certificate Type</label>
                  <select className="admin-search" style={{ width: '100%', boxSizing: 'border-box', height: 42 }} value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}>
                    {safeArr(CERT_TYPES).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Issue Date</label>
                  <input type="date" className="admin-search" style={{ width: '100%', boxSizing: 'border-box', height: 42 }} value={form.issueDate} onChange={e => setForm(prev => ({ ...prev, issueDate: e.target.value }))} />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Notes (optional)</label>
                  <textarea className="admin-search" style={{ width: '100%', boxSizing: 'border-box', minHeight: 80, padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} placeholder="Any additional notes..." value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                  <button type="button" className="btn-red" onClick={closeIssueForm}>Cancel</button>
                  <button
                    type="button"
                    className="btn-purple"
                    onClick={handleSubmit}
                    disabled={!form.student || submitting}
                    style={{ opacity: (!form.student || submitting) ? 0.6 : 1 }}
                  >
                    {submitting ? 'Issuing...' : 'Issue Certificate'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
