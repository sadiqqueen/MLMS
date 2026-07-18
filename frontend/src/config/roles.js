// Centralised role → routing config, shared by App.jsx, ProtectedRoute.jsx and
// Navbar.jsx (each previously kept its own ROLE_HOME copy).
//
// The Basic-Training portal mirrors the Advanced portal: every `b_<role>` reuses
// the exact same page components under a `/basic` URL prefix. The backend scopes
// a `b_*` user to Basic-track data, so the pages need no data changes — only
// their routing/nav is prefixed.

export const BASIC_ROLES = [
  'b_trainee', 'b_supervisor', 'b_program_director', 'b_secretary', 'b_dio', 'b_president',
];

// Advanced roles that have a Basic counterpart.
const MIRRORED = ['trainee', 'supervisor', 'program_director', 'secretary', 'dio', 'president'];

export function isBasicRole(role) {
  return typeof role === 'string' && role.startsWith('b_');
}

// 'b_supervisor' → 'supervisor'  (Advanced roles pass through unchanged).
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
  super_admin:         { en: 'Developer',            ar: 'مطور النظام' },
  secretary_general:   { en: 'Secretary General',    ar: 'الأمين العام' },
  assistant_secretary: { en: 'Assistant Secretary',  ar: 'مساعد الأمين العام' },
  data_analyzer:       { en: 'Data Analyzer',        ar: 'محلل البيانات' },
  data_entry:          { en: 'Data Entry',           ar: 'مدخل البيانات' },
  central_secretary:   { en: 'Central Secretary',    ar: 'السكرتير المركزي' },
  dio_view:            { en: 'DIO',                  ar: 'DIO' },
  dio:                 { en: 'ODIO',                 ar: 'ODIO' },
  sub_dio:             { en: 'Sub-DIO',              ar: 'Sub-DIO' },
  program_director:    { en: 'Program Director',     ar: 'مدير البرنامج' },
  sub_pd:              { en: 'Sub-PD',               ar: 'نائب مدير البرنامج' },
  supervisor:          { en: 'Trainer',             ar: 'مدرب' },
  trainee:             { en: 'Trainee',             ar: 'متدرب' },
  secretary:           { en: 'Secretary',           ar: 'سكرتير' },
  president:           { en: 'President',            ar: 'الرئيس' },
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
export const READ_ONLY_ROLES = ['president', 'dio_view', 'sub_dio', 'sub_pd', 'secretary_general', 'assistant_secretary'];

// ── Landing route per role ───────────────────────────────────────────────────
const ADVANCED_HOME = {
  super_admin:      '/admin/dashboard',
  secretary:        '/secretary/trainees',
  dio:              '/dio/dashboard',
  supervisor:       '/supervisor/trainees',
  trainee:          '/timeline',
  president:        '/president/dashboard',
  program_director: '/program-director/trainees',
  asg1:             '/consultant-memo',
  asg2:             '/consultant-memo',
  // v2 roles — Phase-1 temporary homes (final homes ship with their pages).
  dio_view:            '/president/dashboard',
  secretary_general:   '/profile',
  assistant_secretary: '/profile',
  data_analyzer:       '/profile',
  data_entry:          '/registry/centers',
  central_secretary:   '/profile',
  sub_dio:             '/profile',
  sub_pd:              '/profile',
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
  super_admin: [
    { to: '/admin/dashboard',    key: 'dashboard',    label: 'Dashboard'    },
    { to: '/admin/users',        key: 'users',        label: 'Users'        },
    { to: '/admin/hospitals',    key: 'hospitals',    label: 'Hospitals'    },
    { to: '/admin/certificates', key: 'certificates', label: 'Certificates' },
    { to: '/admin/event-feedback', key: 'event_feedback', label: 'Event Feedback' },
    { to: '/admin/audit-log',    key: 'audit_log',    label: 'Audit Log'    },
  ],
  secretary: [
    { to: '/secretary/trainees',    key: 'trainees',    label: 'Trainees'    },
    { to: '/secretary/supervisors', key: 'supervisors', label: 'Supervisors' },
    { to: '/secretary/hospitals',   key: 'hospitals',   label: 'Hospitals'   },
    { to: '/secretary/research',    key: 'research',    label: 'Research'    },
  ],
  dio: [
    { to: '/dio/dashboard',    key: 'dashboard',    label: 'Dashboard'    },
    { to: '/dio/users',        key: 'users',        label: 'Users'        },
    { to: '/dio/hospitals',    key: 'hospitals',    label: 'Hospitals'    },
    { to: '/dio/assignments',  key: 'assignments',  label: 'Assignments'  },
    { to: '/dio/evaluations',  key: 'evaluations',  label: 'Evaluations'  },
    { to: '/dio/certificates', key: 'certificates', label: 'Certificates' },
    { to: '/dio/approvals',    key: 'approvals',    label: 'Promotions'   },
  ],
  asg1: [ { to: '/consultant-memo', label: 'مذكرة الاستشاري' } ],
  asg2: [ { to: '/consultant-memo', label: 'مذكرة الاستشاري' } ],
  supervisor: [
    { to: '/supervisor/trainees',    key: 'trainees',    label: 'My Trainees' },
    { to: '/supervisor/reports',     key: 'reports',     label: 'Reports'     },
    { to: '/supervisor/evaluations', key: 'evaluations', label: 'Evaluations' },
    { to: '/supervisor/research',    key: 'research',    label: 'Research'    },
  ],
  trainee: [
    { to: '/timeline', key: 'timeline', label: 'Timeline' },
    { to: '/reports',  key: 'reports',  label: 'Reports'  },
    { to: '/grades',   key: 'grades',   label: 'Portfolio' },
    { to: '/certificates-courses', key: 'courses', label: 'Certificates' },
    { to: '/research', key: 'research', label: 'Research' },
    { to: '/notifications', key: 'notifications', label: 'Notifications' },
  ],
  president: [
    { to: '/president/dashboard',         key: 'dashboard',         label: 'Dashboard'      },
    { to: '/president/trainees',          key: 'trainees',          label: 'Trainees'       },
    { to: '/president/supervisors',       key: 'supervisors',       label: 'Supervisors'    },
    { to: '/president/program-directors', key: 'program_directors', label: 'Prog.Directors' },
    { to: '/president/dios',              key: 'dios',              label: 'DIOs'           },
    { to: '/president/secretaries',       key: 'secretaries',       label: 'Secretaries'    },
    { to: '/president/hospitals',         key: 'hospitals',         label: 'Hospitals'      },
  ],
  program_director: [
    { to: '/program-director/trainees',    key: 'trainees',    label: 'Trainees'    },
    { to: '/program-director/supervisors', key: 'supervisors', label: 'Supervisors' },
    { to: '/program-director/evaluations', key: 'evaluations', label: 'Evaluations' },
    { to: '/program-director/reports',     key: 'reports',     label: 'Reports'     },
  ],
  data_entry: [
    { to: '/registry/centers',     key: 'centers',     label: 'Training Centers' },
    { to: '/registry/countries',   key: 'countries',   label: 'Countries' },
    { to: '/registry/specialties', key: 'specialties', label: 'Specialties' },
    { to: '/registry/dios',        key: 'dios',        label: 'DIOs' },
    { to: '/registry/pds',         key: 'pds',         label: 'PDs' },
  ],
};

export const ROLE_LINKS = {
  ...ADVANCED_LINKS,
  ...Object.fromEntries(
    MIRRORED.map(base => ['b_' + base, ADVANCED_LINKS[base].map(l => ({ ...l, to: '/basic' + l.to }))]),
  ),
};
