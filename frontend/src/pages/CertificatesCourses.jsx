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

  return (
    <>
      <Navbar />
      <main className="mt-content">
        <div className="mt-card" style={{ marginBlockEnd: 18 }}>
          <div className="mt-card-head mt-card-head--tight">
            <div style={{ minWidth: 0 }}>
              <div className="mt-card-title">Add certificate or course</div>
              <div className="mt-card-sub">
                Upload any course or certificate you have completed. These appear on your portfolio and are visible to your evaluator, Program Director and DIO.
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-field-grid" style={{ marginBlockStart: 16, alignItems: 'end' }}>
            <div className="mt-field mt-field-full">
              <label className="mt-label">Title <span className="mt-label-req">*</span></label>
              <input className="mt-input" value={form.title} placeholder="e.g. Advanced Cardiac Life Support (ACLS)"
                onChange={e => setField('title', e.target.value)} />
            </div>
            <div className="mt-field">
              <label className="mt-label">Issuer / Provider</label>
              <input className="mt-input" value={form.issuer} placeholder="e.g. American Heart Association"
                onChange={e => setField('issuer', e.target.value)} />
            </div>
            <div className="mt-field">
              <label className="mt-label">Type</label>
              <select className="mt-select" value={form.kind} onChange={e => setField('kind', e.target.value)}>
                <option value="certificate">Certificate</option>
                <option value="course">Course</option>
              </select>
            </div>
            <div className="mt-field">
              <label className="mt-label">Completion date</label>
              <input className="mt-input" type="date" value={form.completedDate}
                onChange={e => setField('completedDate', e.target.value)} />
            </div>
            <div className="mt-field">
              <label className="mt-label">File (PDF or image)</label>
              <input id="cc-file-input" className="mt-input" style={{ height: 'auto', padding: 8 }} type="file"
                accept=".pdf,.jpg,.jpeg,.png" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="mt-field-full" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button type="submit" className="mt-btn" disabled={saving}>
                <IconPlus size={15} /> {saving ? 'Uploading…' : 'Add to portfolio'}
              </button>
              {error && <span style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</span>}
            </div>
          </form>
        </div>

        <div className="mt-card">
          <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 14 }}>
            <div className="mt-card-title">My uploads</div>
            <span className="mt-count">{items.length}</span>
          </div>

          {loading ? (
            <div className="tr-rows">{[0, 1, 2].map(i => <Sk key={i} h={64} r={10} />)}</div>
          ) : items.length === 0 ? (
            <div className="mt-empty">
              <span className="mt-empty-icon"><NavIcon name="award" size={24} /></span>
              <div className="mt-empty-title">No certificates or courses yet</div>
              <div className="mt-empty-sub">Use the form above to add your first one.</div>
            </div>
          ) : (
            <div className="tr-rows">
              {items.map(it => (
                <div key={it._id} className="tr-row" style={{ alignItems: 'center' }}>
                  <div className="tr-row-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className={`mt-pill ${it.kind === 'course' ? 'mt-pill--capacity' : 'mt-pill--role'}`}>
                        {it.kind === 'course' ? 'Course' : 'Certificate'}
                      </span>
                      <span className="tr-row-title">{it.title}</span>
                    </div>
                    <div className="tr-row-meta">
                      {it.issuer ? `${it.issuer} · ` : ''}{fmt(it.completedDate) !== '—' ? `Completed ${fmt(it.completedDate)}` : `Added ${fmt(it.createdAt)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {it.fileUrl && (
                      <a href={`${API_BASE}${it.fileUrl}`} target="_blank" rel="noreferrer" className="mt-icon-action"
                        title="Open file" aria-label="Open file"
                        style={{ width: 34, height: 34, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                        <IconEye size={16} />
                      </a>
                    )}
                    <button type="button" className="mt-icon-action mt-icon-action--danger" onClick={() => handleDelete(it._id)}
                      title="Delete" aria-label="Delete"
                      style={{ width: 34, height: 34, border: '1px solid var(--border)', background: 'var(--surface)' }}>
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
