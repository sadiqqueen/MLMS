// Shared vocabulary reused across the whole app (actions, roles, statuses).
// Arabic wording reuses the existing memo (MemoPrefs.jsx STRINGS) and
// initiatives (initiativeStrings.js INIT_STRINGS) phrasing where equivalent.
// Flat dotted keys, namespaced under "common.*".

export default {
  ar: {
    // actions — verbs reused across forms, tables, toolbars, dialogs
    'common.actions.save': 'حفظ',
    'common.actions.cancel': 'إلغاء',
    'common.actions.edit': 'تعديل',
    'common.actions.delete': 'حذف',
    'common.actions.add': 'إضافة',
    'common.actions.search': 'بحث',
    'common.actions.close': 'إغلاق',
    'common.actions.confirm': 'تأكيد',
    'common.actions.print': 'طباعة',
    'common.actions.back': 'رجوع',
    'common.actions.view': 'عرض',
    'common.actions.reactivate': 'إعادة تفعيل',
    'common.actions.deactivate': 'إلغاء التفعيل',

    // roles — canonical role display names
    'common.role.trainee': 'متدرب',
    'common.role.supervisor': 'مشرف',
    'common.role.program_director': 'مدير برنامج',
    'common.role.secretary': 'سكرتير',
    'common.role.dio': 'مدير التعليم',
    'common.role.president': 'رئيس',
    'common.role.super_admin': 'مدير النظام',
    'common.role.asg1': 'مساعد الأمين العام (١)',
    'common.role.asg2': 'مساعد الأمين العام (٢)',

    // status — record/entity states
    'common.status.active': 'نشط',
    'common.status.inactive': 'غير نشط',
    'common.status.graded': 'مُقيَّم',
    'common.status.ungraded': 'غير مُقيَّم',
    'common.status.pending': 'قيد الانتظار',
    'common.status.completed': 'مكتمل',
  },
  en: {
    // actions
    'common.actions.save': 'Save',
    'common.actions.cancel': 'Cancel',
    'common.actions.edit': 'Edit',
    'common.actions.delete': 'Delete',
    'common.actions.add': 'Add',
    'common.actions.search': 'Search',
    'common.actions.close': 'Close',
    'common.actions.confirm': 'Confirm',
    'common.actions.print': 'Print',
    'common.actions.back': 'Back',
    'common.actions.view': 'View',
    'common.actions.reactivate': 'Reactivate',
    'common.actions.deactivate': 'Deactivate',

    // roles
    'common.role.trainee': 'Trainee',
    'common.role.supervisor': 'Supervisor',
    'common.role.program_director': 'Program Director',
    'common.role.secretary': 'Secretary',
    'common.role.dio': 'DIO',
    'common.role.president': 'President',
    'common.role.super_admin': 'Super Admin',
    'common.role.asg1': 'Assistant Secretary-General (1)',
    'common.role.asg2': 'Assistant Secretary-General (2)',

    // status
    'common.status.active': 'Active',
    'common.status.inactive': 'Inactive',
    'common.status.graded': 'Graded',
    'common.status.ungraded': 'Ungraded',
    'common.status.pending': 'Pending',
    'common.status.completed': 'Completed',
  },
};
