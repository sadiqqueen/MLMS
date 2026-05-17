import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import NotificationPanel from './NotificationPanel';
import ProfileDropdown from './ProfileDropdown';

const STAFF = ['super_admin', 'professor'];

const STAFF_LINKS = [
  { to: '/admin/dashboard',      label: 'Dashboard'     },
  { to: '/admin/users',          label: 'Users'         },
  { to: '/admin/hospitals',      label: 'Hospitals'     },
  { to: '/admin/distributions',  label: 'Distributions' },
  { to: '/admin/students',       label: 'Students'      },
  { to: '/admin/certificates',   label: 'Certificates'  },
];

const ADMIN_LINKS = [
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/doctors',  label: 'Doctors'  },
  { to: '/admin/hospitals', label: 'Hospitals' },
];

const DOCTOR_LINKS = [
  { to: '/doctor/students',    label: 'My Students'  },
  { to: '/doctor/reports',     label: 'Reports'      },
  { to: '/doctor/evaluations', label: 'Evaluations'  },
];

const STUDENT_LINKS = [
  { to: '/reports',  label: 'My reports' },
  { to: '/grades',   label: 'Grades'     },
  { to: '/timeline', label: 'Timeline'   },
];

const DIRECTOR_LINKS = [
  { to: '/director/dashboard',    label: 'Students'      },
  { to: '/director/doctors',      label: 'Doctors'       },
  { to: '/director/certificates', label: 'Certificates'  },
];

const ROLE_HOME = {
  super_admin: '/admin/dashboard',
  admin:       '/admin/students',
  professor:   '/admin/dashboard',
  doctor:      '/doctor/students',
  student:     '/Timeline',
  director:    '/director/dashboard',
};

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Local state — only the Navbar cares about these, so they live here (not in context)
  const [notifications, setNotifications] = useState([]);
  const [showNotif,     setShowNotif    ] = useState(false);
  const [showProfile,   setShowProfile  ] = useState(false);

  // Count unread notifications — this drives the red badge number
  const unreadCount = notifications.filter(n => !n.read).length;

  // useCallback prevents this function from being re-created on every render,
  // which matters because it's used as a useEffect dependency below
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get(`/api/notifications/${user._id}`);
      setNotifications(res.data);
    } catch {
      // silently ignore — notifications failing shouldn't break the whole nav
    }
  }, [user]);

  // Fetch notifications when the Navbar first mounts (and when the user changes)
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Called when user clicks one notification — marks it read locally and on server
  async function handleRead(id) {
    await api.put(`/api/notifications/${id}/read`);
    // Update local state immediately (optimistic update — don't wait for server)
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
  }

  // Called when user clicks "Mark all as read"
  async function handleReadAll() {
    await api.put(`/api/notifications/read-all/${user._id}`);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function toggleNotif() {
    setShowNotif(v => !v);
    setShowProfile(false);   // close profile if open
  }

  function toggleProfile() {
    setShowProfile(v => !v);
    setShowNotif(false);     // close notifications if open
  }

  return (
    <nav className="topnav">

      {/* LOGO */}
      <div className="nav-logo" onClick={() => navigate(ROLE_HOME[user?.role] || '/')} style={{ cursor: 'pointer' }}>
        <img src="/logo.png" alt="MedLearn LMS" className="nav-logo-img" />
      </div>

      {/* PAGE LINKS */}
      {/* NavLink is like <a> but it knows if it's the current page and adds "active" class */}
      <div className="nav-links">
        {(
          user?.role === 'admin'       ? ADMIN_LINKS    :
          STAFF.includes(user?.role)   ? STAFF_LINKS    :
          user?.role === 'doctor'      ? DOCTOR_LINKS   :
          user?.role === 'director'    ? DIRECTOR_LINKS :
                                        STUDENT_LINKS
        ).map(l => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            {l.label}
          </NavLink>
        ))}
      </div>

      {/* BELL + AVATAR */}
      <div className="nav-right">

        {/* BELL BUTTON + PANEL */}
        <div className="bell-wrap">
          <button className="bell-btn" onClick={toggleNotif}>
            <span className="bell">&#128276;</span>
            {unreadCount > 0 && (
              <span className="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
          {showNotif && (
            <NotificationPanel
              notifications={notifications}
              onRead={handleRead}
              onReadAll={handleReadAll}
              onClose={() => setShowNotif(false)}
            />
          )}
        </div>

        {/* AVATAR BUTTON + DROPDOWN */}
        <div className="avatar-wrap">
          <button className="avatar" onClick={toggleProfile}>
            {user?.initials}
          </button>
          {showProfile && (
            <ProfileDropdown onClose={() => setShowProfile(false)} />
          )}
        </div>

      </div>
    </nav>
  );
}
