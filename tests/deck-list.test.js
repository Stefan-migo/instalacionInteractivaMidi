const path = require('path');
const { validateDeckList, resolveDeckList } = require('../p5-collage/deck-list');
const { buildThumbnails } = require('../scripts/build-thumbnails');

describe('deck list', () => {
  test('validates exclusions and resolves manifest order without excluded keys', () => {
    const data = { version: 1, excluded: ['b'] };
    expect(validateDeckList(data, ['a', 'b', 'c'])).toBe(data);
    expect(resolveDeckList(data, ['a', 'b', 'c'])).toEqual(['a', 'c']);
  });
  test.each([
    [{ version: 1, excluded: ['unknown'] }, ['a']],
    [{ version: 1, excluded: ['a', 'a'] }, ['a']],
    [{ version: 2, excluded: [] }, ['a']],
    [{ version: 1, excluded: 'a' }, ['a']],
  ])('rejects invalid deck data without mutation', (data, known) => {
    const before = JSON.stringify(data);
    expect(() => validateDeckList(data, known)).toThrow();
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe('thumbnail builder', () => {
  test('uses injected reader, skips up-to-date targets, and generates absent/outdated targets', () => {
    const norm = p => p.split(path.sep).join('/');
    const files = new Map([['source/a', 10], ['source/b', 20], ['out/a.webp', 10], ['out/b.webp', 1]]);
    const fsImpl = {
      mkdirSync: jest.fn(), existsSync: p => files.has(norm(p)),
      statSync: p => ({ mtimeMs: files.get(norm(p)) }),
    };
    const read = jest.fn((source, target) => files.set(norm(target), files.get(norm(source))));
    buildThumbnails({ manifest: { a: { file: 'a' }, b: { file: 'b' } }, contentDir: 'source', outputDir: 'out', reader: read, fsImpl });
    expect(read).toHaveBeenCalledTimes(1);
    expect(read.mock.calls[0].map(norm)).toEqual(['source/b', 'out/b.webp']);
  });
  test('force regenerates every target, including the ones the mtime rule would skip', () => {
    const norm = p => p.split(path.sep).join('/');
    const files = new Map([['source/a', 10], ['source/b', 20], ['out/a.webp', 10], ['out/b.webp', 1]]);
    const fsImpl = {
      mkdirSync: jest.fn(), existsSync: p => files.has(norm(p)),
      statSync: p => ({ mtimeMs: files.get(norm(p)) }),
    };
    const read = jest.fn((source, target) => files.set(norm(target), files.get(norm(source))));
    buildThumbnails({ manifest: { a: { file: 'a' }, b: { file: 'b' } }, contentDir: 'source', outputDir: 'out', reader: read, fsImpl, force: true });
    expect(read).toHaveBeenCalledTimes(2);
    expect(read.mock.calls.map(call => norm(call[1]))).toEqual(['out/a.webp', 'out/b.webp']);
  });
});
