// Shared accreditation status chip — a coloured dot + bilingual label driven by
// the computed `accreditationStatus` the backend injects on centers/programs
// (see backend/utils/accreditation.js): 'green' | 'yellow' | 'red' | 'black'.
// null/unknown → an em-dash. No animation (out of scope this phase).
import { usePrefs } from '../context/PrefsContext';

const STATUS = {
  green:  { color: 'var(--success)', en: 'Valid',     ar: 'ساري' },
  yellow: { color: 'var(--warning)', en: 'Expiring',  ar: 'قارب على الانتهاء' },
  red:    { color: 'var(--danger)',  en: 'Expired',   ar: 'منتهي' },
  black:  { color: '#333',           en: 'Withdrawn', ar: 'مسحوب' },
};

export default function AccreditationBadge({ status }) {
  const { lang } = usePrefs();
  const s = STATUS[status];
  if (!s) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return (
    <span
      className="badge"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 600,
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {lang === 'ar' ? s.ar : s.en}
    </span>
  );
}
