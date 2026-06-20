// Memo area strings — re-exported from the existing single source of truth
// in MemoPrefs.jsx (STRINGS) so the dictionary and the live memo feature
// never drift. Bare (non-namespaced) keys are kept here for back-compat
// with code that already reads STRINGS keys directly.
import { STRINGS } from '../../components/memo/MemoPrefs.jsx';

export default {
  ar: { ...STRINGS.ar },
  en: { ...STRINGS.en },
};
