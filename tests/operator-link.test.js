const { applyCommand, makeSnapshot } = require('../p5-collage/operator-link');
const operatorPage = require('../operator/operator');

function fixture() {
  const state = { 2: { pos: { rotation: 350, zIndex: 2 }, opacity: .5, filterType: 'none' } };
  const calls = [];
  const manager = { renderer: { cellStates: state }, layoutEngine: { setPreset: value => calls.push(['preset', value]), getCurrentPreset: () => 'spiral' }, _recalculateLayout: () => calls.push(['layout']), count: 1 };
  const api = { deviceManager: manager, collageLayout: { cells: [{ slot: 2, imageFile: '002.jpg' }] }, CONFIG: { scatterScale: 1, noiseIntensity: .8 }, selectedSlot: 2, activeSlots: [], getSortedSlots: () => [{ slot: 2, zIndex: state[2].pos.zIndex }], redraw: () => calls.push(['redraw']), selectCell: slot => { api.selectedSlot = slot; calls.push(['select', slot]); }, setBackgroundTexture: value => calls.push(['texture', value]), publish: () => calls.push(['publish']) };
  return { api, calls, state };
}

describe('operator page controls', () => {
  test('visibility toggle command and pressed state follow the received cell opacity', () => {
    expect(operatorPage.visibilityCommand(7)).toEqual({ type: 'toggleVisibility', slot: 7 });
    expect(operatorPage.isVisible(0)).toBe(false);
    expect(operatorPage.isVisible(0.01)).toBe(true);
    expect(operatorPage.isVisible(1)).toBe(true);
  });

  test('theme toggle initializes from current theme and tracks external changes', () => {
    const listeners = [];
    const button = { attrs: {}, addEventListener(type, callback) { this.click = callback; }, setAttribute(name, value) { this.attrs[name] = value; } };
    const theme = { current: 'dark', getTheme() { return this.current; }, toggleTheme() { this.current = this.current === 'dark' ? 'light' : 'dark'; listeners.forEach(fn => fn(this.current)); return this.current; }, onThemeChange(callback) { listeners.push(callback); } };
    operatorPage.bindThemeToggle(button, theme);
    expect(button.attrs['aria-pressed']).toBe('false');
    theme.current = 'light'; listeners.forEach(fn => fn(theme.current));
    expect(button.attrs['aria-pressed']).toBe('true');
    button.click();
    expect(theme.current).toBe('dark');
    expect(button.attrs['aria-pressed']).toBe('false');
  });

  test('operator command vocabulary exposes the frozen contract types without borders', () => {
    expect(operatorPage.COMMAND_TYPES).toEqual(['setPreset', 'setScatterScale', 'setNoiseIntensity', 'selectCell', 'setFilter', 'setRotation', 'setScale', 'setOpacity', 'toggleVisibility', 'rotateSelected', 'bringToFront', 'hideCell', 'esparcirTodo', 'requestState']);
    expect(operatorPage.COMMAND_TYPES).not.toContain('setBorder');
    expect(operatorPage.BORDERS).toBeUndefined();
  });
});

describe('operator-link command contract', () => {
  test('applies cell edits and publishes state after each accepted command', () => {
    const { api, calls, state } = fixture();
    expect(applyCommand({ type: 'setFilter', slot: 2, value: 'sepia' }, api)).toBe(true);
    expect(state[2].filterType).toBe('sepia');
    expect(calls).toEqual([['redraw'], ['publish']]);
    applyCommand({ type: 'setScale', slot: 2, value: 1.25 }, api);
    applyCommand({ type: 'setOpacity', slot: 2, value: .5 }, api);
    expect(state[2]._editorScale).toBe(1.25);
    expect(state[2].opacity).toBe(.5);
    expect(calls.filter(call => call[0] === 'publish')).toHaveLength(3);
  });

  test('normalizes selected rotation, brings a cell forward, and snapshots contract fields', () => {
    const { api, state } = fixture();
    expect(applyCommand({ type: 'rotateSelected', delta: 15 }, api)).toBe(true);
    expect(state[2].pos.rotation).toBe(5);
    applyCommand({ type: 'bringToFront', slot: 2 }, api);
    const snapshot = makeSnapshot(api);
    expect(snapshot).toEqual(expect.objectContaining({ preset: 'spiral', scatterScale: 1, noiseIntensity: 80, selectedSlot: 2, connected: 1, total: 1 }));
    expect(snapshot.cells[0]).toEqual({ slot: 2, imageFile: '002.jpg', filterType: 'none', rotation: 5, scale: 1, opacity: .5 });
  });

  test('ignores commands before manager readiness and publishes on state request', () => {
    expect(applyCommand({ type: 'setPreset', preset: 'scatter' }, {})).toBe(false);
    const { api, calls } = fixture();
    expect(applyCommand({ type: 'requestState' }, api)).toBe(true);
    expect(calls).toEqual([['publish']]);
  });
});
