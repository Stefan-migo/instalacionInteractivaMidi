const fs = require('fs');
const path = require('path');

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const TOTAL_SLOTS = 30;
const MARGIN = 40;

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'images', 'manifest.json'), 'utf-8')
);

if (Object.keys(manifest).length === 0) {
  console.error('images/manifest.json has no entries — nothing to lay out.');
  console.error('Add images to images/content/ and describe them in images/manifest.json first.');
  console.error('Existing images/layout.json was left untouched.');
  process.exit(1);
}

const images = Object.entries(manifest).map(([id, info]) => ({
  id,
  file: info.file,
  w: info.w,
  h: info.h,
}));

images.sort((a, b) => (b.w * b.h) - (a.w * a.h));

const largeImages = images.filter(i => i.w >= 1200 && i.h >= 800);
const mediumImages = images.filter(i => i.w >= 500 && i.h >= 400 && !(i.w >= 1200 && i.h >= 800));
const smallImages = images.filter(i => !(i.w >= 500 && i.h >= 400));

const cellPool = [];
for (let i = 0; i < TOTAL_SLOTS; i++) {
  cellPool.push(i);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const scaleToFit = (imgW, imgH, maxW, maxH) => {
  const scale = Math.min(maxW / imgW, maxH / imgH);
  return { w: Math.round(imgW * scale), h: Math.round(imgH * scale), scale };
};

function generateLayout() {
  const cells = [];
  const usedZ = new Set();
  const placedRegions = [];

  const ROWS = 5;
  const COLS = 6;
  const cellW = (CANVAS_W - MARGIN * 2) / COLS;
  const cellH = (CANVAS_H - MARGIN * 2) / ROWS;

  const gridCenters = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      gridCenters.push({
        x: MARGIN + cellW * c + cellW / 2,
        y: MARGIN + cellH * r + cellH / 2,
      });
    }
  }

  const shuffledCenters = gridCenters.sort(() => Math.random() - 0.5);

  const overlapFactors = [0.9, 1.1, 0.8, 1.3, 0.7, 1.0];

  for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
    let img;
    if (slot < 8 && largeImages.length) {
      img = largeImages.shift();
    } else if (slot < 20 && mediumImages.length) {
      img = mediumImages.shift();
    } else if (smallImages.length) {
      img = smallImages.shift();
    } else {
      img = images[slot % images.length];
    }

    if (!img) {
      img = images[slot % images.length];
    }

    const center = shuffledCenters[slot % shuffledCenters.length];

    const overlapFactor = overlapFactors[slot % overlapFactors.length];
    const displayW = Math.round(cellW * overlapFactor);
    const displayH = Math.round(displayW * (img.h / img.w));

    const maxDisplayH = CANVAS_H * 0.6;
    const finalH = Math.min(displayH, maxDisplayH);
    const finalW = Math.round(finalH * (img.w / img.h));

    const offsetX = (Math.random() - 0.5) * cellW * 0.4;
    const offsetY = (Math.random() - 0.5) * cellH * 0.4;
    const x = Math.max(10, Math.min(CANVAS_W - finalW - 10, center.x - finalW / 2 + offsetX));
    const y = Math.max(10, Math.min(CANVAS_H - finalH - 10, center.y - finalH / 2 + offsetY));

    let zIndex;
    do {
      zIndex = Math.floor(Math.random() * 100);
    } while (usedZ.has(zIndex));
    usedZ.add(zIndex);

    const rotation = (Math.random() - 0.5) * 8;

    cells.push({
      slot,
      cellId: `cell_${String(slot).padStart(2, '0')}`,
      imageId: img.id,
      imageFile: img.file,
      originalW: img.w,
      originalH: img.h,
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(finalW),
      h: Math.round(finalH),
      rotation: parseFloat(rotation.toFixed(1)),
      zIndex,
    });

    placedRegions.push({ x, y, w: finalW, h: finalH });
  }

  cells.sort((a, b) => a.zIndex - b.zIndex);

  return {
    canvas: { w: CANVAS_W, h: CANVAS_H },
    totalSlots: TOTAL_SLOTS,
    cells,
  };
}

const layout = generateLayout();

fs.writeFileSync(
  path.join(__dirname, '..', 'images', 'layout.json'),
  JSON.stringify(layout, null, 2)
);

console.log(`Generated layout with ${layout.cells.length} cells on ${CANVAS_W}x${CANVAS_H}`);
layout.cells.forEach(c => {
  console.log(`  Slot ${c.slot}: ${c.imageFile} @ (${c.x},${c.y}) ${c.w}x${c.h} z=${c.zIndex} rot=${c.rotation}°`);
});
