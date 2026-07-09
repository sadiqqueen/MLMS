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

// ── Landing route per role ───────────────────────────────────────────────────
const ADVANCED_HOME = {
  super_admin:      '/admin/dashboard',
  secretary:        '/secretary/trainees',
  dio:              '/dio/dashboard',
  supervisor:       '/supervisor/trainees',
  trainee:          '/timeline',
  president:        '/president/trainees',
  program_director: '/program-director/trainees',
  asg1:             '/consultant-memo',
  asg2:             '/consultant-memo',
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
    { to: '/admin/specialties',  key: 'specialties',  label: 'Specialties'  },
    { to: '/admin/certificates', key: 'certificates', label: 'Certificates' },
    { to: '/admin/audit-log',    key: 'audit_log',    label: 'Audit Log'    },
  ],
  secretary: [
    { to: '/secretary/trainees',    key: 'trainees',    label: 'Trainees'    },
    { to: '/secretary/supervisors', key: 'supervisors', label: 'Supervisors' },
    { to: '/secretary/hospitals',   key: 'hospitals',   label: 'Hospitals'   },
  ],
  dio: [
    { to: '/dio/dashboard',    key: 'dashboard',    label: 'Dashboard'    },
    { to: '/dio/users',        key: 'users',        label: 'Users'        },
    { to: '/dio/hospitals',    key: 'hospitals',    label: 'Hospitals'    },
    { to: '/dio/assignments',  key: 'assignments',  label: 'Assignments'  },
    { to: '/dio/evaluations',  key: 'evaluations',  label: 'Evaluations'  },
    { to: '/dio/certificates', key: 'certificates', label: 'Certificates' },
  ],
  asg1: [ { to: '/consultant-memo', label: 'مذكرة الاستشاري' } ],
  asg2: [ { to: '/consultant-memo', label: 'مذكرة الاستشاري' } ],
  supervisor: [
    { to: '/supervisor/trainees',    key: 'trainees',    label: 'My Trainees' },
    { to: '/supervisor/reports',     key: 'reports',     label: 'Reports'     },
    { to: '/supervisor/evaluations', key: 'evaluations', label: 'Evaluations' },
  ],
  trainee: [
    { to: '/timeline', key: 'timeline', label: 'Timeline' },
    { to: '/reports',  key: 'reports',  label: 'Reports'  },
    { to: '/grades',   key: 'grades',   label: 'Grades'   },
  ],
  president: [
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
    { to: '/program-director/reports',     key: 'reports',     label: 'Reports'     },
  ],
};

export const ROLE_LINKS = {
  ...ADVANCED_LINKS,
  ...Object.fromEntries(
    MIRRORED.map(base => ['b_' + base, ADVANCED_LINKS[base].map(l => ({ ...l, to: '/basic' + l.to }))]),
  ),
};
