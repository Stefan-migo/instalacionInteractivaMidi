'use strict';

const crypto = require('crypto');

// One gate for every authoring write. Both routes rewrite tracked files on the
// machine that serves this bridge, so they stay closed unless the operator turns
// them on, and when a token is configured the caller has to present it: that is
// what lets the installation be authored from production without leaving the
// endpoint open to whoever finds /operator/.
const TOKEN_HEADER = 'x-operator-token';

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() !== wanted) continue;
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
  }
  return '';
}

// Constant-time comparison: a token check that leaks its own timing is a token
// check that can be guessed one byte at a time.
function tokensMatch(expected, provided) {
  if (typeof provided !== 'string' || !provided) return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * @returns {{ok: true} | {ok: false, status: 403|401, reason: 'disabled'|'token'}}
 */
function checkAuthoring(env, headers) {
  if (!env || env.AUTHORING_WRITES_ENABLED !== 'true') return { ok: false, status: 403, reason: 'disabled' };
  const expected = env.AUTHORING_TOKEN;
  if (!expected) return { ok: true };
  if (!tokensMatch(expected, headerValue(headers, TOKEN_HEADER))) return { ok: false, status: 401, reason: 'token' };
  return { ok: true };
}

module.exports = { checkAuthoring, tokensMatch, headerValue, TOKEN_HEADER };
