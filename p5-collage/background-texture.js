/**
 * Background Texture — Shader-generated paper texture.
 *
 * Pre-rendered to offscreen p5.Graphics for performance.
 * Uses raw WebGL simplex noise (Ashima Arts) rendered once and cached.
 */

function drawBackgroundTexture(p, w, h, intensity, seed, style) {
  var gfx = p.createGraphics(w, h);

  if (intensity <= 0) {
    gfx.clear();
    return gfx;
  }

  // Only shader-paper is active. If unknown style, fall back cleanly.
  if (style !== 'shader-paper') {
    gfx.clear();
    gfx.noStroke();
    gfx.fill(235, 217, 179);
    gfx.rect(0, 0, w, h);
    return gfx;
  }

  // Render shader-based paper texture
  var shaderCanvas = renderPaperShader(w, h, intensity, seed);
  if (shaderCanvas) {
    gfx.canvas.getContext('2d').drawImage(shaderCanvas, 0, 0);
  } else {
    // WebGL not available — solid warm fill as fallback
    gfx.clear();
    gfx.noStroke();
    gfx.fill(235, 217, 179);
    gfx.rect(0, 0, w, h);
  }

  return gfx;
}

// ── Shader-based background (raw WebGL, rendered once) ──────────────────

// Minimal passthrough vertex shader
var _VERT_SRC = [
  'attribute vec2 a_position;',
  'void main() {',
  '  gl_Position = vec4(a_position, 0.0, 1.0);',
  '}'
].join('\n');

// Fragment shader: simplex noise paper texture (adapted from Ashima Arts / ShaderToy)
var _FRAG_SRC = [
  'precision highp float;',
  'uniform vec2 u_resolution;',
  'uniform float u_intensity;',
  '',
  'vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }',
  'vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }',
  'vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }',
  'vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }',
  '',
  'float snoise(vec3 v) {',
  '  const vec2 C = vec2(1.0/6.0, 1.0/3.0);',
  '  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);',
  '  vec3 i  = floor(v + dot(v, C.yyy));',
  '  vec3 x0 = v - i + dot(i, C.xxx);',
  '  vec3 g = step(x0.yzx, x0.xyz);',
  '  vec3 l = 1.0 - g;',
  '  vec3 i1 = min(g.xyz, l.zxy);',
  '  vec3 i2 = max(g.xyz, l.zxy);',
  '  vec3 x1 = x0 - i1 + C.xxx;',
  '  vec3 x2 = x0 - i2 + C.yyy;',
  '  vec3 x3 = x0 - D.yyy;',
  '  i = mod289(i);',
  '  vec4 p = permute(permute(permute(',
  '    i.z + vec4(0.0, i1.z, i2.z, 1.0))',
  '    + i.y + vec4(0.0, i1.y, i2.y, 1.0))',
  '    + i.x + vec4(0.0, i1.x, i2.x, 1.0));',
  '  float n_ = 0.142857142857;',
  '  vec3 ns = n_ * D.wyz - D.xzx;',
  '  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);',
  '  vec4 x_ = floor(j * ns.z);',
  '  vec4 y_ = floor(j - 7.0 * x_);',
  '  vec4 x = x_ * ns.x + ns.yyyy;',
  '  vec4 y = y_ * ns.x + ns.yyyy;',
  '  vec4 h = 1.0 - abs(x) - abs(y);',
  '  vec4 b0 = vec4(x.xy, y.xy);',
  '  vec4 b1 = vec4(x.zw, y.zw);',
  '  vec4 s0 = floor(b0) * 2.0 + 1.0;',
  '  vec4 s1 = floor(b1) * 2.0 + 1.0;',
  '  vec4 sh = -step(h, vec4(0.0));',
  '  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;',
  '  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;',
  '  vec3 p0 = vec3(a0.xy, h.x);',
  '  vec3 p1 = vec3(a0.zw, h.y);',
  '  vec3 p2 = vec3(a1.xy, h.z);',
  '  vec3 p3 = vec3(a1.zw, h.w);',
  '  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));',
  '  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;',
  '  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);',
  '  m = m * m;',
  '  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));',
  '}',
  '',
  'float fbm(vec3 p) {',
  '  float value = 0.0;',
  '  float amplitude = 1.0;',
  '  float frequency = 0.025;',
  '  float lacunarity = 2.0;',
  '  float persistance = 0.5;',
  '  float scale = 0.5;',
  '  int octaves = 8;',
  '  for (int i = 0; i < 8; i++) {',
  '    float noiseVal = snoise(p * frequency * scale);',
  '    value += amplitude * noiseVal;',
  '    frequency *= lacunarity;',
  '    amplitude *= persistance;',
  '  }',
  '  return value;',
  '}',
  '',
  'float paperNoise(vec2 uv) {',
  '  float n1 = fbm(vec3(uv + vec2(1.0, 0.0), 0.0));',
  '  float n2 = fbm(vec3(uv - vec2(1.0, 0.0), 0.0));',
  '  return n1 - n2;',
  '}',
  '',
  'void main() {',
  '  vec2 uv = gl_FragCoord.xy / u_resolution;',
  '  vec3 col = vec3(0.92, 0.85, 0.70);',
  '  float noise = paperNoise(gl_FragCoord.xy) * 0.3 * u_intensity;',
  '  col += noise;',
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

function renderPaperShader(w, h, intensity, seed) {
  try {
    var canvas = document.createElement('canvas');
  } catch (e) {
    return null; // No DOM available (test env, SSR, etc.)
  }
  canvas.width = w;
  canvas.height = h;
  var gl;
  try { gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); } catch (e) {}
  if (!gl) return null;

  function compileShader(src, type) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[shader] compile error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compileShader(_VERT_SRC, gl.VERTEX_SHADER);
  var fs = compileShader(_FRAG_SRC, gl.FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[shader] link error:', gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  // Fullscreen quad (two triangles as triangle strip)
  var positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  var posLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Set uniforms
  gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), w, h);
  gl.uniform1f(gl.getUniformLocation(program, 'u_intensity'), intensity);

  gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Clean up WebGL resources
  gl.deleteProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  gl.deleteBuffer(buf);

  return canvas;
}



if (typeof module !== 'undefined' && module.exports) {
  module.exports = { drawBackgroundTexture };
}
