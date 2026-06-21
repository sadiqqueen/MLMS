import { Component } from 'react';

// App-wide error boundary. Catches render/runtime errors anywhere in the tree
// and shows a friendly, theme-tokenized fallback instead of a blank white page.
// Class components can't use hooks, so language is read directly from the same
// localStorage keys PrefsContext persists ('mlms-lang' / legacy 'cm-lang'), and
// navigation uses plain window.location.

const STRINGS = {
  ar: {
    title:   'حدث خطأ ما',
    message: 'عذرًا، حدث خطأ غير متوقع. يمكنك إعادة تحميل الصفحة أو العودة إلى الصفحة الرئيسية.',
    reload:  'إعادة التحميل',
    goHome:  'الصفحة الرئيسية',
  },
  en: {
    title:   'Something went wrong',
    message: 'Sorry, an unexpected error occurred. You can reload the page or go back home.',
    reload:  'Reload',
    goHome:  'Go home',
  },
};

function readLang() {
  try {
    const v = localStorage.getItem('mlms-lang') ?? localStorage.getItem('cm-lang');
    return v === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const lang = readLang();
    const t = k => STRINGS[lang]?.[k] ?? STRINGS.ar[k] ?? k;
    const dir = lang === 'ar' ? 'rtl' : 'ltr';

    return (
      <div
        dir={dir}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          padding: '24px',
          background: 'var(--app-bg)',
        }}
      >
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
          <h1 style={{
            margin: '0 0 8px',
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
          <div style={{
            display: 'flex',
            gap: '10px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '11px 24px',
                border: 'none',
                borderRadius: '9px',
                background: 'var(--accent)',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >{t('reload')}</button>
            <a
              href="/"
              style={{
                padding: '11px 24px',
                borderRadius: '9px',
                border: '1px solid var(--border)',
                background: 'var(--surface-2)',
                color: 'var(--text)',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                lineHeight: '20px',
              }}
            >{t('goHome')}</a>
          </div>
        </div>
      </div>
    );
  }
}
