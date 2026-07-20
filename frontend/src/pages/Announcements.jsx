// frontend/src/pages/Announcements.jsx
//
// Program announcements board. A Program Director composes announcements for his
// own program (title + body) and may delete his own posts; trainees, evaluators,
// Sub-PDs and oversight roles see a read-only, scoped board.
// Contract (backend/routes/announcements.js):
//   GET    /api/announcements                → scoped board (newest first)
//   POST   /api/announcements  { title, body }  (program_director only)
//   DELETE /api/announcements/:id               (author PD or super_admin)
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import MtToastHost, { useMtToast } from '../components/MtToast';
import Sk from '../components/Skeleton';
import { IconTrash, IconPlus, NavIcon } from '../components/icons';
import api from '../api/axios';
import './trainee.css';

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
  const { toasts, showToast } = useMtToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/api/announcements', { cache: false });
      setItems(r.data?.data || r.data || []);
    } catch { showToast(t('loadFailed'), 'dng'); }
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
      showToast(t('posted'), 'ok');
    } catch (err) {
      showToast(err.response?.data?.message || t('saveFailed'), 'dng');
    } finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await api.delete(`/api/announcements/${id}`);
      setItems(prev => prev.filter(x => x._id !== id));
      showToast(t('deleted'), 'ok');
    } catch (err) {
      showToast(err.response?.data?.message || t('saveFailed'), 'dng');
    }
  }

  return (
    <>
      <Navbar title={t('title')} />
      <main className="mt-content" dir={dir}>
        {isPd && (
          <div className="mt-card" style={{ marginBlockEnd: 18 }}>
            <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 14 }}>
              <div className="mt-card-title">{t('composeTitle')}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="mt-field">
                <label className="mt-label">{t('fTitle')} <span className="mt-label-req">*</span></label>
                <input className="mt-input" style={{ borderColor: errors.title ? 'var(--danger)' : undefined }}
                  value={form.title} placeholder={t('titlePh')} onChange={e => set('title', e.target.value)} />
              </div>
              <div className="mt-field">
                <label className="mt-label">{t('fBody')} <span className="mt-label-req">*</span></label>
                <textarea className="mt-textarea" style={{ borderColor: errors.body ? 'var(--danger)' : undefined }}
                  value={form.body} placeholder={t('bodyPh')} onChange={e => set('body', e.target.value)} />
              </div>
              <div>
                <button className="mt-btn" onClick={handlePost} disabled={saving}>
                  <IconPlus size={15} /> {saving ? t('posting') : t('post')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-card">
          <div className="mt-card-head mt-card-head--tight" style={{ marginBlockEnd: 14 }}>
            <div className="mt-card-title">{t('title')}</div>
            <span className="mt-count">{items.length}</span>
          </div>

          {loading ? (
            <div className="tr-rows">{[0, 1, 2].map(i => <Sk key={i} h={84} r={10} />)}</div>
          ) : items.length === 0 ? (
            <div className="mt-empty">
              <span className="mt-empty-icon"><NavIcon name="mega" size={24} /></span>
              <div className="mt-empty-title">{t('none')}</div>
            </div>
          ) : (
            <div className="tr-rows" style={{ gap: 12 }}>
              {items.map(a => {
                const canDelete = isPd && idOf(a.authorId) === user?._id;
                return (
                  <div key={a._id} className="tr-row" style={{ flexDirection: 'column', gap: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{a.title}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBlockStart: 6, whiteSpace: 'pre-wrap' }}>{a.body}</div>
                      </div>
                      {canDelete && (
                        <button type="button" className="mt-icon-action mt-icon-action--danger" onClick={() => handleDelete(a._id)}
                          title={t('delete')} aria-label={t('delete')}
                          style={{ width: 34, height: 34, border: '1px solid var(--border)', background: 'var(--surface)' }}>
                          <IconTrash size={16} />
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginBlockStart: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
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
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
