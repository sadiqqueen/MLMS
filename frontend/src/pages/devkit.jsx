// W2-Developer — co-located primitives shared only by the Developer pages
// (Users, AuditLog, AdminSpecialties, HospitalsUniversities, Distributions).
// Owned by W2-Developer, imported by those pages only — mirrors W1-Analyzer's
// AnalyzerListKit pattern. Keeps the search magnifier + initials helper DRY;
// all visuals use the shared mt- classes.

// Leading magnifier for the .mt-search box (feather magnifier, stroke 1.8).
export function MagnifierIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

// 1–2 letter initials from a name.
export function initialsOf(name = '') {
  return String(name).trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}
