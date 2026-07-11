import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { IconSun, IconMoon } from './icons';
import api from '../api/axios';
import NotificationPanel from './NotificationPanel';
import ProfileDropdown from './ProfileDropdown';
import { APP_NAV_LABEL } from './memo/MemoPrefs';
import { ROLE_HOME, ROLE_LINKS, baseRole, basePathForRole } from '../config/roles';

// ROLE_LINKS and ROLE_HOME now live in ../config/roles (shared with App.jsx and
// ProtectedRoute.jsx) and include the Basic-Training (b_*) roles.

// Best-effort: pick the most relevant page for a notification from its message
// text + the user's role (notifications store no link). Falls back to home.
// Basic-track (b_*) roles resolve to the same page under their /basic prefix.
function notifLink(message = '', role) {
  const m = String(message).toLowerCase();
  const has = re => re.test(m);
  const advancedDest = () => {
    switch (baseRole(role)) {
      case 'trainee':
        if (has(/evaluat|assess|competent|grade|score/)) return '/grades';
        if (has(/report/))                                return '/reports';
        if (has(/rotation|distribut|assign|specialt|hospital/)) return '/timeline';
        break;
      case 'supervisor':
        if (has(/evaluat|assess/))   return '/supervisor/evaluations';
        if (has(/report|grade/))     return '/supervisor/reports';
        if (has(/trainee|assign/))   return '/supervisor/trainees';
        break;
      case 'program_director':
        if (has(/report|grade/))  return '/program-director/reports';
        if (has(/supervisor/))    return '/program-director/supervisors';
        if (has(/trainee/))       return '/program-director/trainees';
        break;
      case 'dio':
        if (has(/certificat/))  return '/dio/certificates';
        if (has(/rotation/))    return '/dio/rotations';
        if (has(/distribut/))   return '/dio/distributions';
        if (has(/supervisor/))  return '/dio/supervisors';
        if (has(/trainee/))     return '/dio/users';
        break;
      case 'secretary':
        if (has(/supervisor/))             return '/secretary/supervisors';
        if (has(/trainee|report|assign/))  return '/secretary/trainees';
        break;
      case 'super_admin':
        if (has(/certificat/))           return '/admin/certificates';
        if (has(/user|account|locked/))  return '/admin/users';
        if (has(/hospital/))             return '/admin/hospitals';
        break;
      default:
        break;
    }
    return null;
  };
  const dest = advancedDest();
  return dest ? basePathForRole(role) + dest : (ROLE_HOME[role] || '/');
}

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
      : (user && l.key ? t(`nav.${baseRole(user.role)}.${l.key}`) : l.label);

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

  // Open a notification → mark it read, close the panel, go to its page.
  function handleOpenNotif(n) {
    if (!n.read) handleRead(n._id);
    setShowNotif(false);
    const dest = notifLink(n.message, user?.role);
    if (dest && dest !== location.pathname) navigate(dest);
  }

  async function handleDeleteNotif(id) {
    try {
      await api.delete(`/api/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch {}
  }

  function toggleNotif()   { setShowNotif(v => !v);   setShowProfile(false); setMenuOpen(false); }
  function toggleProfile() { setShowProfile(v => !v); setShowNotif(false);   setMenuOpen(false); }

  const links = user ? (ROLE_LINKS[user.role] || []) : [];

  return (
    // dir="ltr" keeps the navbar layout fixed in both languages — only its text
    // translates; the logo, links, toggles, bell and avatar never switch sides.
    <nav className={navbarClass} dir="ltr">

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
          onClick={toggleTheme}
          aria-label={t(theme === 'dark' ? 'nav.toggle.theme.light' : 'nav.toggle.theme.dark')}
          title={t(theme === 'dark' ? 'nav.toggle.theme.light' : 'nav.toggle.theme.dark')}
        >
          {theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
        </button>

        <button
          type="button"
          className="nav-toggle-btn nav-toggle-lang"
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
              onOpen={handleOpenNotif}
              onReadAll={handleReadAll}
              onDelete={handleDeleteNotif}
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
