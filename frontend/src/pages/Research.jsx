import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import Sk from '../components/Skeleton';
import { IconEye, IconTrash, IconPlus, NavIcon } from '../components/icons';
import './trainee.css';

const API_BASE = '';

function fmt(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function safeArr(v) { return Array.isArray(v) ? v : []; }

// Approval pipeline labels. "Evaluator" is a neutral label for the reviewing
// clinician (the underlying data field is still `supervisorId`/`signedByName`).
const STATUS_STYLE = {
  pending:             { pill: 'mt-pill--warn',     accent: 'var(--accent)',     label: 'With evaluator' },
  supervisor_approved: { pill: 'mt-pill--capacity', accent: 'var(--brand-primary)', label: 'Signed — with secretary' },
  forwarded_dio:       { pill: 'mt-pill--capacity', accent: 'var(--brand-primary)', label: 'With DIO' },
  approved:            { pill: 'mt-pill--active',   accent: 'var(--success)',    label: 'Published' },
  rejected:            { pill: 'mt-pill--rejected', accent: 'var(--danger)',     label: 'Not approved' },
};

const STEPS = ['Evaluator', 'Secretary', 'DIO', 'Published'];
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBlockStart: 8, flexWrap: 'wrap' }}>
      {STEPS.map((label, i) => {
        const done = i <= active;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`mt-pill ${done ? 'mt-pill--active' : 'mt-pill--neutral'}`} style={{ fontSize: 10, padding: '2px 8px' }}>{label}</span>
            {i < STEPS.length - 1 && <span style={{ fontSize: 11, color: 'var(--text-2)' }}>›</span>}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return <span className={`mt-pill ${s.pill}`}>{s.label}</span>;
}

function FileLink({ url }) {
  if (!url) return null;
  return (
    <a href={`${API_BASE}${url}`} target="_blank" rel="noreferrer" className="mt-icon-action"
      title="Open file" aria-label="Open file"
      style={{ width: 34, height: 34, border: '1px solid var(--border)', background: 'var(--surface)' }}>
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

  return (
    <>
      <Navbar />
      <main className="mt-content">

        {/* Register research */}
        <div className="mt-card" style={{ marginBlockEnd: 18 }}>
          <div className="mt-card-head mt-card-head--tight">
            <div style={{ minWidth: 0 }}>
              <div className="mt-card-title">Register research</div>
              <div className="mt-card-sub">
                Your submission is sent to your evaluator for approval. Once approved it moves to Publications, where you choose Public or Private.
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-field-grid" style={{ marginBlockStart: 16, alignItems: 'end' }}>
            <div className="mt-field mt-field-full">
              <label className="mt-label">Title <span className="mt-label-req">*</span></label>
              <input className="mt-input" value={form.title} placeholder="Research title" onChange={e => setField('title', e.target.value)} />
            </div>
            <div className="mt-field">
              <label className="mt-label">Authors</label>
              <input className="mt-input" value={form.authors} placeholder="e.g. You, A. Colleague" onChange={e => setField('authors', e.target.value)} />
            </div>
            <div className="mt-field">
              <label className="mt-label">Journal / Venue</label>
              <input className="mt-input" value={form.journal} placeholder="e.g. BMJ" onChange={e => setField('journal', e.target.value)} />
            </div>
            <div className="mt-field mt-field-full">
              <label className="mt-label">Abstract</label>
              <textarea className="mt-textarea" value={form.abstract} placeholder="Short summary (optional)" onChange={e => setField('abstract', e.target.value)} />
            </div>
            <div className="mt-field">
              <label className="mt-label">File (PDF or image)</label>
              <input id="research-file-input" className="mt-input" style={{ height: 'auto', padding: 8 }} type="file"
                accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="mt-field-full" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" className="mt-btn" disabled={saving}>
                <IconPlus size={15} /> {saving ? 'Submitting…' : 'Submit for approval'}
              </button>
              {error && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>}
            </div>
          </form>
        </div>

        {/* My submissions (pending / rejected) */}
        <div className="mt-card" style={{ marginBlockEnd: 18 }}>
          <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 14 }}>
            <div className="mt-card-title">My researches</div>
            <span className="mt-count">{submissions.length}</span>
          </div>
          {loading ? (
            <div className="tr-rows">{[0, 1].map(i => <Sk key={i} h={64} r={10} />)}</div>
          ) : submissions.length === 0 ? (
            <div className="mt-empty">
              <span className="mt-empty-icon"><NavIcon name="flask" size={24} /></span>
              <div className="mt-empty-title">No researches submitted yet.</div>
            </div>
          ) : (
            <div className="tr-rows">
              {submissions.map(r => (
                <div key={r._id} className="tr-row" style={{ borderInlineStartColor: STATUS_STYLE[r.status]?.accent || 'var(--accent)', flexDirection: 'column', gap: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', width: '100%' }}>
                    <div className="tr-row-main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="tr-row-title">{r.title}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="tr-row-meta">{r.journal ? `${r.journal} · ` : ''}Submitted {fmt(r.createdAt)}</div>
                      {r.signedByName && r.status !== 'rejected' && (
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBlockStart: 4 }}>
                          Signed by {r.signedByName}{r.signedAt ? ` · ${fmt(r.signedAt)}` : ''}
                        </div>
                      )}
                      <Stepper status={r.status} />
                      {r.status === 'rejected' && r.reviewNote && (
                        <div style={{ fontSize: 12, color: 'var(--danger)', marginBlockStart: 6 }}>Reason: {r.reviewNote}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <FileLink url={r.fileUrl} />
                      <button type="button" className="mt-icon-action mt-icon-action--danger" onClick={() => handleDelete(r._id)}
                        title="Delete" aria-label="Delete"
                        style={{ width: 34, height: 34, border: '1px solid var(--border)', background: 'var(--surface)' }}>
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
        <div className="mt-card">
          <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 14 }}>
            <div className="mt-card-title">Publications</div>
            <span className="mt-count">{publications.length}</span>
          </div>
          {loading ? (
            <Sk h={64} r={10} />
          ) : publications.length === 0 ? (
            <div className="mt-empty">
              <span className="mt-empty-icon"><NavIcon name="book" size={24} /></span>
              <div className="mt-empty-title">Approved researches appear here as publications.</div>
            </div>
          ) : (
            <div className="tr-rows">
              {publications.map(r => {
                const isPublic = r.visibility === 'public';
                return (
                  <div key={r._id} className="tr-row" style={{ borderInlineStartColor: 'var(--success)', flexDirection: 'column', gap: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', width: '100%' }}>
                      <div className="tr-row-main">
                        <div className="tr-row-title">{r.title}</div>
                        <div className="tr-row-meta">{r.authors ? `${r.authors} · ` : ''}{r.journal || 'Publication'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <FileLink url={r.fileUrl} />
                        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                          <button type="button" onClick={() => setVisibility(r._id, 'private')}
                            style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                              background: !isPublic ? 'var(--accent)' : 'var(--surface)', color: !isPublic ? '#010c37' : 'var(--text-2)' }}>
                            Private
                          </button>
                          <button type="button" onClick={() => setVisibility(r._id, 'public')}
                            style={{ padding: '7px 12px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                              background: isPublic ? 'var(--accent)' : 'var(--surface)', color: isPublic ? '#010c37' : 'var(--text-2)' }}>
                            Public
                          </button>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBlockStart: 8 }}>
                      {isPublic
                        ? 'Public — visible to your evaluator, Program Directors and DIOs.'
                        : 'Private — visible to you and your evaluator only.'}
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
