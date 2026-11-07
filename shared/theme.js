(function (root) {
  var STORAGE_KEY = 'midi-theme';
  var CHANNEL_NAME = 'midi-theme';
  var theme = 'dark';
  var doc = null;
  var storage = null;
  var channel = null;
  var listeners = [];
  var initialized = false;

  function valid(value) { return value === 'dark' || value === 'light'; }

  function apply(value, publish, persist) {
    if (!valid(value)) value = 'dark';
    theme = value;
    try { if (doc && doc.documentElement) doc.documentElement.dataset.theme = value; } catch (_) {}
    if (persist) {
      try { if (storage) storage.setItem(STORAGE_KEY, value); } catch (_) {}
    }
    if (publish) {
      try { if (channel) channel.postMessage({ theme: value }); } catch (_) {}
    }
    listeners.slice().forEach(function (callback) { callback(value); });
    return theme;
  }

  function init(options) {
    options = options || {};
    doc = options.doc === undefined ? (typeof document !== 'undefined' ? document : null) : options.doc;
    try {
      storage = options.storage === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : options.storage;
    } catch (_) { storage = null; }
    var factory = options.channelFactory;
    if (factory === undefined) {
      factory = typeof BroadcastChannel !== 'undefined' ? function (name) { return new BroadcastChannel(name); } : null;
    }
    channel = null;
    if (factory) {
      try {
        channel = factory(CHANNEL_NAME);
        if (channel) {
          var receive = function (event) {
            var incoming = event && event.data && event.data.theme;
            if (valid(incoming)) apply(incoming, false, false);
          };
          if (typeof channel.addEventListener === 'function') channel.addEventListener('message', receive);
          else channel.onmessage = receive;
        }
      } catch (_) { channel = null; }
    }
    var saved = null;
    try { if (storage) saved = storage.getItem(STORAGE_KEY); } catch (_) {}
    theme = valid(saved) ? saved : 'dark';
    try { if (doc && doc.documentElement) doc.documentElement.dataset.theme = theme; } catch (_) {}
    initialized = true;
    return theme;
  }

  function getTheme() {
    if (!initialized) init();
    return theme;
  }

  function setTheme(value) {
    if (!initialized) init();
    return apply(value, true, true);
  }

  function toggleTheme() { return setTheme(getTheme() === 'dark' ? 'light' : 'dark'); }

  function onThemeChange(callback) {
    if (typeof callback === 'function') listeners.push(callback);
    return function () { listeners = listeners.filter(function (item) { return item !== callback; }); };
  }

  var api = { getTheme: getTheme, setTheme: setTheme, toggleTheme: toggleTheme, onThemeChange: onThemeChange, init: init };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MidiTheme = api;
})(typeof window !== 'undefined' ? window : globalThis);
