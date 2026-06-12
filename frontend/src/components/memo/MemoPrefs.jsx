import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Theme + language preferences for the Consultant Memo feature ONLY.
// Persisted in localStorage; the main app Navbar listens for
// 'cm-lang-changed' to flip its own "مذكرة الاستشاري" label.

export const STRINGS = {
  ar: {
    // navbar
    navAria: 'شريط مذكرة الاستشاري',
    dark: 'داكن', light: 'فاتح',
    allMemos: 'جميع المذكرات', newMemo: 'مذكرة جديدة',
    backToApp: 'العودة إلى لوحة التحكم',
    // page
    pageTitle: 'استمارة العرض على المجلس العلمي الاستشاري',
    secTopic: 'بيانات الموضوع', secAttachments: 'المرفقات', secPresentation: 'العرض',
    secExec: 'اللجنة التنفيذية للمجلس العلمي الاستشاري',
    secPresRec: 'توصية معالي رئيس المجلس الاستشاري',
    secJoint: 'المجلس العلمي الاستشاري المشترك',
    topicName: 'اسم الموضوع', source: 'المصدر',
    dateTime: 'التاريخ والوقت:',
    addAttachment: '+ إضافة مرفق', removeAttachment: 'حذف المرفق', attachment: 'مرفق',
    save: 'حفظ', print: 'طباعة', preview: 'معاينة', closePreview: 'إغلاق المعاينة',
    autosaved: 'تم الحفظ تلقائيًا', saving: 'جارٍ الحفظ…',
    savedToast: 'تم الحفظ بنجاح', saveError: 'فشل الحفظ', loadError: 'تعذر تحميل المذكرة',
    unsavedConfirm: 'لديك تغييرات غير محفوظة. هل تريد المتابعة دون حفظ؟',
    loading: 'جارٍ التحميل…',
    // all-memos
    total: 'الإجمالي', searchPlaceholder: 'ابحث باسم الموضوع…',
    sortLabel: 'الترتيب', sortNewest: 'الأحدث أولاً', sortOldest: 'الأقدم أولاً', sortByName: 'حسب الاسم',
    chipSaved: 'محفوظة', chipDraft: 'مسودة',
    untitled: 'بدون عنوان', sourceLabel: 'المصدر:',
    created: 'أُنشئت', modified: 'آخر تعديل', movedToDraftAt: 'نُقلت للمسودة',
    openEdit: 'فتح وتعديل', open: 'فتح', duplicate: 'نسخ',
    moveToDraft: 'نقل إلى المسودة', restore: 'استعادة', deleteForever: 'حذف نهائي',
    deleteConfirmTitle: 'حذف نهائي؟', deleteConfirmBody: 'لا يمكن التراجع عن هذا الإجراء.',
    deleteYes: 'نعم، احذف', cancel: 'إلغاء',
    movedToast: 'نُقلت المذكرة إلى المسودة', undo: 'تراجع',
    restoredToast: 'تمت استعادة المذكرة', deletedToast: 'تم حذف المذكرة نهائيًا',
    duplicatedToast: 'تم نسخ المذكرة', actionError: 'حدث خطأ، حاول مجددًا',
    emptySaved: 'لا توجد مذكرات محفوظة بعد', emptyDraft: 'لا توجد مسودات',
    // translation
    translating: 'جارٍ ترجمة المحتوى…',
    translatedBanner: 'تمت ترجمة المحتوى تلقائيًا من العربية — راجِع قبل الطباعة',
    translateFailed: 'الترجمة غير متاحة حاليًا — يُعرض النص العربي الأصلي',
    // print
    lh1: 'المجلس العربي للاختصاصات الصحية',
    lh2: 'الأمانة العامة',
    lh3: 'المجلس العلمي الاستشاري المشترك',
    memoNumberLabel: 'رقم المذكرة:', printDateLabel: 'تاريخ الطباعة:',
    signSecretary: 'توقيع الأمين العام', signNameLabel: 'الاسم والتوقيع', stamp: 'الختم',
    footerOrg: 'المجلس العربي للاختصاصات الصحية — المجلس العلمي الاستشاري المشترك',
  },
  en: {
    navAria: 'Consultant memo bar',
    dark: 'Dark', light: 'Light',
    allMemos: 'All memos', newMemo: 'New memo',
    backToApp: 'Back to dashboard',
    pageTitle: 'Submission form to the Scientific Advisory Council',
    secTopic: 'Topic details', secAttachments: 'Attachments', secPresentation: 'Presentation',
    secExec: 'Executive committee of the Scientific Advisory Council',
    secPresRec: 'Recommendation of H.E. the Council President',
    secJoint: 'Joint Scientific Advisory Council',
    topicName: 'Topic name', source: 'Source',
    dateTime: 'Date & time:',
    addAttachment: '+ Add attachment', removeAttachment: 'Remove attachment', attachment: 'Attachment',
    save: 'Save', print: 'Print', preview: 'Preview', closePreview: 'Close preview',
    autosaved: 'Autosaved', saving: 'Saving…',
    savedToast: 'Saved successfully', saveError: 'Save failed', loadError: 'Failed to load memo',
    unsavedConfirm: 'You have unsaved changes. Continue without saving?',
    loading: 'Loading…',
    total: 'Total', searchPlaceholder: 'Search by topic name…',
    sortLabel: 'Sort', sortNewest: 'Newest first', sortOldest: 'Oldest first', sortByName: 'By name',
    chipSaved: 'Saved', chipDraft: 'Draft',
    untitled: 'Untitled', sourceLabel: 'Source:',
    created: 'Created', modified: 'Modified', movedToDraftAt: 'Moved to draft',
    openEdit: 'Open & edit', open: 'Open', duplicate: 'Duplicate',
    moveToDraft: 'Move to draft', restore: 'Restore', deleteForever: 'Delete permanently',
    deleteConfirmTitle: 'Delete permanently?', deleteConfirmBody: 'This action cannot be undone.',
    deleteYes: 'Yes, delete', cancel: 'Cancel',
    movedToast: 'Memo moved to draft', undo: 'Undo',
    restoredToast: 'Memo restored', deletedToast: 'Memo permanently deleted',
    duplicatedToast: 'Memo duplicated', actionError: 'Something went wrong, try again',
    emptySaved: 'No saved memos yet', emptyDraft: 'No drafts',
    translating: 'Translating content…',
    translatedBanner: 'Content translated automatically from Arabic — review before printing',
    translateFailed: 'Translation unavailable — showing the original Arabic',
    lh1: 'Arab Board of Health Specializations',
    lh2: 'General Secretariat',
    lh3: 'Joint Scientific Advisory Council',
    memoNumberLabel: 'Memo No.:', printDateLabel: 'Print date:',
    signSecretary: 'Signature of the Secretary General', signNameLabel: 'Name & signature', stamp: 'Stamp',
    footerOrg: 'Arab Board of Health Specializations — Joint Scientific Advisory Council',
  },
};

export const APP_NAV_LABEL = { ar: 'مذكرة الاستشاري', en: 'Consultant Memo' };

const MemoPrefsContext = createContext(null);

export function MemoPrefsProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('cm-theme') === 'dark' ? 'dark' : 'light');
  const [lang, setLang]   = useState(() => localStorage.getItem('cm-lang') === 'en' ? 'en' : 'ar');

  useEffect(() => { localStorage.setItem('cm-theme', theme); }, [theme]);
  useEffect(() => {
    localStorage.setItem('cm-lang', lang);
    window.dispatchEvent(new CustomEvent('cm-lang-changed', { detail: lang }));
  }, [lang]);

  const t = useCallback(key => STRINGS[lang][key] ?? STRINGS.ar[key] ?? key, [lang]);

  return (
    <MemoPrefsContext.Provider value={{ theme, setTheme, lang, setLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr' }}>
      {children}
    </MemoPrefsContext.Provider>
  );
}

export const useMemoPrefs = () => useContext(MemoPrefsContext);

// Shared date·time formatter (cards, date rows, print)
export function fmtDateTime(value, lang) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d)) return '—';
  const date = d.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}
