'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');

function ffmpegReader(source, target) {
  const result = spawnSync('ffmpeg', ['-v', 'error', '-i', source, '-vf', 'scale=200:200:force_original_aspect_ratio=decrease', '-frames:v', '1', '-c:v', 'libwebp', '-quality', '70', target], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `ffmpeg failed for ${source}`);
}

function buildThumbnails({ manifest, contentDir, outputDir, reader = ffmpegReader, fsImpl = fs }) {
  fsImpl.mkdirSync(outputDir, { recursive: true });
  for (const [key, entry] of Object.entries(manifest)) {
    const source = path.join(contentDir, entry.file);
    const target = path.join(outputDir, `${key}.webp`);
    if (fsImpl.existsSync(target) && fsImpl.statSync(target).mtimeMs >= fsImpl.statSync(source).mtimeMs) continue;
    reader(source, target);
  }
}

if (require.main === module) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'images/manifest.json'), 'utf8'));
  buildThumbnails({ manifest, contentDir: path.join(root, 'images/content'), outputDir: path.join(root, 'images/thumbs') });
}
module.exports = { buildThumbnails, ffmpegReader };
