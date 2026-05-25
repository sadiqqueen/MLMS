import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Toast  from '../components/Toast';
import api    from '../api/axios';
import Sk     from '../components/Skeleton';

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
          <button className="btn-purple" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SecretaryHospitals() {
  const [hospitals,    setHospitals   ] = useState([]);
  const [loading,      setLoading     ] = useState(true);
  const [editHospital, setEditHospital] = useState(null);
  const [saving,       setSaving      ] = useState(false);
  const [toasts,       setToasts      ] = useState([]);

  function showToast(message, type = 'success') {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }

  useEffect(() => {
    api.get('/api/secretary/hospitals')
      .then(r => {
        const data = r.data?.data || r.data || [];
        setHospitals(Array.isArray(data) ? data : [data]);
      })
      .catch(() => showToast('Failed to load hospital info', 'error'))
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
        </div>
      </main>
    </>
  );

  if (hospitals.length === 0) return (
    <>
      <Navbar />
      <main className="admin-main">
        <div className="admin-card" style={{ textAlign: 'center', padding: '60px 40px', color: '#8B8FA8' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#4B5563', marginBottom: 6 }}>No hospital assigned</div>
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
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14, background: '#1B1464',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <span style={{ fontSize: 26 }}>🏥</span>
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1B1464' }}>{h.name}</div>
                  {(h.city || h.governorate) && (
                    <div style={{ fontSize: 13, color: '#8B8FA8', marginTop: 3 }}>
                      {[h.city, h.governorate].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </div>
              <button className="btn-purple" onClick={() => setEditHospital(h)}>
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
                    fontSize: 10, color: '#8B8FA8', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4
                  }}>{label}</div>
                  <div style={{ fontSize: 14, color: '#1B1464', fontWeight: 500 }}>{value}</div>
                </div>
              ))}
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

        {toasts.map(t => <Toast key={t.id} message={t.message} type={t.type} />)}
      </main>
    </>
  );
}
