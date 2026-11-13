'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
  return result.stdout.trim();
}

function buildFfmpegArgs(source, target, { maxEdge, quality, pixelFormat, noUpscale }) {
  const limitW = noUpscale ? `min(${maxEdge},iw)` : String(maxEdge);
  const limitH = noUpscale ? `min(${maxEdge},ih)` : String(maxEdge);
  const hasAlpha = /a/.test(pixelFormat);
  const filters = [`scale=w='${limitW}':h='${limitH}':force_original_aspect_ratio=decrease`];
  if (hasAlpha) filters.push('format=yuva420p');
  const outputPixelFormat = hasAlpha ? 'yuva420p' : 'yuv420p';
  return ['-v', 'error', '-y', '-i', source, '-vf', filters.join(','), '-frames:v', '1', '-c:v', 'libwebp', '-pix_fmt', outputPixelFormat, '-quality', String(quality), '-lossless', '0', target];
}

function ffmpegConverter({ source, target, maxEdge, quality, preserveAlpha, noUpscale }) {
  const pixelFormat = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt', '-of', 'csv=s=x:p=0', source]);
  run('ffmpeg', buildFfmpegArgs(source, target, { maxEdge, quality, pixelFormat, noUpscale }));
  const dimensions = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', target]).split('x').map(Number);
  if (dimensions.length !== 2 || dimensions.some(value => !Number.isInteger(value) || value < 1)) throw new Error(`Could not read output dimensions for ${target}`);
  return { w: dimensions[0], h: dimensions[1], preserveAlpha };
}

async function importLibrary({
  sourceDir = path.join(ROOT, 'images', 'raw', 'raw library definitivo'),
  contentDir = path.join(ROOT, 'images', 'content'),
  manifestPath = path.join(ROOT, 'images', 'manifest.json'),
  converter = ffmpegConverter,
  dryRun = false,
  print = line => console.log(line),
} = {}) {
  const files = fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
    .sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const hashes = new Map();
  const survivors = [];
  const duplicates = [];
  for (const name of files) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(sourceDir, name))).digest('hex');
    if (hashes.has(hash)) duplicates.push({ kept: hashes.get(hash), duplicate: name });
    else { hashes.set(hash, name); survivors.push(name); }
  }
  const plan = survivors.map((name, index) => ({ key: String(index + 1).padStart(3, '0'), source: name }));
  if (dryRun) {
    print(`Found ${files.length}; deduped ${duplicates.length}; writing ${plan.length}`);
    for (const pair of duplicates) print(`Duplicate: ${pair.duplicate} == ${pair.kept}`);
    for (const item of plan) print(`${item.key}.webp <- ${item.source}`);
    return { found: files.length, deduped: duplicates.length, duplicates, plan };
  }

  fs.mkdirSync(contentDir, { recursive: true });
  const manifest = {};
  for (const item of plan) {
    const converted = await converter({
      source: path.join(sourceDir, item.source), target: path.join(contentDir, `${item.key}.webp`),
      maxEdge: 1600, quality: 90, preserveAlpha: true, noUpscale: true,
    });
    if (!converted || !Number.isInteger(converted.w) || !Number.isInteger(converted.h) || converted.w < 1 || converted.h < 1 || Math.max(converted.w, converted.h) > 1600) {
      throw new Error(`Converter returned invalid dimensions for ${item.source}`);
    }
    manifest[item.key] = { file: `${item.key}.webp`, w: converted.w, h: converted.h };
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { found: files.length, deduped: duplicates.length, duplicates, manifest };
}

if (require.main === module) {
  importLibrary({ dryRun: process.argv.includes('--dry-run') }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { importLibrary, ffmpegConverter, buildFfmpegArgs };
