import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import ProfileDropdown from '../ProfileDropdown';
import { useMemoPrefs } from './MemoPrefs';
import { useInitiativeAccess } from './useInitiativeAccess';
import { INIT_STRINGS } from './initiativeStrings';
import { MemoModal } from './MemoUi';

const roleLabel = (role) =>
  role === 'asg1' ? 'ASG.1' : role === 'asg2' ? 'ASG.2' : (role || '').toUpperCase();

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
  const [showUserCard, setShowUserCard] = useState(false);
  const [cardUser, setCardUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const onAllView = location.pathname.startsWith('/consultant-memo/all');
  const onNewMemoView = location.pathname === '/consultant-memo';
  const onInitiatives = location.pathname.startsWith('/initiatives');

  // Load full profile (city / id / specialty / …) when the card opens —
  // the same data the main Profile page shows for every role.
  useEffect(() => {
    if (!showUserCard || cardUser) return;
    api.get('/api/auth/me')
      .then(res => setCardUser(res.data?.data || res.data))
      .catch(() => {});
  }, [showUserCard, cardUser]);

  const guarded = fn => () => {
    if (guardNavigation && !guardNavigation()) return;
    fn();
  };

  const L = {
    profile:   lang === 'en' ? 'Profile' : 'الملف الشخصي',
    fullName:  lang === 'en' ? 'Full name' : 'الاسم الكامل',
    email:     lang === 'en' ? 'Email' : 'البريد الإلكتروني',
    phone:     lang === 'en' ? 'Phone' : 'الهاتف',
    idNumber:  lang === 'en' ? 'ID number' : 'الرقم التعريفي',
    city:      lang === 'en' ? 'City' : 'المدينة',
    hospital:  lang === 'en' ? 'Hospital' : 'المستشفى',
    specialty: lang === 'en' ? 'Specialty' : 'التخصص',
    role:      lang === 'en' ? 'Role' : 'الصلاحية',
    close:     lang === 'en' ? 'Close' : 'إغلاق',
  };

  return (
    <>
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
        {showProfile && (
          <ProfileDropdown
            onClose={() => setShowProfile(false)}
            onProfile={() => setShowUserCard(true)}
          />
        )}
      </div>

      <span className="cmx-vdiv" aria-hidden="true" />

      {/* Theme toggle — shows the current state only; flips on change */}
      <button
        className="cmx-toggle"
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        aria-label={theme === 'light' ? t('dark') : t('light')}
        title={theme === 'light' ? t('dark') : t('light')}
      >
        <span className="cmx-toggle-face" key={theme}>
          {theme === 'light' ? <IconSun /> : <IconMoon />}
        </span>
      </button>

      {/* Language toggle — shows the current language only; flips on change */}
      <button
        className="cmx-toggle"
        onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
        aria-label={lang === 'ar' ? 'English' : 'عربي'}
        title={lang === 'ar' ? 'English' : 'عربي'}
      >
        <span className="cmx-toggle-face" key={lang}>{lang === 'ar' ? 'عربي' : 'EN'}</span>
      </button>

      {/* Centered between the profile cluster and the logo */}
      <div className="cmx-nav-center">
        {/* Initiatives — placed immediately BEFORE "All memos"; only shown to
            allowlisted (ASG) accounts. Backend 403 is the real guard. */}
        {canInitiatives && (
          <button
            className={'cmx-btn cmx-btn-ghost cmx-btn-initiatives' + (onInitiatives ? ' cmx-btn-active' : '')}
            aria-current={onInitiatives ? 'page' : undefined}
            onClick={guarded(() => navigate('/initiatives'))}
          >
            <IconBoard />
            <span className="cmx-nav-twoline">
              <span>{(INIT_STRINGS[lang] ?? INIT_STRINGS.ar).navTitleL1}</span>
              <span>{(INIT_STRINGS[lang] ?? INIT_STRINGS.ar).navTitleL2}</span>
            </span>
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

        <button
          className={'cmx-btn cmx-btn-ghost' + (onNewMemoView ? ' cmx-btn-active' : '')}
          aria-current={onNewMemoView ? 'page' : undefined}
          onClick={onNewMemo}
        >
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

    {showUserCard && (
      <MemoModal onClose={() => setShowUserCard(false)} labelledBy="cmx-usercard-title">
        <div className="cmx-modal-head">
          <h3 id="cmx-usercard-title">{L.profile}</h3>
          <button className="cmx-btn cmx-btn-outline cmx-btn-sm" onClick={() => setShowUserCard(false)}>
            {L.close}
          </button>
        </div>
        {(() => {
          const cu = cardUser || user || {};
          const photo = cu.photoUrl || user?.photoUrl;
          const hospitalName = cu.hospitalId?.name || cu.hospital?.name || '';
          const specialtyName = cu.specialtyId?.name || cu.specialty || '';
          const rows = [
            [L.fullName, cu.name],
            [L.email, cu.email],
            [L.phone, cu.phone],
            [L.idNumber, cu.studentId],
            ...(hospitalName ? [[L.hospital, hospitalName]] : []),
            [L.city, cu.city || cu.hospital?.city],
            ...(specialtyName ? [[L.specialty, specialtyName]] : []),
            [L.role, roleLabel(cu.role)],
          ];
          return (
            <div className="cmx-usercard">
              <div className="cmx-usercard-top">
                {photo
                  ? <img src={photo} alt="" className="cmx-usercard-avatar" />
                  : <span className="cmx-usercard-avatar cmx-usercard-initials">{cu.initials || user?.initials}</span>}
                <div className="cmx-usercard-id">
                  <div className="cmx-usercard-name">{cu.name}</div>
                  <div className="cmx-usercard-role">{roleLabel(cu.role)}</div>
                </div>
              </div>
              <dl className="cmx-usercard-rows">
                {rows.map(([label, value]) => (
                  <div className="cmx-usercard-row" key={label}>
                    <dt>{label}</dt><dd>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })()}
      </MemoModal>
    )}
    </>
  );
}
