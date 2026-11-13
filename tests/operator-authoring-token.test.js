const operator = require('../operator/operator');

describe('operator authoring token', () => {
  test('the token header travels only when a token was entered', () => {
    expect(operator.authoringHeaders('')).toEqual({ 'Content-Type': 'application/json' });
    expect(operator.authoringHeaders('s3cret')).toEqual({ 'Content-Type': 'application/json', 'X-Operator-Token': 's3cret' });
  });

  test('a refused write names the cause instead of repeating the bridge code', () => {
    expect(operator.authoringMessage(401, 'Operator token required')).toContain('token');
    expect(operator.authoringMessage(403, 'Size assignments are disabled')).toContain('AUTHORING_WRITES_ENABLED');
    expect(operator.authoringMessage(500, 'Failed to save sizes')).toBe('Error al guardar: Failed to save sizes');
    expect(operator.authoringMessage(500)).toBe('Error al guardar: el bridge no respondió');
  });

  test('a stored token is sent on the first attempt, and a 401 asks once then retries', async () => {
    const calls = [];
    const replies = [
      { ok: false, status: 401, payload: { error: 'Operator token required' } },
      { ok: true, status: 200, payload: { ok: true } },
    ];
    global.sessionStorage = { getItem: () => '', setItem: (key, value) => calls.push(['store', key, value]) };
    const root = globalThis;
    const savedFetch = root.fetch;
    root.fetch = (url, options) => {
      calls.push(['fetch', url, options.headers]);
      const next = replies.shift();
      return Promise.resolve({ ok: next.ok, status: next.status, json: () => Promise.resolve(next.payload) });
    };
    const savedPrompt = root.prompt;
    root.prompt = () => 'typed-token';
    try {
      const result = await operator.postAuthoring({ getElementById: () => null }, '/api/sizes', { version: 1, assignments: {} });
      expect(result).toEqual({ ok: true });
      expect(calls[0]).toEqual(['fetch', '/api/sizes', { 'Content-Type': 'application/json' }]);
      expect(calls[1]).toEqual(['store', 'operator-token', 'typed-token']);
      expect(calls[2]).toEqual(['fetch', '/api/sizes', { 'Content-Type': 'application/json', 'X-Operator-Token': 'typed-token' }]);
    } finally {
      root.fetch = savedFetch;
      root.prompt = savedPrompt;
      delete global.sessionStorage;
    }
  });

  test('a cancelled prompt sends nothing more and says so', async () => {
    let fetches = 0;
    global.sessionStorage = { getItem: () => '', setItem: () => {} };
    const root = globalThis;
    const savedFetch = root.fetch;
    root.fetch = () => {
      fetches++;
      return Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Operator token required' }) });
    };
    const savedPrompt = root.prompt;
    root.prompt = () => null;
    try {
      await expect(operator.postAuthoring({ getElementById: () => null }, '/api/sizes', {})).rejects.toThrow('Sin token no se guardó nada.');
      expect(fetches).toBe(1);
    } finally {
      root.fetch = savedFetch;
      root.prompt = savedPrompt;
      delete global.sessionStorage;
    }
  });

  test('a payload the bridge refuses is reported with its own sentence', async () => {
    global.sessionStorage = { getItem: () => 'stored', setItem: () => {} };
    const root = globalThis;
    const savedFetch = root.fetch;
    root.fetch = () => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'Invalid sizes: unknown image 999' }) });
    try {
      await expect(operator.postAuthoring({ getElementById: () => null }, '/api/sizes', {})).rejects.toThrow('Invalid sizes: unknown image 999');
    } finally {
      root.fetch = savedFetch;
      delete global.sessionStorage;
    }
  });
});
