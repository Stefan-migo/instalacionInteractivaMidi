'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { importLibrary, buildFfmpegArgs } = require('../scripts/import-library');

describe('importLibrary', () => {
  test('sorts source names, removes exact duplicates keeping first, and assigns contiguous keys', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'library-import-'));
    try {
      const sourceDir = path.join(root, 'source');
      const contentDir = path.join(root, 'content');
      const manifestPath = path.join(root, 'manifest.json');
      fs.mkdirSync(sourceDir);
      fs.writeFileSync(path.join(sourceDir, 'b.png'), 'duplicate');
      fs.writeFileSync(path.join(sourceDir, 'a.png'), 'duplicate');
      fs.writeFileSync(path.join(sourceDir, 'c.jpg'), 'third');
      const converter = async ({ source, target }) => {
        fs.writeFileSync(target, `converted:${path.basename(source)}`);
        return { w: 800, h: 600 };
      };
      const result = await importLibrary({ sourceDir, contentDir, manifestPath, converter });
      expect(result.found).toBe(3);
      expect(result.deduped).toBe(1);
      expect(result.duplicates).toEqual([{ kept: 'a.png', duplicate: 'b.png' }]);
      expect(result.manifest).toEqual({
        '001': { file: '001.webp', w: 800, h: 600 },
        '002': { file: '002.webp', w: 800, h: 600 },
      });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('adds an alpha conversion filter only for alpha-capable inputs', () => {
    const rgbArgs = buildFfmpegArgs('photo.jpg', 'photo.webp', { maxEdge: 1600, quality: 90, pixelFormat: 'yuvj420p' });
    const rgbaArgs = buildFfmpegArgs('cutout.png', 'cutout.webp', { maxEdge: 1600, quality: 90, pixelFormat: 'rgba' });
    expect(rgbArgs[rgbArgs.indexOf('-vf') + 1]).not.toContain('format=yuva420p');
    expect(rgbArgs[rgbArgs.indexOf('-pix_fmt') + 1]).toBe('yuv420p');
    expect(rgbaArgs[rgbaArgs.indexOf('-vf') + 1]).toContain('format=yuva420p');
    expect(rgbaArgs[rgbaArgs.indexOf('-pix_fmt') + 1]).toBe('yuva420p');
    expect(rgbArgs).toContain('90');
  });

  test('--dry-run prints the plan and leaves content and manifest unwritten', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'library-dry-run-'));
    try {
      const sourceDir = path.join(root, 'source');
      const contentDir = path.join(root, 'content');
      const manifestPath = path.join(root, 'manifest.json');
      fs.mkdirSync(sourceDir);
      fs.writeFileSync(path.join(sourceDir, 'one.png'), 'one');
      let output = '';
      const result = await importLibrary({ sourceDir, contentDir, manifestPath, dryRun: true, print: text => { output += text; }, converter: () => { throw new Error('converter must not run'); } });
      expect(result.found).toBe(1);
      expect(output).toContain('001.webp');
      expect(fs.existsSync(contentDir)).toBe(false);
      expect(fs.existsSync(manifestPath)).toBe(false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('passes bounded q90 alpha-preserving conversion settings and is byte-idempotent', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'library-idempotent-'));
    try {
      const sourceDir = path.join(root, 'source');
      const contentDir = path.join(root, 'content');
      const manifestPath = path.join(root, 'manifest.json');
      fs.mkdirSync(sourceDir);
      fs.writeFileSync(path.join(sourceDir, 'image.png'), 'source');
      const seen = [];
      const converter = async options => {
        seen.push(options);
        fs.writeFileSync(options.target, 'stable webp bytes');
        return { w: 1200, h: 800 };
      };
      await importLibrary({ sourceDir, contentDir, manifestPath, converter });
      const firstBytes = fs.readFileSync(path.join(contentDir, '001.webp'));
      await importLibrary({ sourceDir, contentDir, manifestPath, converter });
      expect(fs.readFileSync(path.join(contentDir, '001.webp'))).toEqual(firstBytes);
      expect(seen[0]).toMatchObject({ maxEdge: 1600, quality: 90, preserveAlpha: true, noUpscale: true });
      expect(fs.readFileSync(manifestPath, 'utf8')).toContain('"001"');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
