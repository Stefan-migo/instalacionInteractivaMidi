const fs = require('fs');
const os = require('os');
const path = require('path');
const { validateOperatorState, readOperatorState, writeOperatorState } = require('../bridge/operator-state');
const { apply } = require('../p5-collage/operator-state');
const valid = { version: 1, state: { scatterScale: 1, noiseIntensity: 0.35, preset: 'scatter', cycleRunning: false, updatedAt: '2026-11-21T03:00:00.000Z' } };
describe('operator state', () => {
  let dir, file;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'operator-state-')); file = path.join(dir, 'state.json'); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  test('round trips and missing or corrupt files return null', async () => {
    expect(readOperatorState(file)).toBeNull();
    fs.writeFileSync(file, '{'); expect(readOperatorState(file)).toBeNull();
    await writeOperatorState(file, valid); expect(readOperatorState(file)).toEqual(valid);
  });
  test.each([
    ['scatterScale', 0.39], ['scatterScale', 1.81], ['noiseIntensity', -0.1], ['noiseIntensity', 1.1], ['preset', 'unknown'],
  ])('rejects invalid %s=%s without changing stored bytes', async (key, value) => {
    fs.writeFileSync(file, 'original bytes'); const before = fs.readFileSync(file);
    const next = JSON.parse(JSON.stringify(valid)); next.state[key] = value;
    await expect(writeOperatorState(file, next)).rejects.toThrow(); expect(fs.readFileSync(file).equals(before)).toBe(true);
  });
  test('applies only valid fields', () => {
    const calls = {}; const callbacks = Object.fromEntries(['setScatterScale','setNoiseIntensity','setPreset','setCycle'].map(key => [key, value => { calls[key] = value; }]));
    const result = apply({ scatterScale: 0.39, noiseIntensity: 0.5, preset: 'bogus', cycleRunning: true }, callbacks);
    expect(result).toEqual({ noiseIntensity: 0.5, cycleRunning: true }); expect(calls).toEqual({ setNoiseIntensity: 0.5, setCycle: true });
  });
  test('rejects unexpected fields and invalid bounds', () => {
    for (const state of [{ ...valid.state, extra: true }, { ...valid.state, preset: 'unknown' }]) expect(() => validateOperatorState({ version: 1, state })).toThrow();
  });
});
