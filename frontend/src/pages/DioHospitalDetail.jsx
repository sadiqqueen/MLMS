// frontend/src/pages/DioHospitalDetail.jsx
//
// Full page for a single hospital in the ODIO's track: profile, program
// director(s), specialties (each with secretary), supervisors and trainees,
// plus the same management actions as the hospitals list (edit hospital, add
// specialty, add supervisor / program director). mt- restyle (dashboards.md
// §4.7 · lists_views drill-down). Endpoints + modals are unchanged — the shared
// modal set is imported from DioHospitals (already mt-styled).
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useBasePath from '../hooks/useBasePath';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import { useMtToast, MtToastHost } from '../components/MtToast';
import RevealOnScroll from '../components/RevealOnScroll';
import api from '../api/axios';
import Sk from '../components/Skeleton';
import { IconBack, IconPencil, IconPlus } from '../components/icons';
import { HospitalModal, SpecialtyModal, StaffModal, HospitalCapacityModal, capT } from './DioHospitals';
import './dio.css';

// Section card with a title, optional count and an optional inline-end action.
function Card({ title, count, action, children }) {
  return (
    <section className="mt-card dio-section">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBlockEnd: 12 }}>
        <div className="mt-card-title">
          {title}{count !== undefined ? <span style={{ color: 'var(--text-2)', fontWeight: 600 }}> ({count})</span> : null}
        </div>
        <div style={{ flex: 1 }} />
        {action || null}
      </div>
      {children}
    </section>
  );
}
function Muted({ children }) { return <div className="mt-card-sub">{children}</div>; }
function AddBtn({ children, onClick }) {
  return (
    <button className="mt-btn--small-outline" onClick={onClick}>
      <IconPlus size={14} /> {children}
    </button>
  );
}

export default function DioHospitalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const bp = useBasePath();
  const { lang } = usePrefs();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const ct = k => capT(lang, k);

  const [data, setData] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [secretaries, setSecretaries] = useState([]); // for the capacity panel's secretary dropdown
  const [capMap, setCapMap] = useState({}); // specialtyId → capacity entry
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { type, role?, specialty? }
  const { toasts, showToast } = useMtToast();

  const loadCapacity = useCallback(async () => {
    try {
      const res = await api.get(`/api/dio/hospitals/${id}/capacity`);
      const specs = res.data?.data?.specialties || [];
      setCapMap(Object.fromEntries(specs.map(s => [(s.specialtyId?._id || s.specialtyId || '').toString(), s])));
    } catch { /* capacity is optional info — keep "Not set" fallback */ }
  }, [id]);

  const load = useCallback(async () => {
    setError('');
    try {
      const [dRes, sRes, secRes] = await Promise.allSettled([
        api.get(`/api/dio/hospitals/${id}`),
        api.get('/api/specialties'),
        api.get('/api/dio/secretaries'),
      ]);
      if (dRes.status === 'fulfilled') setData(dRes.value.data?.data || dRes.value.data);
      else setError(dRes.reason?.response?.data?.message || 'Failed to load hospital');
      if (sRes.status === 'fulfilled') setSpecialties(sRes.value.data?.data || sRes.value.data || []);
      if (secRes.status === 'fulfilled') setSecretaries(secRes.value.data?.data || secRes.value.data || []);
      loadCapacity();
    } finally {
      setLoading(false);
    }
  }, [id, loadCapacity]);

  useEffect(() => { load(); }, [load]);

  function onSaved(message) { showToast(message, 'ok'); load(); }

  if (loading) return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        <Sk h={40} r={10} style={{ marginBottom: 18 }} />
        <div className="mt-card dio-section" style={{ marginBlockStart: 0 }}><Sk h={80} r={8} /></div>
        {[0, 1].map(i => (
          <div key={i} className="mt-card dio-section">
            <Sk w="30%" h={16} style={{ marginBottom: 12 }} /><Sk h={60} r={8} />
          </div>
        ))}
      </main>
    </>
  );

  if (error || !data) return (
    <>
      <Navbar />
      <main className="mt-content" dir={dir}>
        <button className="mt-btn--small-outline" onClick={() => navigate(bp + '/dio/hospitals')} style={{ marginBlockEnd: 16 }}>
          <IconBack size={15} /> Back
        </button>
        <div className="mt-banner" style={{ background: 'var(--danger-bg)', borderInlineStartColor: 'var(--danger)', color: 'var(--danger)' }}>
          {error || 'Hospital not found'}
        </div>
        <MtToastHost toasts={toasts} />
      </main>
    </>
  );

  const location = [data.city, data.governorate].filter(Boolean).join(' · ') || '—';

  return (
    <>
      <Navbar title={data.name} />
      <main className="mt-content" dir={dir}>

        {/* Header */}
        <div className="dio-page-head" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button className="mt-btn--small-outline" onClick={() => navigate(bp + '/dio/hospitals')}>
              <IconBack size={15} /> Back
            </button>
            <div style={{ minWidth: 0 }}>
              <div className="dio-detail-name">{data.name}</div>
              <div className="dio-detail-sub">{location}</div>
            </div>
          </div>
          <button className="mt-icon-action" title="Edit hospital" aria-label="Edit hospital" onClick={() => setModal({ type: 'hospital' })}>
            <IconPencil size={15} />
          </button>
        </div>

        {/* Info + quick actions */}
        <RevealOnScroll className="mt-card dio-section" style={{ marginBlockStart: 0 }}>
          <div className="dio-kv-grid">
            {[
              ['Address', data.address], ['Phone', data.phone], ['Email', data.email],
              ['City', data.city], ['Governorate', data.governorate],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="mt-acct-k">{label}</div>
                <div className="mt-acct-v">{value || '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, borderBlockStart: '1px solid var(--border)', paddingBlockStart: 14, marginBlockStart: 16 }}>
            <AddBtn onClick={() => setModal({ type: 'specialty' })}>Specialty</AddBtn>
            <AddBtn onClick={() => setModal({ type: 'staff', role: 'supervisor' })}>Supervisor</AddBtn>
            <AddBtn onClick={() => setModal({ type: 'staff', role: 'program_director' })}>Program Director</AddBtn>
          </div>
        </RevealOnScroll>

        {/* Program directors */}
        <Card title="Program Directors" count={data.programDirectors.length}>
          {data.programDirectors.length === 0 ? <Muted>Not assigned</Muted> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.programDirectors.map(pd => (
                <div key={pd._id} style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                  {pd.name}
                  {pd.department ? <span className="mt-card-sub"> · {pd.department}</span> : null}
                  {pd.email ? <span className="mt-card-sub"> · {pd.email}</span> : null}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Specialties + secretaries */}
        <Card title="Specialties" count={data.specialties.length} action={<AddBtn onClick={() => setModal({ type: 'specialty' })}>Specialty</AddBtn>}>
          {data.specialties.length === 0 ? <Muted>No specialties yet</Muted> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
              {data.specialties.map(sp => (
                <div key={sp._id || sp.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2)' }}>
                  <span className="mt-pill mt-pill--role">{sp.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{sp.secretary ? sp.secretary.name : 'No secretary'}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Annual capacity + training duration + secretary per specialty (ODIO-controlled) */}
        <Card title={ct('capacityTitle')} count={data.specialties.length}
          action={data.specialties.some(sp => sp._id) ? (
            <button className="mt-btn--small-outline" onClick={() => setModal({ type: 'capacity' })}>
              <IconPencil size={13} /> {ct('editCapacity')}
            </button>
          ) : null}>
          {data.specialties.length === 0 ? <Muted>No specialties yet</Muted> : (
            <div className="mt-table-wrap">
              <table className="mt-table">
                <thead>
                  <tr>
                    <th className="mt-th">{ct('specialty')}</th>
                    <th className="mt-th">{ct('annualCapacity')}</th>
                    <th className="mt-th">{ct('trainingDuration')}</th>
                    <th className="mt-th">{ct('thisYear')}</th>
                    <th className="mt-th">{ct('secretary')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.specialties.map(sp => {
                    const entry = sp._id ? capMap[sp._id.toString()] : null;
                    const capSet = entry != null && entry.annualCapacity != null;
                    const durSet = entry != null && entry.trainingDurationYears != null;
                    return (
                      <tr key={sp._id || sp.name}>
                        <td className="mt-td"><span className="mt-pill mt-pill--role">{sp.name}</span></td>
                        <td className="mt-td" style={{ color: capSet ? 'var(--text)' : 'var(--text-2)', fontWeight: capSet ? 700 : 400 }}>
                          {capSet ? entry.annualCapacity : ct('notSet')}
                        </td>
                        <td className="mt-td" style={{ color: durSet ? 'var(--text)' : 'var(--text-2)', fontWeight: durSet ? 700 : 400 }}>
                          {durSet ? `${entry.trainingDurationYears} ${ct('years')}` : ct('notSet')}
                        </td>
                        <td className="mt-td mt-td--muted">
                          {capSet && entry.used != null ? (
                            <>
                              {entry.used} / {entry.annualCapacity} {ct('traineesThisYear')}
                              {entry.exceptionsUsed > 0 && (
                                <span style={{ color: 'var(--warning-fg)' }}> · +{entry.exceptionsUsed} {ct('exceptions')}</span>
                              )}
                            </>
                          ) : '—'}
                        </td>
                        <td className="mt-td mt-td--muted">{sp.secretary ? sp.secretary.name : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Supervisors */}
        <Card title="Supervisors" count={data.supervisors.length} action={<AddBtn onClick={() => setModal({ type: 'staff', role: 'supervisor' })}>Supervisor</AddBtn>}>
          {data.supervisors.length === 0 ? <Muted>None assigned</Muted> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.supervisors.map(s => (
                <span key={s._id} title={s.email || ''} className="mt-pill mt-pill--neutral">
                  {s.name}{s.specialty ? <span style={{ color: 'var(--text-2)' }}> · {s.specialty}</span> : null}
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Trainees */}
        <Card title="Trainees" count={data.trainees.length}>
          {data.trainees.length === 0 ? <Muted>None assigned</Muted> : (
            <div className="mt-table-wrap">
              <table className="mt-table">
                <thead><tr>
                  <th className="mt-th">#</th><th className="mt-th">Trainee</th><th className="mt-th">Student ID</th><th className="mt-th">Specialty</th><th className="mt-th">Supervisor</th>
                </tr></thead>
                <tbody>
                  {data.trainees.map((t, i) => (
                    <tr key={t._id}>
                      <td className="mt-td mt-td--muted">{i + 1}</td>
                      <td className="mt-td mt-td--name">{t.name}{t.year ? <span className="mt-card-sub"> · Year {t.year}</span> : null}</td>
                      <td className="mt-td mt-td--mono">{t.studentId || '—'}</td>
                      <td className="mt-td"><span className="mt-pill mt-pill--role">{t.specialty || '—'}</span></td>
                      <td className="mt-td mt-td--muted">{t.supervisor || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Modals */}
        {modal?.type === 'hospital' && (
          <HospitalModal hospital={data} onClose={() => setModal(null)} onSaved={onSaved} />
        )}
        {modal?.type === 'specialty' && (
          <SpecialtyModal hospital={data} onClose={() => setModal(null)} onSaved={onSaved} />
        )}
        {modal?.type === 'staff' && (
          <StaffModal role={modal.role} hospital={data} specialties={specialties} onClose={() => setModal(null)} onSaved={onSaved} />
        )}
        {modal?.type === 'capacity' && (
          <HospitalCapacityModal hospital={data} specialties={data.specialties}
            caps={capMap} secretaries={secretaries}
            onClose={() => setModal(null)}
            onSaved={msg => { showToast(msg, 'ok'); load(); }}
            onReload={() => load()} />
        )}

        <MtToastHost toasts={toasts} />
      </main>
    </>
  );
}
