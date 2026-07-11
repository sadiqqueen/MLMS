import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import api from '../api/axios';
import Sk from '../components/Skeleton';
import { IconEye } from '../components/icons';

const API_BASE = '';

const STRINGS = {
  ar: {
    tabPromotions: 'تعديلات الحسابات',
    tabResearch: 'الأبحاث',
    promoTitle: 'طلبات تعديل من السكرتارية',
    promoSubtitle: 'تعديلات على الحسابات تنتظر موافقتك. عند الموافقة تُطبَّق التعديلات.',
    promoEmpty: 'لا توجد طلبات تعديل معلّقة.',
    researchTitle: 'أبحاث بانتظار الاعتماد النهائي',
    researchSubtitle: 'أبحاث حوّلتها السكرتارية إليك. اعتمِدها لتُنشر للمتدرب.',
    researchEmpty: 'لا توجد أبحاث بانتظار الاعتماد.',
    requestedBy: 'مقدّم الطلب',
    target: 'الحساب',
    field: 'الحقل', from: 'من', to: 'إلى',
    approve: 'موافقة', reject: 'رفض',
    finalApprove: 'اعتماد ونشر',
    rejectReason: 'سبب الرفض (اختياري)',
    approved: 'تمت الموافقة', rejectedMsg: 'تم الرفض', published: 'تم الاعتماد والنشر',
    failed: 'فشل الإجراء',
    by: 'المتدرب', signedBy: 'وقّعها', view: 'عرض',
  },
  en: {
    tabPromotions: 'Account Changes',
    tabResearch: 'Research',
    promoTitle: 'Edit requests from secretaries',
    promoSubtitle: 'Account edits waiting for your approval. Approving applies the change.',
    promoEmpty: 'No pending edit requests.',
    researchTitle: 'Research awaiting final approval',
    researchSubtitle: 'Research the secretary forwarded to you. Approve it to publish for the trainee.',
    researchEmpty: 'No research awaiting approval.',
    requestedBy: 'Requested by',
    target: 'Account',
    field: 'Field', from: 'From', to: 'To',
    approve: 'Approve', reject: 'Reject',
    finalApprove: 'Approve & Publish',
    rejectReason: 'Reason for rejection (optional)',
    approved: 'Approved', rejectedMsg: 'Rejected', published: 'Approved and published',
    failed: 'Action failed',
    by: 'Trainee', signedBy: 'Signed by', view: 'View',
  },
};

// Human labels for the account fields that a secretary may edit.
const FIELD_LABELS = {
  name: 'Name', phone: 'Phone', gender: 'Gender', city: 'City', department: 'Department',
  year: 'Year', studentId: 'Student ID', hospitalId: 'Hospital', supervisorId: 'Supervisor',
  researchSupervisorId: 'Research Supervisor', isActive: 'Active', specialty: 'Specialty',
};

function fmt(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Render a change value that may be an id, a populated {name}, a bool, or a scalar.
function showVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return v.name || v.title || v._id || '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

export default function DioApprovals() {
  const { lang } = usePrefs();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [tab, setTab] = useState('promotions');
  const [promos, setPromos] = useState([]);
  const [research, setResearch] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), 3000);
  }

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api.get('/api/dio/change-requests?status=pending'),
      api.get('/api/research/queue'),
    ]).then(([pRes, rRes]) => {
      if (pRes.status === 'fulfilled') setPromos(pRes.value.data?.data || pRes.value.data || []);
      if (rRes.status === 'fulfilled') setResearch(rRes.value.data?.data || rRes.value.data || []);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function approvePromo(id) {
    try {
      await api.patch(`/api/dio/change-requests/${id}/approve`);
      setPromos(prev => prev.filter(x => x._id !== id));
      showToast(t('approved'));
    } catch (err) { showToast(err.response?.data?.message || t('failed'), 'error'); }
  }
  async function rejectPromo(id) {
    const note = window.prompt(t('rejectReason')) ?? '';
    try {
      await api.patch(`/api/dio/change-requests/${id}/reject`, { note });
      setPromos(prev => prev.filter(x => x._id !== id));
      showToast(t('rejectedMsg'));
    } catch (err) { showToast(err.response?.data?.message || t('failed'), 'error'); }
  }
  async function approveResearch(id) {
    try {
      await api.patch(`/api/research/${id}/final-approve`);
      setResearch(prev => prev.filter(x => x._id !== id));
      showToast(t('published'));
    } catch (err) { showToast(err.response?.data?.message || t('failed'), 'error'); }
  }
  async function rejectResearch(id) {
    const note = window.prompt(t('rejectReason')) ?? '';
    try {
      await api.patch(`/api/research/${id}/reject`, { note });
      setResearch(prev => prev.filter(x => x._id !== id));
      showToast(t('rejectedMsg'));
    } catch (err) { showToast(err.response?.data?.message || t('failed'), 'error'); }
  }

  const tabs = [
    { key: 'promotions', label: `${t('tabPromotions')} (${promos.length})` },
    { key: 'research',   label: `${t('tabResearch')} (${research.length})` },
  ];

  return (
    <>
      <Navbar />
      <main className="admin-main" dir={dir}>
        <div className="filter-tabs" style={{ marginBottom: 16 }}>
          {tabs.map(x => (
            <button key={x.key} className={`filter-tab${tab === x.key ? ' active' : ''}`} onClick={() => setTab(x.key)}>
              {x.label}
            </button>
          ))}
        </div>

        <div className="admin-card">
          {tab === 'promotions' ? (
            <>
              <div style={{ padding: '4px 2px 16px' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-secondary)' }}>{t('promoTitle')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{t('promoSubtitle')}</div>
              </div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1].map(i => <Sk key={i} h={90} r={10} />)}</div>
              ) : promos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 38, marginBottom: 10 }}>📝</div>
                  <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{t('promoEmpty')}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {promos.map(cr => (
                    <div key={cr._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                            {t('target')}: {cr.targetLabel || '—'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            {t('requestedBy')}: {cr.requestedBy?.name || '—'} · {fmt(cr.createdAt)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <button type="button" onClick={() => approvePromo(cr._id)}
                            style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--success-fg)', color: '#fff' }}>
                            {t('approve')}
                          </button>
                          <button type="button" onClick={() => rejectPromo(cr._id)}
                            style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', background: 'var(--surface)', color: 'var(--danger-fg)', border: '1px solid var(--border)' }}>
                            {t('reject')}
                          </button>
                        </div>
                      </div>
                      {/* Field-by-field diff */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '6px 12px', fontSize: 13 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('field')}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('from')}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('to')}</div>
                        {Object.keys(cr.changes || {}).map(k => (
                          <FragmentRow key={k} label={FIELD_LABELS[k] || k} from={showVal(cr.before?.[k])} to={showVal(cr.changes[k])} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ padding: '4px 2px 16px' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--brand-secondary)' }}>{t('researchTitle')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>{t('researchSubtitle')}</div>
              </div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1].map(i => <Sk key={i} h={80} r={10} />)}</div>
              ) : research.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 38, marginBottom: 10 }}>🔬</div>
                  <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{t('researchEmpty')}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {research.map(r => (
                    <div key={r._id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', background: 'var(--surface-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{r.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                            {t('by')}: {r.trainee?.name || '—'}
                            {[r.authors, r.journal].filter(Boolean).length ? ` · ${[r.authors, r.journal].filter(Boolean).join(' · ')}` : ''}
                          </div>
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
                          <button type="button" onClick={() => approveResearch(r._id)}
                            style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, border: 'none', cursor: 'pointer', background: 'var(--accent)', color: '#fff' }}>
                            {t('finalApprove')}
                          </button>
                          <button type="button" onClick={() => rejectResearch(r._id)}
                            style={{ padding: '8px 14px', fontSize: 13, fontWeight: 700, borderRadius: 8, cursor: 'pointer', background: 'var(--surface)', color: 'var(--danger-fg)', border: '1px solid var(--border)' }}>
                            {t('reject')}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <Toast toasts={toasts} />
      </main>
    </>
  );
}

function FragmentRow({ label, from, to }) {
  return (
    <>
      <div style={{ fontWeight: 600, color: 'var(--text-2)' }}>{label}</div>
      <div style={{ color: 'var(--text-muted)' }}>{from}</div>
      <div style={{ color: 'var(--brand-secondary)', fontWeight: 600 }}>{to}</div>
    </>
  );
}
