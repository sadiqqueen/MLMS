import useCountUp from '../hooks/useCountUp';
import { NavIcon } from './icons';

// Dashboard stat card (shell_tokens §d "Stat card" + dashboards.md §2).
// Accent-tint icon tile, count-up value (1200ms ease-out-cubic), uppercase label,
// optional delta line tinted by tone. Wrap in <RevealOnScroll> at the call site
// for the staggered reveal.
//
//   <StatCard label="Total users" value={1284} icon="users" delta="+12 this week" tone="ok" />
//
// `icon` accepts a NAV_ICONS key (string) or a ReactNode. `tone`: 'ok' | 'warn' | 'dng'.
// `active` gates the count-up (default true); pass the reveal state to sync them.
export default function StatCard({ label, value, icon, delta, tone = 'ok', active = true, format }) {
  const shown = useCountUp(Number(value) || 0, { active });
  const display = typeof format === 'function' ? format(shown) : shown.toLocaleString('en-US');
  const toneClass = tone === 'dng' ? 'mt-stat-delta--dng' : tone === 'warn' ? 'mt-stat-delta--warn' : 'mt-stat-delta--ok';

  return (
    <div className="mt-stat">
      <div className="mt-stat-ic">
        {typeof icon === 'string' ? <NavIcon name={icon} size={19} /> : icon}
      </div>
      <div className="mt-stat-value">{display}</div>
      <div className="mt-stat-label">{label}</div>
      {delta && <div className={`mt-stat-delta ${toneClass}`}>{delta}</div>}
    </div>
  );
}
