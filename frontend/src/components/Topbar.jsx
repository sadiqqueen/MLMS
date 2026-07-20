// 62px topbar for the mt- redesigned shell (shell_tokens §c).
// Left: page title (20/700) + role subtitle (12px muted). Right: controls node
// (theme toggle, lang toggle, bell, avatar) supplied by Navbar so the bell/avatar
// keep their existing NotificationPanel / ProfileDropdown wiring.
//
// NO role switcher — the real app derives the role from auth (RULINGS §A6).
export default function Topbar({ title, subtitle, right }) {
  return (
    <div className="mt-topbar">
      <div className="mt-topbar-titles">
        {title != null && title !== '' && <div className="mt-topbar-title">{title}</div>}
        {subtitle && <div className="mt-topbar-sub">{subtitle}</div>}
      </div>
      <div className="mt-topbar-spacer" />
      {right && <div className="mt-topbar-right">{right}</div>}
    </div>
  );
}
