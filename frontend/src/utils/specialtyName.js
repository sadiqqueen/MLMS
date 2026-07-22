// Display a specialty / sub-specialty name in the active UI language: English by
// default, Arabic only when the language is Arabic. `spec` is a populated
// Specialty ref (`{ name, nameEn }`) — `name` is the Arabic name, `nameEn` the
// English one. Falls back to whichever name exists, so specialties without an
// English name still render (their Arabic name).
//
// `lang` is optional: pass it (from usePrefs) for guaranteed reactivity, or omit
// it and the current language is read from localStorage (kept in sync by
// PrefsContext, which writes it synchronously on every toggle).
function currentLang() {
  try {
    return localStorage.getItem('mlms-lang') || localStorage.getItem('cm-lang') || 'en';
  } catch {
    return 'en';
  }
}

export function specialtyName(spec, lang) {
  if (!spec) return '—';
  if (typeof spec !== 'object') return String(spec);
  const ar = spec.name || '';
  const en = spec.nameEn || '';
  const l = lang || currentLang();
  return (l === 'ar' ? (ar || en) : (en || ar)) || '—';
}

export default specialtyName;
