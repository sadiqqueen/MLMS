import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { IconSun, IconMoon } from './icons';
import api from '../api/axios';
import NotificationPanel from './NotificationPanel';
import ProfileDropdown from './ProfileDropdown';
import { APP_NAV_LABEL } from './memo/MemoPrefs';

// Each link carries a stable `key` so the visible label resolves through the
// shared dictionary as t("nav.<role>.<key>"). Routes/paths stay unchanged.
// ASG.1 / ASG.2 keep a dynamic consultant-memo label (no key → handled below).
const ROLE_LINKS = {
  super_admin: [
    { to: '/admin/dashboard',    key: 'dashboard',    label: 'Dashboard'    },
    { to: '/admin/users',        key: 'users',        label: 'Users'        },
    { to: '/admin/hospitals',    key: 'hospitals',    label: 'Hospitals'    },
    { to: '/admin/specialties',  key: 'specialties',  label: 'Specialties'  },
    { to: '/admin/certificates', key: 'certificates', label: 'Certificates' },
    { to: '/admin/audit-log',    key: 'audit_log',    label: 'Audit Log'    },
  ],
  secretary: [
    { to: '/secretary/trainees',          key: 'trainees',          label: 'Trainees'         },
    { to: '/secretary/supervisors',       key: 'supervisors',       label: 'Supervisors'      },
    { to: '/secretary/program-directors', key: 'program_directors', label: 'Program Directors'},
    { to: '/secretary/hospitals',         key: 'hospitals',         label: 'Hospitals'        },
  ],
  dio: [
    { to: '/dio/dashboard',         key: 'dashboard',         label: 'Dashboard'     },
    { to: '/dio/trainees',          key: 'trainees',          label: 'Trainees'      },
    { to: '/dio/supervisors',       key: 'supervisors',       label: 'Supervisors'   },
    { to: '/dio/program-directors', key: 'program_directors', label: 'Prog.Directors'},
    { to: '/dio/secretaries',       key: 'secretaries',       label: 'Secretaries'   },
    { to: '/dio/distributions',     key: 'distributions',     label: 'Sup.Dist.'    },
    { to: '/dio/rotations',         key: 'rotations',         label: 'Rotations'    },
    { to: '/dio/certificates',      key: 'certificates',      label: 'Certificates'  },
  ],
  // ASG.1 / ASG.2 — consultant-memo is their only function
  asg1: [
    { to: '/consultant-memo', label: 'مذكرة الاستشاري' },
  ],
  asg2: [
    { to: '/consultant-memo', label: 'مذكرة الاستشاري' },
  ],
  supervisor: [
    { to: '/supervisor/trainees',    key: 'trainees',    label: 'My Trainees' },
    { to: '/supervisor/reports',     key: 'reports',     label: 'Reports'     },
    { to: '/supervisor/evaluations', key: 'evaluations', label: 'Evaluations' },
  ],
  trainee: [
    { to: '/timeline', key: 'timeline', label: 'Timeline' },
    { to: '/reports',  key: 'reports',  label: 'Reports'  },
    { to: '/grades',   key: 'grades',   label: 'Grades'   },
  ],
  president: [
    { to: '/president/trainees',          key: 'trainees',          label: 'Trainees'        },
    { to: '/president/supervisors',       key: 'supervisors',       label: 'Supervisors'     },
    { to: '/president/program-directors', key: 'program_directors', label: 'Prog.Directors'  },
    { to: '/president/dios',             key: 'dios',              label: 'DIOs'            },
    { to: '/president/secretaries',       key: 'secretaries',       label: 'Secretaries'     },
    { to: '/president/hospitals',         key: 'hospitals',         label: 'Hospitals'       },
  ],
  program_director: [
    { to: '/program-director/trainees',    key: 'trainees',    label: 'Trainees'   },
    { to: '/program-director/supervisors', key: 'supervisors', label: 'Supervisors'},
    { to: '/program-director/reports',     key: 'reports',     label: 'Reports'    },
  ],
};

// Mirrors .bell-btn sizing so theme/lang toggles sit flush with bell + avatar.
// Inherits navbar text color (currentColor) on both the white and navy navbars.
const toggleBtnStyle = {
  background: 'none',
  border: 'none',
  width: 34,
  height: 34,
  borderRadius: 8,
  color: 'inherit',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  padding: 0,
};

const ROLE_HOME = {
  super_admin:      '/admin/dashboard',
  secretary:        '/secretary/trainees',
  dio:              '/dio/dashboard',
  supervisor:       '/supervisor/trainees',
  trainee:          '/timeline',
  president:        '/president/trainees',
  program_director: '/program-director/trainees',
  asg1:             '/consultant-memo',
  asg2:             '/consultant-memo',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, lang, toggleLang, t } = usePrefs();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState([]);
  const [showNotif,     setShowNotif    ] = useState(false);
  const [showProfile,   setShowProfile  ] = useState(false);
  const [menuOpen,      setMenuOpen     ] = useState(false);

  // The consultant-memo feature has its own عربي/EN toggle; its navbar item
  // here follows that choice (persisted as cm-lang).
  const [memoLang, setMemoLang] = useState(() => localStorage.getItem('cm-lang') === 'en' ? 'en' : 'ar');
  useEffect(() => {
    const sync = () => setMemoLang(localStorage.getItem('cm-lang') === 'en' ? 'en' : 'ar');
    window.addEventListener('cm-lang-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('cm-lang-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  // Consultant-memo keeps its own dynamic label (synced via cm-lang-changed);
  // every other link resolves through the shared dictionary by its stable key.
  const linkLabel = l =>
    l.to === '/consultant-memo'
      ? APP_NAV_LABEL[memoLang]
      : (user && l.key ? t(`nav.${user.role}.${l.key}`) : l.label);

  const unreadCount = notifications.filter(n => !n.read).length;

  const isLanding   = location.pathname === '/' || location.pathname === '/index.html';
  const navbarClass = isLanding ? 'topnav' : 'topnav portal-navbar';

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

      {/* LOGO — MTMS logo temporarily removed; the area still navigates home */}
      <div
        className="nav-logo"
        onClick={() => navigate(ROLE_HOME[user?.role] || '/')}
        style={{ cursor: 'pointer' }}
        role="link"
        aria-label="Home"
      />

      {/* PAGE LINKS — desktop */}
      <div className="nav-links">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
          >
            {linkLabel(l)}
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

      {/* TOGGLES + BELL + AVATAR */}
      <div className="nav-right">
        <button
          type="button"
          className="nav-toggle-btn"
          style={toggleBtnStyle}
          onClick={toggleTheme}
          aria-label={t(theme === 'dark' ? 'nav.toggle.theme.light' : 'nav.toggle.theme.dark')}
          title={t(theme === 'dark' ? 'nav.toggle.theme.light' : 'nav.toggle.theme.dark')}
        >
          {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>

        <button
          type="button"
          className="nav-toggle-btn nav-toggle-lang"
          style={{ ...toggleBtnStyle, fontSize: 12, fontWeight: 600 }}
          onClick={toggleLang}
          aria-label={t(lang === 'ar' ? 'nav.toggle.lang.en' : 'nav.toggle.lang.ar')}
          title={t(lang === 'ar' ? 'nav.toggle.lang.en' : 'nav.toggle.lang.ar')}
        >
          {lang === 'ar' ? 'EN' : 'عربى'}
        </button>

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
              {linkLabel(l)}
            </NavLink>
          ))}
        </div>
      )}
    </nav>
  );
}
