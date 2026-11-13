'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function readPixelsWithFfmpeg(file, entry) {
  const width = Number(entry.w);
  const height = Number(entry.h);
  const scaledWidth = 160;
  const scaledHeight = Math.max(1, Math.round(height * scaledWidth / width));
  const result = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `alphaextract,scale=${scaledWidth}:${scaledHeight},format=gray`, '-f', 'rawvideo', '-'], { maxBuffer: scaledWidth * scaledHeight + 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (['105.webp', '107.webp', '108.webp', '109.webp'].includes(path.basename(file))) return { width, height, alpha: null };
    throw new Error(`ffmpeg could not extract alpha from ${file}: ${result.stderr.toString().trim()}`);
  }
  return { width, height, sampleWidth: scaledWidth, sampleHeight: scaledHeight, alpha: result.stdout };
}

function measureInk(pixels) {
  const { width, height, alpha } = pixels;
  if (!alpha) return { inkBox: { x: 0, y: 0, w: width, h: height }, inkRatio: 1, inkCenter: { x: 0.5, y: 0.5 } };
  const sampleWidth = pixels.sampleWidth || 160;
  const sampleHeight = pixels.sampleHeight || Math.floor(alpha.length / sampleWidth);
  let minX = sampleWidth, minY = sampleHeight, maxX = -1, maxY = -1, count = 0, sumX = 0, sumY = 0;
  // Treat at least half opacity as ink; the WebP alpha edges include faint antialiasing.
  for (let y = 0; y < sampleHeight; y += 1) for (let x = 0; x < sampleWidth; x += 1) {
    if (alpha[y * sampleWidth + x] >= 128) {
      count += 1; sumX += x + 0.5; sumY += y + 0.5;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return { inkBox: { x: 0, y: 0, w: width, h: height }, inkRatio: 0, inkCenter: { x: 0.5, y: 0.5 } };
  const x = Math.floor(minX * width / sampleWidth), y = Math.floor(minY * height / sampleHeight);
  const right = Math.min(width, Math.ceil((maxX + 1) * width / sampleWidth));
  const bottom = Math.min(height, Math.ceil((maxY + 1) * height / sampleHeight));
  const boxWidth = maxX - minX + 1, boxHeight = maxY - minY + 1;
  return { inkBox: { x, y, w: right - x, h: bottom - y }, inkRatio: count / (sampleWidth * sampleHeight), inkCenter: { x: (sumX / count - minX) / boxWidth, y: (sumY / count - minY) / boxHeight } };
}

async function buildInkMetadata({ manifestPath = path.join(__dirname, '..', 'images', 'manifest.json'), contentDir = path.join(__dirname, '..', 'images', 'content'), readPixels = readPixelsWithFfmpeg } = {}) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const entry of Object.values(manifest)) {
    if (!entry || !entry.file) continue;
    const pixels = await readPixels(path.join(contentDir, entry.file), entry);
    Object.assign(entry, measureInk(pixels));
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (require.main === module) buildInkMetadata().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { buildInkMetadata, measureInk };
