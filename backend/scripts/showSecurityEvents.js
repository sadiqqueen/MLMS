// backend/scripts/showSecurityEvents.js
require('dotenv').config();
const mongoose = require('mongoose');
const SecurityEvent = require('../models/SecurityEvent');

const MAX_LIMIT = 100;

function usage() {
  console.log([
    'Usage: npm run security-events -- [--limit=20] [--type=honeypot|rate_limit|auth|suspicious_route]',
    '',
    'Local-only SecurityEvent viewer. Refuses to run when NODE_ENV=production.',
    'Prints sanitized event fields only; it does not print secrets, cookies, tokens, passwords, or request bodies.'
  ].join('\n'));
}

function readArg(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(item => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function parseLimit() {
  const raw = readArg('limit');
  if (!raw) return 20;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 20;
  return Math.min(parsed, MAX_LIMIT);
}

function sanitizeText(value, max = 120) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').slice(0, max);
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    usage();
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run SecurityEvent viewer while NODE_ENV=production.');
    process.exitCode = 1;
    return;
  }

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required, but its value will not be printed.');
    process.exitCode = 1;
    return;
  }

  const type = readArg('type');
  const allowedTypes = ['honeypot', 'rate_limit', 'auth', 'suspicious_route'];
  if (type && !allowedTypes.includes(type)) {
    console.error(`Invalid --type. Allowed values: ${allowedTypes.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const limit = parseLimit();
  const query = type ? { type } : {};

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });

  const events = await SecurityEvent.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  if (!events.length) {
    console.log('No SecurityEvent records found.');
    return;
  }

  console.table(events.map(event => ({
    createdAt: event.createdAt?.toISOString?.() || '',
    type: event.type,
    severity: event.severity,
    reason: event.reason,
    statusCode: event.statusCode || '',
    method: event.method,
    path: sanitizeText(event.path, 160),
    ip: sanitizeText(event.ip, 80),
    userAgent: sanitizeText(event.userAgent, 120),
    metadata: JSON.stringify(event.metadata || {})
  })));
}

main()
  .catch(() => {
    console.error('Failed to read SecurityEvent records. Check local database connectivity and try again.');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  });
