import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

function safeArr(value) {
  return Array.isArray(value) ? value : [];
}

function unwrapList(res) {
  const data = res?.data?.data || res?.data || [];
  return safeArr(data);
}

function idOf(value) {
  if (!value) return '';
  return (value._id || value).toString();
}

function hospitalIdOf(person) {
  return idOf(person?.hospitalId || person?.hospital);
}

function specialtyName(person) {
  return person?.specialtyId?.name || person?.specialty || 'No specialty';
}

function initialsFor(person) {
  return person?.initials || person?.name?.slice(0, 2)?.toUpperCase() || '?';
}

function PersonList({ title, icon, people, emptyText, meta, kind, onSelect }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 12,
      background: 'var(--surface)',
      overflow: 'hidden',
      minWidth: 0
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 14px',
        background: 'var(--surface-2)',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 17 }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-secondary)' }}>{title}</span>
        </div>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--info-fg)',
          background: 'var(--info-bg)',
          borderRadius: 20,
          padding: '2px 8px',
          flexShrink: 0
        }}>
          {people.length}
        </span>
      </div>

      {people.length === 0 ? (
        <div style={{ padding: '18px 14px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          {emptyText}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {people.map(person => (
            <button
              key={person._id}
              type="button"
              onClick={() => onSelect && onSelect(person)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                width: '100%',
                textAlign: 'start',
                background: 'none',
                border: 'none',
                borderTop: '1px solid var(--border-soft)',
                cursor: 'pointer'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <div style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--info-bg)',
                color: 'var(--info)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0
              }}>
                {initialsFor(person)}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--brand-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {person.name || 'Unnamed'}
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {meta(person)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function HospitalModal({ hospital, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name:        hospital.name        || '',
    city:        hospital.city        || '',
    governorate: hospital.governorate || '',
    address:     hospital.address     || '',
  });
  const [errors, setErrors] = useState({});

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: false })); }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = true;
    setErrors(e);
    return !Object.keys(e).length;
  }

  function handleSave() {
    if (!validate()) return;
    onSave(form);
  }

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div className="admin-modal-title">Edit Hospital</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-form-grid">

            <div className="admin-field full">
              <label>Hospital Name *</label>
              <input
                className={errors.name ? 'invalid' : ''}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Hospital name"
              />
            </div>

            <div className="admin-field">
              <label>City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </div>

            <div className="admin-field">
              <label>Governorate</label>
              <input value={form.governorate} onChange={e => set('governorate', e.target.value)} placeholder="Governorate" />
            </div>

            <div className="admin-field full">
              <label>Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full address" />
            </div>

          </div>
        </div>
        <div className="admin-modal-footer">
          <button className="btn-red" onClick={onClose}>Cancel</button>
          <button className="btn-purple" style={{ marginLeft: 0 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PersonInfoModal({ person, kind, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const specialty = person.specialtyId?.name || person.specialty || '—';
  const hospital  = person.hospitalId?.name || person.hospital?.name || '—';

  const rows = [
    ['Role', kind, true],
    ['Email', person.email || '—', true],
    ['Phone', person.phone],
    ['Specialty', specialty],
    ['Student ID', person.studentId],
    ['Hospital', hospital],
    ['Gender', person.gender],
    ['City', person.city],
  ].filter(([, value, always]) => always || (value && value !== '—'));

  return (
    <div className="admin-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <div className="admin-modal-title">{person.name || 'Unnamed'}</div>
          <button className="admin-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="admin-modal-body">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 14 }}>
            {kind}
          </div>
          {rows.map(([label, value]) => (
            <div className="info-row" key={label}>
              <div className="info-label">{label}</div>
              <div className="info-value">{value}</div>
            </div>
          ))}
        </div>
        <div className="admin-modal-footer">
          <button className="btn-purple" style={{ marginLeft: 0 }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default function SecretaryHospitals() {
  const [hospitals,    setHospitals   ] = useState([]);
  const [supervisors,  setSupervisors ] = useState([]);
  const [trainees,     setTrainees    ] = useState([]);
  const [directors,    setDirectors   ] = useState([]);
  const [loading,      setLoading     ] = useState(true);
  const [editHospital, setEditHospital] = useState(null);
  const [viewPerson,   setViewPerson  ] = useState(null);
  const [saving,       setSaving      ] = useState(false);
  const [toasts,       setToasts      ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    Promise.allSettled([
      api.get('/api/secretary/hospitals'),
      api.get('/api/secretary/supervisors'),
      api.get('/api/secretary/trainees'),
      api.get('/api/secretary/program-directors'),
    ])
      .then(([hospitalRes, supervisorRes, traineeRes, directorRes]) => {
        if (hospitalRes.status === 'fulfilled') {
          setHospitals(unwrapList(hospitalRes.value));
        } else {
          showToast('Failed to load hospital info', 'error');
        }
        if (supervisorRes.status === 'fulfilled') setSupervisors(unwrapList(supervisorRes.value));
        if (traineeRes.status === 'fulfilled') setTrainees(unwrapList(traineeRes.value));
        if (directorRes.status === 'fulfilled') setDirectors(unwrapList(directorRes.value));
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(form) {
    setSaving(true);
    try {
      const res = await api.patch(`/api/secretary/hospitals/${editHospital._id}`, form);
      const updated = res.data?.data || res.data;
      setHospitals(prev => prev.map(h => h._id === editHospital._id ? { ...h, ...updated } : h));
      showToast('Hospital info updated');
      setEditHospital(null);
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card" style={{ padding: '28px 32px' }}>
          <Sk h={20} w={200} r={6} style={{ marginBottom: 24 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 28px' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <Sk h={12} w={80} r={4} style={{ marginBottom: 8 }} />
                <Sk h={16} w={160} r={4} />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginTop: 28 }}>
            {[0, 1, 2].map(i => <Sk key={i} h={150} r={12} />)}
          </div>
        </div>
      </main>
    </>
  );

  if (hospitals.length === 0) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card" style={{ textAlign: 'center', padding: '60px 40px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>No hospital assigned</div>
          <div style={{ fontSize: 13 }}>Contact your DIO to assign a hospital to your account.</div>
        </div>
      </main>
    </>
  );

  return (
    <>
      <Navbar />
      <main className="admin-main">

        {hospitals.map(h => (
          <div key={h._id} className="admin-card" style={{ marginBottom: 20, padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 28, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14, background: 'var(--brand-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <span style={{ fontSize: 26 }}>🏥</span>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-secondary)' }}>{h.name}</div>
                  {(h.city || h.governorate) && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
                      {[h.city, h.governorate].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </div>
              <button className="btn-purple" style={{ marginLeft: 0 }} onClick={() => setEditHospital(h)}>
                Edit Info
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px 28px' }}>
              {[
                ['Hospital Name', h.name        || '—'],
                ['City',          h.city         || '—'],
                ['Governorate',   h.governorate  || '—'],
                ['Address',       h.address      || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{
                    fontSize: 10, color: 'var(--text-muted)', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4
                  }}>{label}</div>
                  <div style={{ fontSize: 14, color: 'var(--brand-secondary)', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                marginBottom: 12
              }}>
                People assigned to this hospital
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 14
              }}>
                <PersonList
                  title="Supervisors"
                  icon="S"
                  kind="Supervisor"
                  people={supervisors.filter(s => hospitalIdOf(s) === idOf(h))}
                  emptyText="No supervisors assigned to this hospital."
                  meta={s => [specialtyName(s), s.email || s.phone].filter(Boolean).join(' · ')}
                  onSelect={p => setViewPerson({ person: p, kind: 'Supervisor' })}
                />
                <PersonList
                  title="Trainees"
                  icon="T"
                  kind="Trainee"
                  people={trainees.filter(t => hospitalIdOf(t) === idOf(h))}
                  emptyText="No trainees assigned to this hospital."
                  meta={t => [t.studentId ? `ID: ${t.studentId}` : '', specialtyName(t), t.email].filter(Boolean).join(' · ')}
                  onSelect={p => setViewPerson({ person: p, kind: 'Trainee' })}
                />
                <PersonList
                  title="Program Directors"
                  icon="PD"
                  kind="Program Director"
                  people={directors.filter(pd => hospitalIdOf(pd) === idOf(h))}
                  emptyText="No program director assigned to this hospital."
                  meta={pd => [specialtyName(pd), pd.email || pd.phone].filter(Boolean).join(' · ')}
                  onSelect={p => setViewPerson({ person: p, kind: 'Program Director' })}
                />
              </div>
            </div>
          </div>
        ))}

        {editHospital && (
          <HospitalModal
            hospital={editHospital}
            onSave={handleSave}
            onClose={() => setEditHospital(null)}
            saving={saving}
          />
        )}

        {viewPerson && (
          <PersonInfoModal
            person={viewPerson.person}
            kind={viewPerson.kind}
            onClose={() => setViewPerson(null)}
          />
        )}

        <Toast toasts={toasts} />
      </main>
    </>
  );
}
