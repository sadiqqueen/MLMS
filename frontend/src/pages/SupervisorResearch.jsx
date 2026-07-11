import { useState, useEffect } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import api from '../api/axios';
import Sk from '../components/Skeleton';
import { IconEye } from '../components/icons';

const API_BASE = '';

const STRINGS = {
  ar: {
    pageTitle: 'أبحاث المتدربين',
    awaiting: 'أبحاث بانتظار توقيعك',
    awaitingSub: 'راجع البحث ثم اعتمِده ووقّع عليه، أو ارفضه.',
    allTitle: 'كل الأبحاث',
    allSub: 'كل أبحاث متدربيك ومسارها في الاعتماد.',
    empty: 'لا توجد أبحاث بانتظار توقيعك.',
    emptyAll: 'لا توجد أبحاث بعد.',
    by: 'المتدرب', signedBy: 'وقّعها', view: 'عرض',
    approveSign: 'اعتماد وتوقيع', reject: 'رفض',
    signTitle: 'اعتماد وتوقيع البحث', signPrompt: 'اكتب اسمك الكامل للتوقيع على الاعتماد',
    signNamePh: 'الاسم الكامل', noteOptional: 'ملاحظة (اختياري)', rejectReason: 'سبب الرفض (اختياري)',
    cancel: 'إلغاء', signed: 'تم الاعتماد والتوقيع', rejected: 'تم رفض البحث', failed: 'فشل الإجراء',
    st_pending: 'بانتظار توقيعك', st_supervisor_approved: 'موقّع — لدى السكرتارية',
    st_forwarded_dio: 'لدى مدير التدريب', st_approved: 'منشور', st_rejected: 'مرفوض',
  },
  en: {
    pageTitle: 'Trainee Research',
    awaiting: 'Research awaiting your signature',
    awaitingSub: 'Review the research, then approve and sign it — or reject it.',
    allTitle: 'All research',
    allSub: "All of your trainees' research and where it is in the approval flow.",
    empty: 'No research awaiting your signature.',
    emptyAll: 'No research yet.',
    by: 'Trainee', signedBy: 'Signed by', view: 'View',
    approveSign: 'Approve & Sign', reject: 'Reject',
    signTitle: 'Approve & Sign Research', signPrompt: 'Type your full name to sign the approval',
    signNamePh: 'Full name', noteOptional: 'Note (optional)', rejectReason: 'Reason for rejection (optional)',
    cancel: 'Cancel', signed: 'Approved and signed', rejected: 'Research rejected', failed: 'Action failed',
    st_pending: 'Awaiting your signature', st_supervisor_approved: 'Signed — with secretary',
    st_forwarded_dio: 'With DIO', st_approved: 'Published', st_rejected: 'Rejected',
  },
};

const STATUS_TONE = {
  pending:             ['var(--warning-bg)', 'var(--warning-fg)'],
  supervisor_approved: ['var(--info-bg)', 'var(--info-fg)'],
  forwarded_dio:       ['var(--info-bg)', 'var(--info-fg)'],
  approved:            ['var(--success-bg)', 'var(--success-fg)'],
  rejected:            ['var(--danger-bg)', 'var(--danger-fg)'],
};

function fmt(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function safeArr(v) { return Array.isArray(v) ? v : []; }

// Approve & Sign modal — the research supervisor types their full name to sign.
function SignModal({ item, t, onClose, onSigned }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  async function submit() {
    if (!name.trim()) { setError(t('signPrompt')); return; }
    setSaving(true); setError('');
    try {
      const res = await api.patch(`/api/research/${item._id}/approve`, { signatureName: name.trim(), note: note.trim() });
      onSigned(res.data?.data || res.data);
    } catch (err) {
      setError(err.response?.data?.message || t('failed'));
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--overlay)', zIndex: 2600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px var(--shadow)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
          {t('signTitle')}
        </div>
        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{item.title}</div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{t('signPrompt')}</label>
            <input value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder={t('signNamePh')}
              style={{ width: '100%', boxSizing: 'border-box', height: 42, padding: '0 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }} />
            {name.trim() && (
              <div style={{ marginTop: 8, fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', fontSize: 22, color: 'var(--brand-secondary)', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
                /s/ {name.trim()}
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{t('noteOptional')}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 70, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          {error && <div style={{ color: 'var(--danger-fg)', fontSize: 13 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn-outline" onClick={onClose}>{t('cancel')}</button>
            <button className="btn-purple" onClick={submit} disabled={saving}>{saving ? '…' : t('approveSign')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResearchRow({ r, t, actions, onSign, onReject }) {
  const [bg, color] = STATUS_TONE[r.status] || ['var(--surface-3)', 'var(--text-muted)'];
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '13px 15px', background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{r.title}</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: bg, color }}>
              {t(`st_${r.status}`)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
            {t('by')}: {r.trainee?.name || '—'}
            {r.trainee?.studentId ? ` · ${r.trainee.studentId}` : ''}
            {[r.authors, r.journal].filter(Boolean).length ? ` · ${[r.authors, r.journal].filter(Boolean).join(' · ')}` : ''}
          </div>
          {r.signedByName && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
              <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', fontSize: 18, color: 'var(--brand-secondary)' }}>
                /s/ {r.signatureName || r.signedByName}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {t('signedBy')} {r.signedByName}{r.signedAt ? ` · ${fmt(r.signedAt)}` : ''}
              </div>
            </div>
          )}
          {r.status === 'rejected' && r.reviewNote && (
            <div style={{ fontSize: 12, color: 'var(--danger-fg)', marginTop: 6 }}>{r.reviewNote}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {r.fileUrl && (
            <a href={`${API_BASE}${r.fileUrl}`} target="_blank" rel="noreferrer" title={t('view')} aria-label={t('view')}
              style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
              <IconEye size={16} />
            </a>
          )}
          {actions && (
            <>
              <button type="button" onClick={() => onSign(r)}
                style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--success-fg)', color: '#fff' }}>
                {t('approveSign')}
              </button>
              <button type="button" onClick={() => onReject(r._id)}
                style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', background: 'var(--surface)', color: 'var(--danger-fg)', border: '1px solid var(--border)' }}>
                {t('reject')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SupervisorResearch() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signItem, setSignItem] = useState(null);
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3000);
  }

  function load() {
    api.get('/api/research/supervisor')
      .then(r => setItems(safeArr(r.data?.data || r.data)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function applyUpdate(updated) {
    setItems(prev => prev.map(x => x._id === updated._id ? { ...x, ...updated } : x));
  }

  async function reject(id) {
    const note = window.prompt(t('rejectReason')) ?? '';
    try {
      const res = await api.patch(`/api/research/${id}/reject`, { note });
      applyUpdate(res.data?.data || res.data);
      showToast(t('rejected'));
    } catch (err) { showToast(err.response?.data?.message || t('failed'), 'error'); }
  }

  const pending = items.filter(r => r.status === 'pending');
  const rest = items.filter(r => r.status !== 'pending');

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        {/* Awaiting signature */}
        <div className="admin-card" style={{ marginBottom: 18 }}>
          <div style={{ padding: '4px 2px 14px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-secondary)' }}>
              {t('awaiting')}{pending.length ? <span className="badge badge-blue" style={{ marginInlineStart: 8 }}>{pending.length}</span> : null}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{t('awaitingSub')}</div>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1].map(i => <Sk key={i} h={80} r={10} />)}</div>
          ) : pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>✍️</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{t('empty')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {pending.map(r => (
                <ResearchRow key={r._id} r={r} t={t} actions onSign={setSignItem} onReject={reject} />
              ))}
            </div>
          )}
        </div>

        {/* All research (read-only history) */}
        <div className="admin-card">
          <div style={{ padding: '4px 2px 14px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-secondary)' }}>{t('allTitle')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{t('allSub')}</div>
          </div>
          {loading ? (
            <Sk h={70} r={10} />
          ) : rest.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 34, marginBottom: 8 }}>📚</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{t('emptyAll')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rest.map(r => <ResearchRow key={r._id} r={r} t={t} />)}
            </div>
          )}
        </div>

        {signItem && (
          <SignModal
            item={signItem}
            t={t}
            onClose={() => setSignItem(null)}
            onSigned={updated => { applyUpdate(updated); setSignItem(null); showToast(t('signed')); }}
          />
        )}
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
