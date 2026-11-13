'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');

function ffmpegReader(source, target) {
  // -y is mandatory: without it ffmpeg asks to overwrite, refuses when there is
  // no terminal, and STILL exits 0. That turned every existing thumbnail into a
  // silent no-op, so a release kept the previous library's pictures.
  const result = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', source, '-vf', 'scale=200:200:force_original_aspect_ratio=decrease', '-frames:v', '1', '-c:v', 'libwebp', '-quality', '70', target], { encoding: 'utf8' });
  // Belt and braces: never let "Not overwriting - exiting" read as success again.
  if (result.status !== 0 || /not overwriting/i.test(result.stderr || '')) {
    throw new Error(result.stderr || `ffmpeg failed for ${source}`);
  }
}

function buildThumbnails({ manifest, contentDir, outputDir, reader = ffmpegReader, fsImpl = fs, force = false }) {
  fsImpl.mkdirSync(outputDir, { recursive: true });
  for (const [key, entry] of Object.entries(manifest)) {
    const source = path.join(contentDir, entry.file);
    const target = path.join(outputDir, `${key}.webp`);
    // The mtime skip is only safe while the library itself is unchanged. A
    // release rewrites content under the same keys, so it must pass force: a
    // stale thumbnail is otherwise indistinguishable from a current one and
    // shows the previous library's picture for that key.
    if (!force && fsImpl.existsSync(target) && fsImpl.statSync(target).mtimeMs >= fsImpl.statSync(source).mtimeMs) continue;
    reader(source, target);
  }
}

if (require.main === module) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images/manifest.json'), 'utf8'));
  buildThumbnails({ manifest, contentDir: path.join(root, 'images/content'), outputDir: path.join(root, 'images/thumbs'), force: process.argv.includes('--force') });
}
module.exports = { buildThumbnails, ffmpegReader };
