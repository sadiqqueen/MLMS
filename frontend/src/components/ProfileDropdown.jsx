import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProfileDropdown({ onClose, onProfile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const ref = useRef(null);

  // Same outside-click-to-close pattern as NotificationPanel
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  function handleLogout() {
    logout();             // clears localStorage + state
    navigate('/');        // send to login page
  }

  return (
    <div className="profile-dropdown" ref={ref}>
      {/* Header: avatar + name + email */}
      <div className="pd-header">
        <div className="pd-avatar">{user?.initials}</div>
        {/* The ?. is "optional chaining" — if user is null, don't crash, just show nothing */}
        <div>
          <div className="pd-name">{user?.name}</div>
          <div className="pd-email">{user?.email}</div>
        </div>
      </div>

      <div className="pd-divider" />

      <button
        className="pd-item"
        onClick={() => { if (onProfile) onProfile(); else navigate('/profile'); onClose(); }}
      >
        Profile
      </button>

      <div className="pd-divider" />

      <button className="pd-item pd-logout" onClick={handleLogout}>
        Log out
      </button>
    </div>
  );
}
