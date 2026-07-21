import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import { IconSun, IconMoon, IconBell, IconCaret, NavIcon } from './icons';
import api from '../api/axios';
import NotificationPanel from './NotificationPanel';
import ProfileDropdown from './ProfileDropdown';
import { APP_NAV_LABEL } from './memo/MemoPrefs';
import { ROLE_HOME, ROLE_LINKS, roleLabel, baseRole, basePathForRole } from '../config/roles';

// The 10 redesigned "design roles" render the new mt- top-nav shell (single bar:
// centered links + right-side controls, no logo, no separate title row). Every
// other role (president, ASG, secretary, supervisor, basic-track b_*) keeps the
// existing navbar EXACTLY as-is. No role switcher in either shell.
const MT_SHELL_ROLES = new Set([
  'super_admin', 'hoc', 'central_secretary', 'data_analyzer', 'head_cs', 'head_ad', 'data_entry',
  'secretary_general', 'assistant_secretary', 'dio', 'dio_view', 'sub_dio',
  'program_director', 'sub_pd', 'trainee',
]);

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
        if (has(/announcement|إعلان/))                    return '/announcements';
        if (has(/log book|logbook|سجل/))                  return '/logbook';
        if (has(/research|publication|publish/))          return '/research';
        if (has(/evaluat|assess|competent|grade|score/)) return '/grades';
        if (has(/report/))                                return '/reports';
        if (has(/rotation|distribut|assign|specialt|hospital/)) return '/timeline';
        break;
      case 'supervisor':
        if (has(/announcement|إعلان/)) return '/announcements';
        if (has(/log book|logbook|سجل/)) return '/supervisor/logbook';
        if (has(/research/))         return '/supervisor/trainees';
        if (has(/evaluat|assess/))   return '/supervisor/evaluations';
        if (has(/report|grade/))     return '/supervisor/reports';
        if (has(/trainee|assign/))   return '/supervisor/trainees';
        break;
      case 'program_director':
        if (has(/announcement|إعلان/)) return '/announcements';
        if (has(/log book|logbook|سجل/)) return '/program-director/log-book';
        if (has(/report|grade/))  return '/program-director/reports';
        if (has(/evaluat|assess/)) return '/program-director/evaluations';
        if (has(/trainee/))       return '/program-director/trainees';
        break;
      case 'dio':
        if (has(/change|approval|promotion|research/)) return '/dio/approvals';
        if (has(/certificat/))  return '/dio/certificates';
        if (has(/rotation/))    return '/dio/rotations';
        if (has(/assign/))      return '/dio/assignments';
        if (has(/trainee/))     return '/dio/assignments';
        break;
      case 'secretary':
        if (has(/research|forward|sign/))  return '/secretary/research';
        if (has(/supervisor/))             return '/secretary/supervisors';
        if (has(/trainee|report|assign/))  return '/secretary/trainees';
        break;
      case 'super_admin':
        if (has(/user|account|locked/))  return '/admin/users';
        if (has(/hospital/))             return '/admin/hospitals';
        break;
      case 'data_analyzer':
        if (has(/change|approval|request|pending/)) return '/analyzer/pending';
        break;
      case 'head_ad':
        if (has(/change|approval|request|pending/)) return '/registry/permissions';
        break;
      case 'secretary_general':
      case 'assistant_secretary':
        if (has(/report/))               return '/sg/reports';
        break;
      default:
        break;
    }
    return null;
  };
  const dest = advancedDest();
  return dest ? basePathForRole(role) + dest : (ROLE_HOME[role] || '/');
}

export default function Navbar({ title, subtitle }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, lang, toggleLang, t } = usePrefs();
  const navigate = useNavigate();
  const location = useLocation();

  const [notifications, setNotifications] = useState([]);
  const [showNotif,     setShowNotif    ] = useState(false);
  const [showProfile,   setShowProfile  ] = useState(false);
  const [menuOpen,      setMenuOpen     ] = useState(false);

  // mt- nav overflow: show the first MAX_VISIBLE_LINKS inline; any extra go into a
  // "More" dropdown (menuMore = open state).
  const [menuMore, setMenuMore] = useState(false);

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

  const links = user ? (ROLE_LINKS[user.role] || []) : [];
  const isMt = !!user && MT_SHELL_ROLES.has(user.role);

  // mt- shell: at most this many links show inline; the rest fold into "More".
  const MAX_VISIBLE_LINKS = 6;

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

  function toggleNotif()   { setShowNotif(v => !v);   setShowProfile(false); setMenuOpen(false); setMenuMore(false); }
  function toggleProfile() { setShowProfile(v => !v); setShowNotif(false);   setMenuOpen(false); setMenuMore(false); }
  function toggleMore()    { setMenuMore(v => !v);    setShowNotif(false);   setShowProfile(false); }

  // ── mt- redesigned shell (10 design roles) ────────────────────────────────
  if (isMt) {
    // No separate page-title row: the active nav link already shows the page, and
    // the role label rides beside the avatar. `title`/`subtitle` props are kept in
    // the signature for the legacy shell + callers, but only `subtitle` (role
    // override) is consumed here.
    // Avatar role label always reflects the actual signed-in role (pages may pass
    // a fixed subtitle like "Data Analyzer" that must not override e.g. Head CS).
    const roleSub = roleLabel(user.role, lang);

    const controls = (
      <>
        <button
          type="button" className="mt-iconbtn" onClick={toggleTheme}
          aria-label={t(theme === 'dark' ? 'nav.toggle.theme.light' : 'nav.toggle.theme.dark')}
          title={t(theme === 'dark' ? 'nav.toggle.theme.light' : 'nav.toggle.theme.dark')}
        >
          {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
        </button>

        <button
          type="button" className="mt-iconbtn mt-iconbtn-lang" onClick={toggleLang}
          aria-label={t(lang === 'ar' ? 'nav.toggle.lang.en' : 'nav.toggle.lang.ar')}
          title={t(lang === 'ar' ? 'nav.toggle.lang.en' : 'nav.toggle.lang.ar')}
        >
          {lang === 'ar' ? 'EN' : 'عربى'}
        </button>

        <div className="mt-bell-wrap">
          <button type="button" className="mt-iconbtn" onClick={toggleNotif} aria-label="Notifications">
            <IconBell size={17} />
            {unreadCount > 0 && <span className="mt-bell-dot" />}
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

        <div className="mt-avatar-wrap">
          <button type="button" className="mt-topbar-avatar" onClick={toggleProfile} aria-label="Account menu">
            {user?.initials}
          </button>
          <div className="mt-topbar-uname" onClick={toggleProfile}>
            <div className="mt-topbar-uname-name">{user?.name}</div>
            <div className="mt-topbar-uname-role">{roleSub}</div>
          </div>
          {showProfile && <ProfileDropdown onClose={() => setShowProfile(false)} />}
        </div>
      </>
    );

    // Show the first 6 links inline; fold any extra into a "More" dropdown. If the
    // active page is one of the folded links, flag the More button as active.
    const visibleLinks  = links.slice(0, MAX_VISIBLE_LINKS);
    const overflowLinks = links.slice(MAX_VISIBLE_LINKS);
    const path = location.pathname;
    const activeInMore = overflowLinks.some(l => path === l.to || path.startsWith(l.to + '/'));

    const renderLink = l => (
      <NavLink
        key={l.to}
        to={l.to}
        end={l.to === '/'}
        className={({ isActive }) => 'mt-navlink' + (isActive ? ' is-active' : '')}
        onClick={() => setMenuMore(false)}
      >
        {l.ic && <NavIcon name={l.ic} size={16} />}
        {linkLabel(l)}
      </NavLink>
    );

    return (
      <div className="mt-shell-top">
        {/* Single taller top-nav: [logo slot] · [centered links + More] · [controls].
            dir="ltr" keeps the bar layout fixed in both languages; only the labels
            translate. */}
        <nav className="mt-nav" dir="ltr">
          <div className="mt-nav-logo-slot">
            <button
              type="button" className="mt-nav-brand" aria-label="Home"
              onClick={() => navigate(ROLE_HOME[user?.role] || '/')}
            >
              <img
                className="mt-nav-logo" src="/logo-light.png" alt="MTMS"
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
            </button>
          </div>

          <div className="mt-navcenter">
            {visibleLinks.map(renderLink)}

            {overflowLinks.length > 0 && (
              <button
                type="button"
                className={'mt-nav-more' + (activeInMore ? ' is-active' : '') + (menuMore ? ' is-open' : '')}
                onClick={toggleMore}
                aria-expanded={menuMore}
              >
                {menuMore ? (lang === 'ar' ? 'أقل' : 'Less') : (lang === 'ar' ? 'المزيد' : 'More')}
                <IconCaret size={14} style={{ transform: menuMore ? 'rotate(180deg)' : 'none' }} />
              </button>
            )}
          </div>

          <div className="mt-nav-controls">
            {controls}
          </div>
        </nav>

        {/* "More" expands the nav DOWNWARD into a second row of the overflow links,
            pushing page content down (rather than floating over it). */}
        {menuMore && overflowLinks.length > 0 && (
          <div className="mt-nav-more-row" dir="ltr">
            {overflowLinks.map(renderLink)}
          </div>
        )}
      </div>
    );
  }

  // ── Legacy shell (all de-scoped roles) — unchanged ────────────────────────
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
