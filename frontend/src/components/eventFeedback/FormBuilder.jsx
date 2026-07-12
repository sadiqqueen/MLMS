import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios';

// Field types the admin can add. `type` matches the backend enum.
const FIELD_TYPES = [
  { type: 'short_text',     label: 'Short text',      icon: '✏️' },
  { type: 'long_text',      label: 'Long text',       icon: '📝' },
  { type: 'rating',         label: 'Rating (1–5)',    icon: '⭐' },
  { type: 'single_choice',  label: 'Single choice',   icon: '🔘' },
  { type: 'multi_choice',   label: 'Multiple choice', icon: '☑️' },
  { type: 'yes_no',         label: 'Yes / No',        icon: '🔀' },
  { type: 'date',           label: 'Date',            icon: '📅' },
  { type: 'email',          label: 'Email',           icon: '✉️' },
  { type: 'section_header', label: 'Section header',  icon: '▤' },
];
const TYPE_LABEL = Object.fromEntries(FIELD_TYPES.map(t => [t.type, t.label]));
const FACES = ['😞', '😕', '😐', '🙂', '😄'];

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'f' + Date.now() + Math.random().toString(16).slice(2));

function newField(type) {
  const f = { id: uid(), type, label: '', labelAr: '', required: false, section: '' };
  if (type === 'single_choice' || type === 'multi_choice') {
    f.options = [{ id: uid(), label: 'Option 1', labelAr: '', value: 'option_1' }];
  }
  if (type === 'rating') f.rating = { min: 1, max: 5, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree', style: 'emoji' };
  return f;
}

const box = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 };
const lbl = { fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 5, display: 'block' };
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 14 };

export default function FormBuilder({ formId, onToast, onStatus }) {
  const [form, setForm]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [selIdx, setSelIdx]   = useState(-1);
  const [dirty, setDirty]     = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/api/event-feedback/forms/${formId}`)
      .then(r => { setForm(r.data?.data || r.data); setDirty(false); })
      .catch(() => onToast?.('Failed to load form', 'error'))
      .finally(() => setLoading(false));
  }, [formId, onToast]);

  useEffect(() => { if (formId) load(); }, [formId, load]);

  if (loading) return <div style={{ ...box, padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading form…</div>;
  if (!form)   return null;

  const fields = form.fields || [];
  const setFields = (next) => { setForm(f => ({ ...f, fields: next })); setDirty(true); };
  const patchField = (idx, patch) => setFields(fields.map((f, i) => i === idx ? { ...f, ...patch } : f));

  const addField = (type) => { setFields([...fields, newField(type)]); setSelIdx(fields.length); setShowAdd(false); };
  const removeField = (idx) => { setFields(fields.filter((_, i) => i !== idx)); setSelIdx(-1); };
  const move = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[idx], next[j]] = [next[j], next[idx]];
    setFields(next);
    setSelIdx(j);
  };

  async function save() {
    setSaving(true);
    try {
      const body = { title: form.title, titleAr: form.titleAr, description: form.description, descriptionAr: form.descriptionAr, fields: form.fields, brand: form.brand, footer: form.footer };
      const r = await api.patch(`/api/event-feedback/forms/${form._id}`, body);
      setForm(r.data?.data || r.data); setDirty(false);
      onToast?.('Draft saved');
    } catch (e) { onToast?.(e.response?.data?.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  }

  async function doAction(path, successMsg) {
    try {
      const r = await api.post(`/api/event-feedback/forms/${form._id}/${path}`);
      onToast?.(successMsg);
      load(); onStatus?.(r.data?.data);
    } catch (e) { onToast?.(e.response?.data?.message || 'Action failed', 'error'); }
  }

  async function publish() {
    if (dirty) await save();
    doAction('publish', 'Form published — now live in the app');
  }

  async function uploadReplacement(file) {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try {
      const r = await api.post(`/api/event-feedback/forms/${form._id}/attachment`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(f => ({ ...f, ...(r.data?.data || {}) }));
      onToast?.('Replacement file uploaded');
    } catch (e) { onToast?.(e.response?.data?.message || 'Upload failed', 'error'); }
  }

  const statusColor = { published: '#059669', draft: 'var(--text-muted)', unpublished: '#d97706', archived: '#9ca3af' }[form.status] || 'var(--text-muted)';
  const accent = form.brand?.primary || '#F0892B';
  const sel = selIdx >= 0 ? fields[selIdx] : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
      {/* LEFT: builder */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Form header + status + publish controls */}
        <div style={{ ...box, padding: 16 }}>
          <label style={lbl}>Form title</label>
          <input style={inp} value={form.title || ''} onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setDirty(true); }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'var(--surface-2)', color: statusColor, border: '1px solid var(--border)' }}>
              ● {form.status}{form.version ? ` · v${form.version}` : ''}
            </span>
            <div style={{ flex: 1 }} />
            <button onClick={save} disabled={saving || !dirty} className="btn-purple" style={{ opacity: (saving || !dirty) ? 0.55 : 1 }}>
              {saving ? 'Saving…' : dirty ? 'Save draft' : 'Saved'}
            </button>
            {form.status === 'published'
              ? <button onClick={() => doAction('unpublish', 'Form hidden from the app')} style={{ ...inp, width: 'auto', cursor: 'pointer', fontWeight: 700, color: '#d97706' }}>Turn OFF</button>
              : <button onClick={publish} style={{ ...inp, width: 'auto', cursor: 'pointer', fontWeight: 700, background: accent, color: '#fff', border: 'none' }}>Publish / Turn ON</button>}
            {form.status === 'published' && <button onClick={publish} style={{ ...inp, width: 'auto', cursor: 'pointer', fontWeight: 700 }}>Re-publish</button>}
          </div>
          {/* Replacement file upload */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label style={{ ...inp, width: 'auto', cursor: 'pointer', fontWeight: 600 }}>
              ⬆ Upload replacement form file
              <input type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadReplacement(f); e.target.value = ''; }} />
            </label>
            {form.attachmentName && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📎 {form.attachmentName}</span>}
          </div>
        </div>

        {/* Field list */}
        <div style={{ ...box, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-secondary)' }}>Questions ({fields.length})</div>
            <div style={{ position: 'relative' }}>
              <button className="btn-purple" onClick={() => setShowAdd(v => !v)}>＋ Add question</button>
              {showAdd && (
                <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 10, ...box, boxShadow: '0 8px 24px rgba(0,0,0,.16)', padding: 6, width: 190 }}>
                  {FIELD_TYPES.map(t => (
                    <div key={t.type} onClick={() => addField(t.type)} style={{ padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'flex', gap: 8 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span>{t.icon}</span>{t.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {fields.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No questions yet. Add one to begin.</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {fields.map((f, i) => (
              <div key={f.id} onClick={() => setSelIdx(i)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid ' + (selIdx === i ? accent : 'var(--border)'),
                background: selIdx === i ? 'var(--surface-2)' : 'transparent',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.type === 'section_header' ? '▤ ' : ''}{f.label || <span style={{ color: 'var(--text-muted)' }}>Untitled</span>}
                    {f.required && <span style={{ color: '#dc2626' }}> *</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{TYPE_LABEL[f.type]}{f.section ? ` · ${f.section}` : ''}</div>
                </div>
                <button title="Up" onClick={e => { e.stopPropagation(); move(i, -1); }} style={miniBtn}>▲</button>
                <button title="Down" onClick={e => { e.stopPropagation(); move(i, 1); }} style={miniBtn}>▼</button>
                <button title="Delete" onClick={e => { e.stopPropagation(); removeField(i); }} style={{ ...miniBtn, color: '#dc2626' }}>🗑</button>
              </div>
            ))}
          </div>
        </div>

        {/* Field editor */}
        {sel && <FieldEditor key={sel.id} field={sel} onChange={patch => patchField(selIdx, patch)} />}
      </div>

      {/* RIGHT: live preview */}
      <div style={{ ...box, padding: 0, overflow: 'hidden', position: 'sticky', top: 12 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>App preview</div>
        <Preview form={form} accent={accent} />
      </div>
    </div>
  );
}

const miniBtn = { border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' };

// ── Per-field editor ────────────────────────────────────────────────────────
function FieldEditor({ field, onChange }) {
  const isChoice = field.type === 'single_choice' || field.type === 'multi_choice';
  const setOpt = (i, patch) => onChange({ options: field.options.map((o, j) => j === i ? { ...o, ...patch } : o) });
  const addOpt = () => onChange({ options: [...(field.options || []), { id: uid(), label: '', labelAr: '', value: 'option_' + ((field.options?.length || 0) + 1) }] });
  const rmOpt  = (i) => onChange({ options: field.options.filter((_, j) => j !== i) });

  return (
    <div style={{ ...box, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-secondary)' }}>Edit: {TYPE_LABEL[field.type]}</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label style={lbl}>Label (English)</label><input style={inp} value={field.label || ''} onChange={e => onChange({ label: e.target.value })} /></div>
        <div><label style={lbl}>Label (Arabic)</label><input style={inp} dir="rtl" value={field.labelAr || ''} onChange={e => onChange({ labelAr: e.target.value })} /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div><label style={lbl}>Section (English)</label><input style={inp} value={field.section || ''} onChange={e => onChange({ section: e.target.value })} placeholder="Groups questions into a screen" /></div>
        <div><label style={lbl}>Section (Arabic)</label><input style={inp} dir="rtl" value={field.sectionAr || ''} onChange={e => onChange({ sectionAr: e.target.value })} /></div>
      </div>

      {field.type !== 'section_header' && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
          <input type="checkbox" checked={!!field.required} onChange={e => onChange({ required: e.target.checked })} /> Required
        </label>
      )}

      {isChoice && (
        <div>
          <label style={lbl}>Options</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(field.options || []).map((o, i) => (
              <div key={o.id} style={{ display: 'flex', gap: 6 }}>
                <input style={{ ...inp, flex: 1 }} value={o.label || ''} placeholder="Option" onChange={e => setOpt(i, { label: e.target.value, value: (e.target.value || '').toLowerCase().replace(/\s+/g, '_').slice(0, 40) || o.value })} />
                <input style={{ ...inp, flex: 1 }} dir="rtl" value={o.labelAr || ''} placeholder="عربي" onChange={e => setOpt(i, { labelAr: e.target.value })} />
                <button onClick={() => rmOpt(i)} style={{ ...miniBtn, color: '#dc2626' }}>✕</button>
              </div>
            ))}
          </div>
          <button onClick={addOpt} style={{ ...inp, width: 'auto', cursor: 'pointer', marginTop: 8, fontWeight: 600 }}>＋ Add option</button>
        </div>
      )}

      {field.type === 'rating' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={lbl}>Low label</label><input style={inp} value={field.rating?.minLabel || ''} onChange={e => onChange({ rating: { ...field.rating, minLabel: e.target.value } })} /></div>
          <div><label style={lbl}>High label</label><input style={inp} value={field.rating?.maxLabel || ''} onChange={e => onChange({ rating: { ...field.rating, maxLabel: e.target.value } })} /></div>
        </div>
      )}

      {/* Conditional visibility */}
      <div>
        <label style={lbl}>Show only if… (optional)</label>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ ...inp, flex: 1 }} placeholder="another field's id" value={field.showIf?.fieldId || ''} onChange={e => onChange({ showIf: e.target.value ? { fieldId: e.target.value, op: field.showIf?.op || 'equals', value: field.showIf?.value ?? 'yes' } : undefined })} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>equals</span>
          <input style={{ ...inp, width: 100 }} placeholder="value" value={field.showIf?.value ?? ''} disabled={!field.showIf?.fieldId} onChange={e => onChange({ showIf: { ...field.showIf, op: 'equals', value: e.target.value } })} />
        </div>
      </div>
    </div>
  );
}

// ── Live preview (Warm-Rounded flavored, read-only) ─────────────────────────
function Preview({ form, accent }) {
  const fields = (form.fields || []).filter(Boolean);
  return (
    <div style={{ padding: 16, background: '#FFF4E8', maxHeight: 560, overflowY: 'auto' }}>
      <div style={{ fontFamily: 'system-ui', color: '#3B2A18' }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{form.title || 'Untitled'}</div>
        {form.description && <div style={{ fontSize: 12.5, color: '#9C8367', lineHeight: 1.5, marginBottom: 12 }}>{form.description}</div>}
        {fields.map((f, i) => {
          const prev = fields[i - 1];
          const showSection = f.section && (!prev || prev.section !== f.section);
          return (
            <div key={f.id}>
              {showSection && <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: accent, margin: '14px 0 6px' }}>{f.section}</div>}
              {f.type === 'section_header'
                ? <div style={{ fontSize: 15, fontWeight: 700, margin: '10px 0 4px' }}>{f.label}</div>
                : (
                  <div style={{ background: '#fff', border: '1px solid #F2E3D0', borderRadius: 16, padding: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{f.label || <span style={{ color: '#bbb' }}>Untitled</span>}{f.required && <span style={{ color: '#dc2626' }}> *</span>}</div>
                    <PreviewControl f={f} accent={accent} />
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreviewControl({ f, accent }) {
  if (f.type === 'rating') return (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      {FACES.map((e, i) => <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 22, filter: 'grayscale(.35) opacity(.7)' }}>{e}</div>)}
    </div>
  );
  if (f.type === 'yes_no') return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      {['Yes', 'No'].map(y => <div key={y} style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 999, border: '1px solid #F2E3D0', fontSize: 13, fontWeight: 700 }}>{y}</div>)}
    </div>
  );
  if (f.type === 'single_choice' || f.type === 'multi_choice') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
      {(f.options || []).map(o => (
        <div key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '9px 10px', borderRadius: 12, border: '1px solid #F2E3D0', fontSize: 13 }}>
          <span style={{ width: 16, height: 16, borderRadius: f.type === 'multi_choice' ? 4 : '50%', border: '2px solid #ccc', display: 'inline-block' }} />{o.label}
        </div>
      ))}
    </div>
  );
  if (f.type === 'long_text') return <div style={{ marginTop: 8, height: 54, borderRadius: 10, border: '1px solid #F2E3D0', background: '#FFF9F1' }} />;
  return <div style={{ marginTop: 8, height: 38, borderRadius: 10, border: '1px solid #F2E3D0', background: '#FFF9F1' }} />;
}
