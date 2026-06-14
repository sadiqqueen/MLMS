import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import Navbar from '../components/Navbar';
import Sk from '../components/Skeleton';

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
    if (['student', 'trainee'].includes(user.role)) calls.push(api.get(`/api/rotations/current/${user._id}`));
    Promise.all(calls)
      .then(([meRes, rotRes]) => {
        const me = meRes.data?.data || meRes.data;
        setProfile(me);
        setPhotoUrl(me?.photoUrl || null);
        if (rotRes) setCurrentHospital(rotRes.data?.hospital?.name || null);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return (
    <>
      <Navbar />
      <main className="main">
        <div className="card profile-header-card">
          <div className="profile-photo-wrap">
            <Sk w={140} h={140} r={12} />
            <Sk w={120} h={32} r={8} style={{ marginTop: 12 }} />
          </div>
          <div className="profile-info">
            <Sk w={220} h={26} style={{ marginBottom: 16 }} />
            {[0, 1, 2].map(i => (
              <div className="profile-detail" key={i}>
                <Sk w={70}  h={12} />
                <Sk w={180} h={13} style={{ marginTop: 4 }} />
              </div>
            ))}
          </div>
        </div>
        <div className="card profile-body-card">
          <div className="profile-fields">
            <Sk w={180} h={16} style={{ marginBottom: 16 }} />
            <div className="info-grid">
              {[...Array(7)].map((_, i) => (
                <div className="info-row" key={i}>
                  <Sk w={90}  h={12} />
                  <Sk w={150} h={13} style={{ marginTop: 4 }} />
                </div>
              ))}
            </div>
          </div>
          <div className="profile-divider" />
          <div className="profile-pw-section">
            <Sk w={160} h={16} style={{ marginBottom: 16 }} />
            {[0, 1, 2].map(i => (
              <div className="pw-field" key={i} style={{ marginBottom: 14 }}>
                <Sk w={130} h={12} />
                <Sk h={38} r={8} style={{ marginTop: 6 }} />
              </div>
            ))}
            <Sk h={42} r={8} style={{ marginTop: 6 }} />
          </div>
        </div>
      </main>
    </>
  );

  const p = profile || user;
  const isPresident = p?.role === 'president';

  function hospitalName() {
    return p?.hospitalId?.name || p?.hospital?.name || currentHospital || '—';
  }

  function roleLabel(role) {
    if (!role) return '—';
    return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  function roleExtra() {
    if (['doctor', 'supervisor', 'student', 'trainee', 'program_director', 'secretary', 'dio'].includes(p?.role)) {
      return { label: 'Hospital', value: hospitalName() };
    }
    if (['professor', 'president', 'director'].includes(p?.role)) {
      return { label: 'Department', value: p?.department || '—' };
    }
    return { label: 'Role', value: roleLabel(p?.role) };
  }
  const extra = roleExtra();

  const showHospital  = ['doctor', 'supervisor', 'student', 'trainee', 'program_director', 'secretary', 'dio'].includes(p?.role);
  const showSpecialty = ['doctor', 'supervisor', 'student', 'trainee', 'program_director', 'secretary'].includes(p?.role);

  const infoRows = [
    ['Full name',  p?.name],
    ['Email',      p?.email],
    ['Phone',      p?.phone],
    ['ID number',  p?.studentId],
    ...(showHospital  ? [['Hospital',  hospitalName()]] : []),
    ['City',       p?.city || p?.hospital?.city],
    ...(showSpecialty ? [['Specialty', p?.specialtyId?.name || p?.specialty]]   : []),
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
                ? <img src={photoUrl} alt={p?.name} />
                : <span>{p?.initials}</span>}
            </div>
            {!isPresident && (
              <>
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
              </>
            )}
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

          {!isPresident && (
            <>
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
            </>
          )}

        </div>

      </main>
    </>
  );
}
