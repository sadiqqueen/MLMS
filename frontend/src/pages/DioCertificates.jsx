import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

const API_BASE = '';

const CERT_TYPES = ['Completion', 'Training', 'Attendance', 'Achievement', 'Other'];

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getTrainee(cert) {
  return cert.traineeId || cert.student || {};
}

function IssueModal({ trainees, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    traineeId: '',
    type:      '',
    issueDate: new Date().toISOString().slice(0, 10),
    notes:     '',
  });
  const [errors, setErrors] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function validate() {
    const e = {};
    if (!form.traineeId) e.traineeId = true;
    if (!form.type)      e.type      = true;
    if (!form.issueDate) e.issueDate = true;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({ ...form, student: form.traineeId });
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', borderBottom: '1px solid #E8E9EF' }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#1B1464' }}>Issue Certificate</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: '#F5F6FA', border: 'none', fontSize: 18, color: '#8B8FA8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 5 }}>Trainee *</label>
            <select
              className={errors.traineeId ? 'invalid admin-search' : 'admin-search'}
              style={{ width: '100%' }}
              value={form.traineeId}
              onChange={e => set('traineeId', e.target.value)}
            >
              <option value="">— Select trainee —</option>
              {trainees.map(t => (
                <option key={t._id} value={t._id}>{t.name}{t.studentId ? ` (${t.studentId})` : ''}</option>
              ))}
            </select>
            {errors.traineeId && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Required</div>}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 5 }}>Certificate Type *</label>
            <select
              className={errors.type ? 'invalid admin-search' : 'admin-search'}
              style={{ width: '100%' }}
              value={form.type}
              onChange={e => set('type', e.target.value)}
            >
              <option value="">— Select type —</option>
              {CERT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.type && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Required</div>}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 5 }}>Issue Date *</label>
            <input
              type="date"
              className={errors.issueDate ? 'invalid admin-search' : 'admin-search'}
              style={{ width: '100%' }}
              value={form.issueDate}
              onChange={e => set('issueDate', e.target.value)}
            />
            {errors.issueDate && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>Required</div>}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4B5563', marginBottom: 5 }}>Notes</label>
            <textarea
              className="admin-search"
              style={{ width: '100%', height: 80, resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
              placeholder="Optional notes about this certificate…"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
            />
          </div>

        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E9EF', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-red" onClick={onClose}>Cancel</button>
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Issuing…' : 'Issue Certificate'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CertModal({ cert, onClose, onRevoke, onDelete, revoking, deleting }) {
  const trainee = getTrainee(cert);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  function copyCode() {
    navigator.clipboard.writeText(cert.verifyCode || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const isRevoked = !!cert.revokedAt;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px', borderBottom: '1px solid #E8E9EF' }}>
          <div style={{ width: 46, height: 46, borderRadius: '50%', background: isRevoked ? '#F3F4F6' : '#1B1464', color: isRevoked ? '#9CA3AF' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0 }}>
            {trainee.initials || trainee.name?.slice(0,2)?.toUpperCase() || '?'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1B1464' }}>{trainee.name || '—'}</div>
            <div style={{ fontSize: 12, color: '#8B8FA8', marginTop: 2 }}>{cert.type} Certificate</div>
          </div>
          {isRevoked && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: '#FEE2E2', color: '#DC2626' }}>Revoked</span>
          )}
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', background: '#F5F6FA', border: 'none', fontSize: 18, color: '#8B8FA8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px', marginBottom: 16 }}>
            {[
              ['Student ID',  trainee.studentId || '—'],
              ['Issue Date',  fmtDate(cert.issueDate)],
              ['Issued By',   cert.issuedBy?.name || '—'],
              ['Revoked',     cert.revokedAt ? fmtDate(cert.revokedAt) : 'No'],
              ['Notes',       cert.notes || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: '#8B8FA8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#1B1464', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

          {cert.verifyCode && (
            <div style={{ background: '#F8F9FA', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: '#8B8FA8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Verification Code</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code style={{ fontSize: 12, color: '#1B1464', flex: 1, wordBreak: 'break-all' }}>{cert.verifyCode}</code>
                <button
                  onClick={copyCode}
                  style={{ padding: '4px 10px', borderRadius: 6, background: copied ? '#059669' : '#1B1464', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid #E8E9EF', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button
            className="btn-red"
            onClick={() => onDelete(cert)}
            disabled={deleting}
            style={{ fontSize: 12 }}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline" onClick={onClose}>Close</button>
            {!isRevoked && (
              <button
                className="btn-action delete"
                style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600 }}
                onClick={() => onRevoke(cert)}
                disabled={revoking}
              >
                {revoking ? 'Revoking…' : 'Revoke'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DioCertificates() {
  const [certs,    setCerts   ] = useState([]);
  const [trainees, setTrainees] = useState([]);
  const [loading,  setLoading ] = useState(true);
  const [search,   setSearch  ] = useState('');
  const [filter,   setFilter  ] = useState('all');
  const [showIssue,setShowIssue] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving,   setSaving  ] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toasts,   setToasts  ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.all([
      api.get('/api/dio/certificates'),
      api.get('/api/dio/trainees'),
    ]).then(([cRes, tRes]) => {
      setCerts(   cRes.data?.data || cRes.data || []);
      setTrainees(tRes.data?.data || tRes.data || []);
    }).catch(() => showToast('Failed to load data', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function handleIssue(data) {
    setSaving(true);
    try {
      const res = await api.post('/api/dio/certificates', data);
      const created = res.data?.data || res.data;
      setCerts(prev => [created, ...prev]);
      setShowIssue(false);
      showToast('Certificate issued successfully');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to issue certificate', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRevoke(cert) {
    setRevoking(true);
    try {
      const res = await api.patch(`/api/dio/certificates/${cert._id}/revoke`);
      const updated = res.data?.data || res.data;
      setCerts(prev => prev.map(c => c._id === cert._id ? { ...c, revokedAt: updated.revokedAt || new Date().toISOString() } : c));
      setSelected(prev => prev ? { ...prev, revokedAt: updated.revokedAt || new Date().toISOString() } : prev);
      showToast('Certificate revoked');
    } catch {
      showToast('Revoke failed', 'error');
    } finally {
      setRevoking(false);
    }
  }

  async function handleDelete(cert) {
    setDeleting(true);
    try {
      await api.delete(`/api/dio/certificates/${cert._id}`);
      setCerts(prev => prev.filter(c => c._id !== cert._id));
      setSelected(null);
      showToast('Certificate deleted');
    } catch {
      showToast('Delete failed', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const displayed = certs.filter(c => {
    const trainee = getTrainee(c);
    const q = search.toLowerCase();
    const matchSearch = !q
      || trainee.name?.toLowerCase().includes(q)
      || (trainee.studentId || '').toLowerCase().includes(q)
      || (c.type || '').toLowerCase().includes(q);
    const matchFilter = filter === 'all'
      || (filter === 'active'  && !c.revokedAt)
      || (filter === 'revoked' && !!c.revokedAt);
    return matchSearch && matchFilter;
  });

  const activeCount  = certs.filter(c => !c.revokedAt).length;
  const revokedCount = certs.filter(c =>  c.revokedAt).length;

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ background: '#fff', border: '1px solid #E8E9EF', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <Sk w={46} h={46} r={10} /><Sk w={110} h={14} />
            </div>
          ))}
        </div>
        <div className="admin-card">
          <div className="admin-toolbar"><Sk h={36} r={8} style={{ flex: 1 }} /></div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                {[...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td><Sk w={20} h={13} /></td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Sk w={36} h={36} r="50%" /><Sk w={120} h={13} /></div></td>
                    <td><Sk w={80}  h={22} r={20} /></td>
                    <td><Sk w={90}  h={13} /></td>
                    <td><Sk w={70}  h={22} r={20} /></td>
                    <td><Sk w={55}  h={28} r={8} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Total Certificates', count: certs.length,  color: '#1B1464', bg: '#EEEDFE' },
            { label: 'Active',             count: activeCount,   color: '#059669', bg: '#D1FAE5' },
            { label: 'Revoked',            count: revokedCount,  color: '#DC2626', bg: '#FEE2E2' },
          ].map(c => (
            <div key={c.label} style={{ background: '#fff', border: '1px solid #E8E9EF', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: c.color, flexShrink: 0 }}>{c.count}</div>
              <div style={{ fontSize: 13, color: '#4B5563', fontWeight: 500 }}>{c.label}</div>
            </div>
          ))}
        </div>

        <div className="admin-card">
          <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
            <input
              className="admin-search"
              style={{ flex: 1, minWidth: 200, height: 36 }}
              placeholder="Search by trainee name, student ID, or type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'active', 'revoked'].map(f => (
                <button
                  key={f}
                  className={`filter-tab${filter === f ? ' active' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {f === 'all' ? `All (${certs.length})` : f === 'active' ? `Active (${activeCount})` : `Revoked (${revokedCount})`}
                </button>
              ))}
            </div>
            <button className="btn-purple" onClick={() => setShowIssue(true)}>
              + Issue Certificate
            </button>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>#</th><th>Trainee</th><th>Type</th><th>Issue Date</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#8B8FA8' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📜</div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#4B5563', marginBottom: 4 }}>
                        {certs.length === 0 ? 'No certificates issued yet' : 'No certificates match your filter'}
                      </div>
                      {certs.length === 0 && (
                        <div style={{ fontSize: 13 }}>Click "+ Issue Certificate" to issue the first certificate.</div>
                      )}
                    </td>
                  </tr>
                )}
                {displayed.map((c, i) => {
                  const trainee  = getTrainee(c);
                  const isRevoked = !!c.revokedAt;
                  return (
                    <tr key={c._id} style={{ cursor: 'pointer', opacity: isRevoked ? 0.65 : 1 }} onClick={() => setSelected(c)}>
                      <td style={{ color: '#8B8FA8' }}>{i + 1}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="cell-initials">{trainee.initials || trainee.name?.[0] || '?'}</div>
                          <div>
                            <strong>{trainee.name || '—'}</strong>
                            {trainee.studentId && <div style={{ fontSize: 11, color: '#8B8FA8' }}>{trainee.studentId}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: '#EEEDFE', color: '#1B1464' }}>
                          {c.type || '—'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: '#4B5563' }}>{fmtDate(c.issueDate)}</td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                          background: isRevoked ? '#FEE2E2' : '#D1FAE5',
                          color:      isRevoked ? '#DC2626' : '#059669'
                        }}>
                          {isRevoked ? 'Revoked' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <button className="btn-action edit" onClick={e => { e.stopPropagation(); setSelected(c); }}>View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {showIssue && (
          <IssueModal
            trainees={trainees}
            onSave={handleIssue}
            onClose={() => setShowIssue(false)}
            saving={saving}
          />
        )}

        {selected && (
          <CertModal
            cert={selected}
            onClose={() => setSelected(null)}
            onRevoke={handleRevoke}
            onDelete={handleDelete}
            revoking={revoking}
            deleting={deleting}
          />
        )}

        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
      </main>
    </>
  );
}
