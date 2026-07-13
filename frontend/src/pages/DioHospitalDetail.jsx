// frontend/src/pages/DioHospitalDetail.jsx
//
// Full page for a single hospital in the DIO's track: profile, program
// director(s), specialties (each with secretary), supervisors and trainees,
// plus the same management actions as the hospitals list (edit hospital, add
// specialty, add supervisor / program director).
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useBasePath from '../hooks/useBasePath';
import { usePrefs } from '../context/PrefsContext';
import Navbar from '../components/Navbar';
import Toast from '../components/Toast';
import api from '../api/axios';
import Sk from '../components/Skeleton';
import { IconBack, IconPencil, IconPlus } from '../components/icons';
import { HospitalModal, SpecialtyModal, StaffModal, CapacityModal, capT } from './DioHospitals';

function Card({ title, count, action, children }) {
  return (
    <section className="admin-card" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-secondary)' }}>
          {title}{count !== undefined ? <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}> ({count})</span> : null}
        </div>
        {action || null}
      </div>
      {children}
    </section>
  );
}
function Muted({ children }) { return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{children}</div>; }
function AddBtn({ children, onClick }) {
  return (
    <button className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '6px 12px' }} onClick={onClick}>
      <IconPlus size={14} /> {children}
    </button>
  );
}

export default function DioHospitalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const bp = useBasePath();
  const { lang } = usePrefs();
  const ct = k => capT(lang, k);

  const [data, setData] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [capMap, setCapMap] = useState({}); // specialtyId → capacity entry
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { type, role?, specialty? }
  const [toasts, setToasts] = useState([]);

  function showToast(message, type = 'success') {
    const tid = Date.now();
    setToasts(p => [...p, { id: tid, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== tid)), 3200);
  }

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
      const [dRes, sRes] = await Promise.allSettled([
        api.get(`/api/dio/hospitals/${id}`),
        api.get('/api/specialties'),
      ]);
      if (dRes.status === 'fulfilled') setData(dRes.value.data?.data || dRes.value.data);
      else setError(dRes.reason?.response?.data?.message || 'Failed to load hospital');
      if (sRes.status === 'fulfilled') setSpecialties(sRes.value.data?.data || sRes.value.data || []);
      loadCapacity();
    } finally {
      setLoading(false);
    }
  }, [id, loadCapacity]);

  useEffect(() => { load(); }, [load]);

  function onSaved(message) { showToast(message); load(); }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <Sk h={40} r={10} style={{ marginBottom: 18 }} />
        <div className="admin-card" style={{ padding: 18, marginBottom: 16 }}><Sk h={80} r={8} /></div>
        {[0, 1].map(i => <div key={i} className="admin-card" style={{ padding: 18, marginBottom: 16 }}><Sk w="30%" h={16} style={{ marginBottom: 12 }} /><Sk h={60} r={8} /></div>)}
      </main>
    </>
  );

  if (error || !data) return (
    <>
      <Navbar />
      <main className="admin-main">
        <button className="btn-outline" onClick={() => navigate(bp + '/dio/hospitals')} style={{ marginBottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconBack size={15} /> Back</button>
        <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-fg)', borderRadius: 12, padding: 18 }}>{error || 'Hospital not found'}</div>
      </main>
    </>
  );

  const location = [data.city, data.governorate].filter(Boolean).join(' · ') || '—';

  return (
    <>
      <Navbar />
      <main className="admin-main">

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => navigate(bp + '/dio/hospitals')}><IconBack size={15} /> Back</button>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--brand-secondary)' }}>🏥 {data.name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{location}</div>
            </div>
          </div>
          <button className="btn-action edit" title="Edit hospital" aria-label="Edit hospital" onClick={() => setModal({ type: 'hospital' })}><IconPencil /></button>
        </div>

        {/* Info + quick actions */}
        <div className="admin-card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px 18px', marginBottom: 16 }}>
            {[
              ['Address', data.address], ['Phone', data.phone], ['Email', data.email],
              ['City', data.city], ['Governorate', data.governorate],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, color: 'var(--brand-secondary)', fontWeight: 600 }}>{value || '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, borderTop: '1px solid var(--border-soft, #F0F0F0)', paddingTop: 14 }}>
            <AddBtn onClick={() => setModal({ type: 'specialty' })}>Specialty</AddBtn>
            <AddBtn onClick={() => setModal({ type: 'staff', role: 'supervisor' })}>Supervisor</AddBtn>
            <AddBtn onClick={() => setModal({ type: 'staff', role: 'program_director' })}>Program Director</AddBtn>
          </div>
        </div>

        {/* Program directors */}
        <Card title="Program Directors" count={data.programDirectors.length}>
          {data.programDirectors.length === 0 ? <Muted>Not assigned</Muted> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.programDirectors.map(pd => (
                <div key={pd._id} style={{ fontSize: 14, fontWeight: 600, color: 'var(--brand-secondary)' }}>
                  ⭐ {pd.name}{pd.department ? <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}> · {pd.department}</span> : null}
                  {pd.email ? <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400 }}> · {pd.email}</span> : null}
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
                <div key={sp._id || sp.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '9px 12px', border: '1px solid var(--border-soft, #F0F0F0)', borderRadius: 8, background: 'var(--surface-2, #FAFAFC)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: 'var(--chip-spec-bg)', color: 'var(--chip-spec-fg)' }}>{sp.name}</span>
                  <span style={{ fontSize: 12, color: sp.secretary ? 'var(--text-2)' : 'var(--text-muted)' }}>{sp.secretary ? `📋 ${sp.secretary.name}` : 'No secretary'}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Annual capacity + training duration per specialty (DIO-controlled) */}
        <Card title={ct('capacityTitle')} count={data.specialties.length}>
          {data.specialties.length === 0 ? <Muted>No specialties yet</Muted> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{ct('specialty')}</th>
                    <th>{ct('annualCapacity')}</th>
                    <th>{ct('trainingDuration')}</th>
                    <th>{ct('thisYear')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.specialties.map(sp => {
                    const entry = sp._id ? capMap[sp._id.toString()] : null;
                    const capSet = entry != null && entry.annualCapacity != null;
                    const durSet = entry != null && entry.trainingDurationMonths != null;
                    return (
                      <tr key={sp._id || sp.name}>
                        <td>
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: 'var(--chip-spec-bg)', color: 'var(--chip-spec-fg)' }}>{sp.name}</span>
                        </td>
                        <td style={{ fontSize: 13, color: capSet ? 'var(--brand-secondary)' : 'var(--text-muted)', fontWeight: capSet ? 700 : 400 }}>
                          {capSet ? entry.annualCapacity : ct('notSet')}
                        </td>
                        <td style={{ fontSize: 13, color: durSet ? 'var(--brand-secondary)' : 'var(--text-muted)', fontWeight: durSet ? 700 : 400 }}>
                          {durSet ? `${entry.trainingDurationMonths} ${ct('months')}` : ct('notSet')}
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-2)' }}>
                          {capSet && entry.used != null ? (
                            <>
                              {entry.used} / {entry.annualCapacity} {ct('traineesThisYear')}
                              {entry.exceptionsUsed > 0 && (
                                <span style={{ fontSize: 11, color: 'var(--warning-fg)' }}> · +{entry.exceptionsUsed} {ct('exceptions')}</span>
                              )}
                            </>
                          ) : '—'}
                        </td>
                        <td>
                          {sp._id && (
                            <button className="btn-action edit" title={ct('editCapacity')} aria-label={`${ct('editCapacity')} · ${sp.name}`}
                              onClick={() => setModal({ type: 'capacity', specialty: sp })}>
                              <IconPencil size={14} />
                            </button>
                          )}
                        </td>
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
                <span key={s._id} title={s.email || ''} style={{ fontSize: 12, fontWeight: 500, padding: '5px 11px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                  {s.name}{s.specialty ? <span style={{ color: 'var(--text-muted)' }}> · {s.specialty}</span> : null}
                </span>
              ))}
            </div>
          )}
        </Card>

        {/* Trainees */}
        <Card title="Trainees" count={data.trainees.length}>
          {data.trainees.length === 0 ? <Muted>None assigned</Muted> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>#</th><th>Trainee</th><th>Student ID</th><th>Specialty</th><th>Supervisor</th></tr></thead>
                <tbody>
                  {data.trainees.map((t, i) => (
                    <tr key={t._id}>
                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td><strong>{t.name}</strong>{t.year ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> · Year {t.year}</span> : null}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{t.studentId || '—'}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: 'var(--chip-spec-bg)', color: 'var(--chip-spec-fg)' }}>{t.specialty || '—'}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{t.supervisor || '—'}</td>
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
          <CapacityModal hospital={data} specialty={modal.specialty}
            entry={capMap[modal.specialty._id?.toString()]}
            onClose={() => setModal(null)}
            onSaved={msg => { showToast(msg); loadCapacity(); }} />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
