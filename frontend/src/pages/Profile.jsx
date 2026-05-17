import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile]               = useState(null);
  const [currentHospital, setCurrentHospital] = useState(null);
  const [loading, setLoading]               = useState(true);

  const fileInputRef = useRef(null);
  const [photoUrl,  setPhotoUrl]  = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [pwForm, setPwForm]   = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwOk,    setPwOk]    = useState('');
  const [pwBusy,  setPwBusy]  = useState(false);

  useEffect(() => {
    if (!user) return;
    const calls = [api.get('/api/auth/me')];
    if (user.role === 'student') calls.push(api.get(`/api/rotations/current/${user._id}`));
    Promise.all(calls)
      .then(([meRes, rotRes]) => {
        setProfile(meRes.data);
        setPhotoUrl(meRes.data?.photoUrl || null);
        if (rotRes) setCurrentHospital(rotRes.data?.hospital?.name || null);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <><Navbar /><div className="main"><div className="loading">Loading…</div></div></>;

  const p = profile || user;

  function hospitalName() {
    if (p?.role === 'doctor')  return p.hospital?.name || '—';
    if (p?.role === 'student') return currentHospital  || '—';
    return p?.hospital?.name || '—';
  }

  function roleLabel(role) {
    if (!role) return '—';
    return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function roleExtra() {
    if (p?.role === 'doctor')    return { label: 'Hospital',   value: hospitalName() };
    if (p?.role === 'student')   return { label: 'Hospital',   value: hospitalName() };
    if (p?.role === 'professor') return { label: 'Department', value: p?.department || '—' };
    return { label: 'Role', value: roleLabel(p?.role) };
  }
  const extra = roleExtra();

  const showHospital  = ['doctor', 'student'].includes(p?.role);
  const showSpecialty = ['doctor', 'student'].includes(p?.role);

  const infoRows = [
    ['Full name',  p?.name],
    ['Email',      p?.email],
    ['Phone',      p?.phone],
    ['ID number',  p?.studentId],
    ...(showHospital  ? [['Hospital',  hospitalName()]] : []),
    ['City',       p?.city || p?.hospital?.city],
    ...(showSpecialty ? [['Specialty', p?.specialty]]   : []),
    ['Role',       roleLabel(p?.role)],
  ];

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('photo', file);
    setPhotoUploading(true);
    try {
      const res = await api.put('/api/auth/upload-photo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPhotoUrl(res.data.photoUrl);
    } catch {
      // silent — user can retry
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError(''); setPwOk('');
    if (pwForm.next !== pwForm.confirm) {
      setPwError('New password and confirm password do not match.');
      return;
    }
    if (pwForm.next.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    setPwBusy(true);
    try {
      await api.put('/api/auth/change-password', {
        currentPassword: pwForm.current,
        newPassword:     pwForm.next,
      });
      setPwOk('Password updated successfully.');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setPwError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setPwBusy(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="main">

        {/* ── HEADER CARD ── */}
        <div className="card profile-header-card">
          <div className="profile-photo-wrap">
            <div className="profile-photo-square">
              {photoUrl
                ? <img src={`http://https://mlms-production.up.railway.app${photoUrl}`} alt={p?.name} />
                : <span>{p?.initials}</span>}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handlePhotoChange}
            />
            <button
              className="profile-photo-btn"
              onClick={() => !photoUploading && fileInputRef.current?.click()}
              disabled={photoUploading}
            >
              {photoUploading ? 'Uploading…' : 'Change photo'}
            </button>
          </div>
          <div className="profile-info">
            <div className="profile-name">{p?.name}</div>
            <div className="profile-detail">
              <span className="profile-detail-label">Email</span>
              <span>{p?.email || '—'}</span>
            </div>
            <div className="profile-detail">
              <span className="profile-detail-label">Phone</span>
              <span>{p?.phone || '—'}</span>
            </div>
            <div className="profile-detail">
              <span className="profile-detail-label">{extra.label}</span>
              <span>{extra.value}</span>
            </div>
          </div>
        </div>

        {/* ── INFO + CHANGE PASSWORD CARD ── */}
        <div className="card profile-body-card">

          {/* LEFT — info fields */}
          <div className="profile-fields">
            <div className="card-title">Personal information</div>
            <div className="info-grid">
              {infoRows.map(([label, value]) => (
                <div className="info-row" key={label}>
                  <span className="info-label">{label}</span>
                  <span className="info-value">{value || '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* DIVIDER */}
          <div className="profile-divider" />

          {/* RIGHT — change password */}
          <div className="profile-pw-section">
            <div className="card-title">Change password</div>
            <form className="profile-pw-form" onSubmit={handleChangePassword}>
              <div className="pw-field">
                <label className="pw-label">Current password</label>
                <input
                  type="password"
                  className="pw-input"
                  value={pwForm.current}
                  onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                  placeholder="Enter current password"
                  required
                />
              </div>
              <div className="pw-field">
                <label className="pw-label">New password</label>
                <input
                  type="password"
                  className="pw-input"
                  value={pwForm.next}
                  onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                  placeholder="Enter new password"
                  required
                />
              </div>
              <div className="pw-field">
                <label className="pw-label">Confirm password</label>
                <input
                  type="password"
                  className={`pw-input${pwForm.confirm && pwForm.next !== pwForm.confirm ? ' pw-input-err' : ''}`}
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Re-enter new password"
                  required
                />
                {pwForm.confirm && pwForm.next !== pwForm.confirm && (
                  <span className="pw-hint-err">Passwords do not match</span>
                )}
              </div>

              {pwError && <div className="pw-msg pw-msg-err">{pwError}</div>}
              {pwOk    && <div className="pw-msg pw-msg-ok">{pwOk}</div>}

              <button
                type="submit"
                className="btn-purple pw-submit"
                disabled={pwBusy || (pwForm.confirm && pwForm.next !== pwForm.confirm)}
              >
                {pwBusy ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </div>

        </div>

      </main>
    </>
  );
}
