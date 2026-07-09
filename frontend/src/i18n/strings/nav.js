// Navbar strings — flat dotted keys "nav.<role>.<linkKey>" for every link
// label in Navbar's ROLE_LINKS, plus the theme/language toggle aria-labels.
//
// Shape: { ar: { "nav.dotted.key": "…" }, en: { … } } (default export).
// Resolution lives in src/i18n/index.js: dict[lang][key] ?? dict.ar[key] ?? key.
//
// NOTE: the ASG.1 / ASG.2 consultant-memo link keeps its own dynamic label
// (APP_NAV_LABEL, synced via 'cm-lang-changed') and is intentionally NOT here.

const nav = {
  ar: {
    // super_admin
    'nav.super_admin.dashboard':         'لوحة التحكم',
    'nav.super_admin.users':             'المستخدمون',
    'nav.super_admin.hospitals':         'المستشفيات',
    'nav.super_admin.specialties':       'التخصصات',
    'nav.super_admin.certificates':      'الشهادات',
    'nav.super_admin.audit_log':         'سجل التدقيق',

    // secretary
    'nav.secretary.trainees':            'المتدربون',
    'nav.secretary.supervisors':         'المشرفون',
    'nav.secretary.program_directors':   'مديرو البرامج',
    'nav.secretary.hospitals':           'المستشفيات',

    // dio
    'nav.dio.dashboard':                 'لوحة التحكم',
    'nav.dio.users':                     'المستخدمون',
    'nav.dio.hospitals':                 'المستشفيات',
    'nav.dio.assignments':               'التوزيع والتدويرات',
    'nav.dio.evaluations':               'التقييمات',
    'nav.dio.certificates':              'الشهادات',
    // legacy keys (routes kept for deep links / super_admin)
    'nav.dio.trainees':                  'المتدربون',
    'nav.dio.supervisors':               'المشرفون',
    'nav.dio.program_directors':         'مديرو البرامج',
    'nav.dio.secretaries':               'السكرتارية',
    'nav.dio.distributions':             'توزيع المشرفين',
    'nav.dio.rotations':                 'التدويرات',

    // supervisor
    'nav.supervisor.trainees':           'متدربيّ',
    'nav.supervisor.reports':            'التقارير',
    'nav.supervisor.evaluations':        'التقييمات',

    // trainee
    'nav.trainee.timeline':              'الجدول الزمني',
    'nav.trainee.reports':               'تقاريري',
    'nav.trainee.grades':                'الدرجات',

    // president
    'nav.president.trainees':            'المتدربون',
    'nav.president.supervisors':         'المشرفون',
    'nav.president.program_directors':   'مديرو البرامج',
    'nav.president.dios':                'مديرو التدريب',
    'nav.president.secretaries':         'السكرتارية',
    'nav.president.hospitals':           'المستشفيات',

    // program_director
    'nav.program_director.trainees':     'المتدربون',
    'nav.program_director.supervisors':  'المشرفون',
    'nav.program_director.reports':      'التقارير',

    // toggle aria-labels
    'nav.toggle.theme.dark':             'تفعيل الوضع الداكن',
    'nav.toggle.theme.light':            'تفعيل الوضع الفاتح',
    'nav.toggle.lang.ar':                'التبديل إلى العربية',
    'nav.toggle.lang.en':                'التبديل إلى الإنجليزية',
  },
  en: {
    // super_admin
    'nav.super_admin.dashboard':         'Dashboard',
    'nav.super_admin.users':             'Users',
    'nav.super_admin.hospitals':         'Hospitals',
    'nav.super_admin.specialties':       'Specialties',
    'nav.super_admin.certificates':      'Certificates',
    'nav.super_admin.audit_log':         'Audit Log',

    // secretary
    'nav.secretary.trainees':            'Trainees',
    'nav.secretary.supervisors':         'Supervisors',
    'nav.secretary.program_directors':   'Program Directors',
    'nav.secretary.hospitals':           'Hospitals',

    // dio
    'nav.dio.dashboard':                 'Dashboard',
    'nav.dio.users':                     'Users',
    'nav.dio.hospitals':                 'Hospitals',
    'nav.dio.assignments':               'Assignments',
    'nav.dio.evaluations':               'Evaluations',
    'nav.dio.certificates':              'Certificates',
    // legacy keys (routes kept for deep links / super_admin)
    'nav.dio.trainees':                  'Trainees',
    'nav.dio.supervisors':               'Supervisors',
    'nav.dio.program_directors':         'Prog.Directors',
    'nav.dio.secretaries':               'Secretaries',
    'nav.dio.distributions':             'Sup.Dist.',
    'nav.dio.rotations':                 'Rotations',

    // supervisor
    'nav.supervisor.trainees':           'My Trainees',
    'nav.supervisor.reports':            'Reports',
    'nav.supervisor.evaluations':        'Evaluations',

    // trainee
    'nav.trainee.timeline':              'Timeline',
    'nav.trainee.reports':               'My Reports',
    'nav.trainee.grades':                'Grades',

    // president
    'nav.president.trainees':            'Trainees',
    'nav.president.supervisors':         'Supervisors',
    'nav.president.program_directors':   'Prog.Directors',
    'nav.president.dios':                'DIOs',
    'nav.president.secretaries':         'Secretaries',
    'nav.president.hospitals':           'Hospitals',

    // program_director
    'nav.program_director.trainees':     'Trainees',
    'nav.program_director.supervisors':  'Supervisors',
    'nav.program_director.reports':      'Reports',

    // toggle aria-labels
    'nav.toggle.theme.dark':             'Switch to dark mode',
    'nav.toggle.theme.light':            'Switch to light mode',
    'nav.toggle.lang.ar':                'Switch to Arabic',
    'nav.toggle.lang.en':                'Switch to English',
  },
};

export default nav;
