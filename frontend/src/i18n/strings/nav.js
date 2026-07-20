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
    'nav.super_admin.hospitals':         'مراكز التدريب',
    'nav.super_admin.specialties':       'التخصصات',
    'nav.super_admin.system':            'النظام',
    'nav.super_admin.event_feedback':    'تقييم الفعاليات',
    'nav.super_admin.audit_log':         'سجل التدقيق',

    // secretary
    'nav.secretary.trainees':            'المتدربون',
    'nav.secretary.supervisors':         'المشرفون',
    'nav.secretary.program_directors':   'مديرو البرامج',
    'nav.secretary.hospitals':           'المستشفيات',
    'nav.secretary.research':            'الأبحاث',

    // dio
    'nav.dio.dashboard':                 'لوحة التحكم',
    'nav.dio.users':                     'المستخدمون',
    'nav.dio.hospitals':                 'المستشفيات',
    'nav.dio.assignments':               'التوزيع والتدويرات',
    'nav.dio.evaluations':               'التقييمات',
    'nav.dio.certificates':              'الشهادات',
    'nav.dio.approvals':                 'الموافقات',
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
    'nav.supervisor.logbook':            'سجل الإجراءات',
    'nav.supervisor.research':           'الأبحاث',
    'nav.supervisor.announcements':      'الإعلانات',

    // trainee
    'nav.trainee.timeline':              'الجدول الزمني',
    'nav.trainee.reports':               'التقارير',
    'nav.trainee.grades':                'الدرجات',
    'nav.trainee.courses':               'الشهادات والدورات',
    'nav.trainee.logbook':               'سجل الإجراءات',
    'nav.trainee.research':              'الأبحاث والمنشورات',
    'nav.trainee.announcements':         'الإعلانات',
    'nav.trainee.notifications':         'الإشعارات',

    // president
    'nav.president.dashboard':           'لوحة التحكم',
    'nav.president.trainees':            'المتدربون',
    'nav.president.supervisors':         'المشرفون',
    'nav.president.program_directors':   'مديرو البرامج',
    'nav.president.dios':                'مديرو التدريب',
    'nav.president.secretaries':         'السكرتارية',
    'nav.president.hospitals':           'المستشفيات',

    // program_director
    'nav.program_director.dashboard':    'لوحة التحكم',
    'nav.program_director.program':      'برنامجي',
    'nav.program_director.trainees':     'المتدربون',
    'nav.program_director.supervisors':  'المشرفون',
    'nav.program_director.evaluations':  'التقييمات',
    'nav.program_director.reports':      'التقارير',
    'nav.program_director.announcements': 'الإعلانات',

    // data_entry (registry)
    'nav.data_entry.centers':            'المراكز التدريبية',
    'nav.data_entry.countries':          'الدول',
    'nav.data_entry.specialties':        'الاختصاصات',
    'nav.data_entry.dios':               'DIOs',
    'nav.data_entry.pds':                'مدراء البرامج',

    // data_analyzer
    'nav.data_analyzer.dashboard':       'لوحة التحكم',
    'nav.data_analyzer.staff':           'الموظفون',
    'nav.data_analyzer.exports':         'التصدير والتقارير',

    // central_secretary
    'nav.central_secretary.trainees':    'المتدربون',
    'nav.central_secretary.trainers':    'المدربون',

    // dio_view (DIO)
    'nav.dio_view.dashboard':            'لوحة التحكم',
    'nav.dio_view.centers':              'المراكز التدريبية',
    'nav.dio_view.pds':                  'مدراء البرامج',
    'nav.dio_view.trainees':             'المتدربون',
    'nav.dio_view.trainers':             'المدربون',
    'nav.dio_view.certificates':         'الشهادات',

    // sub_dio (Sub-DIO)
    'nav.sub_dio.dashboard':             'لوحة التحكم',
    'nav.sub_dio.centers':               'المراكز التدريبية',
    'nav.sub_dio.pds':                   'مدراء البرامج',
    'nav.sub_dio.trainees':              'المتدربون',
    'nav.sub_dio.trainers':              'المدربون',
    'nav.sub_dio.certificates':          'الشهادات',

    // secretary_general
    'nav.secretary_general.dashboard':   'لوحة التحكم',
    'nav.secretary_general.centers':     'المراكز التدريبية',
    'nav.secretary_general.dios':        'DIOs',
    'nav.secretary_general.specialties': 'الاختصاصات',
    'nav.secretary_general.programs':    'البرامج',
    'nav.secretary_general.pds':         'مدراء البرامج',
    'nav.secretary_general.trainees':    'المتدربون',
    'nav.secretary_general.reports':     'التقارير',

    // assistant_secretary
    'nav.assistant_secretary.dashboard':   'لوحة التحكم',
    'nav.assistant_secretary.centers':     'المراكز التدريبية',
    'nav.assistant_secretary.dios':        'DIOs',
    'nav.assistant_secretary.specialties': 'الاختصاصات',
    'nav.assistant_secretary.programs':    'البرامج',
    'nav.assistant_secretary.pds':         'مدراء البرامج',
    'nav.assistant_secretary.trainees':    'المتدربون',
    'nav.assistant_secretary.reports':     'التقارير',

    // sub_pd (Sub-PD)
    'nav.sub_pd.dashboard':              'لوحة التحكم',
    'nav.sub_pd.program':                'برنامجي',
    'nav.sub_pd.trainees':               'المتدربون',
    'nav.sub_pd.supervisors':            'المدربون',

    // ── mt- redesign: new nav keys (Agent F) ──
    'nav.hoc.dashboard':                 'لوحة التحكم',
    'nav.hoc.centers':                   'المراكز التدريبية',
    'nav.hoc.programs':                  'البرامج',
    'nav.central_secretary.dashboard':   'لوحة التحكم',
    'nav.central_secretary.countries':   'الدول',
    'nav.central_secretary.centers':     'المراكز التدريبية',
    'nav.central_secretary.programs':    'البرامج',
    'nav.data_entry.dashboard':          'لوحة التحكم',
    'nav.data_entry.programs':           'البرامج',
    'nav.data_analyzer.countries':       'الدول',
    'nav.data_analyzer.centers':         'المراكز التدريبية',
    'nav.data_analyzer.dios':            'DIOs',
    'nav.data_analyzer.programs':        'البرامج',
    'nav.data_analyzer.pds':             'مدراء البرامج',
    'nav.data_analyzer.clerks':          'مدخلو البيانات',
    'nav.data_analyzer.hocs':            'رؤساء المجالس',
    'nav.data_analyzer.specialties':     'الاختصاصات',
    'nav.data_analyzer.central_secretaries': 'السكرتارية المركزية',
    'nav.data_analyzer.trainees':        'المتدربون',
    'nav.data_analyzer.pending':         'التغييرات المعلقة',
    // head_cs — same nav as the data analyzer minus Exports & Reports.
    'nav.head_cs.dashboard':             'لوحة التحكم',
    'nav.head_cs.countries':             'الدول',
    'nav.head_cs.centers':               'المراكز التدريبية',
    'nav.head_cs.dios':                  'DIOs',
    'nav.head_cs.programs':              'البرامج',
    'nav.head_cs.pds':                   'مدراء البرامج',
    'nav.head_cs.clerks':                'مدخلو البيانات',
    'nav.head_cs.hocs':                  'رؤساء المجالس',
    'nav.head_cs.specialties':           'الاختصاصات',
    'nav.head_cs.central_secretaries':   'السكرتارية المركزية',
    'nav.head_cs.trainees':              'المتدربون',
    'nav.head_cs.pending':               'التغييرات المعلقة',
    'nav.dio.pd_assignment':             'إسناد مدير البرنامج',
    'nav.dio.training_centers':          'المراكز التدريبية',
    'nav.dio_view.odios':                'ODIOs',
    'nav.sub_dio.odios':                 'ODIOs',
    'nav.program_director.log_book':     'سجل الإجراءات',
    'nav.trainee.profile':               'الملف الشخصي',

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
    'nav.super_admin.hospitals':         'Training Centers',
    'nav.super_admin.specialties':       'Specialties',
    'nav.super_admin.system':            'System',
    'nav.super_admin.event_feedback':    'Event Feedback',
    'nav.super_admin.audit_log':         'Audit Log',

    // secretary
    'nav.secretary.trainees':            'Trainees',
    'nav.secretary.supervisors':         'Supervisors',
    'nav.secretary.program_directors':   'Program Directors',
    'nav.secretary.hospitals':           'Hospitals',
    'nav.secretary.research':            'Research',

    // dio
    'nav.dio.dashboard':                 'Dashboard',
    'nav.dio.users':                     'Users',
    'nav.dio.hospitals':                 'Hospitals',
    'nav.dio.assignments':               'Assignments',
    'nav.dio.evaluations':               'Evaluations',
    'nav.dio.certificates':              'Certificates',
    'nav.dio.approvals':                 'Approvals',
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
    'nav.supervisor.logbook':            'Log Book',
    'nav.supervisor.research':           'Research',
    'nav.supervisor.announcements':      'Announcements',

    // trainee
    'nav.trainee.timeline':              'Timeline',
    'nav.trainee.reports':               'Reports',
    'nav.trainee.grades':                'Grades',
    'nav.trainee.courses':               'Certificates & Courses',
    'nav.trainee.logbook':               'Log Book',
    'nav.trainee.research':              'Research',
    'nav.trainee.announcements':         'Announcements',
    'nav.trainee.notifications':         'Notifications',

    // president
    'nav.president.dashboard':           'Dashboard',
    'nav.president.trainees':            'Trainees',
    'nav.president.supervisors':         'Supervisors',
    'nav.president.program_directors':   'Prog.Directors',
    'nav.president.dios':                'DIOs',
    'nav.president.secretaries':         'Secretaries',
    'nav.president.hospitals':           'Hospitals',

    // program_director
    'nav.program_director.dashboard':    'Dashboard',
    'nav.program_director.program':      'My Program',
    'nav.program_director.trainees':     'Trainees',
    'nav.program_director.supervisors':  'Supervisors',
    'nav.program_director.evaluations':  'Evaluations',
    'nav.program_director.reports':      'Reports',
    'nav.program_director.announcements': 'Announcements',

    // data_entry (registry)
    'nav.data_entry.centers':            'Training Centers',
    'nav.data_entry.countries':          'Countries',
    'nav.data_entry.specialties':        'Specialties',
    'nav.data_entry.dios':               'DIOs',
    'nav.data_entry.pds':                'PDs',

    // data_analyzer
    'nav.data_analyzer.dashboard':       'Dashboard',
    'nav.data_analyzer.staff':           'Staff',
    'nav.data_analyzer.exports':         'Exports & Reports',

    // central_secretary
    'nav.central_secretary.trainees':    'Trainees',
    'nav.central_secretary.trainers':    'Trainers',

    // dio_view (DIO)
    'nav.dio_view.dashboard':            'Dashboard',
    'nav.dio_view.centers':              'Training Centers',
    'nav.dio_view.pds':                  'PDs',
    'nav.dio_view.trainees':             'Trainees',
    'nav.dio_view.trainers':             'Trainers',
    'nav.dio_view.certificates':         'Certificates',

    // sub_dio (Sub-DIO)
    'nav.sub_dio.dashboard':             'Dashboard',
    'nav.sub_dio.centers':               'Training Centers',
    'nav.sub_dio.pds':                   'PDs',
    'nav.sub_dio.trainees':              'Trainees',
    'nav.sub_dio.trainers':              'Trainers',
    'nav.sub_dio.certificates':          'Certificates',

    // secretary_general
    'nav.secretary_general.dashboard':   'Dashboard',
    'nav.secretary_general.centers':     'Training Centers',
    'nav.secretary_general.dios':        'DIOs',
    'nav.secretary_general.specialties': 'Specialties',
    'nav.secretary_general.programs':    'Programs',
    'nav.secretary_general.pds':         'PDs',
    'nav.secretary_general.trainees':    'Trainees',
    'nav.secretary_general.reports':     'Reports',

    // assistant_secretary
    'nav.assistant_secretary.dashboard':   'Dashboard',
    'nav.assistant_secretary.centers':     'Training Centers',
    'nav.assistant_secretary.dios':        'DIOs',
    'nav.assistant_secretary.specialties': 'Specialties',
    'nav.assistant_secretary.programs':    'Programs',
    'nav.assistant_secretary.pds':         'PDs',
    'nav.assistant_secretary.trainees':    'Trainees',
    'nav.assistant_secretary.reports':     'Reports',

    // sub_pd (Sub-PD)
    'nav.sub_pd.dashboard':              'Dashboard',
    'nav.sub_pd.program':                'My Program',
    'nav.sub_pd.trainees':               'Trainees',
    'nav.sub_pd.supervisors':            'Trainers',

    // ── mt- redesign: new nav keys (Agent F) ──
    'nav.hoc.dashboard':                 'Dashboard',
    'nav.hoc.centers':                   'Training Centers',
    'nav.hoc.programs':                  'Programs',
    'nav.central_secretary.dashboard':   'Dashboard',
    'nav.central_secretary.countries':   'Countries',
    'nav.central_secretary.centers':     'Training Centers',
    'nav.central_secretary.programs':    'Programs',
    'nav.data_entry.dashboard':          'Dashboard',
    'nav.data_entry.programs':           'Programs',
    'nav.data_analyzer.countries':       'Countries',
    'nav.data_analyzer.centers':         'Training Centers',
    'nav.data_analyzer.dios':            'DIOs',
    'nav.data_analyzer.programs':        'Programs',
    'nav.data_analyzer.pds':             'PDs',
    'nav.data_analyzer.clerks':          'Data Entry Clerks',
    'nav.data_analyzer.hocs':            'HOCs',
    'nav.data_analyzer.specialties':     'Specialties',
    'nav.data_analyzer.central_secretaries': 'Central Secretaries',
    'nav.data_analyzer.trainees':        'Trainees',
    'nav.data_analyzer.pending':         'Pending Changes',
    // head_cs — same nav as the data analyzer minus Exports & Reports.
    'nav.head_cs.dashboard':             'Dashboard',
    'nav.head_cs.countries':             'Countries',
    'nav.head_cs.centers':               'Training Centers',
    'nav.head_cs.dios':                  'DIOs',
    'nav.head_cs.programs':              'Programs',
    'nav.head_cs.pds':                   'PDs',
    'nav.head_cs.clerks':                'Data Entry Clerks',
    'nav.head_cs.hocs':                  'HOCs',
    'nav.head_cs.specialties':           'Specialties',
    'nav.head_cs.central_secretaries':   'Central Secretaries',
    'nav.head_cs.trainees':              'Trainees',
    'nav.head_cs.pending':               'Pending Changes',
    'nav.dio.pd_assignment':             'PD Assignment',
    'nav.dio.training_centers':          'Training Centers',
    'nav.dio_view.odios':                'ODIOs',
    'nav.sub_dio.odios':                 'ODIOs',
    'nav.program_director.log_book':     'Log Book',
    'nav.trainee.profile':               'Profile',

    // toggle aria-labels
    'nav.toggle.theme.dark':             'Switch to dark mode',
    'nav.toggle.theme.light':            'Switch to light mode',
    'nav.toggle.lang.ar':                'Switch to Arabic',
    'nav.toggle.lang.en':                'Switch to English',
  },
};

export default nav;
