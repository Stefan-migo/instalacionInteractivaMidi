/**
 * Border Renderer — draws decorative borders around collage cells.
 * Called inside push/translate(cx,cy), so all coordinates are relative
 * to the cell center.
 * Each style uses p5 push/pop for local draw state.
 */
function drawBorder(cellState, p, style) {
  const pos = cellState.pos;
  const w = pos.w;
  const h = pos.h;

  // Apply the cell's opacity to the border so both fade together
  var ctx = p.drawingContext;
  var savedAlpha = ctx ? ctx.globalAlpha : 1;
  if (ctx) ctx.globalAlpha *= (cellState.opacity ?? 1);

  p.push();

  switch (style) {
    case 'torn':
      drawTornBorder(cellState, p);
      break;
    case 'polaroid':
      drawPolaroidBorder(w, h, p);
      break;
    case 'stamp':
      drawStampBorder(w, h, p);
      break;
    case 'gold':
      drawGoldBorder(w, h, p);
      break;
    case 'minimal':
      drawMinimalBorder(w, h, p);
      break;
    case 'deckled-edge':
      drawDeckledEdgeBorder(w, h, p);
      break;
    case 'double-line':
      drawDoubleLineBorder(w, h, p);
      break;
    case 'shadow-box':
      drawShadowBoxBorder(w, h, p);
      break;

    default:
      drawTornBorder(cellState, p);
      break;
  }

  p.pop();
  if (ctx) ctx.globalAlpha = savedAlpha;
}

function drawTornBorder(cellState, p) {
  const verts = cellState.borderVerts;
  const pos = cellState.pos;

  if (!verts || verts.length < 3) {
    if (typeof generateTornBorder !== 'undefined') {
      const hw = pos.w / 2;
      const hh = pos.h / 2;
      cellState.borderVerts = generateTornBorder(-hw, -hh, pos.w, pos.h, 32, 6, cellState.cell ? cellState.cell.slot : 0);
    }
    return;
  }

  p.noFill();
  p.stroke(255);
  p.strokeWeight(1);
  p.beginShape();
  for (const v of verts) {
    p.vertex(v.x, v.y);
  }
  p.endShape(p.CLOSE);
}

function drawPolaroidBorder(w, h, p) {
  const hw = w / 2;
  const hh = h / 2;
  const marginSide = 12;
  const marginTop = 12;
  const marginBottom = 36; // bottom-heavy like classic polaroid

  // White card frame — 4 strips around the image (NOT a single filled rect)
  p.noStroke();
  p.fill(248, 248, 248);
  // Top strip
  p.rect(-hw - marginSide, -hh - marginTop, w + marginSide * 2, marginTop);
  // Bottom strip
  p.rect(-hw - marginSide, hh, w + marginSide * 2, marginBottom);
  // Left strip
  p.rect(-hw - marginSide, -hh, marginSide, h);
  // Right strip
  p.rect(hw, -hh, marginSide, h);

  // Thin gray shadow stroke around the outer perimeter
  p.noFill();
  p.stroke(180, 180, 180, 120);
  p.strokeWeight(1);
  p.rect(-hw - marginSide, -hh - marginTop, w + marginSide * 2, h + marginTop + marginBottom);
}

function drawStampBorder(w, h, p) {
  const hw = w / 2;
  const hh = h / 2;
  const margin = 8;
  const bx = -hw - margin;
  const by = -hh - margin;
  const bw = w + margin * 2;
  const bh = h + margin * 2;

  // Dashed outline
  p.noFill();
  p.stroke(80, 80, 80, 160);
  p.strokeWeight(1.5);

  if (typeof drawingContext !== 'undefined' && drawingContext && typeof drawingContext.setLineDash === 'function') {
    drawingContext.setLineDash([4, 4]);
  }
  p.rect(bx, by, bw, bh);

  // Reset line dash
  if (typeof drawingContext !== 'undefined' && drawingContext && typeof drawingContext.setLineDash === 'function') {
    drawingContext.setLineDash([]);
  }

  // Postmark-like circle mark at top-right corner
  p.noFill();
  p.stroke(100, 100, 100, 100);
  p.strokeWeight(0.8);
  const markX = hw + 2;
  const markY = -hh - 2;
  p.ellipse(markX, markY, 14, 14);
  p.ellipse(markX, markY, 10, 10);
}

function drawGoldBorder(w, h, p) {
  const hw = w / 2;
  const hh = h / 2;
  const margin = 10;
  const bx = -hw - margin;
  const by = -hh - margin;
  const bw = w + margin * 2;
  const bh = h + margin * 2;

  // Frame-only rendering: 4 dark-filled strips around the image
  // (the image area stays transparent — no fill over the cell)
  p.noStroke();
  p.fill(30, 25, 20);
  // Top strip
  p.rect(bx, by, bw, margin);
  // Bottom strip
  p.rect(bx, by + bh - margin, bw, margin);
  // Left strip (between top and bottom)
  p.rect(bx, by + margin, margin, bh - margin * 2);
  // Right strip (between top and bottom)
  p.rect(bx + bw - margin, by + margin, margin, bh - margin * 2);

  // Gold border stroke — outer perimeter
  p.noFill();
  p.stroke(201, 169, 110);
  p.strokeWeight(2);
  p.rect(bx, by, bw, bh);

  // Gold border stroke — inner perimeter
  p.rect(-hw + 1, -hh + 1, w - 2, h - 2);

  // Corner dots
  const dotR = 3;
  const gap = 4;
  p.noStroke();
  p.fill(201, 169, 110);
  p.ellipse(bx + gap, by + gap, dotR * 2, dotR * 2);
  p.ellipse(bx + bw - gap, by + gap, dotR * 2, dotR * 2);
  p.ellipse(bx + gap, by + bh - gap, dotR * 2, dotR * 2);
  p.ellipse(bx + bw - gap, by + bh - gap, dotR * 2, dotR * 2);
}

function drawMinimalBorder(w, h, p) {
  const hw = w / 2;
  const hh = h / 2;
  p.noFill();
  p.stroke(128, 128, 128, 76); // 0.3 alpha ≈ 76/255
  p.strokeWeight(1);
  p.rect(-hw, -hh, w, h);
}

// ── New border styles (Phase 4) ─────────────────────────────────────

/**
 * Deckled-edge: straight outer edge, jittered inner edge.
 * Uses a simple LCG for deterministic jitter 3–8px on inner edge.
 */
function drawDeckledEdgeBorder(w, h, p) {
  const hw = w / 2;
  const hh = h / 2;
  const marginOuter = 2;
  const marginInner = 10;
  const segments = 24;

  // LCG for deterministic jitter
  var seed = 12345;
  function lcg() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  // Outer edge — straight clean rect
  p.noFill();
  p.stroke(200, 190, 175, 100);
  p.strokeWeight(1);
  p.rect(-hw - marginOuter, -hh - marginOuter, w + marginOuter * 2, h + marginOuter * 2);

  // Inner edge — deckled (jittered) vertices
  p.noFill();
  p.stroke(180, 170, 155, 120);
  p.strokeWeight(1);

  var ix = -hw + marginInner;
  var iy = -hh + marginInner;
  var iw2 = w - marginInner * 2;
  var ih2 = h - marginInner * 2;

  p.beginShape();
  // Top edge (left to right)
  for (var i = 0; i < segments; i++) {
    var t = i / segments;
    var jitter = 3 + lcg() * 5; // 3–8px
    var sign = lcg() > 0.5 ? 1 : -1;
    p.vertex(ix + t * iw2 + sign * lcg() * 2, iy + jitter * (lcg() - 0.5) * 0.5);
  }
  // Right edge
  for (var i2 = 0; i2 < segments; i2++) {
    var t2 = i2 / segments;
    var jitter2 = 3 + lcg() * 5;
    var sign2 = lcg() > 0.5 ? 1 : -1;
    p.vertex(ix + iw2 + jitter2 * (lcg() - 0.5) * 0.5, iy + t2 * ih2 + sign2 * lcg() * 2);
  }
  // Bottom edge (right to left)
  for (var i3 = 0; i3 < segments; i3++) {
    var t3 = i3 / segments;
    var jitter3 = 3 + lcg() * 5;
    var sign3 = lcg() > 0.5 ? 1 : -1;
    p.vertex(ix + (1 - t3) * iw2 + sign3 * lcg() * 2, iy + ih2 + jitter3 * (lcg() - 0.5) * 0.5);
  }
  // Left edge (bottom to top)
  for (var i4 = 0; i4 < segments; i4++) {
    var t4 = i4 / segments;
    var jitter4 = 3 + lcg() * 5;
    var sign4 = lcg() > 0.5 ? 1 : -1;
    p.vertex(ix + jitter4 * (lcg() - 0.5) * 0.5, iy + (1 - t4) * ih2 + sign4 * lcg() * 2);
  }
  p.endShape(p.CLOSE);
}

/**
 * Double-line: two concentric rects, 6px gap, alpha 0.4.
 */
function drawDoubleLineBorder(w, h, p) {
  const hw = w / 2;
  const hh = h / 2;

  p.noFill();
  p.stroke(160, 150, 140, 102); // alpha 0.4
  p.strokeWeight(2);
  p.rect(-hw - 5, -hh - 5, w + 10, h + 10);

  p.strokeWeight(1);
  p.rect(-hw - 11, -hh - 11, w + 22, h + 22);
}

/**
 * Shadow-box: 8px fill #2a1f14 + 4px drop shadow bottom-right.
 */
function drawShadowBoxBorder(w, h, p) {
  const hw = w / 2;
  const hh = h / 2;
  const margin = 8;
  const bx = -hw - margin;
  const by = -hh - margin;
  const bw = w + margin * 2;
  const bh = h + margin * 2;

  // Drop shadow (bottom-right offset) — frame only
  p.noStroke();
  p.fill(0, 0, 0, 40);
  const shOff = 4;
  // Top strip
  p.rect(bx + shOff, by + shOff, bw, margin);
  // Bottom strip
  p.rect(bx + shOff, by + bh - margin + shOff, bw, margin);
  // Left strip
  p.rect(bx + shOff, by + margin + shOff, margin, bh - margin * 2);
  // Right strip
  p.rect(bx + bw - margin + shOff, by + margin + shOff, margin, bh - margin * 2);

  // Dark fill background — frame only (not over the image)
  p.fill(42, 31, 20); // #2a1f14
  // Top strip
  p.rect(bx, by, bw, margin);
  // Bottom strip
  p.rect(bx, by + bh - margin, bw, margin);
  // Left strip
  p.rect(bx, by + margin, margin, bh - margin * 2);
  // Right strip
  p.rect(bx + bw - margin, by + margin, margin, bh - margin * 2);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawBorder };
}
