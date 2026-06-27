// Initiatives area strings — re-exported from the existing single source of
// truth in initiativeStrings.js (INIT_STRINGS) so the dictionary and the live
// initiatives feature never drift. Bare (non-namespaced) keys are kept here
// for back-compat with code that already reads INIT_STRINGS keys directly.
import { INIT_STRINGS } from '../../components/memo/initiativeStrings.js';

// `pageTitle` is intentionally NOT contributed to the global dictionary. The
// consultant-memo area (merged earlier in i18n/index.js) defines its own
// `pageTitle`, and since later areas win on key collisions, exporting it here
// would override the memo heading ("مذكرة العرض على المجلس العلمي الاستشاري")
// everywhere `t('pageTitle')` is used — including the New Memo page and the
// printed memo. The Initiatives page reads its own title straight from
// INIT_STRINGS via its local `ti()` helper, so it does not need the global key.
const { pageTitle: _arTitle, ...ar } = INIT_STRINGS.ar;
const { pageTitle: _enTitle, ...en } = INIT_STRINGS.en;

export default { ar, en };
