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

export default function CertificatesCourses() {
  const { user } = useAuth();
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [form, setForm] = useState({ title: '', issuer: '', kind: 'certificate', completedDate: '' });
  const [file, setFile] = useState(null);

  function load() {
    api.get('/api/trainee-courses/mine')
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
      fd.append('issuer', form.issuer.trim());
      fd.append('kind', form.kind);
      if (form.completedDate) fd.append('completedDate', form.completedDate);
      if (file) fd.append('file', file);
      const res = await api.post('/api/trainee-courses', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const created = res.data?.data || res.data;
      setItems(prev => [created, ...prev]);
      setForm({ title: '', issuer: '', kind: 'certificate', completedDate: '' });
      setFile(null);
      // clear the native file input
      const input = document.getElementById('cc-file-input');
      if (input) input.value = '';
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/api/trainee-courses/${id}`);
      setItems(prev => prev.filter(x => x._id !== id));
    } catch {
      setError('Could not delete this item.');
    }
  }

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
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>Certificates & Courses</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Upload any course or certificate you have completed. These appear on your portfolio and are
            visible to your Supervisor, Program Director and DIO.
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'end' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Title *</label>
              <input style={fieldStyle} value={form.title} placeholder="e.g. Advanced Cardiac Life Support (ACLS)"
                onChange={e => setField('title', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Issuer / Provider</label>
              <input style={fieldStyle} value={form.issuer} placeholder="e.g. American Heart Association"
                onChange={e => setField('issuer', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={fieldStyle} value={form.kind} onChange={e => setField('kind', e.target.value)}>
                <option value="certificate">Certificate</option>
                <option value="course">Course</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Completion Date</label>
              <input style={fieldStyle} type="date" value={form.completedDate}
                onChange={e => setField('completedDate', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>File (PDF or image)</label>
              <input id="cc-file-input" style={{ ...fieldStyle, height: 'auto', padding: 8 }} type="file"
                accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" className="btn-purple" disabled={saving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconPlus size={15} /> {saving ? 'Uploading…' : 'Add to portfolio'}
              </button>
              {error && <span style={{ color: 'var(--danger-fg)', fontSize: 13 }}>{error}</span>}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>
            My uploads
            <span className="badge badge-blue" style={{ marginInlineStart: 8 }}>{items.length}</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map(i => <Sk key={i} h={64} r={10} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 44, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>🎓</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No certificates or courses yet</div>
              <div style={{ fontSize: 13 }}>Use the form above to add your first one.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(it => (
                <div key={it._id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px',
                  background: 'var(--surface-2)', borderLeft: '4px solid var(--accent)',
                }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                        padding: '2px 8px', borderRadius: 20,
                        background: 'var(--chip-spec-bg)', color: 'var(--chip-spec-fg)',
                      }}>
                        {it.kind === 'course' ? 'Course' : 'Certificate'}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{it.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {it.issuer ? `${it.issuer} · ` : ''}{fmt(it.completedDate) !== '—' ? `Completed ${fmt(it.completedDate)}` : `Added ${fmt(it.createdAt)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {it.fileUrl && (
                      <a href={`${API_BASE}${it.fileUrl}`} target="_blank" rel="noreferrer"
                        title="Open file" aria-label="Open file"
                        style={{
                          width: 34, height: 34, borderRadius: 8, background: 'var(--surface)',
                          border: '1px solid var(--border)', color: 'var(--link)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
                        }}>
                        <IconEye size={16} />
                      </a>
                    )}
                    <button type="button" onClick={() => handleDelete(it._id)}
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
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
