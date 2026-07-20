import { IconEye, IconEdit } from './icons';

// People-grid account card (shell_tokens §d "Account card" + lists_views §3).
// Avatar initials, mono ID, accent role pill, 2-col key/value grid, view/edit
// actions, and an optional gold→accent-tint change-history footer.
//
// The edit pencil is GATED on `canEdit` (RULINGS §G35 — hidden for read-only
// roles), fixing the prototype's missed guard.
//
//   <AccountCard name="Dr. Amina Yousif" id="TR-04521" role="Trainee"
//     fields={[{ label:'Country', value:'Sudan' }, ...]}
//     canEdit={canEdit} onView={...} onEdit={...}
//     history={['12 Mar 2026 — Phone, City — by Sara Mahmoud']} />
function initialsOf(name = '') {
  return name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function AccountCard({
  name, id, role, fields = [], canEdit = false,
  onView, onEdit, history = [], avatar,
}) {
  return (
    <div className="mt-acct">
      <div className="mt-acct-head">
        <div className="mt-acct-avatar">{avatar || initialsOf(name)}</div>
        <div className="mt-acct-id-wrap">
          <div className="mt-acct-name" title={name}>{name}</div>
          {id && <div className="mt-acct-id">{id}</div>}
        </div>
        <div className="mt-acct-head-spacer" />
        {role && <span className="mt-pill mt-pill--role">{role}</span>}
      </div>

      {fields.length > 0 && (
        <div className="mt-acct-kv">
          {fields.map((f, i) => (
            <div key={i}>
              <div className="mt-acct-k">{f.label}</div>
              <div className="mt-acct-v" title={typeof f.value === 'string' ? f.value : undefined}>{f.value ?? '—'}</div>
            </div>
          ))}
        </div>
      )}

      {(onView || (canEdit && onEdit)) && (
        <div className="mt-acct-actions">
          {onView && (
            <button type="button" className="mt-icon-action" onClick={onView} aria-label="View" title="View">
              <IconEye size={15} />
            </button>
          )}
          {canEdit && onEdit && (
            <button type="button" className="mt-icon-action" onClick={onEdit} aria-label="Edit" title="Edit">
              <IconEdit size={15} />
            </button>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-acct-hist">
          <div className="mt-acct-hist-title">Change history</div>
          {history.map((h, i) => <div key={i} className="mt-acct-hist-line">{h}</div>)}
        </div>
      )}
    </div>
  );
}
