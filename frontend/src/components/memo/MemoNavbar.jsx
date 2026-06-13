import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProfileDropdown from '../ProfileDropdown';
import { useMemoPrefs } from './MemoPrefs';
import { useInitiativeAccess } from './useInitiativeAccess';
import { INIT_STRINGS } from './initiativeStrings';

const IconMoon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);
const IconSun = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const IconFolder = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconChevron = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IconBoard = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
);

// The dedicated navbar for the consultant-memo pages.
// `guardNavigation` (optional) is asked before leaving — the form page uses
// it to confirm when there are unsaved changes.
export default function MemoNavbar({ onNewMemo, guardNavigation }) {
  const { user } = useAuth();
  const { theme, setTheme, lang, setLang, t } = useMemoPrefs();
  const { allowed: canInitiatives } = useInitiativeAccess();
  const [showProfile, setShowProfile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const onAllView = location.pathname.startsWith('/consultant-memo/all');
  const onInitiatives = location.pathname.startsWith('/initiatives');

  const guarded = fn => () => {
    if (guardNavigation && !guardNavigation()) return;
    fn();
  };

  return (
    <nav className="cmx-nav" aria-label={t('navAria')}>
      {/* DIO profile (start of the RTL row = right corner) */}
      <div className="cmx-profile-wrap">
        <button
          className="cmx-profile"
          onClick={() => setShowProfile(v => !v)}
          aria-haspopup="menu"
          aria-expanded={showProfile}
        >
          {user?.photoUrl
            ? <img src={user.photoUrl} alt="" className="cmx-avatar cmx-avatar-img" />
            : <span className="cmx-avatar" aria-hidden="true">{user?.initials}</span>}
          <span className="cmx-profile-text">
            <span className="cmx-profile-name">{user?.name}</span>
            <span className="cmx-profile-role">
              {user?.role === 'asg1' ? 'ASG.1' : user?.role === 'asg2' ? 'ASG.2' : (user?.role || '').toUpperCase()}
            </span>
          </span>
          <IconChevron />
        </button>
        {showProfile && <ProfileDropdown onClose={() => setShowProfile(false)} />}
      </div>

      <span className="cmx-vdiv" aria-hidden="true" />

      <button
        className="cmx-btn cmx-btn-ghost"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      >
        {theme === 'light' ? <IconMoon /> : <IconSun />}
        <span>{theme === 'light' ? t('dark') : t('light')}</span>
      </button>

      <div className="cmx-langs" role="group" aria-label="عربي / English">
        <button
          className={'cmx-lang' + (lang === 'ar' ? ' active' : '')}
          aria-pressed={lang === 'ar'}
          onClick={() => setLang('ar')}
        >عربي</button>
        <button
          className={'cmx-lang' + (lang === 'en' ? ' active' : '')}
          aria-pressed={lang === 'en'}
          onClick={() => setLang('en')}
        >EN</button>
      </div>

      {/* Centered between the profile cluster and the logo */}
      <div className="cmx-nav-center">
        {/* Initiatives — placed immediately BEFORE "All memos"; only shown to
            allowlisted (ASG) accounts. Backend 403 is the real guard. */}
        {canInitiatives && (
          <button
            className={'cmx-btn cmx-btn-ghost' + (onInitiatives ? ' cmx-btn-active' : '')}
            aria-current={onInitiatives ? 'page' : undefined}
            onClick={guarded(() => navigate('/initiatives'))}
          >
            <IconBoard />
            <span>{INIT_STRINGS[lang]?.navLabel ?? INIT_STRINGS.ar.navLabel}</span>
          </button>
        )}

        <button
          className={'cmx-btn cmx-btn-ghost' + (onAllView ? ' cmx-btn-active' : '')}
          aria-current={onAllView ? 'page' : undefined}
          onClick={guarded(() => navigate('/consultant-memo/all'))}
        >
          <IconFolder />
          <span>{t('allMemos')}</span>
        </button>

        <button className="cmx-btn cmx-btn-primary" onClick={onNewMemo}>
          <IconPlus />
          <span>{t('newMemo')}</span>
        </button>
      </div>

      {/* Board logo — far LEFT corner in both directions */}
      <button
        className="cmx-logo-wrap"
        onClick={guarded(() => navigate('/'))}
        title={t('backToApp')}
        aria-label={t('backToApp')}
      >
        <img src="/arab-board-logo.png" alt={t('lh1')} className="cmx-logo" />
      </button>
    </nav>
  );
}
