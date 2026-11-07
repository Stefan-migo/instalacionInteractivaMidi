describe('shared theme runtime', () => {
  function harness(storedValue) {
    const values = new Map();
    if (storedValue !== undefined) values.set('midi-theme', storedValue);
    const storage = {
      getItem: jest.fn(key => values.has(key) ? values.get(key) : null),
      setItem: jest.fn((key, value) => values.set(key, value))
    };
    const listeners = [];
    const channel = { postMessage: jest.fn(), addEventListener: jest.fn((type, fn) => listeners.push(fn)) };
    const doc = { documentElement: { dataset: {} } };
    return { storage, channel, listeners, doc, options: { storage, channelFactory: jest.fn(() => channel), doc } };
  }

  beforeEach(() => jest.resetModules());

  test.each([[undefined, 'dark'], ['light', 'light'], ['blue', 'dark']])('initializes %p as %s', (stored, expected) => {
    const { options } = harness(stored);
    const theme = require('../shared/theme');
    theme.init(options);
    expect(theme.getTheme()).toBe(expected);
  });

  test('setTheme applies, persists, and publishes once', () => {
    const { options, doc, storage, channel } = harness();
    const theme = require('../shared/theme');
    theme.init(options);
    theme.setTheme('light');
    expect(doc.documentElement.dataset.theme).toBe('light');
    expect(storage.setItem).toHaveBeenCalledWith('midi-theme', 'light');
    expect(channel.postMessage).toHaveBeenCalledTimes(1);
    expect(channel.postMessage).toHaveBeenCalledWith({ theme: 'light' });
  });

  test('received channel message applies without republishing', () => {
    const { options, listeners, doc, channel } = harness();
    const theme = require('../shared/theme');
    theme.init(options);
    listeners[0]({ data: { theme: 'light' } });
    expect(doc.documentElement.dataset.theme).toBe('light');
    expect(channel.postMessage).not.toHaveBeenCalled();
  });

  test('storage and channel write failures do not prevent in-memory theme', () => {
    const { options, doc, channel } = harness();
    options.storage.setItem = () => { throw new Error('storage unavailable'); };
    options.channelFactory = () => ({ postMessage() { throw new Error('channel unavailable'); }, addEventListener() {} });
    const theme = require('../shared/theme');
    theme.init(options);
    expect(() => theme.setTheme('light')).not.toThrow();
    expect(theme.getTheme()).toBe('light');
    expect(doc.documentElement.dataset.theme).toBe('light');
  });

  test('onThemeChange receives the new theme', () => {
    const { options } = harness();
    const theme = require('../shared/theme');
    theme.init(options);
    const callback = jest.fn();
    theme.onThemeChange(callback);
    theme.setTheme('light');
    expect(callback).toHaveBeenCalledWith('light');
  });
});
