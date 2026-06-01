import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import NotificationPanel from './NotificationPanel';
import ProfileDropdown from './ProfileDropdown';

const ROLE_LINKS = {
  super_admin: [
    { to: '/admin/dashboard',    label: 'Dashboard'    },
    { to: '/admin/users',        label: 'Users'        },
    { to: '/admin/hospitals',    label: 'Hospitals'    },
    { to: '/admin/specialties',  label: 'Specialties'  },
    { to: '/admin/certificates', label: 'Certificates' },
    { to: '/admin/audit-log',    label: 'Audit Log'    },
  ],
  secretary: [
    { to: '/secretary/trainees',          label: 'Trainees'         },
    { to: '/secretary/supervisors',       label: 'Supervisors'      },
    { to: '/secretary/program-directors', label: 'Program Directors'},
    { to: '/secretary/hospitals',         label: 'Hospitals'        },
  ],
  dio: [
    { to: '/dio/dashboard',         label: 'Dashboard'        },
    { to: '/dio/trainees',          label: 'Trainees'         },
    { to: '/dio/supervisors',       label: 'Supervisors'      },
    { to: '/dio/program-directors', label: 'Program Directors'},
    { to: '/dio/secretaries',       label: 'Secretaries'      },
    { to: '/dio/certificates',      label: 'Certificates'     },
  ],
  supervisor: [
    { to: '/supervisor/trainees',    label: 'My Trainees' },
    { to: '/supervisor/reports',     label: 'Reports'     },
    { to: '/supervisor/evaluations', label: 'Evaluations' },
  ],
  doctor: [
    { to: '/supervisor/trainees',    label: 'My Trainees' },
    { to: '/supervisor/reports',     label: 'Reports'     },
    { to: '/supervisor/evaluations', label: 'Evaluations' },
  ],
  trainee: [
    { to: '/timeline', label: 'Timeline' },
    { to: '/reports',  label: 'Reports'  },
    { to: '/grades',   label: 'Grades'   },
  ],
  president: [
    { to: '/president/trainees',          label: 'Trainees'         },
    { to: '/president/supervisors',       label: 'Supervisors'      },
    { to: '/president/program-directors', label: 'Program Directors'},
    { to: '/president/secretaries',       label: 'Secretaries'      },
  ],
  program_director: [
    { to: '/program-director/trainees',    label: 'Trainees'   },
    { to: '/program-director/supervisors', label: 'Supervisors'},
    { to: '/program-director/reports',     label: 'Reports'    },
  ],
};

const ROLE_HOME = {
  super_admin:      '/admin/dashboard',
  secretary:        '/secretary/trainees',
  dio:              '/dio/dashboard',
  supervisor:       '/supervisor/trainees',
  doctor:           '/supervisor/trainees',
  trainee:          '/timeline',
  president:        '/president/trainees',
  program_director: '/program-director/trainees',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState([]);
  const [showNotif,     setShowNotif    ] = useState(false);
  const [showProfile,   setShowProfile  ] = useState(false);
  const [menuOpen,      setMenuOpen     ] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const isLanding   = location.pathname === '/' || location.pathname === '/index.html';
  const navbarClass = isLanding ? 'topnav' : 'topnav topnav-white';

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get(`/api/notifications/${user._id}`);
      setNotifications(res.data);
    } catch {}
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function handleRead(id) {
    await api.put(`/api/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
  }

  async function handleReadAll() {
    await api.put(`/api/notifications/read-all/${user._id}`);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function toggleNotif()   { setShowNotif(v => !v);   setShowProfile(false); setMenuOpen(false); }
  function toggleProfile() { setShowProfile(v => !v); setShowNotif(false);   setMenuOpen(false); }

  const links = user ? (ROLE_LINKS[user.role] || []) : [];

  return (
    <nav className={navbarClass}>

      {/* LOGO */}
      <div
        className="nav-logo"
        onClick={() => navigate(ROLE_HOME[user?.role] || '/')}
        style={{ cursor: 'pointer' }}
      >
        <img src="/logo.png" alt="MTMS" className="nav-logo-img" />
      </div>

      {/* PAGE LINKS — desktop */}
      <div className="nav-links">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            {l.label}
          </NavLink>
        ))}
      </div>

      {/* HAMBURGER — mobile */}
      <button
        className="hamburger-btn"
        onClick={() => setMenuOpen(v => !v)}
        aria-label="Toggle menu"
      >
        &#9776;
      </button>

      {/* BELL + AVATAR */}
      <div className="nav-right">
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

        <div className="avatar-wrap">
          <button className="avatar" onClick={toggleProfile}>
            {user?.initials}
          </button>
          {showProfile && (
            <ProfileDropdown onClose={() => setShowProfile(false)} />
          )}
        </div>
      </div>

      {/* MOBILE DROPDOWN */}
      {menuOpen && (
        <div className="mobile-menu">
          {links.map(l => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}
