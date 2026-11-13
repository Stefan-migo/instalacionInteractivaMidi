'use strict';

function validateDeckList(data, knownImageKeys) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid deck: expected an object');
  if (Object.keys(data).sort().join(',') !== 'excluded,version') throw new Error('Invalid deck: expected version and excluded only');
  if (data.version !== 1) throw new Error('Invalid deck: unsupported version');
  if (!Array.isArray(data.excluded)) throw new Error('Invalid deck: excluded must be a list');
  const known = new Set(knownImageKeys || []);
  const seen = new Set();
  for (const key of data.excluded) {
    if (typeof key !== 'string' || !known.has(key)) throw new Error(`Invalid deck: unknown image ${key}`);
    if (seen.has(key)) throw new Error(`Invalid deck: duplicate image ${key}`);
    seen.add(key);
  }
  return data;
}

function resolveDeckList(data, manifest) {
  const keys = Array.isArray(manifest) ? manifest : Object.keys(manifest || {});
  validateDeckList(data, keys);
  const excluded = new Set(data.excluded);
  return keys.filter(key => !excluded.has(key));
}

if (typeof module !== 'undefined' && module.exports) module.exports = { validateDeckList, resolveDeckList };
else if (typeof window !== 'undefined') window.DeckList = { validateDeckList, resolveDeckList };
