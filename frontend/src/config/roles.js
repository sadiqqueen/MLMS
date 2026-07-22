// Centralised role → routing config, shared by App.jsx, ProtectedRoute.jsx and
// Navbar.jsx (each previously kept its own ROLE_HOME copy).
//
// The Basic-Training portal mirrors the Advanced portal: every `b_<role>` reuses
// the exact same page components under a `/basic` URL prefix. The backend scopes
// a `b_*` user to Basic-track data, so the pages need no data changes — only
// their routing/nav is prefixed.

export const BASIC_ROLES = [
  'b_trainee', 'b_trainer', 'b_program_director', 'b_secretary', 'b_odio',
];

// Advanced roles that have a Basic counterpart.
const MIRRORED = ['trainee', 'trainer', 'program_director', 'secretary', 'odio'];

export function isBasicRole(role) {
  return typeof role === 'string' && role.startsWith('b_');
}

// 'b_trainer' → 'trainer'  (Advanced roles pass through unchanged).
export function baseRole(role) {
  return isBasicRole(role) ? role.slice(2) : role;
}

export function trackForRole(role) {
  return isBasicRole(role) ? 'basic' : 'advanced';
}

// URL prefix for the portal a role belongs to ('' Advanced, '/basic' Basic).
export function basePathForRole(role) {
  return isBasicRole(role) ? '/basic' : '';
}

// ── Display labels ───────────────────────────────────────────────────────────
// One source of truth for role → { en, ar }. Basic (b_*) roles are labelled by
// prefixing "Basic "/"أساسي " to their Advanced counterpart via roleLabel().
export const ROLE_LABELS = {
  developer:           { en: 'Developer',            ar: 'مطور النظام' },
  secretary_general:   { en: 'Secretary General',    ar: 'الأمين العام' },
  assistant_secretary: { en: 'Assistant Secretary',  ar: 'مساعد الأمين العام' },
  data_analyzer:       { en: 'Data Analyzer',        ar: 'محلل البيانات' },
  head_cs:             { en: 'Head CS',              ar: 'رئيس السكرتارية' },
  head_ad:             { en: 'Head AD',              ar: 'Head AD' },
  data_entry:          { en: 'Data Entry',           ar: 'مدخل البيانات' },
  central_secretary:   { en: 'Central Secretary',    ar: 'السكرتير المركزي' },
  hoc:                 { en: 'HOC',                  ar: 'HOC' },
  dio:                 { en: 'DIO',                  ar: 'DIO' },
  odio:                { en: 'ODIO',                 ar: 'ODIO' },
  sub_dio:             { en: 'Sub-DIO',              ar: 'Sub-DIO' },
  program_director:    { en: 'Program Director',     ar: 'مدير البرنامج' },
  sub_pd:              { en: 'Sub-PD',               ar: 'نائب مدير البرنامج' },
  trainer:             { en: 'Trainer',             ar: 'مدرب' },
  trainee:             { en: 'Trainee',             ar: 'متدرب' },
  secretary:           { en: 'Secretary',           ar: 'سكرتير' },
  asg1:                { en: 'ASG.1',               ar: 'ASG.1' },
  asg2:                { en: 'ASG.2',               ar: 'ASG.2' },
};

// Resolve a role's display label in the given language. Basic roles get a
// "Basic "/"أساسي " prefix on their base label; unknown roles fall back to the
// raw role string so legacy accounts still render something sensible.
export function roleLabel(role, lang = 'en') {
  if (isBasicRole(role)) {
    return (lang === 'ar' ? 'أساسي ' : 'Basic ') + roleLabel(baseRole(role), lang);
  }
  return ROLE_LABELS[role]?.[lang] ?? ROLE_LABELS[role]?.en ?? (role || '');
}

// Roles that cannot mutate their own profile/self-service (mirrors the backend
// read-only gate on /api/auth/me + /upload-photo).
export const READ_ONLY_ROLES = ['dio', 'sub_dio', 'sub_pd', 'secretary_general', 'assistant_secretary'];

// ── Landing route per role ───────────────────────────────────────────────────
const ADVANCED_HOME = {
  developer:        '/admin/dashboard',
  secretary:        '/secretary/trainees',
  odio:             '/dio/dashboard',
  trainer:          '/supervisor/trainees',
  trainee:          '/timeline',
  program_director: '/program-director/dashboard',
  asg1:             '/consultant-memo',
  asg2:             '/consultant-memo',
  // v2 roles — final homes.
  hoc:                 '/hoc/dashboard',
  dio:                 '/dio-view/dashboard',
  secretary_general:   '/sg/dashboard',
  assistant_secretary: '/sg/dashboard',
  data_analyzer:       '/analyzer/dashboard',
  head_cs:             '/analyzer/dashboard',
  data_entry:          '/registry/dashboard',
  head_ad:             '/registry/dashboard',
  central_secretary:   '/central/dashboard',
  sub_dio:             '/dio-view/dashboard',
  sub_pd:              '/program-director/dashboard',
};

export const ROLE_HOME = {
  ...ADVANCED_HOME,
  ...Object.fromEntries(BASIC_ROLES.map(r => [r, '/basic' + ADVANCED_HOME[baseRole(r)]])),
};

// ── Navbar links per role ────────────────────────────────────────────────────
// Each link carries a stable `key`; the visible label resolves through the
// shared dictionary as t("nav.<baseRole>.<key>"), so Basic roles reuse the
// Advanced translations. Paths for Basic roles are prefixed with /basic.
const ADVANCED_LINKS = {
  // Developer — design shows 5, we keep Hospitals + Event Feedback
  // (no-feature-removal rule, RULINGS §B14). Specialties wires AdminSpecialties.
  developer: [
    { to: '/admin/dashboard',      key: 'dashboard',      label: 'Dashboard',      ic: 'grid'     },
    { to: '/admin/users',          key: 'users',          label: 'Users',          ic: 'users'    },
    { to: '/admin/specialties',    key: 'specialties',    label: 'Specialties',    ic: 'book'     },
    { to: '/admin/countries',      key: 'countries',      label: 'Countries',      ic: 'globe'    },
    { to: '/admin/hospitals',      key: 'hospitals',      label: 'Training Centers', ic: 'building' },
    { to: '/admin/event-feedback', key: 'event_feedback', label: 'Event Feedback', ic: 'doc'      },
    { to: '/admin/audit-log',      key: 'audit_log',      label: 'Audit Log',      ic: 'list'     },
    { to: '/admin/system',         key: 'system',         label: 'System',         ic: 'sliders'  },
  ],
  secretary: [
    { to: '/secretary/trainees',    key: 'trainees',    label: 'Trainees'    },
    { to: '/secretary/supervisors', key: 'supervisors', label: 'Supervisors' },
    { to: '/secretary/hospitals',   key: 'hospitals',   label: 'Hospitals'   },
    { to: '/secretary/research',    key: 'research',    label: 'Research'    },
  ],
  // ODIO (app role `odio`) — design nav (dashboards.md §4.7). Existing routes are
  // reused/restyled by wave 2; /dio/users etc. stay routed (no feature removal).
  odio: [
    { to: '/dio/dashboard',    key: 'dashboard',        label: 'Dashboard',        ic: 'grid'     },
    { to: '/dio/approvals',    key: 'approvals',        label: 'Approvals',        ic: 'check'    },
    { to: '/dio/assignments',  key: 'assignments',      label: 'Assignments',      ic: 'users'    },
    { to: '/dio/assign-pds',   key: 'pd_assignment',    label: 'PD Assignment',    ic: 'brief'    },
    { to: '/dio/certificates', key: 'certificates',     label: 'Certificates',     ic: 'award'    },
    { to: '/dio/evaluations',  key: 'evaluations',      label: 'Evaluations',      ic: 'doc'      },
    { to: '/dio/rotations',    key: 'rotations',        label: 'Rotations',        ic: 'clock'    },
    { to: '/dio/hospitals',    key: 'training_centers', label: 'Training Centers', ic: 'building' },
    { to: '/dio/secretaries',  key: 'secretaries',      label: 'Secretaries',      ic: 'users'    },
  ],
  asg1: [ { to: '/consultant-memo', label: 'مذكرة الاستشاري' } ],
  asg2: [ { to: '/consultant-memo', label: 'مذكرة الاستشاري' } ],
  // TODO(fable): task §7 asks to REMOVE the supervisor login-role UI, but RULINGS
  // §B13 de-scopes supervisor and keeps it "intact and functioning with the OLD
  // shell" (accounts remain, role stays in enum). Fully removing its HOME/LINKS
  // here would trap any existing supervisor login in a redirect loop, so this
  // block is kept as-is (old shell). Only the trainer *entity* links were removed
  // from the redesigned roles (CS/DIO). Confirm which behavior you want.
  trainer: [
    { to: '/supervisor/trainees',    key: 'trainees',    label: 'My Trainees' },
    { to: '/supervisor/reports',     key: 'reports',     label: 'Reports'     },
    { to: '/supervisor/evaluations', key: 'evaluations', label: 'Evaluations' },
    { to: '/supervisor/logbook',     key: 'logbook',     label: 'Log Book',    advancedOnly: true },
    { to: '/supervisor/research',    key: 'research',    label: 'Research'    },
    { to: '/announcements',          key: 'announcements', label: 'Announcements', advancedOnly: true },
  ],
  // Trainee — design nav (dashboards.md §4.10). Announcements moves off the nav
  // (still routed + reachable from notifications); Profile joins it (advancedOnly
  // so the b_trainee mirror, which has no /basic/profile, drops it).
  trainee: [
    { to: '/timeline',             key: 'timeline',      label: 'Timeline',                ic: 'clock' },
    { to: '/reports',              key: 'reports',       label: 'Reports',                 ic: 'doc'   },
    { to: '/grades',               key: 'grades',        label: 'Grades',                  ic: 'award' },
    { to: '/certificates-courses', key: 'courses',       label: 'Certificates & Courses',  ic: 'award' },
    { to: '/logbook',              key: 'logbook',       label: 'Log Book',                ic: 'book', advancedOnly: true },
    { to: '/research',             key: 'research',      label: 'Research',                ic: 'flask' },
    { to: '/notifications',        key: 'notifications', label: 'Notifications',           ic: 'bell'  },
    { to: '/profile',              key: 'profile',       label: 'Profile',                 ic: 'users', advancedOnly: true },
  ],
  // PD — design swaps Supervisors → Log Book (RULINGS §D20, dashboards.md §4.9).
  // Supervisors route stays in App.jsx; only the nav link is retired here.
  program_director: [
    { to: '/program-director/dashboard',   key: 'dashboard',     label: 'Dashboard',     ic: 'grid',   advancedOnly: true },
    { to: '/program-director/program',     key: 'program',       label: 'My Program',    ic: 'layers', advancedOnly: true },
    { to: '/program-director/trainees',    key: 'trainees',      label: 'Trainees',      ic: 'grad'  },
    { to: '/program-director/evaluations', key: 'evaluations',   label: 'Evaluations',   ic: 'doc'   },
    { to: '/program-director/log-book',    key: 'log_book',      label: 'Log Book',      ic: 'book',  advancedOnly: true },
    { to: '/program-director/reports',     key: 'reports',       label: 'Reports',       ic: 'doc'   },
    { to: '/announcements',                key: 'announcements', label: 'Announcements', ic: 'mega',  advancedOnly: true },
  ],
  // Clerk (data_entry) — design adds Dashboard + Programs, drops Specialties from
  // the nav (route stays in App.jsx). Countries is a breadcrumb drill-down page.
  data_entry: [
    { to: '/registry/dashboard', key: 'dashboard', label: 'Dashboard',        ic: 'grid'     },
    { to: '/registry/countries', key: 'countries', label: 'Countries',        ic: 'globe'    },
    { to: '/registry/centers',   key: 'centers',   label: 'Training Centers', ic: 'building' },
    { to: '/registry/programs',  key: 'programs',  label: 'Programs',         ic: 'layers'   },
    { to: '/registry/dios',      key: 'dios',      label: 'DIOs',             ic: 'brief'    },
    { to: '/registry/pds',       key: 'pds',       label: 'PDs',              ic: 'users'    },
  ],
  // Head AD (head_ad) — the clerk's six registry pages, READ-ONLY (mutations
  // hidden client-side + 403'd server-side), plus a Permissions inbox: its only
  // write, where it approves/rejects the clerk's edit & delete requests.
  head_ad: [
    { to: '/registry/dashboard',   key: 'dashboard',   label: 'Dashboard',        ic: 'grid'     },
    { to: '/registry/countries',   key: 'countries',   label: 'Countries',        ic: 'globe'    },
    { to: '/registry/centers',     key: 'centers',     label: 'Training Centers', ic: 'building' },
    { to: '/registry/programs',    key: 'programs',    label: 'Programs',         ic: 'layers'   },
    { to: '/registry/dios',        key: 'dios',        label: 'DIOs',             ic: 'brief'    },
    { to: '/registry/pds',         key: 'pds',         label: 'PDs',              ic: 'users'    },
    { to: '/registry/permissions', key: 'permissions', label: 'Permissions',      ic: 'inbox'    },
  ],
  // Analyzer — 13-item read-only registry + Pending-Changes inbox + Exports.
  // (Old /analyzer/staff route stays in App.jsx, unlinked.)
  data_analyzer: [
    { to: '/analyzer/dashboard',           key: 'dashboard',           label: 'Dashboard',           ic: 'grid'     },
    { to: '/analyzer/countries',           key: 'countries',           label: 'Countries',           ic: 'globe'    },
    { to: '/analyzer/centers',             key: 'centers',             label: 'Training Centers',    ic: 'building' },
    { to: '/analyzer/dios',                key: 'dios',                label: 'DIOs',                ic: 'brief'    },
    { to: '/analyzer/programs',            key: 'programs',            label: 'Programs',            ic: 'layers'   },
    { to: '/analyzer/pds',                 key: 'pds',                 label: 'PDs',                 ic: 'users'    },
    { to: '/analyzer/clerks',              key: 'clerks',              label: 'Data Entry Clerks',   ic: 'edit'     },
    { to: '/analyzer/hocs',                key: 'hocs',                label: 'HOCs',                ic: 'book'     },
    { to: '/analyzer/specialties',         key: 'specialties',         label: 'Specialties',         ic: 'book'     },
    { to: '/analyzer/central-secretaries', key: 'central_secretaries', label: 'Central Secretaries', ic: 'users'    },
    { to: '/analyzer/trainees',            key: 'trainees',            label: 'Trainees',            ic: 'grad'     },
    { to: '/analyzer/pending',             key: 'pending',             label: 'Pending Changes',     ic: 'inbox'    },
    { to: '/analyzer/exports',             key: 'exports',             label: 'Exports & Reports',   ic: 'doc'      },
  ],
  // Head CS (head_cs) — same suite as the data analyzer WITHOUT Exports & Reports.
  head_cs: [
    { to: '/analyzer/dashboard',           key: 'dashboard',           label: 'Dashboard',           ic: 'grid'     },
    { to: '/analyzer/countries',           key: 'countries',           label: 'Countries',           ic: 'globe'    },
    { to: '/analyzer/centers',             key: 'centers',             label: 'Training Centers',    ic: 'building' },
    { to: '/analyzer/dios',                key: 'dios',                label: 'DIOs',                ic: 'brief'    },
    { to: '/analyzer/programs',            key: 'programs',            label: 'Programs',            ic: 'layers'   },
    { to: '/analyzer/pds',                 key: 'pds',                 label: 'PDs',                 ic: 'users'    },
    { to: '/analyzer/clerks',              key: 'clerks',              label: 'Data Entry Clerks',   ic: 'edit'     },
    { to: '/analyzer/hocs',                key: 'hocs',                label: 'HOCs',                ic: 'book'     },
    { to: '/analyzer/specialties',         key: 'specialties',         label: 'Specialties',         ic: 'book'     },
    { to: '/analyzer/central-secretaries', key: 'central_secretaries', label: 'Central Secretaries', ic: 'users'    },
    { to: '/analyzer/trainees',            key: 'trainees',            label: 'Trainees',            ic: 'grad'     },
    { to: '/analyzer/pending',             key: 'pending',             label: 'Pending Changes',     ic: 'inbox'    },
  ],
  // Central Secretary — design nav (dashboards.md §4.3). Trainers link retired
  // per RULINGS §D21 (trainer entity removed from redesigned roles' UI).
  central_secretary: [
    { to: '/central/dashboard', key: 'dashboard', label: 'Dashboard',        ic: 'grid'     },
    { to: '/central/countries', key: 'countries', label: 'Countries',        ic: 'globe'    },
    { to: '/central/centers',   key: 'centers',   label: 'Training Centers', ic: 'building' },
    { to: '/central/programs',  key: 'programs',  label: 'Programs',         ic: 'layers'   },
    { to: '/central/trainees',  key: 'trainees',  label: 'Trainees',         ic: 'grad'     },
  ],
  // HOC (NEW, RULINGS §B12) — fully read-only over its council's specialty scope.
  hoc: [
    { to: '/hoc/dashboard', key: 'dashboard', label: 'Dashboard',        ic: 'grid'     },
    { to: '/hoc/centers',   key: 'centers',   label: 'Training Centers', ic: 'building' },
    { to: '/hoc/programs',  key: 'programs',  label: 'Programs',         ic: 'layers'   },
    { to: '/hoc/trainees',  key: 'trainees',  label: 'Trainees',         ic: 'grad'     },
  ],
  // DIO (dio) + Sub-DIO — design nav (dashboards.md §4.8): adds ODIOs, drops
  // Trainers (RULINGS §D21) and Certificates from the nav. Both routes stay in
  // App.jsx (no feature removal). dio can Add ODIO; sub_dio is read-only.
  dio: [
    { to: '/dio-view/dashboard',         key: 'dashboard', label: 'Dashboard',        ic: 'grid'     },
    { to: '/dio-view/centers',           key: 'centers',   label: 'Training Centers', ic: 'building' },
    { to: '/dio-view/odios',             key: 'odios',     label: 'ODIOs',            ic: 'brief'    },
    { to: '/dio-view/program-directors', key: 'pds',       label: 'PDs',              ic: 'users'    },
    { to: '/dio-view/trainees',          key: 'trainees',  label: 'Trainees',         ic: 'grad'     },
  ],
  sub_dio: [
    { to: '/dio-view/dashboard',         key: 'dashboard', label: 'Dashboard',        ic: 'grid'     },
    { to: '/dio-view/centers',           key: 'centers',   label: 'Training Centers', ic: 'building' },
    { to: '/dio-view/odios',             key: 'odios',     label: 'ODIOs',            ic: 'brief'    },
    { to: '/dio-view/program-directors', key: 'pds',       label: 'PDs',              ic: 'users'    },
    { to: '/dio-view/trainees',          key: 'trainees',  label: 'Trainees',         ic: 'grad'     },
  ],
  // SG + Assistant Secretary — read-only, design order (dashboards.md §4.6).
  secretary_general: [
    { to: '/sg/dashboard',   key: 'dashboard',   label: 'Dashboard',        ic: 'grid'     },
    { to: '/sg/centers',     key: 'centers',     label: 'Training Centers', ic: 'building' },
    { to: '/sg/dios',        key: 'dios',        label: 'DIOs',             ic: 'brief'    },
    { to: '/sg/pds',         key: 'pds',         label: 'PDs',              ic: 'users'    },
    { to: '/sg/programs',    key: 'programs',    label: 'Programs',         ic: 'layers'   },
    { to: '/sg/specialties', key: 'specialties', label: 'Specialties',      ic: 'book'     },
    { to: '/sg/trainees',    key: 'trainees',    label: 'Trainees',         ic: 'grad'     },
    { to: '/sg/reports',     key: 'reports',     label: 'Reports',          ic: 'doc'      },
  ],
  assistant_secretary: [
    { to: '/sg/dashboard',   key: 'dashboard',   label: 'Dashboard',        ic: 'grid'     },
    { to: '/sg/centers',     key: 'centers',     label: 'Training Centers', ic: 'building' },
    { to: '/sg/dios',        key: 'dios',        label: 'DIOs',             ic: 'brief'    },
    { to: '/sg/pds',         key: 'pds',         label: 'PDs',              ic: 'users'    },
    { to: '/sg/programs',    key: 'programs',    label: 'Programs',         ic: 'layers'   },
    { to: '/sg/specialties', key: 'specialties', label: 'Specialties',      ic: 'book'     },
    { to: '/sg/trainees',    key: 'trainees',    label: 'Trainees',         ic: 'grad'     },
    { to: '/sg/reports',     key: 'reports',     label: 'Reports',          ic: 'doc'      },
  ],
  // Sub-PD — read-only mirror of the PD screens it can reach today (Supervisors
  // link retired). Widening evaluations/log-book/reports to sub_pd needs matching
  // route allow-list changes in App.jsx (left to the PD wave).
  sub_pd: [
    { to: '/program-director/dashboard', key: 'dashboard', label: 'Dashboard',  ic: 'grid'   },
    { to: '/program-director/program',   key: 'program',   label: 'My Program', ic: 'layers' },
    { to: '/program-director/trainees',  key: 'trainees',  label: 'Trainees',   ic: 'grad'   },
  ],
};

export const ROLE_LINKS = {
  ...ADVANCED_LINKS,
  // The Basic (b_*) mirror only prefixes links that have a real /basic route.
  // Links flagged `advancedOnly` (logbook, announcements, PD dashboard/program)
  // have no /basic counterpart, so they are dropped from the b_* navbars to
  // avoid 404s — advanced navbars keep them (ADVANCED_LINKS is spread as-is).
  ...Object.fromEntries(
    MIRRORED.map(base => ['b_' + base, ADVANCED_LINKS[base]
      .filter(l => !l.advancedOnly)
      .map(l => ({ ...l, to: '/basic' + l.to }))]),
  ),
};
