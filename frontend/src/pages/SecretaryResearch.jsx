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
    title: 'أبحاث بانتظار التحويل إلى مدير التدريب',
    subtitle: 'الأبحاث التي اعتمدها ووقّعها المشرف. حوّلها إلى مدير التدريب لاعتمادها النهائي.',
    empty: 'لا توجد أبحاث بانتظار التحويل.',
    by: 'المتدرب',
    signedBy: 'وقّعها',
    forward: 'تحويل إلى مدير التدريب',
    reject: 'رفض',
    rejectReason: 'سبب الرفض (اختياري)',
    forwarded: 'تم التحويل إلى مدير التدريب',
    rejected: 'تم رفض البحث',
    failed: 'فشل الإجراء',
    view: 'عرض',
  },
  en: {
    title: 'Research awaiting forwarding to the DIO',
    subtitle: 'Research approved and signed by the supervisor. Forward it to the DIO for final approval.',
    empty: 'No research awaiting forwarding.',
    by: 'Trainee',
    signedBy: 'Signed by',
    forward: 'Forward to DIO',
    reject: 'Reject',
    rejectReason: 'Reason for rejection (optional)',
    forwarded: 'Forwarded to the DIO',
    rejected: 'Research rejected',
    failed: 'Action failed',
    view: 'View',
  },
};

function fmt(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SecretaryResearch() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts]   = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3000);
  }

  function load() {
    api.get('/api/research/queue')
      .then(r => setItems(Array.isArray(r.data) ? r.data : (r.data?.data || [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function forward(id) {
    try {
      await api.patch(`/api/research/${id}/forward`);
      setItems(prev => prev.filter(x => x._id !== id));
      showToast(t('forwarded'));
    } catch (err) { showToast(err.response?.data?.message || t('failed'), 'error'); }
  }

  async function reject(id) {
    const note = window.prompt(t('rejectReason')) ?? '';
    try {
      await api.patch(`/api/research/${id}/reject`, { note });
      setItems(prev => prev.filter(x => x._id !== id));
      showToast(t('rejected'));
    } catch (err) { showToast(err.response?.data?.message || t('failed'), 'error'); }
  }

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="admin-card">
          <div style={{ padding: '4px 2px 16px' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-secondary)' }}>{t('title')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{t('subtitle')}</div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0, 1, 2].map(i => <Sk key={i} h={70} r={10} />)}
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>🔬</div>
              <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{t('empty')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(r => (
                <div key={r._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        {t('by')}: {r.trainee?.name || '—'}
                        {r.trainee?.studentId ? ` · ${r.trainee.studentId}` : ''}
                        {[r.authors, r.journal].filter(Boolean).length ? ` · ${[r.authors, r.journal].filter(Boolean).join(' · ')}` : ''}
                      </div>
                      {/* Signature block */}
                      {r.signedByName && (
                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                          <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', fontSize: 20, color: 'var(--brand-secondary)' }}>
                            /s/ {r.signatureName || r.signedByName}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {t('signedBy')} {r.signedByName}{r.signedAt ? ` · ${fmt(r.signedAt)}` : ''}
                          </div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {r.fileUrl && (
                        <a href={`${API_BASE}${r.fileUrl}`} target="_blank" rel="noreferrer" title={t('view')} aria-label={t('view')}
                          style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--surface)', color: 'var(--text-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                          <IconEye size={16} />
                        </a>
                      )}
                      <button type="button" onClick={() => forward(r._id)}
                        style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff' }}>
                        {t('forward')}
                      </button>
                      <button type="button" onClick={() => reject(r._id)}
                        style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', background: 'var(--surface)', color: 'var(--danger-fg)', border: '1px solid var(--border)' }}>
                        {t('reject')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Toast toasts={toasts} />
      </main>
    </>
  );
}
