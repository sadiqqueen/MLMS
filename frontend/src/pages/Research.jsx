import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import Sk from '../components/Skeleton';
import { IconEye, IconTrash, IconPlus } from '../components/icons';

const API_BASE = '';

function fmt(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function safeArr(v) { return Array.isArray(v) ? v : []; }

const STATUS_STYLE = {
  pending:             { bg: 'var(--warning-bg)', color: 'var(--warning-fg)', label: 'With supervisor' },
  supervisor_approved: { bg: 'var(--info-bg)',    color: 'var(--info-fg)',    label: 'Signed — with secretary' },
  forwarded_dio:       { bg: 'var(--info-bg)',    color: 'var(--info-fg)',    label: 'With DIO' },
  approved:            { bg: 'var(--success-bg)', color: 'var(--success-fg)', label: 'Published' },
  rejected:            { bg: 'var(--danger-bg)',  color: 'var(--danger-fg)',  label: 'Not approved' },
};

// Approval progress: which step index a status sits at (for the stepper).
const STEPS = ['Supervisor', 'Secretary', 'DIO', 'Published'];
function stepIndex(status) {
  if (status === 'pending') return 0;
  if (status === 'supervisor_approved') return 1;
  if (status === 'forwarded_dio') return 2;
  if (status === 'approved') return 3;
  return -1; // rejected
}

function Stepper({ status }) {
  const active = stepIndex(status);
  if (active < 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
      {STEPS.map((label, i) => {
        const done = i <= active;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: done ? 'var(--success-bg)' : 'var(--surface-3)',
              color: done ? 'var(--success-fg)' : 'var(--text-muted)',
            }}>{label}</span>
            {i < STEPS.length - 1 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>›</span>}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function FileLink({ url }) {
  if (!url) return null;
  return (
    <a href={`${API_BASE}${url}`} target="_blank" rel="noreferrer"
      title="Open file" aria-label="Open file"
      style={{
        width: 34, height: 34, borderRadius: 8, background: 'var(--surface)',
        border: '1px solid var(--border)', color: 'var(--link)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', flexShrink: 0,
      }}>
      <IconEye size={16} />
    </a>
  );
}

export default function Research() {
  const { user } = useAuth();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm] = useState({ title: '', authors: '', journal: '', abstract: '' });
  const [file, setFile] = useState(null);

  function load() {
    api.get('/api/research/mine')
      .then(r => setItems(safeArr(r.data?.data || r.data)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { if (user) load(); }, [user]);

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Please enter a title.'); return; }
    setSaving(true); setError('');
    try {
      const fd = new FormData();
      fd.append('title', form.title.trim());
      fd.append('authors', form.authors.trim());
      fd.append('journal', form.journal.trim());
      fd.append('abstract', form.abstract.trim());
      if (file) fd.append('file', file);
      const res = await api.post('/api/research', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const created = res.data?.data || res.data;
      setItems(prev => [created, ...prev]);
      setForm({ title: '', authors: '', journal: '', abstract: '' });
      setFile(null);
      const input = document.getElementById('research-file-input');
      if (input) input.value = '';
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/api/research/${id}`);
      setItems(prev => prev.filter(x => x._id !== id));
    } catch {
      setError('Could not delete this item.');
    }
  }

  async function setVisibility(id, visibility) {
    try {
      const res = await api.patch(`/api/research/${id}/visibility`, { visibility });
      const updated = res.data?.data || res.data;
      setItems(prev => prev.map(x => x._id === id ? { ...x, visibility: updated.visibility } : x));
    } catch {
      setError('Could not update visibility.');
    }
  }

  const submissions  = items.filter(i => i.status !== 'approved');
  const publications = items.filter(i => i.status === 'approved');

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box', height: 42, padding: '0 12px',
    borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: 14,
  };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 };

  return (
    <>
      <Navbar />
      <main className="main">
        {/* Submit form */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>Submit a Research</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Your submission is sent to your supervisor for approval. Once approved, it moves to Publications,
            where you choose whether it is Public or Private.
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'end' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Title *</label>
              <input style={fieldStyle} value={form.title} placeholder="Research title"
                onChange={e => setField('title', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Authors</label>
              <input style={fieldStyle} value={form.authors} placeholder="e.g. You, A. Colleague"
                onChange={e => setField('authors', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Journal / Venue</label>
              <input style={fieldStyle} value={form.journal} placeholder="e.g. BMJ"
                onChange={e => setField('journal', e.target.value)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Abstract</label>
              <textarea style={{ ...fieldStyle, height: 'auto', minHeight: 90, padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit' }}
                value={form.abstract} placeholder="Short summary (optional)"
                onChange={e => setField('abstract', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>File (PDF or image)</label>
              <input id="research-file-input" style={{ ...fieldStyle, height: 'auto', padding: 8 }} type="file"
                accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" className="btn-purple" disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconPlus size={15} /> {saving ? 'Submitting…' : 'Submit for approval'}
              </button>
              {error && <span style={{ color: 'var(--danger-fg)', fontSize: 13 }}>{error}</span>}
            </div>
          </form>
        </div>

        {/* My submissions (pending / rejected) */}
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-title" style={{ marginBottom: 14 }}>
            My Researches
            <span className="badge badge-blue" style={{ marginInlineStart: 8 }}>{submissions.length}</span>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1].map(i => <Sk key={i} h={64} r={10} />)}
            </div>
          ) : submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>🔬</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)' }}>No researches submitted yet.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {submissions.map(r => (
                <div key={r._id} style={{
                  border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
                  background: 'var(--surface-2)', borderLeft: `4px solid ${STATUS_STYLE[r.status]?.color || 'var(--accent)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{r.title}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        {r.journal ? `${r.journal} · ` : ''}Submitted {fmt(r.createdAt)}
                      </div>
                      {r.signedByName && r.status !== 'rejected' && (
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>
                          ✍ Signed by {r.signedByName}{r.signedAt ? ` · ${fmt(r.signedAt)}` : ''}
                        </div>
                      )}
                      <Stepper status={r.status} />
                      {r.status === 'rejected' && r.reviewNote && (
                        <div style={{ fontSize: 12, color: 'var(--danger-fg)', marginTop: 6 }}>Reason: {r.reviewNote}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <FileLink url={r.fileUrl} />
                      <button type="button" onClick={() => handleDelete(r._id)}
                        title="Delete" aria-label="Delete"
                        style={{
                          width: 34, height: 34, borderRadius: 8, background: 'var(--surface)',
                          border: '1px solid var(--border)', color: 'var(--danger-fg)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Publications (approved) */}
        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>
            Publications
            <span className="badge" style={{ marginInlineStart: 8, background: 'var(--success-bg)', color: 'var(--success-fg)' }}>{publications.length}</span>
          </div>
          {loading ? (
            <Sk h={64} r={10} />
          ) : publications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>📚</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)' }}>Approved researches appear here as publications.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {publications.map(r => {
                const isPublic = r.visibility === 'public';
                return (
                  <div key={r._id} style={{
                    border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
                    background: 'var(--surface-2)', borderLeft: '4px solid var(--success-fg)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{r.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                          {r.authors ? `${r.authors} · ` : ''}{r.journal || 'Publication'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <FileLink url={r.fileUrl} />
                        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                          <button type="button" onClick={() => setVisibility(r._id, 'private')}
                            style={{
                              padding: '7px 12px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                              background: !isPublic ? 'var(--accent)' : 'var(--surface)',
                              color: !isPublic ? '#fff' : 'var(--text-2)',
                            }}>
                            Private
                          </button>
                          <button type="button" onClick={() => setVisibility(r._id, 'public')}
                            style={{
                              padding: '7px 12px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                              background: isPublic ? 'var(--accent)' : 'var(--surface)',
                              color: isPublic ? '#fff' : 'var(--text-2)',
                            }}>
                            Public
                          </button>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                      {isPublic
                        ? 'Public — visible to your supervisor, Program Directors and DIOs.'
                        : 'Private — visible to you and your supervisor only.'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
