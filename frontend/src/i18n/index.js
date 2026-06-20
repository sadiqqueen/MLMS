// Central translation dictionary.
//
// Each area module under ./strings DEFAULT-exports an object of shape
//   { ar: { "flat.dotted.key": "..." }, en: { "flat.dotted.key": "..." } }
// This file merges every area into a single { ar: {...}, en: {...} } dictionary
// and DEFAULT-exports it. PrefsContext consumes it as:
//   t(key) => dict[lang][key] ?? dict.ar[key] ?? key
//
// To add a new area: create ./strings/<area>.js (same shape) and add it to the
// AREAS array below.

import common from './strings/common.js';
import nav from './strings/nav.js'; // created by the Navbar agent
import memo from './strings/memo.js';
import initiatives from './strings/initiatives.js';
import admin from './strings/admin.js';
import dio from './strings/dio.js';
import secretary from './strings/secretary.js';
import supervisor from './strings/supervisor.js';
import program_director from './strings/program_director.js';
import president from './strings/president.js';
import trainee from './strings/trainee.js';
import profile from './strings/profile.js';
import verify from './strings/verify.js';

// Order matters only for collisions: later areas win. Keep `common` first so
// area-specific keys can intentionally override shared ones if ever needed.
const AREAS = [
  common,
  nav,
  memo,
  initiatives,
  admin,
  dio,
  secretary,
  supervisor,
  program_director,
  president,
  trainee,
  profile,
  verify,
];

// Deep-merge each area's `ar` into ar and `en` into en (flat key tables, so a
// shallow spread per locale is all that's needed).
const dict = AREAS.reduce(
  (acc, area) => {
    if (area && area.ar) Object.assign(acc.ar, area.ar);
    if (area && area.en) Object.assign(acc.en, area.en);
    return acc;
  },
  { ar: {}, en: {} }
);

export default dict;
