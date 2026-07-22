import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import dict from '../i18n';

// Global theme + language preferences for the whole app.
// Applies data-theme / dir / lang to <html>; CSS reacts via
// html[data-theme="dark"] and html[dir="rtl"]. Persisted in localStorage
// under both mlms-* (new) and cm-* (legacy) keys, and dispatches
// 'cm-lang-changed' so the Navbar memo-label listener keeps working.
// Defaults: lang="en" (LTR), theme="light". A previously-saved Arabic choice is
// respected; only unset/new sessions default to English.

const PrefsContext = createContext(null);

function readLang() {
  const v = localStorage.getItem('mlms-lang') ?? localStorage.getItem('cm-lang');
  return v === 'ar' ? 'ar' : 'en';
}

function readTheme() {
  const v = localStorage.getItem('mlms-theme') ?? localStorage.getItem('cm-theme');
  return v === 'dark' ? 'dark' : 'light';
}

export function PrefsProvider({ children }) {
  const [theme, setTheme] = useState(readTheme);
  const [lang, setLangState] = useState(readLang);

  // Write localStorage SYNCHRONOUSLY on every language change (before React
  // re-renders consumers) so helpers that read the language directly from storage
  // — e.g. utils/specialtyName — resolve the new language on the same render.
  const setLang = useCallback((next) => {
    setLangState((prev) => {
      const v = typeof next === 'function' ? next(prev) : next;
      try { localStorage.setItem('mlms-lang', v); localStorage.setItem('cm-lang', v); } catch { /* ignore */ }
      return v;
    });
  }, []);

  // Persist theme to both new + legacy keys.
  useEffect(() => {
    localStorage.setItem('mlms-theme', theme);
    localStorage.setItem('cm-theme', theme);
  }, [theme]);

  // Persist lang to both new + legacy keys, and notify the Navbar listener.
  useEffect(() => {
    localStorage.setItem('mlms-lang', lang);
    localStorage.setItem('cm-lang', lang);
    window.dispatchEvent(new CustomEvent('cm-lang-changed', { detail: lang }));
  }, [lang]);

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Apply preferences to <html> so CSS tokens + RTL flip globally.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('dir', dir);
    root.setAttribute('lang', lang);
  }, [theme, dir, lang]);

  const toggleTheme = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), []);
  const toggleLang  = useCallback(() => setLang(l => (l === 'ar' ? 'en' : 'ar')), []);

  const t = useCallback(
    key => (dict[lang]?.[key]) ?? dict.ar?.[key] ?? key,
    [lang]
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, lang, setLang, toggleLang, t, dir }),
    [theme, toggleTheme, lang, toggleLang, t, dir]
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);

// Shared date·time formatter (lang-aware: ar-EG vs en-GB).
export function fmtDateTime(value, lang) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d)) return '—';
  const date = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

// Date-only formatter (form date rows, preview, and print).
export function fmtDate(value, lang) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}
