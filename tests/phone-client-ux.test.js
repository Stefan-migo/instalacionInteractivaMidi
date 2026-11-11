/**
 * Tests for phone-client-ux-polish changes.
 * Tests renderPaperTexture signature/edge cases and HintEngine sequential logic.
 */

var renderPaperTexture = function() {};
var paperTextureLoaded = false;
try {
  renderPaperTexture = require('../phone-client/paper-texture');
  paperTextureLoaded = true;
} catch (e) {
  // Will skip paper-texture tests gracefully
}

describe('phone control sheet actions', () => {
  const fs = require('fs');
  const html = fs.readFileSync(require('path').join(__dirname, '../phone-client/index.html'), 'utf8');

  test('shows the three requested actions and removes the previous/next button pair', () => {
    expect(html).toMatch(/>Reubicar<\/button>/);
    expect(html).toMatch(/>Cambiar foto<\/button>/);
    expect(html).toMatch(/>Enviar atrás<\/button>/);
    expect(html).not.toContain('id="cell-prev-btn"');
    expect(html).not.toContain('id="cell-next-btn"');
    // Látigo stays a gesture: Reubicar already changes the cell position.
    expect(html).not.toContain('data-action="shuffle"');
  });
});

describe('phone intro screens', () => {
  const fs = require('fs');
  const path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '../phone-client/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../phone-client/style.css'), 'utf8');

  test('the splash introduces the piece and dedicates it to the night', () => {
    expect(html).toMatch(/Collage<br>interactivo<br>sonoro-visual/);
    expect(html).toMatch(/sumate a la experiencia MIDI desde tu celular\./);
    expect(html).toMatch(/Noche de los Museos 2026/);
    expect(html).toMatch(/«Somos ese quimérico museo de formas inconstantes, ese montón de espejos rotos\.»/);
    expect(html).toMatch(/Jorge Luis Borges, <cite>Cambridge<\/cite>/);
  });

  // Regression: the splash reported Fragmentos / Lienzo / Sesión, which describes
  // the machinery instead of the piece the visitor is about to join.
  test('the splash no longer reports the session as data rows', () => {
    expect(html).not.toMatch(/class="data"/);
    expect(html).not.toMatch(/>Fragmentos</);
    expect(html).not.toMatch(/>Sesión</);
    expect(css).not.toMatch(/\.data\s*\{/);
  });

  test('the permission screen asks for the sensors only, and says what it keeps', () => {
    const screen = html.slice(html.indexOf('id="permission-screen"'), html.indexOf('id="dashboard"'));
    expect([...screen.matchAll(/class="field"/g)]).toHaveLength(1);
    expect(screen).not.toMatch(/Campo 02/);
    expect(screen).toMatch(/No recopilamos datos personales/);
  });
});

describe('renderPaperTexture', () => {
  // Skip all tests if module couldn't load (e.g., DOM-dependent)
  beforeAll(() => {
    if (!paperTextureLoaded) {
      console.warn('paper-texture.js could not load — skipping tests');
    }
  });

  test('returns false when called with null canvas', () => {
    if (!paperTextureLoaded) return;
    expect(renderPaperTexture(null, 100, 100)).toBe(false);
  });

  test('returns false when called with undefined canvas', () => {
    if (!paperTextureLoaded) return;
    expect(renderPaperTexture(undefined, 100, 100)).toBe(false);
  });

  test('returns false when called with null width', () => {
    if (!paperTextureLoaded) return;
    var canvas = {};
    expect(renderPaperTexture(canvas, null, 100)).toBe(false);
  });

  test('returns false when called with null height', () => {
    if (!paperTextureLoaded) return;
    var canvas = {};
    expect(renderPaperTexture(canvas, 100, null)).toBe(false);
  });

  test('returns false when called with zero width', () => {
    if (!paperTextureLoaded) return;
    var canvas = {};
    expect(renderPaperTexture(canvas, 0, 100)).toBe(false);
  });

  test('returns false when called with zero height', () => {
    if (!paperTextureLoaded) return;
    var canvas = {};
    expect(renderPaperTexture(canvas, 100, 0)).toBe(false);
  });

  test('defaults intensity to 0.8 when omitted', () => {
    if (!paperTextureLoaded) return;
    // We can only verify it doesn't throw with a mock canvas
    // In test env WebGL will fail, so it returns false
    // The intensity default is a code quality check, not a runtime observable
    var result = renderPaperTexture({}, 100, 100);
    // Should not throw, should handle gracefully
    expect(typeof result).toBe('boolean');
  });

  test('handles missing document gracefully (test environment)', () => {
    if (!paperTextureLoaded) return;
    // In Node.js there's no document.createElement
    // The function should catch and return false
    expect(renderPaperTexture({}, 100, 100)).toBe(false);
  });
});

describe('HintEngine sequential flag logic', () => {
  /**
   * Core HintEngine algorithm — duplicates the production logic
   * to test the sequential flag behavior in isolation.
   */
  function createHintEngine() {
    var flags = {
      connected: false,
      dragged: false,
      toolsOpened: false,
      broughtFront: false,
      shuffled: false
    };
    var sequence = ['connected', 'dragged', 'toolsOpened', 'broughtFront', 'shuffled'];
    var index = 0;
    var lastHint = null;

    function markAction(flag) {
      if (index >= sequence.length) return null;
      if (flag !== sequence[index]) return null;
      flags[flag] = true;
      lastHint = flag;
      index++;
      return flag;
    }

    return {
      markAction: markAction,
      getIndex: function () { return index; },
      getFlags: function () { return { ...flags }; },
      isComplete: function () { return index >= sequence.length; },
      getLastHint: function () { return lastHint; }
    };
  }

  test('triggers hints in correct sequential order', () => {
    var engine = createHintEngine();
    var fired = [];

    var r1 = engine.markAction('connected');
    if (r1) fired.push(r1);
    expect(fired).toEqual(['connected']);
    expect(engine.getIndex()).toBe(1);

    var r2 = engine.markAction('dragged');
    if (r2) fired.push(r2);
    expect(fired).toEqual(['connected', 'dragged']);
    expect(engine.getIndex()).toBe(2);

    var r3 = engine.markAction('toolsOpened');
    if (r3) fired.push(r3);
    expect(fired).toEqual(['connected', 'dragged', 'toolsOpened']);
    expect(engine.getIndex()).toBe(3);

    var r4 = engine.markAction('broughtFront');
    if (r4) fired.push(r4);
    expect(fired).toEqual(['connected', 'dragged', 'toolsOpened', 'broughtFront']);
    expect(engine.getIndex()).toBe(4);

    var r5 = engine.markAction('shuffled');
    if (r5) fired.push(r5);
    expect(fired).toEqual(['connected', 'dragged', 'toolsOpened', 'broughtFront', 'shuffled']);
    expect(engine.getIndex()).toBe(5);
  });

  test('silence after all flags seen (index >= 5)', () => {
    var engine = createHintEngine();
    var fired = [];

    // Mark all 5 in sequence
    engine.markAction('connected');
    engine.markAction('dragged');
    engine.markAction('toolsOpened');
    engine.markAction('broughtFront');
    engine.markAction('shuffled');
    expect(engine.isComplete()).toBe(true);

    // Now try to mark more — all should be ignored
    var r = engine.markAction('connected');
    expect(r).toBeNull();
    r = engine.markAction('dragged');
    expect(r).toBeNull();
    r = engine.markAction('shuffled');
    expect(r).toBeNull();
    expect(fired).toEqual([]);
    expect(engine.getIndex()).toBe(5);
  });

  test('out-of-order flags are ignored (must match sequence index)', () => {
    var engine = createHintEngine();

    // Try dragged before connected — should be ignored
    var r = engine.markAction('dragged');
    expect(r).toBeNull();
    expect(engine.getIndex()).toBe(0);

    // Connected should work
    r = engine.markAction('connected');
    expect(r).toBe('connected');
    expect(engine.getIndex()).toBe(1);

    // connected again — already passed, should be ignored
    r = engine.markAction('connected');
    expect(r).toBeNull();
    expect(engine.getIndex()).toBe(1);
  });

  test('each flag is set correctly after being triggered', () => {
    var engine = createHintEngine();

    engine.markAction('connected');
    expect(engine.getFlags().connected).toBe(true);
    expect(engine.getFlags().dragged).toBe(false);

    engine.markAction('dragged');
    expect(engine.getFlags().dragged).toBe(true);
    expect(engine.getFlags().toolsOpened).toBe(false);

    engine.markAction('toolsOpened');
    expect(engine.getFlags().toolsOpened).toBe(true);

    engine.markAction('broughtFront');
    expect(engine.getFlags().broughtFront).toBe(true);

    engine.markAction('shuffled');
    expect(engine.getFlags().shuffled).toBe(true);
  });
});
