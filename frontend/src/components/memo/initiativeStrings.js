// Localized strings for the Training Program Initiatives feature.
// Mirrors the AR/EN + RTL/LTR pattern used by MemoPrefs. Checkpoint KEYS are
// stored on the server; these tables localize them for display only.

// Stage order = Kanban order (right→left in RTL).
export const STAGES_ORDER = ['under_study', 'foundational', 'final'];

export const LEVELS = ['primary', 'subspecialty'];

// "أخرى" sentinel — picking it reveals a free-text field for a custom source.
export const SOURCE_OTHER = 'أخرى';

// Fixed list of scientific councils offered as the initiative "source"
// (searchable combobox). أخرى is pinned last by CouncilSelect.
export const SOURCE_OPTIONS = [
  'المجلس العلمي للجراحة',
  'المجلس العلمي للأمراض الباطنة',
  'المجلس العلمي للولادة وأمراض النساء',
  'المجلس العلمي لطب الأطفال',
  'المجلس العلمي لطب الأسرة',
  'المجلس العلمي لطب المجتمع',
  'المجلس العلمي للطب النفسي',
  'المجلس العلمي للتخدير والعناية المركزة',
  'المجلس العلمي للأمراض الجلدية والتناسلية',
  'المجلس العلمي لطب العيون وجراحتها',
  'المجلس العلمي للأذن والأنف والحنجرة والرأس والعنق وجراحتها',
  'المجلس العلمي لجراحة الفم والوجه والفكين',
  'المجلس العلمي لطب الطوارئ',
  'المجلس العلمي للأشعة والتصوير الطبي',
  'المجلس العلمي لجراحة العظام',
  'المجلس العلمي لجراحة المسالك البولية',
  'المجلس العلمي لعلم الأمراض',
  'المجلس العلمي للتمريض والقبالة',
  'المجلس العلمي للجراحة العصبية',
  'المجلس العلمي للأورام',
  SOURCE_OTHER,
];

// Which checkpoint keys belong to each stage (mirrors the backend
// utils/initiativeCheckpoints — keep in sync).
export const STAGE_CHECKPOINTS = {
  under_study: ['conceptDraft', 'execAdvisory'],
  foundational: ['conceptApproved', 'feasibility', 'sgApproval', 'execAdvisory', 'execOffice'],
  final: ['foundingCommittee', 'sgApprovalCommittee', 'guidePrepared', 'guideApproved', 'programAnnounced'],
};

export const STAGE_LABELS = {
  ar: { under_study: 'قيد الدراسة', foundational: 'مرحلة أساسية', final: 'مرحلة نهائية' },
  en: { under_study: 'Under study', foundational: 'Foundational', final: 'Final' },
};

export const LEVEL_LABELS = {
  ar: { primary: 'رئيسي', subspecialty: 'دقيق' },
  en: { primary: 'Primary', subspecialty: 'Subspecialty' },
};

export const CHECKPOINT_LABELS = {
  conceptDraft:        { ar: 'اعداد التصور في المجلس العلمي', en: 'Concept drafted in scientific council' },
  execAdvisory:        { ar: 'تنفيذية - استشاري', en: 'Executive / advisory' },
  conceptApproved:     { ar: 'اعتماد التصور - المجلس العلمي', en: 'Concept approved by scientific council' },
  feasibility:         { ar: 'دراسة الجدوى (توفر برامج تدريبية ومتدربين)', en: 'Feasibility study (training programs & trainees available)' },
  sgApproval:          { ar: 'اعتماد الأمين العام', en: 'Secretary-General approval' },
  execOffice:          { ar: 'المكتب التنفيذي', en: 'Executive office' },
  foundingCommittee:   { ar: 'ترشيح اللجنة التأسيسية من المجلس العلمي', en: 'Founding committee nomination' },
  sgApprovalCommittee: { ar: 'اعتماد الأمين العام واستكمال اللجنة', en: 'SG approval & committee completion' },
  guidePrepared:       { ar: 'اعداد دليل الاختصاص من قبل اللجنة التأسيسية', en: 'Specialty guide prepared by committee' },
  guideApproved:       { ar: 'اعتماد دليل الاختصاص من قبل المجلس العلمي', en: 'Specialty guide approved by scientific council' },
  programAnnounced:    { ar: 'اعلان البرنامج - الأمانة العامة', en: 'Program announcement by General Secretariat' },
};

export const INIT_STRINGS = {
  ar: {
    navLabel: 'المبادرات',
    navTitleL1: 'مبادرات استحداث',
    navTitleL2: 'برامج تدريبية',
    pageTitle: 'مبادرات استحداث برامج تدريبية',
    addInitiative: 'إضافة مبادرة',
    deletedTab: 'المحذوفة',
    deletedTitle: 'المبادرات المحذوفة',
    deletedEmpty: 'لا توجد مبادرات محذوفة',
    restore: 'استعادة',
    restoredToast: 'تمت استعادة المبادرة',
    deletedAtLabel: 'حُذفت',
    boardLoading: 'جارٍ التحميل…',
    boardEmpty: 'لا توجد مبادرات بعد',
    columnEmpty: 'لا توجد مبادرات في هذه المرحلة',
    levelLabel: 'المستوى',
    sourceLabel: 'المصدر',
    back: 'رجوع',
    // detail sections
    secData: 'بيانات المبادرة',
    secSteps: 'خطوات الاعتماد',
    secAttachments: 'المرفقات',
    secNotes: 'ملاحظات',
    name: 'اسم المبادرة',
    source: 'مصدر المبادرة',
    level: 'المستوى',
    addedDate: 'تاريخ الإدراج',
    // checkpoint toggle
    done: 'تم',
    inProgress: 'قيد الإنجاز',
    notePlaceholder: 'ملاحظة (اختياري)',
    noDate: '—',
    // stage move
    moveNext: 'نقل إلى المرحلة التالية',
    moveBack: 'إرجاع إلى مرحلة سابقة',
    moveTo: 'نقل إلى',
    // attachments / notes
    uploadFile: 'رفع ملف (PDF، Word…)',
    uploading: 'جارٍ الرفع…',
    removeFile: 'حذف الملف',
    notesPlaceholder: 'اكتب ملاحظاتك هنا…',
    // actions
    save: 'حفظ',
    cancel: 'إلغاء',
    saving: 'جارٍ الحفظ…',
    delete: 'حذف',
    deleteConfirmTitle: 'حذف المبادرة؟',
    deleteConfirmBody: 'سيتم نقل المبادرة إلى الأرشيف ولن تظهر في اللوحة.',
    deleteYes: 'نعم، احذف',
    // toasts
    createdToast: 'تمت إضافة المبادرة',
    savedToast: 'تم الحفظ بنجاح',
    movedToast: 'تم نقل المبادرة',
    checkpointToast: 'تم تحديث الخطوة',
    deletedToast: 'تم حذف المبادرة',
    uploadFailed: 'فشل رفع الملف',
    loadError: 'تعذر تحميل البيانات',
    actionError: 'حدث خطأ، حاول مجددًا',
    newName: 'اسم المبادرة الجديدة',
  },
  en: {
    navLabel: 'Initiatives',
    navTitleL1: 'Training Program',
    navTitleL2: 'Initiatives',
    pageTitle: 'Training Program Initiatives',
    addInitiative: 'Add initiative',
    deletedTab: 'Deleted',
    deletedTitle: 'Deleted initiatives',
    deletedEmpty: 'No deleted initiatives',
    restore: 'Restore',
    restoredToast: 'Initiative restored',
    deletedAtLabel: 'Deleted',
    boardLoading: 'Loading…',
    boardEmpty: 'No initiatives yet',
    columnEmpty: 'No initiatives in this stage',
    levelLabel: 'Level',
    sourceLabel: 'Source',
    back: 'Back',
    secData: 'Initiative details',
    secSteps: 'Approval steps',
    secAttachments: 'Attachments',
    secNotes: 'Notes',
    name: 'Initiative name',
    source: 'Initiative source',
    level: 'Level',
    addedDate: 'Date added',
    done: 'Done',
    inProgress: 'In progress',
    notePlaceholder: 'Note (optional)',
    noDate: '—',
    moveNext: 'Move to next stage',
    moveBack: 'Move back a stage',
    moveTo: 'Move to',
    uploadFile: 'Upload file (PDF, Word…)',
    uploading: 'Uploading…',
    removeFile: 'Remove file',
    notesPlaceholder: 'Write your notes here…',
    save: 'Save',
    cancel: 'Cancel',
    saving: 'Saving…',
    delete: 'Delete',
    deleteConfirmTitle: 'Delete initiative?',
    deleteConfirmBody: 'The initiative will be archived and removed from the board.',
    deleteYes: 'Yes, delete',
    createdToast: 'Initiative added',
    savedToast: 'Saved successfully',
    movedToast: 'Initiative moved',
    checkpointToast: 'Step updated',
    deletedToast: 'Initiative deleted',
    uploadFailed: 'File upload failed',
    loadError: 'Failed to load data',
    actionError: 'Something went wrong, try again',
    newName: 'New initiative name',
  },
};

// Convenience getters that fall back to Arabic, mirroring MemoPrefs.t.
export const stageLabel = (stage, lang) => STAGE_LABELS[lang]?.[stage] ?? STAGE_LABELS.ar[stage] ?? stage;
export const levelLabel = (level, lang) => LEVEL_LABELS[lang]?.[level] ?? LEVEL_LABELS.ar[level] ?? level;
export const checkpointLabel = (key, lang) => CHECKPOINT_LABELS[key]?.[lang] ?? CHECKPOINT_LABELS[key]?.ar ?? key;
