// backend/utils/eventCode.js
// Short, human-enterable public event codes (e.g. "K7Q4M9TP") for the mobile app.
const crypto = require('crypto');

// Crockford-style base32 alphabet with ambiguous letters (I, L, O, U) removed.
// 32 symbols divides 256 evenly, so `byte % 32` has no modulo bias.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function generateCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// Generate a code not already taken. `exists(code)` is an async predicate that
// resolves truthy if the code is in use.
async function generateUniqueCode(exists, len = 8, maxTries = 12) {
  for (let i = 0; i < maxTries; i++) {
    const code = generateCode(len);
    if (!(await exists(code))) return code;
  }
  throw new Error('Could not generate a unique event code, please retry');
}

module.exports = { ALPHABET, generateCode, generateUniqueCode };
