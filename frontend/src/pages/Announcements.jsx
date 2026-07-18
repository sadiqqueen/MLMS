// frontend/src/pages/Announcements.jsx
//
// Program announcements board. A Program Director composes announcements for his
// own program (title + body) and may delete his own posts; trainees, trainers,
// Sub-PDs and oversight roles see a read-only, scoped board.
// Contract (backend/routes/announcements.js):
//   GET    /api/announcements                → scoped board (newest first)
//   POST   /api/announcements  { title, body }  (program_director only)
//   DELETE /api/announcements/:id               (author PD or super_admin)
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import Sk from '../components/Skeleton';
import { IconTrash, IconPlus } from '../components/icons';
import api from '../api/axios';

const STRINGS = {
  ar: {
    title: 'الإعلانات',
    composeTitle: 'نشر إعلان جديد', fTitle: 'العنوان', fBody: 'النص',
    titlePh: 'عنوان الإعلان', bodyPh: 'اكتب نص الإعلان…',
    post: 'نشر', posting: 'جارٍ النشر…',
    none: 'لا توجد إعلانات بعد.', by: 'بواسطة', program: 'البرنامج',
    delete: 'حذف', deleteConfirm: 'حذف هذا الإعلان؟',
    posted: 'تم نشر الإعلان', deleted: 'تم حذف الإعلان',
    titleReq: 'العنوان مطلوب', bodyReq: 'النص مطلوب', loadFailed: 'فشل تحميل الإعلانات', saveFailed: 'فشل الحفظ',
  },
  en: {
    title: 'Announcements',
    composeTitle: 'Post a new announcement', fTitle: 'Title', fBody: 'Body',
    titlePh: 'Announcement title', bodyPh: 'Write the announcement…',
    post: 'Post', posting: 'Posting…',
    none: 'No announcements yet.', by: 'By', program: 'Program',
    delete: 'Delete', deleteConfirm: 'Delete this announcement?',
    posted: 'Announcement posted', deleted: 'Announcement deleted',
    titleReq: 'Title is required', bodyReq: 'Body is required', loadFailed: 'Failed to load announcements', saveFailed: 'Save failed',
  },
};

function fmt(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function idOf(v) { return v?._id || v || ''; }

export default function Announcements() {
  const { user } = useAuth();
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const isPd = user?.role === 'program_director';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', body: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3200);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/announcements', { cache: false });
      setItems(r.data?.data || r.data || []);
    } catch { showToast(t('loadFailed'), 'error'); }
    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  async function handlePost() {
    const e = {};
    if (!form.title.trim()) e.title = true;
    if (!form.body.trim()) e.body = true;
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    try {
      const res = await api.post('/api/announcements', { title: form.title.trim(), body: form.body.trim() });
      const created = res.data?.data || res.data;
      setItems(prev => [created, ...prev]);
      setForm({ title: '', body: '' });
      showToast(t('posted'));
    } catch (err) {
      showToast(err.response?.data?.message || t('saveFailed'), 'error');
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await api.delete(`/api/announcements/${id}`);
      setItems(prev => prev.filter(x => x._id !== id));
      showToast(t('deleted'));
    } catch (err) {
      showToast(err.response?.data?.message || t('saveFailed'), 'error');
    }
  }

  const fieldStyle = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' };
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 };

  return (
    <>
      <Navbar />
      <main className="main" dir={dir}>
        {isPd && (
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-title" style={{ marginBottom: 14 }}>{t('composeTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>{t('fTitle')} *</label>
                <input style={{ ...fieldStyle, height: 42, borderColor: errors.title ? 'var(--danger)' : 'var(--border)' }}
                  value={form.title} placeholder={t('titlePh')} onChange={e => set('title', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>{t('fBody')} *</label>
                <textarea style={{ ...fieldStyle, minHeight: 90, resize: 'vertical', borderColor: errors.body ? 'var(--danger)' : 'var(--border)' }}
                  value={form.body} placeholder={t('bodyPh')} onChange={e => set('body', e.target.value)} />
              </div>
              <div>
                <button className="btn-purple" onClick={handlePost} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconPlus size={15} /> {saving ? t('posting') : t('post')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-title" style={{ marginBottom: 14 }}>
            {t('title')}
            <span className="badge badge-blue" style={{ marginInlineStart: 8 }}>{items.length}</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map(i => <Sk key={i} h={84} r={10} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 44, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>📢</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>{t('none')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map(a => {
                const canDelete = isPd && idOf(a.authorId) === user?._id;
                return (
                  <div key={a._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface-2)', borderInlineStart: '4px solid var(--accent)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{a.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, whiteSpace: 'pre-wrap' }}>{a.body}</div>
                      </div>
                      {canDelete && (
                        <button type="button" onClick={() => handleDelete(a._id)} title={t('delete')} aria-label={t('delete')}
                          style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--danger-fg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <IconTrash size={16} />
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <span>{t('by')}: {a.authorId?.name || '—'}</span>
                      {a.programId?.name && <span>{t('program')}: {a.programId.name}</span>}
                      <span>{fmt(a.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
