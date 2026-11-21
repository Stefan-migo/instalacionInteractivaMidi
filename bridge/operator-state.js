'use strict';
const fs = require('fs');
const PRESETS = ['scatter', 'spiral', 'polaroid-stack', 'neat-grid', 'vignette', 'random'];
function validateOperatorState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'state,version' || value.version !== 1) throw new Error('Invalid operator state');
  const s = value.state;
  if (s === null) return value;
  if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).sort().join(',') !== 'cycleRunning,noiseIntensity,preset,scatterScale,updatedAt' || !Number.isFinite(s.scatterScale) || s.scatterScale < 0.4 || s.scatterScale > 1.8 || !Number.isFinite(s.noiseIntensity) || s.noiseIntensity < 0 || s.noiseIntensity > 1 || !PRESETS.includes(s.preset) || typeof s.cycleRunning !== 'boolean' || typeof s.updatedAt !== 'string' || !Number.isFinite(Date.parse(s.updatedAt))) throw new Error('Invalid operator state');
  return value;
}
function readOperatorState(file) { try { return validateOperatorState(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { return null; } }
async function writeOperatorState(file, value) { validateOperatorState(value); const temp = `${file}.${process.pid}.${Date.now()}.tmp`; try { await fs.promises.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' }); await fs.promises.rename(temp, file); } catch (error) { try { await fs.promises.unlink(temp); } catch {} throw error; } }
module.exports = { validateOperatorState, readOperatorState, writeOperatorState };
