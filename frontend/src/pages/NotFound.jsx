import { useNavigate } from 'react-router-dom';
import { useAuth }  from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import Navbar       from '../components/Navbar';

// Role → home route. Mirrors ROLE_HOME in App.jsx so the "Go to home" button
// lands each role on their own landing page (falls back to "/").
const ROLE_HOME = {
  super_admin:      '/admin/dashboard',
  secretary:        '/secretary/trainees',
  dio:              '/dio/dashboard',
  supervisor:       '/supervisor/trainees',
  trainee:          '/timeline',
  president:        '/president/dashboard',
  program_director: '/program-director/trainees',
  asg1:             '/consultant-memo',
  asg2:             '/consultant-memo',
};

// Page-chrome translations (Arabic + English).
const STRINGS = {
  ar: {
    title:    'الصفحة غير موجودة',
    message:  'عذرًا، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
    goHome:   'الذهاب إلى الصفحة الرئيسية',
  },
  en: {
    title:    'Page not found',
    message:  "Sorry, the page you're looking for doesn't exist or has been moved.",
    goHome:   'Go to home',
  },
};

export default function NotFound() {
  const { user } = useAuth();
  const { lang } = usePrefs();
  const navigate = useNavigate();
  const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;

  const goHome = () => navigate((user && ROLE_HOME[user.role]) || '/');

  return (
    <>
      <Navbar />
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 120px)',
        padding: '24px',
      }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          boxShadow: '0 8px 24px var(--shadow)',
          padding: '40px 32px',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '72px',
            fontWeight: 800,
            lineHeight: 1,
            color: 'var(--accent)',
          }}>404</div>
          <h1 style={{
            margin: '16px 0 8px',
            fontSize: '20px',
            fontWeight: 600,
            color: 'var(--text)',
          }}>{t('title')}</h1>
          <p style={{
            margin: '0 0 24px',
            fontSize: '14px',
            lineHeight: 1.6,
            color: 'var(--text-muted)',
          }}>{t('message')}</p>
          <button
            type="button"
            onClick={goHome}
            style={{
              display: 'inline-block',
              padding: '11px 24px',
              border: 'none',
              borderRadius: '9px',
              background: 'var(--accent)',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >{t('goHome')}</button>
        </div>
      </div>
    </>
  );
}
