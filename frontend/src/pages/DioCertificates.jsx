// frontend/src/pages/DioCertificates.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useBasePath from '../hooks/useBasePath';
import Navbar from '../components/Navbar';
import { useMtToast, MtToastHost } from '../components/MtToast';
import MtModal from '../components/MtModal';
import ViewToggle from '../components/ViewToggle';
import api from '../api/axios';
import Sk from '../components/Skeleton';
import { IconPrinter, IconBan, IconTrash, IconAward } from '../components/icons';
import './dio.css';

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
  const bp = useBasePath();
  const { user } = useAuth();
  // View-only oversight roles: a DIO-view (dio_view) and Sub-DIO (sub_dio) may
  // list + print certificates but never revoke/delete; a Sub-DIO additionally
  // cannot issue. ODIO ('dio')/super_admin keep full management.
  const canRevokeDelete = user?.role !== 'dio_view' && user?.role !== 'sub_dio';
  const canIssue = user?.role !== 'sub_dio';
  // The DIO now lists certificates from BOTH tracks (system-wide read). Revoke/
  // delete stay track-scoped on the backend, so only same-track rows expose those
  // buttons; a Track badge marks each row's portal. Print works for every cert.
  const currentTrack = bp === '/basic' ? 'basic' : 'advanced';
  const certTrack = c => (c?.track || 'advanced');
  const canManageCert = c => certTrack(c) === currentTrack && canRevokeDelete;
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
  const { toasts, showToast } = useMtToast();
  const dropdownRef = useRef(null);

  // ── List filtration (separate from the issue-form trainee search above) ──
  const [filterText, setFilterText] = useState('');   // trainee name / student ID
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all | valid | revoked

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
          showToast('Failed to load certificates', 'dng');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadCertificates();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      showToast('Please select a trainee first', 'dng');
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
      showToast('Certificate issued successfully', 'ok');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to issue certificate', 'dng');
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
      showToast('Certificate revoked', 'ok');
    } catch (err) {
      console.error('Revoke error:', err);
      showToast('Failed to revoke certificate', 'dng');
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
      showToast('Certificate deleted', 'ok');
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Failed to delete certificate', 'dng');
    } finally {
      setDeleting(null);
    }
  }

  const validCount = safeArr(certificates).filter(c => !c?.revokedAt).length;
  const revokedCount = safeArr(certificates).filter(c => c?.revokedAt).length;
  const totalCount = safeArr(certificates).length;

  // Distinct specialties + types present in the data drive the filter dropdowns.
  const specialtyOptions = useMemo(
    () => [...new Set(safeArr(certificates).map(c => textValue(c?.specialty, '')).filter(Boolean))].sort(),
    [certificates]
  );
  const typeOptions = useMemo(
    () => [...new Set(safeArr(certificates).map(c => c?.type || 'Completion').filter(Boolean))].sort(),
    [certificates]
  );

  const filtered = safeArr(certificates).filter(c => {
    const trainee = traineeFromCertificate(c);
    const q = filterText.trim().toLowerCase();
    const matchSearch = !q
      || (trainee?.name || '').toLowerCase().includes(q)
      || (trainee?.studentId || '').toLowerCase().includes(q);
    const matchSpecialty = !specialtyFilter || textValue(c?.specialty, '') === specialtyFilter;
    const matchType = !typeFilter || (c?.type || 'Completion') === typeFilter;
    const isRevoked = !!c?.revokedAt;
    const matchStatus = statusFilter === 'all'
      || (statusFilter === 'valid' ? !isRevoked : isRevoked);
    return matchSearch && matchSpecialty && matchType && matchStatus;
  });

  function rowActions(c) {
    const trainee = traineeFromCertificate(c);
    const isRevoked = !!c?.revokedAt;
    return (
      <div className="mt-row-actions">
        {!isRevoked && (
          <button type="button" className="mt-icon-action" title="Print certificate"
            aria-label={`Print certificate for ${trainee?.name || 'trainee'}`}
            onClick={() => navigate(bp + `/dio/certificates/${c?._id}/print`)} disabled={!c?._id}>
            <IconPrinter size={15} />
          </button>
        )}
        {!isRevoked && canManageCert(c) && (
          <button type="button" className="mt-icon-action mt-icon-action--danger" title="Revoke"
            aria-label={`Revoke certificate for ${trainee?.name || 'trainee'}`}
            onClick={() => handleRevoke(c)} disabled={revoking === c?._id}>
            <IconBan size={15} />
          </button>
        )}
        {canManageCert(c) && (
          <button type="button" className="mt-icon-action mt-icon-action--danger" title="Delete"
            aria-label={`Delete certificate for ${trainee?.name || 'trainee'}`}
            onClick={() => handleDelete(c)} disabled={deleting === c?._id}>
            <IconTrash size={15} />
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="mt-content">
          <div className="dio-page-head" style={{ justifyContent: 'space-between' }}>
            <Sk w={200} h={26} r={6} />
            <Sk w={150} h={38} r={9} />
          </div>
          <div className="mt-card">
            {[0, 1, 2, 3, 4, 5].map(i => <Sk key={i} h={40} r={8} style={{ marginBottom: 8 }} />)}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="mt-content">
        {/* Page header — title + counts on the start, Issue button on the end */}
        <div className="dio-page-head" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="dio-page-title">Certificates</div>
            <div className="mt-card-sub">{validCount} valid · {revokedCount} revoked · {totalCount} total</div>
          </div>
          {canIssue && (
            <button className="mt-btn" onClick={openIssueForm}>+ Issue Certificate</button>
          )}
        </div>

        {totalCount === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty-icon"><IconAward size={22} /></div>
            <div className="mt-empty-title">No certificates issued yet</div>
            {canIssue && <div className="mt-empty-sub">Click "+ Issue Certificate" to issue the first certificate.</div>}
          </div>
        ) : (
          <div className="mt-card">
            {/* Search + filters toolbar */}
            <div className="mt-filterbar">
              <div className="mt-search">
                <input
                  placeholder="Search by trainee name or student ID…"
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                />
              </div>
              <select className="mt-filter" value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)}>
                <option value="">All Specialties</option>
                {specialtyOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="mt-filter" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="">All Types</option>
                {typeOptions.map(tp => <option key={tp} value={tp}>{tp}</option>)}
              </select>
              <select className="mt-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All ({totalCount})</option>
                <option value="valid">Valid ({validCount})</option>
                <option value="revoked">Revoked ({revokedCount})</option>
              </select>
              <div className="mt-filterbar-spacer" />
              <ViewToggle value={view} onChange={setView} />
              <span className="mt-count">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Keyed wrapper → subtle crossfade when filters/view change */}
            <div key={`${filterText}|${specialtyFilter}|${typeFilter}|${statusFilter}|${view}`} style={{ animation: 'fadeIn .18s ease-out' }}>
              {view === 'list' && (
                <div className="mt-table-wrap">
                  <table className="mt-table mt-table--stack">
                    <thead>
                      <tr>
                        <th className="mt-th">#</th>
                        <th className="mt-th">Trainee</th>
                        <th className="mt-th">Student ID</th>
                        <th className="mt-th">Specialty</th>
                        <th className="mt-th">Type</th>
                        <th className="mt-th">Issue Date</th>
                        <th className="mt-th">Status</th>
                        <th className="mt-th">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr>
                          <td className="mt-td mt-td--muted" colSpan={8} style={{ textAlign: 'center', padding: 40 }}>
                            No certificates match your filters.
                          </td>
                        </tr>
                      )}
                      {filtered.map((c, i) => {
                        const trainee = traineeFromCertificate(c);
                        const isRevoked = !!c?.revokedAt;
                        return (
                          <tr key={c?._id || i} style={{ opacity: isRevoked ? 0.65 : 1 }}>
                            <td className="mt-td mt-td--muted">{i + 1}</td>
                            <td className="mt-td mt-td--name" data-label="Trainee">
                              <div>{trainee?.name || '-'}</div>
                              {trainee?.email && <div className="mt-acct-id">{trainee.email}</div>}
                            </td>
                            <td className="mt-td mt-td--mono" data-label="Student ID">{trainee?.studentId || '-'}</td>
                            <td className="mt-td mt-td--muted" data-label="Specialty">{textValue(c?.specialty)}</td>
                            <td className="mt-td" data-label="Type">
                              <span className="mt-pill mt-pill--role">{c?.type || 'Completion'}</span>
                              <span className="mt-pill mt-pill--neutral" style={{ marginInlineStart: 6 }}>
                                {certTrack(c) === 'basic' ? 'Basic' : 'Advanced'}
                              </span>
                            </td>
                            <td className="mt-td mt-td--mono" data-label="Issue Date">{fmt(c?.issueDate || c?.issuedAt)}</td>
                            <td className="mt-td" data-label="Status">
                              <span className={`mt-pill ${isRevoked ? 'mt-pill--rejected' : 'mt-pill--active'}`}>
                                {isRevoked ? `Revoked ${fmt(c?.revokedAt)}` : 'Valid'}
                              </span>
                            </td>
                            <td className="mt-td mt-td--actions" data-label="Actions">{rowActions(c)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {view === 'card' && (
                <div className="mt-acct-grid">
                  {filtered.length === 0 && (
                    <div className="mt-empty" style={{ gridColumn: '1/-1' }}>
                      <div className="mt-empty-sub">No certificates match your filters.</div>
                    </div>
                  )}
                  {filtered.map((c, i) => {
                    const trainee = traineeFromCertificate(c);
                    const isRevoked = !!c?.revokedAt;
                    return (
                      <div className="mt-card" key={c?._id || i} style={{ opacity: isRevoked ? 0.65 : 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{trainee?.name || '-'}</div>
                          <div className="mt-acct-id">{trainee?.studentId || 'No student ID'}</div>
                        </div>
                        <div className="dio-chip-row">
                          <span className="mt-pill mt-pill--role">{c?.type || 'Completion'}</span>
                          <span className="mt-pill mt-pill--neutral">{certTrack(c) === 'basic' ? 'Basic' : 'Advanced'}</span>
                          <span className={`mt-pill ${isRevoked ? 'mt-pill--rejected' : 'mt-pill--active'}`}>
                            {isRevoked ? `Revoked ${fmt(c?.revokedAt)}` : 'Valid'}
                          </span>
                        </div>
                        <div className="mt-card-sub">{textValue(c?.specialty)} · {fmt(c?.issueDate || c?.issuedAt)}</div>
                        <div className="mt-row-actions" style={{ justifyContent: 'flex-start' }}>{rowActions(c)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {canIssue && (
          <MtModal
            open={showForm}
            title="Issue Certificate"
            onClose={closeIssueForm}
            footer={(
              <>
                <button type="button" className="mt-btn--cancel" onClick={closeIssueForm}>Cancel</button>
                <button type="button" className="mt-btn" onClick={handleSubmit} disabled={!form.student || submitting}>
                  {submitting ? 'Issuing…' : 'Issue Certificate'}
                </button>
              </>
            )}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div ref={dropdownRef} className="mt-field" style={{ position: 'relative' }}>
                <label className="mt-label">Search Trainee <span className="mt-label-req">*</span></label>
                <input
                  className="mt-input"
                  placeholder="Type trainee name or student ID…"
                  value={searchQuery}
                  onChange={e => searchTrainees(e.target.value)}
                  autoComplete="off"
                />

                {searchLoading && (
                  <div style={{ position: 'absolute', insetBlockStart: 'calc(100% + 4px)', insetInline: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--text-2)', boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 500 }}>
                    Searching…
                  </div>
                )}

                {!searchLoading && safeArr(searchResults).length > 0 && (
                  <ul style={{ position: 'absolute', insetBlockStart: 'calc(100% + 4px)', insetInline: 0, zIndex: 500, margin: 0, padding: 0, listStyle: 'none', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', maxHeight: 220, overflowY: 'auto' }}>
                    {safeArr(searchResults).map((tr, i) => (
                      <li key={tr?._id || i}>
                        <button
                          type="button"
                          onMouseDown={e => { e.preventDefault(); selectTrainee(tr); }}
                          style={{ width: '100%', textAlign: 'start', background: 'none', border: 'none', borderBlockEnd: '1px solid var(--border)', padding: '10px 14px', cursor: 'pointer', display: 'block', fontSize: 13, color: 'var(--text)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--brand-primary-t)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                        >
                          <strong>{tr?.name || 'Unknown'}</strong>
                          {tr?.studentId && <span style={{ marginInlineStart: 8, fontSize: 11, color: 'var(--text-2)' }}>{tr?.studentId}</span>}
                          {tr?.specialtyId?.name && <span style={{ marginInlineStart: 8, fontSize: 11, color: 'var(--brand-primary)' }}>{tr?.specialtyId?.name}</span>}
                          {tr?.hospitalId?.name && <span style={{ marginInlineStart: 8, fontSize: 11, color: 'var(--success)' }}>{tr?.hospitalId?.name}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {!searchLoading && searchQuery.trim().length > 1 && safeArr(searchResults).length === 0 && (
                  <div style={{ position: 'absolute', insetBlockStart: 'calc(100% + 4px)', insetInline: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: 'var(--text-2)', boxShadow: '0 4px 12px rgba(0,0,0,.1)', zIndex: 500 }}>
                    No trainees found for "{searchQuery}"
                  </div>
                )}
              </div>

              {form.student && (
                <div className="mt-dropzone-strip" style={{ background: 'var(--success-bg)', display: 'block' }}>
                  <div className="mt-acct-hist-title" style={{ color: 'var(--success)', marginBottom: 10 }}>Selected Trainee</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13 }}>
                    {safeArr([
                      ['Name', form.studentName || '-'],
                      ['Student ID', form.studentId || '-'],
                      ['Hospital', form.hospital || '-'],
                      ['Supervisor', form.supervisor || '-'],
                      ['Specialty', form.specialty || '-'],
                    ]).map(([label, value]) => (
                      <div key={label}>
                        <div className="mt-acct-k">{label}</div>
                        <div style={{ fontWeight: 600, color: 'var(--text)' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-field">
                <label className="mt-label">Certificate Type</label>
                <select className="mt-select" value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}>
                  {safeArr(CERT_TYPES).map(tp => <option key={tp} value={tp}>{tp}</option>)}
                </select>
              </div>

              <div className="mt-field">
                <label className="mt-label">Issue Date</label>
                <input type="date" className="mt-input" value={form.issueDate} onChange={e => setForm(prev => ({ ...prev, issueDate: e.target.value }))} />
              </div>

              <div className="mt-field">
                <label className="mt-label">Notes (optional)</label>
                <textarea className="mt-textarea" placeholder="Any additional notes…" value={form.notes} onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))} />
              </div>
            </div>
          </MtModal>
        )}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
