const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildInkMetadata } = require('../scripts/build-ink-metadata');

describe('buildInkMetadata', () => {
  test('writes measured ink fields, preserves other values, handles opaque files, and is idempotent', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ink-metadata-'));
    try {
      const manifestPath = path.join(dir, 'manifest.json');
      const manifest = {
        first: { file: 'first.webp', w: 4, h: 3, role: 'kept', extra: { value: 2 } },
        second: { file: 'second.webp', w: 2, h: 2, note: 'also kept' },
      };
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
      const pixels = {
        'first.webp': { width: 4, height: 3, sampleWidth: 4, sampleHeight: 3, alpha: [64, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0, 0] },
        'second.webp': { width: 2, height: 2, sampleWidth: 2, sampleHeight: 2, alpha: null },
      };
      const reader = async file => pixels[path.basename(file)];
      await buildInkMetadata({ manifestPath, contentDir: dir, readPixels: reader });
      const firstRun = fs.readFileSync(manifestPath, 'utf8');
      const result = JSON.parse(firstRun);
      expect(result).toEqual({
        first: { ...manifest.first, inkBox: { x: 1, y: 1, w: 2, h: 1 }, inkRatio: 2 / 12, inkCenter: { x: 0.5, y: 0.5 } },
        second: { ...manifest.second, inkBox: { x: 0, y: 0, w: 2, h: 2 }, inkRatio: 1, inkCenter: { x: 0.5, y: 0.5 } },
      });
      await buildInkMetadata({ manifestPath, contentDir: dir, readPixels: reader });
      expect(fs.readFileSync(manifestPath, 'utf8')).toBe(firstRun);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
