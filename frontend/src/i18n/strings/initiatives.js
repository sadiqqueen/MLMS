// Initiatives area strings — re-exported from the existing single source of
// truth in initiativeStrings.js (INIT_STRINGS) so the dictionary and the live
// initiatives feature never drift. Bare (non-namespaced) keys are kept here
// for back-compat with code that already reads INIT_STRINGS keys directly.
import { INIT_STRINGS } from '../../components/memo/initiativeStrings.js';

export default {
  ar: { ...INIT_STRINGS.ar },
  en: { ...INIT_STRINGS.en },
};
