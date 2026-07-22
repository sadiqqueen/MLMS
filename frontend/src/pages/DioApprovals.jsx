import { useState, useEffect, useCallback } from 'react';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import { useMtToast, MtToastHost } from '../components/MtToast';
import DiffTable from '../components/DiffTable';
import api from '../api/axios';
import Sk from '../components/Skeleton';
import { IconEye, IconInbox, IconBuilding, IconFlask } from '../components/icons';
import './dio.css';

const API_BASE = '';

const STRINGS = {
  ar: {
    tabPromotions: 'تعديلات الحسابات',
    tabCapacity: 'طلبات السعة',
    tabResearch: 'الأبحاث',
    capTitle: 'طلبات تجاوز السعة السنوية',
    capSubtitle: 'طلبات من السكرتارية لإضافة متدرب فوق السعة السنوية. عند الموافقة يُنشأ حساب المتدرب.',
    capEmpty: 'لا توجد طلبات سعة معلّقة.',
    capTrainee: 'المتدرب',
    capHospital: 'المستشفى',
    capSpecialty: 'التخصص',
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
    tabCapacity: 'Capacity Requests',
    tabResearch: 'Research',
    capTitle: 'Annual capacity exception requests',
    capSubtitle: 'Requests from secretaries to add a trainee beyond the annual capacity. Approving creates the trainee account.',
    capEmpty: 'No pending capacity requests.',
    capTrainee: 'Trainee',
    capHospital: 'Hospital',
    capSpecialty: 'Specialty',
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
  const { toasts, showToast } = useMtToast();

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
      showToast(t('approved'), 'ok');
    } catch (err) { showToast(err.response?.data?.message || t('failed'), 'dng'); }
  }
  async function rejectPromo(id) {
    const note = window.prompt(t('rejectReason')) ?? '';
    try {
      await api.patch(`/api/dio/change-requests/${id}/reject`, { note });
      setPromos(prev => prev.filter(x => x._id !== id));
      showToast(t('rejectedMsg'), 'ok');
    } catch (err) { showToast(err.response?.data?.message || t('failed'), 'dng'); }
  }
  async function approveResearch(id) {
    try {
      await api.patch(`/api/research/${id}/final-approve`);
      setResearch(prev => prev.filter(x => x._id !== id));
      showToast(t('published'), 'ok');
    } catch (err) { showToast(err.response?.data?.message || t('failed'), 'dng'); }
  }
  async function rejectResearch(id) {
    const note = window.prompt(t('rejectReason')) ?? '';
    try {
      await api.patch(`/api/research/${id}/reject`, { note });
      setResearch(prev => prev.filter(x => x._id !== id));
      showToast(t('rejectedMsg'), 'ok');
    } catch (err) { showToast(err.response?.data?.message || t('failed'), 'dng'); }
  }

  // One pending feed, two kinds: account edits vs capacity exception requests.
  const accountChanges = promos.filter(x => x.requestType !== 'capacity_exception');
  const capacityReqs   = promos.filter(x => x.requestType === 'capacity_exception');

  const tabs = [
    { key: 'promotions', label: t('tabPromotions'), count: accountChanges.length },
    { key: 'capacity',   label: t('tabCapacity'),   count: capacityReqs.length },
    { key: 'research',   label: t('tabResearch'),   count: research.length },
  ];

  const diffLabels = { field: t('field'), before: t('from'), after: t('to') };

  return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        <div className="dio-tabs">
          {tabs.map(x => (
            <button key={x.key} className={`dio-tab${tab === x.key ? ' is-active' : ''}`} onClick={() => setTab(x.key)}>
              {x.label}
              <span className="dio-tab-badge">{x.count}</span>
            </button>
          ))}
        </div>

        <div className="mt-card">
          {tab === 'promotions' ? (
            <>
              <div className="mt-card-head">
                <div style={{ minWidth: 0 }}>
                  <div className="mt-card-title">{t('promoTitle')}</div>
                  <div className="mt-card-sub">{t('promoSubtitle')}</div>
                </div>
                <div className="mt-divider" />
              </div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1].map(i => <Sk key={i} h={90} r={10} />)}</div>
              ) : accountChanges.length === 0 ? (
                <EmptyState icon={<IconInbox size={22} />} text={t('promoEmpty')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {accountChanges.map(cr => {
                    const rows = (cr.display && cr.display.length
                      ? cr.display.map(d => ({ field: d.label, before: d.from, after: d.to }))
                      : Object.keys(cr.changes || {}).filter(k => k !== 'trainer')
                          .map(k => ({ field: FIELD_LABELS[k] || k, before: showVal(cr.before?.[k]), after: showVal(cr.changes[k]) }))
                    );
                    return (
                      <div key={cr._id} className="mt-card" style={{ background: 'var(--surface-2)' }}>
                        <div className="dio-detail-head" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                              {t('target')}: {cr.targetLabel || '—'}
                            </div>
                            <div className="mt-card-sub" style={{ marginTop: 2 }}>
                              {t('requestedBy')}: {cr.requestedBy?.name || '—'} · {fmt(cr.createdAt)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <button type="button" className="mt-btn mt-btn--small" onClick={() => approvePromo(cr._id)}>{t('approve')}</button>
                            <button type="button" className="mt-btn--danger" onClick={() => rejectPromo(cr._id)}>{t('reject')}</button>
                          </div>
                        </div>
                        {rows.length > 0 && <DiffTable rows={rows} labels={diffLabels} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : tab === 'capacity' ? (
            <>
              <div className="mt-card-head">
                <div style={{ minWidth: 0 }}>
                  <div className="mt-card-title">{t('capTitle')}</div>
                  <div className="mt-card-sub">{t('capSubtitle')}</div>
                </div>
                <div className="mt-divider" />
              </div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1].map(i => <Sk key={i} h={90} r={10} />)}</div>
              ) : capacityReqs.length === 0 ? (
                <EmptyState icon={<IconBuilding size={22} />} text={t('capEmpty')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {capacityReqs.map(cr => {
                    const rows = (cr.display || []).map(d => ({ field: d.label, before: showVal(d.from), after: showVal(d.to) }));
                    return (
                      <div key={cr._id} className="mt-card" style={{ background: 'var(--surface-2)' }}>
                        <div className="dio-detail-head" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                              {t('capTrainee')}: {cr.targetLabel || '—'}
                            </div>
                            <div className="mt-card-sub" style={{ marginTop: 2 }}>
                              {t('requestedBy')}: {cr.requestedBy?.name || '—'} · {fmt(cr.createdAt)}
                            </div>
                            <div className="mt-card-sub" style={{ marginTop: 4 }}>
                              {t('capHospital')}: {cr.hospitalId?.name || '—'} · {t('capSpecialty')}: {cr.specialtyId?.name || '—'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <button type="button" className="mt-btn mt-btn--small" onClick={() => approvePromo(cr._id)}>{t('approve')}</button>
                            <button type="button" className="mt-btn--danger" onClick={() => rejectPromo(cr._id)}>{t('reject')}</button>
                          </div>
                        </div>
                        {rows.length > 0 && <DiffTable rows={rows} labels={diffLabels} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mt-card-head">
                <div style={{ minWidth: 0 }}>
                  <div className="mt-card-title">{t('researchTitle')}</div>
                  <div className="mt-card-sub">{t('researchSubtitle')}</div>
                </div>
                <div className="mt-divider" />
              </div>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[0, 1].map(i => <Sk key={i} h={80} r={10} />)}</div>
              ) : research.length === 0 ? (
                <EmptyState icon={<IconFlask size={22} />} text={t('researchEmpty')} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {research.map(r => (
                    <div key={r._id} className="mt-card" style={{ background: 'var(--surface-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{r.title}</div>
                          <div className="mt-card-sub" style={{ marginTop: 3 }}>
                            {t('by')}: {r.trainee?.name || '—'}
                            {[r.authors, r.journal].filter(Boolean).length ? ` · ${[r.authors, r.journal].filter(Boolean).join(' · ')}` : ''}
                          </div>
                          {r.signedByName && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                              <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', fontSize: 20, color: 'var(--brand-primary)' }}>
                                /s/ {r.signatureName || r.signedByName}
                              </div>
                              <div className="mt-card-sub" style={{ marginTop: 2 }}>
                                {t('signedBy')} {r.signedByName}{r.signedAt ? ` · ${fmt(r.signedAt)}` : ''}
                              </div>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {r.fileUrl && (
                            <a href={`${API_BASE}${r.fileUrl}`} target="_blank" rel="noreferrer" title={t('view')} aria-label={t('view')} className="mt-icon-action">
                              <IconEye size={16} />
                            </a>
                          )}
                          <button type="button" className="mt-btn mt-btn--small" onClick={() => approveResearch(r._id)}>{t('finalApprove')}</button>
                          <button type="button" className="mt-btn--danger" onClick={() => rejectResearch(r._id)}>{t('reject')}</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div className="mt-empty">
      <div className="mt-empty-icon">{icon}</div>
      <div className="mt-empty-sub" style={{ marginTop: 10 }}>{text}</div>
    </div>
  );
}
