// Draws a layer tree to canvases. Every leaf layer gets its own canvas, which is
// used both for the live preview/composite and as the pixel data inside the PSD.
import { FONTS, textGeom, setMeasure } from './layout.js';
import { BORDER_ART_TILE } from './borderArtData.js';

let factory = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
let measureCtx = null;

/** Lets Node tests plug in the `canvas` package. */
export function setCanvasFactory(f) {
  factory = f;
  measureCtx = null;
}
export const makeCanvas = (w, h) => factory(w, h);

/* Moon-phase artwork (face images). Filled by loadMoonSprites(); until then the old drawn circles are used. */
const sprites = {};
export function setMoonSprite(phase, img) {
  sprites[phase] = img;
}
/** loader: (dataUri) => Promise<drawable image>. Browser: new Image(); Node: canvas.loadImage */
export async function loadMoonSprites(loader, data) {
  await Promise.all(Object.entries(data).map(async ([k, uri]) => setMoonSprite(k, await loader(uri))));
}

/* Custom border artwork (BOARDER.png) — filled by loadBorderArt(); until then the built-in key pattern is drawn. */
let borderArt = null;
const artTintCache = new Map();
export async function loadBorderArt(loader, data) {
  const out = {};
  await Promise.all(Object.entries(data).map(async ([k, uri]) => { out[k] = await loader(uri); }));
  borderArt = out;
  artTintCache.clear();
}
function artTinted(name, color) {
  const key = `${name}|${color}`;
  let t = artTintCache.get(key);
  if (!t) {
    const img = borderArt[name];
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    t = makeCanvas(w, h);
    const g = t.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    artTintCache.set(key, t);
  }
  return t;
}
function drawArtBorder(c, l) {
  const { x, y, w, h, bw } = l;
  const s = bw / BORDER_ART_TILE.band; // units per source pixel
  const col = l.color || '#111111';
  c.save();
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  const lenH = w - 2 * bw;
  const lenV = h - 2 * bw;
  const nH = Math.max(1, Math.round(lenH / (BORDER_ART_TILE.h * s)));
  const nV = Math.max(1, Math.round(lenV / (BORDER_ART_TILE.v * s)));
  const tw = lenH / nH;
  const th = lenV / nV;
  const ov = 0.2 * s; // tiny overlap hides hairline seams
  for (let i = 0; i < nH; i++) {
    c.drawImage(artTinted('top', col), x + bw + i * tw, y, tw + ov, bw);
    c.drawImage(artTinted('bot', col), x + bw + i * tw, y + h - bw, tw + ov, bw);
  }
  for (let i = 0; i < nV; i++) {
    c.drawImage(artTinted('left', col), x, y + bw + i * th, bw, th + ov);
    c.drawImage(artTinted('right', col), x + w - bw, y + bw + i * th, bw, th + ov);
  }
  c.drawImage(artTinted('tl', col), x, y, bw, bw);
  c.drawImage(artTinted('tr', col), x + w - bw, y, bw, bw);
  c.drawImage(artTinted('bl', col), x, y + h - bw, bw, bw);
  c.drawImage(artTinted('br', col), x + w - bw, y + h - bw, bw, bw);
  c.restore();
}

/* ---------------- moon artwork sets ----------------
   1 = face artwork, 2 = red faces, 3 = grey cratered moon, 4 = red faces (April sample); 1, 2 and 4 take the theme colour,
   3 = grey cratered moon, 5 = gold & navy discs (fixed colours). The set is global: every moon on every page and month uses it, and each
   cell still gets the phase that is computed for that month. */
let moonSet = 1;
export function setMoonSet(n) {
  moonSet = [1, 2, 3, 4, 5].includes(Number(n)) ? Number(n) : 1;
}
const CRATERS = [[-0.35, -0.3, 0.2], [0.3, -0.45, 0.13], [0.45, 0.1, 0.18], [-0.1, 0.25, 0.15], [-0.5, 0.35, 0.1], [0.1, -0.05, 0.09], [0.2, 0.55, 0.11], [-0.2, -0.65, 0.08], [0.62, -0.2, 0.07]];
const realCache = new Map();
function realMoonSprite(phase) {
  if (realCache.has(phase)) return realCache.get(phase);
  const S = 256, r = S / 2 - 4, cx = S / 2, cy = S / 2;
  const cv = factory(S, S);
  const g = cv.getContext('2d');
  const full = phase === 'full';
  const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  (full ? [[0, '#fafafa'], [0.6, '#dcdcdc'], [1, '#b9b9b9']] : [[0, '#bdbdbd'], [0.6, '#a2a2a2'], [1, '#808080']]).forEach(([s, col]) => gr.addColorStop(s, col));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  CRATERS.forEach(([fx, fy, fr]) => {
    g.beginPath();
    g.arc(cx + fx * r, cy + fy * r, fr * r, 0, Math.PI * 2);
    g.fillStyle = full ? 'rgba(120,120,120,0.28)' : 'rgba(60,60,60,0.32)';
    g.fill();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.stroke();
  });
  if (phase === 'fq' || phase === 'lq') {
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(cx + (phase === 'fq' ? 1 : -1) * r * 0.55, cy, r * 0.98, 0, Math.PI * 2);
    g.fill();
  }
  realCache.set(phase, cv);
  return cv;
}

/* set 5: gold & navy discs. Full = gold, new = starry navy, first quarter = navy | gold, last quarter = gold | navy. */
const goldNavyCache = new Map();
function goldNavySprite(phase) {
  if (goldNavyCache.has(phase)) return goldNavyCache.get(phase);
  const S = 256, cx = S / 2, cy = S / 2, r = S / 2 - 3;
  const cv = factory(S, S);
  const g = cv.getContext('2d');
  const disc = (kind) => {
    const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    if (kind === 'gold') [[0, '#e3cf86'], [0.55, '#cdb360'], [1, '#b39a4a']].forEach(([o, col]) => gr.addColorStop(o, col));
    else [[0, '#3b3a6e'], [0.6, '#2c2b58'], [1, '#1f1e44']].forEach(([o, col]) => gr.addColorStop(o, col));
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
    // fine speckle (stars on navy, grain on gold)
    let seed = kind === 'gold' ? 7 : 19;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 160; i++) {
      g.fillStyle = kind === 'gold' ? `rgba(255,248,210,${0.08 + rnd() * 0.18})` : `rgba(200,205,255,${0.1 + rnd() * 0.3})`;
      g.beginPath();
      g.arc(rnd() * S, rnd() * S, 0.6 + rnd() * (kind === 'gold' ? 1.6 : 1.1), 0, Math.PI * 2);
      g.fill();
    }
  };
  const half = (left, kind) => {
    g.save();
    g.beginPath();
    g.rect(left ? 0 : cx, 0, S / 2, S);
    g.clip();
    disc(kind);
    g.restore();
  };
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  if (phase === 'full') disc('gold');
  else if (phase === 'new') disc('navy');
  else if (phase === 'fq') { half(true, 'navy'); half(false, 'gold'); }
  else { half(true, 'gold'); half(false, 'navy'); }
  g.restore();
  goldNavyCache.set(phase, cv);
  return cv;
}

function drawMoon(c, l, set) {
  const sz = Math.min(l.w, l.h);
  const key = set === 1 ? l.phase : `s${set}_${l.phase}`;
  if (set !== 1 && sprites[key]) {
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(set === 3 ? sprites[key] : tintedSprite(key, l.color), l.x + (l.w - sz) / 2, l.y + (l.h - sz) / 2, sz, sz);
    return;
  }
  if (set === 5) {
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(goldNavySprite(l.phase), l.x + (l.w - sz) / 2, l.y + (l.h - sz) / 2, sz, sz);
    return;
  }
  if (set === 3) {
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(realMoonSprite(l.phase), l.x + (l.w - sz) / 2, l.y + (l.h - sz) / 2, sz, sz);
    return;
  }
  if (set === 1 && sprites[l.phase]) {
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(tintedSprite(l.phase, l.color), l.x + (l.w - sz) / 2, l.y + (l.h - sz) / 2, sz, sz);
    return;
  }
  const lw = Math.max(1.5, l.w * 0.06);
  const cx = l.x + l.w / 2;
  const cy = l.y + l.h / 2;
  const r = Math.min(l.w, l.h) / 2 - lw / 2;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.fillStyle = l.phase === 'new' ? l.color : l.light;
  c.fill();
  if (l.phase === 'fq' || l.phase === 'lq') {
    c.beginPath();
    if (l.phase === 'fq') c.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
    else c.arc(cx, cy, r, Math.PI / 2, (3 * Math.PI) / 2);
    c.closePath();
    c.fillStyle = l.color;
    c.fill();
  }
  c.lineWidth = lw;
  c.strokeStyle = l.color;
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.stroke();
  if (l.phase === 'full') {
    c.lineWidth = lw * 0.55;
    c.beginPath();
    c.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
    c.stroke();
  }
}

/** small preview of one phase in one set, for the Moon picker */
export function drawMoonTile(canvas, set, phase, color) {
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  drawMoon(g, { type: 'moon', phase, x: 0, y: 0, w: canvas.width, h: canvas.height, color, light: '#ffffff' }, set);
}

const tinted = new Map();
function tintedSprite(phase, color) {
  const key = phase + color;
  if (tinted.has(key)) return tinted.get(key);
  const src = sprites[phase];
  const w = src.naturalWidth || src.width;
  const h = src.naturalHeight || src.height;
  const cv = factory(w, h);
  const cx = cv.getContext('2d');
  cx.drawImage(src, 0, 0);
  cx.globalCompositeOperation = 'source-in';
  cx.fillStyle = color;
  cx.fillRect(0, 0, w, h);
  tinted.set(key, cv);
  return cv;
}

export const fontString = (key, bold, size) => `${bold ? 'bold ' : ''}${size}px ${(FONTS[key] || FONTS.Arial).css}`;

export function measure(text, fontKey, bold, size) {
  if (!measureCtx) measureCtx = factory(8, 8).getContext('2d');
  measureCtx.font = fontString(fontKey, bold, size);
  return measureCtx.measureText(text).width;
}

setMeasure(measure); // lets the auto-fit pass (autofit.js) measure text with the same fonts as the renderer

// polygon given as fractions (0-1) of the node's own box, so it follows moves / resizes in the editor
function shapePath(c, l) {
  c.beginPath();
  l.shape.forEach(([fx, fy], i) => {
    const px = l.x + fx * l.w;
    const py = l.y + fy * l.h;
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  });
  c.closePath();
}

function roundedRect(c, x, y, w, h, r) {
  r = Math.min(r || 0, w / 2, h / 2);
  c.beginPath();
  if (r <= 0) {
    c.rect(x, y, w, h);
    return;
  }
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}


/* Ornamental key-pattern band (the black "Chinese" border of the Philippine wall calendar). */
function keyBand(c, len, bw, color, paper) {
  // local coords: band runs along +x from 0..len, spans y 0..bw
  c.fillStyle = color;
  c.fillRect(0, 0, len, bw);
  const m = bw * 0.2;
  const n = Math.max(1, Math.round(len / (bw * 1.55)));
  const tw = len / n;
  c.strokeStyle = paper;
  c.lineWidth = Math.max(1, bw * 0.085);
  c.lineCap = 'butt';
  c.lineJoin = 'miter';
  for (let i = 0; i < n; i++) {
    const x0 = i * tw;
    c.beginPath();
    c.moveTo(x0, m); c.lineTo(x0, bw - m); // divider bar
    c.moveTo(x0 + tw * 0.2, bw - m);
    c.lineTo(x0 + tw * 0.2, m);
    c.lineTo(x0 + tw * 0.82, m);
    c.lineTo(x0 + tw * 0.82, bw * 0.64);
    c.lineTo(x0 + tw * 0.42, bw * 0.64);
    c.lineTo(x0 + tw * 0.42, bw * 0.42);
    c.lineTo(x0 + tw * 0.62, bw * 0.42);
    c.stroke();
  }
  c.beginPath();
  c.moveTo(len, m); c.lineTo(len, bw - m);
  c.stroke();
}

function drawKeyBorder(c, l) {
  if (l.art === 'img' && l.mode !== 'strip' && borderArt) {
    drawArtBorder(c, l);
    return;
  }
  const paper = l.bg || '#ffffff';
  if (l.mode === 'strip' && l.hl) {
    // plain horizontal rule: one bar, or a thick bar + thin bar
    c.fillStyle = l.color;
    if (l.hl === 'double') {
      c.fillRect(l.x, l.y, l.w, l.h * 0.42);
      c.fillRect(l.x, l.y + l.h * 0.8, l.w, l.h * 0.2);
    } else c.fillRect(l.x, l.y, l.w, l.h);
    return;
  }
  if (l.mode === 'strip') {
    c.save();
    c.translate(l.x, l.y);
    keyBand(c, l.w, l.h, l.color, paper);
    c.restore();
    return;
  }
  const { x, y, w, h, bw } = l;
  const side = (tx, ty, rot, len) => {
    c.save();
    c.translate(tx, ty);
    c.rotate(rot);
    c.translate(bw, 0);
    keyBand(c, len - 2 * bw, bw, l.color, paper);
    c.restore();
  };
  side(x, y, 0, w);
  side(x + w, y, Math.PI / 2, h);
  side(x + w, y + h, Math.PI, w);
  side(x, y + h, -Math.PI / 2, h);
  // corner blocks
  [[x, y], [x + w - bw, y], [x, y + h - bw], [x + w - bw, y + h - bw]].forEach(([cx, cy]) => {
    c.fillStyle = l.color;
    c.fillRect(cx, cy, bw, bw);
    c.strokeStyle = paper;
    c.lineWidth = Math.max(1, bw * 0.085);
    c.strokeRect(cx + bw * 0.2, cy + bw * 0.2, bw * 0.6, bw * 0.6);
    c.fillStyle = paper;
    c.fillRect(cx + bw * 0.4, cy + bw * 0.4, bw * 0.2, bw * 0.2);
  });
}


/* Zodiac goat emblem (stylised silhouette), drawn inside the node's box. */
function drawGoat(c, l) {
  const s = Math.min(l.w / 100, l.h / 100);
  c.save();
  c.translate(l.x + (l.w - 100 * s) / 2, l.y + (l.h - 100 * s) / 2);
  c.scale(s, s);
  c.fillStyle = l.color;
  c.strokeStyle = l.color;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  // body
  c.beginPath();
  c.moveTo(22, 52); c.bezierCurveTo(24, 38, 52, 36, 70, 42);
  c.bezierCurveTo(80, 46, 84, 56, 80, 66);
  c.bezierCurveTo(72, 70, 40, 72, 28, 68);
  c.bezierCurveTo(22, 64, 20, 58, 22, 52);
  c.fill();
  // neck + head
  c.beginPath();
  c.moveTo(22, 52); c.bezierCurveTo(14, 44, 12, 32, 18, 24);
  c.bezierCurveTo(24, 18, 34, 20, 38, 26);
  c.bezierCurveTo(36, 36, 36, 44, 40, 50);
  c.closePath();
  c.fill();
  // muzzle + beard
  c.beginPath();
  c.moveTo(18, 24); c.bezierCurveTo(10, 28, 8, 36, 10, 42);
  c.bezierCurveTo(14, 44, 18, 42, 20, 38);
  c.closePath();
  c.fill();
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(12, 42); c.quadraticCurveTo(10, 52, 14, 58); c.stroke();
  // horn
  c.lineWidth = 5;
  c.beginPath(); c.moveTo(30, 20); c.bezierCurveTo(34, 6, 52, 2, 60, 14); c.stroke();
  c.lineWidth = 3;
  c.beginPath(); c.moveTo(34, 18); c.bezierCurveTo(40, 12, 48, 12, 52, 18); c.stroke();
  // ear
  c.beginPath(); c.moveTo(34, 26); c.lineTo(48, 28); c.lineTo(36, 32); c.closePath(); c.fill();
  // legs
  c.lineWidth = 6;
  [[32, 68, 30, 92], [44, 70, 46, 92], [66, 70, 64, 92], [78, 66, 82, 90]].forEach(([x1, y1, x2, y2]) => {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  });
  // tail
  c.lineWidth = 5;
  c.beginPath(); c.moveTo(80, 46); c.quadraticCurveTo(90, 38, 88, 30); c.stroke();
  // eye (cut-out)
  c.globalCompositeOperation = 'destination-out';
  c.beginPath(); c.arc(24, 28, 2.2, 0, Math.PI * 2); c.fill();
  c.restore();
}

function fillFor(c, fill, l) {
  if (typeof fill === 'string') return fill;
  const g = c.createLinearGradient(0, l.y, 0, l.y + l.h);
  fill.grad.forEach(([s, col]) => g.addColorStop(s, col));
  return g;
}

/** layers that can be turned (rot, degrees) and mirrored (flipX / flipY) around their centre */
export const canRotate = (l) => ['image', 'rect', 'text', 'moon', 'goat'].includes(l.type);
const turned = (l) => canRotate(l) && (l.rot || l.flipX || l.flipY);

function draw(c, l, geom) {
  if (l.type !== 'text' && turned(l)) {
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    c.save();
    c.translate(cx, cy);
    if (l.rot) c.rotate((l.rot * Math.PI) / 180);
    c.scale(l.flipX ? -1 : 1, l.flipY ? -1 : 1);
    c.translate(-cx, -cy);
    drawRaw(c, l, geom);
    c.restore();
    return;
  }
  drawRaw(c, l, geom);
}


/** blend modes: canvas operation + the name ag-psd writes into the PSD */
export const BLEND_MODES = [
  ['normal', 'Normal'], ['darken', 'Darken'], ['multiply', 'Multiply'], ['color burn', 'Color Burn'],
  ['lighten', 'Lighten'], ['screen', 'Screen'], ['color dodge', 'Color Dodge'],
  ['overlay', 'Overlay'], ['soft light', 'Soft Light'], ['hard light', 'Hard Light'],
  ['difference', 'Difference'], ['exclusion', 'Exclusion'],
  ['hue', 'Hue'], ['saturation', 'Saturation'], ['color', 'Color'], ['luminosity', 'Luminosity'],
];
const BLEND = {
  normal: 'source-over', darken: 'darken', multiply: 'multiply', 'color burn': 'color-burn', lighten: 'lighten',
  screen: 'screen', 'color dodge': 'color-dodge', overlay: 'overlay', 'soft light': 'soft-light', 'hard light': 'hard-light',
  difference: 'difference', exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity',
};

/** image adjustments (brightness, contrast, ... blur) as a canvas filter string; '' when untouched */
export function adjFilter(a) {
  if (!a) return '';
  const f = [];
  if (a.brightness != null && a.brightness !== 100) f.push(`brightness(${a.brightness}%)`);
  if (a.contrast != null && a.contrast !== 100) f.push(`contrast(${a.contrast}%)`);
  if (a.saturate != null && a.saturate !== 100) f.push(`saturate(${a.saturate}%)`);
  if (a.hue) f.push(`hue-rotate(${a.hue}deg)`);
  if (a.gray) f.push(`grayscale(${a.gray}%)`);
  if (a.sepia) f.push(`sepia(${a.sepia}%)`);
  if (a.invert) f.push(`invert(${a.invert}%)`);
  if (a.blur) f.push(`blur(${a.blur}px)`);
  return f.join(' ');
}

/* ---------- Photoshop-style "Layer Style" for text (stroke, drop shadow, outer glow, colour / gradient overlay) ---------- */
export const hasLayerStyle = (ls) => !!ls && ['stroke', 'shadow', 'glow', 'ishadow', 'iglow', 'bevel', 'pattern', 'color', 'grad'].some((k) => ls[k] && ls[k].on);

const hexRgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '#000000'));
  const v = parseInt(m ? m[1] : '000000', 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const rgba = (hex, a) => {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
};

/** how far (design units) the effects reach beyond the glyphs - used to size the layer canvas */
export function layerStylePad(ls) {
  if (!hasLayerStyle(ls)) return 0;
  let p = 0;
  if (ls.stroke && ls.stroke.on) p = Math.max(p, (ls.stroke.size || 0) + 1);
  if (ls.shadow && ls.shadow.on) p = Math.max(p, (ls.shadow.dist || 0) + (ls.shadow.blur || 0) * 2 + (ls.shadow.spread || 0) + 1);
  if (ls.glow && ls.glow.on) p = Math.max(p, (ls.glow.size || 0) * 2 + 1);
  return p;
}


/** inner shadow / inner glow / bevel: shape is cast from OUTSIDE the glyph inwards, then clipped to the glyph */
function innerEffect(c, l, geom, m, hex, opacity, blur, dx, dy) {
  const W = c.canvas.width;
  const H = c.canvas.height;
  const k = Math.hypot(m.a, m.b) || 1;
  const a = factory(W, H);
  const ga = a.getContext('2d');
  ga.setTransform(m);
  ga.font = fontString(l.font, l.bold, geom.size);
  ga.textAlign = l.align;
  ga.textBaseline = 'alphabetic';
  // 1) everything except the glyph
  ga.save();
  ga.setTransform(1, 0, 0, 1, 0, 0);
  ga.fillStyle = rgba(hex, 1);
  ga.fillRect(0, 0, W, H);
  ga.restore();
  ga.globalCompositeOperation = 'destination-out';
  ga.fillStyle = '#000';
  ga.fillText(l.text, geom.anchorX, geom.baselineY);
  // 2) cast that shape's shadow inwards
  const b = factory(W, H);
  const gb = b.getContext('2d');
  gb.shadowColor = rgba(hex, opacity);
  gb.shadowBlur = blur * k;
  gb.shadowOffsetX = dx * k;
  gb.shadowOffsetY = dy * k;
  gb.drawImage(a, 0, 0);
  // keep only the part that lands inside the glyph (the surrounding shape itself falls outside it and is cut away)
  gb.shadowColor = 'rgba(0,0,0,0)';
  gb.globalCompositeOperation = 'destination-in';
  gb.setTransform(m);
  gb.font = fontString(l.font, l.bold, geom.size);
  gb.textAlign = l.align;
  gb.textBaseline = 'alphabetic';
  gb.fillStyle = '#000';
  gb.fillText(l.text, geom.anchorX, geom.baselineY);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(b, 0, 0);
  c.restore();
}

/** tiny repeating patterns for "Pattern Overlay" */
function patternFill(c, p, k) {
  const unit = Math.max(2, p.scale || 6); // tile size in design units
  const px = Math.max(4, Math.round(unit * k));
  const t = factory(px, px);
  const g = t.getContext('2d');
  g.fillStyle = p.c1 || '#000000';
  g.fillRect(0, 0, px, px);
  g.fillStyle = p.c2 || '#ffffff';
  g.strokeStyle = p.c2 || '#ffffff';
  const kind = p.kind || 'stripes';
  if (kind === 'stripes') {
    g.fillRect(0, 0, px, px / 2);
  } else if (kind === 'diagonal') {
    g.lineWidth = px / 4;
    g.beginPath();
    g.moveTo(-px, px * 2); g.lineTo(px * 2, -px);
    g.moveTo(-px, px); g.lineTo(px, -px);
    g.moveTo(0, px * 2); g.lineTo(px * 2, 0);
    g.stroke();
  } else if (kind === 'dots') {
    g.beginPath();
    g.arc(px / 2, px / 2, px * 0.28, 0, Math.PI * 2);
    g.fill();
  } else if (kind === 'checks') {
    g.fillRect(0, 0, px / 2, px / 2);
    g.fillRect(px / 2, px / 2, px / 2, px / 2);
  }
  const pat = c.createPattern(t, 'repeat');
  if (pat && pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().scale(1 / k));
  return pat;
}

function drawStyledText(c, l, geom) {
  const ls = l.lstyle;
  const { anchorX, baselineY, size } = geom;
  const txt = l.text;
  const m = c.getTransform();
  const k = Math.hypot(m.a, m.b) || 1; // canvas shadows work in device pixels, not design units
  const stroke = (w) => {
    c.lineJoin = 'round';
    c.miterLimit = 2;
    c.lineWidth = w;
    c.strokeText(txt, anchorX, baselineY);
  };
  /** paint a glyph with a canvas shadow; the glyph itself ends up hidden under the fill drawn afterwards */
  const shadowOnly = (hex, opacity, blur, dx, dy, spread) => {
    const color = rgba(hex, 1);
    c.save();
    c.shadowColor = rgba(hex, opacity);
    c.shadowBlur = blur * k;
    c.shadowOffsetX = dx * k;
    c.shadowOffsetY = dy * k;
    c.fillStyle = color;
    c.strokeStyle = color;
    c.fillText(txt, anchorX, baselineY);
    if (spread) stroke(spread * 2);
    c.restore();
  };
  const wrap = (fn) => {
    c.save();
    fn();
    c.restore();
  };

  // 1. outer glow (soft halo; a few passes make it denser)
  if (ls.glow && ls.glow.on) {
    const g = ls.glow;
    const passes = 1 + Math.round((g.strength ?? 0.5) * 4);
    for (let i = 0; i < passes; i++) shadowOnly(g.color, g.opacity ?? 0.75, (g.size || 0) * 2, 0, 0, g.spread || 0);
  }

  // 2. drop shadow - Photoshop angle = where the light comes from, so the shadow falls the opposite way
  if (ls.shadow && ls.shadow.on) {
    const sh = ls.shadow;
    const a = ((sh.angle ?? 120) * Math.PI) / 180;
    shadowOnly(sh.color, sh.opacity ?? 0.75, (sh.blur || 0) * 2, -Math.cos(a) * (sh.dist || 0), Math.sin(a) * (sh.dist || 0), sh.spread || 0);
  }

  // 3. stroke outside (sits behind the fill)
  const st = ls.stroke && ls.stroke.on ? ls.stroke : null;
  if (st && st.pos !== 'center') {
    wrap(() => {
      c.strokeStyle = rgba(st.color, st.opacity ?? 1);
      stroke((st.size || 0) * 2);
    });
  }

  // 4. fill: plain colour -> colour overlay -> gradient overlay
  wrap(() => {
    let fill = l.color;
    if (ls.color && ls.color.on) fill = rgba(ls.color.color, ls.color.opacity ?? 1);
    if (ls.pattern && ls.pattern.on) fill = patternFill(c, ls.pattern, k) || fill;
    if (ls.grad && ls.grad.on) {
      const gr = ls.grad;
      const w = Math.max(measure(txt, l.font, l.bold, size), 4);
      const x0 = l.align === 'left' ? anchorX : l.align === 'right' ? anchorX - w : anchorX - w / 2;
      const y0 = baselineY - size * 0.82;
      const h = size * 1.05;
      const cx = x0 + w / 2;
      const cy = y0 + h / 2;
      const ang = ((gr.angle ?? 90) * Math.PI) / 180;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang); // angle 90 = first colour at the top
      const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2 || 1;
      const g = c.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
      const rev = !!gr.reverse;
      g.addColorStop(0, rgba(rev ? gr.c2 : gr.c1, gr.opacity ?? 1));
      g.addColorStop(1, rgba(rev ? gr.c1 : gr.c2, gr.opacity ?? 1));
      fill = g;
    }
    c.fillStyle = fill;
    c.fillText(txt, anchorX, baselineY);
  });

  // 4b. inner glow, inner shadow, bevel (all live inside the glyph)
  if (ls.iglow && ls.iglow.on) {
    const g = ls.iglow;
    innerEffect(c, l, geom, m, g.color, g.opacity ?? 0.75, (g.size || 0) * 2, 0, 0);
  }
  if (ls.ishadow && ls.ishadow.on) {
    const sh = ls.ishadow;
    const a = ((sh.angle ?? 120) * Math.PI) / 180;
    innerEffect(c, l, geom, m, sh.color, sh.opacity ?? 0.75, (sh.blur || 0) * 2, -Math.cos(a) * (sh.dist || 0), Math.sin(a) * (sh.dist || 0));
  }
  if (ls.bevel && ls.bevel.on) {
    const bv = ls.bevel;
    const a = ((bv.angle ?? 120) * Math.PI) / 180;
    const d = bv.size || 0;
    const lx = -Math.cos(a), ly = Math.sin(a); // direction the light falls TOWARDS
    // light edge faces the light, dark edge faces away
    innerEffect(c, l, geom, m, bv.hi || '#ffffff', bv.depth ?? 0.75, d, -lx * d * 0.6, -ly * d * 0.6);
    innerEffect(c, l, geom, m, bv.sh || '#000000', bv.depth ?? 0.75, d, lx * d * 0.6, ly * d * 0.6);
  }

  // 5. stroke centred (sits on top of the fill)
  if (st && st.pos === 'center') {
    wrap(() => {
      c.strokeStyle = rgba(st.color, st.opacity ?? 1);
      stroke(st.size || 0);
    });
  }
}

function drawRaw(c, l, geom) {
  if (l.type === 'rect') {
    if (l.shape) shapePath(c, l);
    else roundedRect(c, l.x, l.y, l.w, l.h, l.radius);
    if (l.fill) {
      c.fillStyle = fillFor(c, l.fill, l);
      c.fill();
    }
    if (l.stroke) {
      c.lineWidth = l.strokeW || 1;
      c.strokeStyle = l.stroke;
      c.stroke();
    }
  } else if (l.type === 'keyborder') {
    drawKeyBorder(c, l);
  } else if (l.type === 'goat') {
    drawGoat(c, l);
  } else if (l.type === 'moon') {
    drawMoon(c, l, moonSet);
  } else if (l.type === 'image') {
    const img = l.img;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    c.save();
    if (l.shape) shapePath(c, l);
    else roundedRect(c, l.x, l.y, l.w, l.h, l.radius);
    c.clip();
    const s = (l.fit === 'contain' ? Math.min(l.w / iw, l.h / ih) : Math.max(l.w / iw, l.h / ih)) * (l.zoom || 1);
    const dw = iw * s;
    const dh = ih * s;
    const fx = l.fx ?? 0.5;
    const fy = l.fy ?? 0.5;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    const flt = adjFilter(l.adj);
    if (flt) c.filter = flt;
    c.drawImage(img, l.x + (l.w - dw) * fx, l.y + (l.h - dh) * fy, dw, dh);
    c.restore();
  } else if (l.type === 'lines') {
    c.strokeStyle = l.color;
    c.lineWidth = l.lw;
    c.beginPath();
    l.segs.forEach(([x1, y1, x2, y2]) => {
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
    });
    c.stroke();
  } else if (l.type === 'text') {
    c.save();
    if (l.rot) {
      const rcx = l.x + l.w / 2;
      const rcy = l.y + l.h / 2;
      c.translate(rcx, rcy);
      c.rotate((l.rot * Math.PI) / 180);
      c.translate(-rcx, -rcy);
    }
    c.font = fontString(l.font, l.bold, geom.size);
    c.fillStyle = l.color;
    c.textAlign = l.align;
    c.textBaseline = 'alphabetic';
    if (hasLayerStyle(l.lstyle)) {
      drawStyledText(c, l, geom);
    } else if (l.outline) {
      c.lineJoin = 'round';
      c.lineWidth = l.outline;
      c.strokeStyle = l.outlineColor || l.color;
      if (l.shadow) {
        c.shadowColor = l.shadow;
        c.shadowOffsetX = l.shadowDx || 0;
        c.shadowOffsetY = l.shadowDy || 0;
        c.shadowBlur = l.shadowBlur || 0;
      }
      c.strokeText(l.text, geom.anchorX, geom.baselineY);
      c.shadowColor = 'rgba(0,0,0,0)';
      c.shadowOffsetX = 0;
      c.shadowOffsetY = 0;
      c.shadowBlur = 0;
      c.fillStyle = l.fillColor || '#ffffff';
    }
    if (!hasLayerStyle(l.lstyle)) c.fillText(l.text, geom.anchorX, geom.baselineY);
    c.restore();
  }
}

function renderLeaf(l, k, pxW, pxH) {
  let bx = l.x, by = l.y, bw = l.w, bh = l.h;
  let geom = null;
  if (l.type === 'text') {
    geom = textGeom(l, measure);
    const p = geom.size * 0.3 + layerStylePad(l.lstyle); // room for descenders / overflow / effects
    bx -= p; by -= p; bw += 2 * p; bh += 2 * p;
    if (l.rot) {
      const r = Math.hypot(l.w, l.h) / 2 + p;
      bx = l.x + l.w / 2 - r; by = l.y + l.h / 2 - r; bw = 2 * r; bh = 2 * r;
    }
  } else if (l.stroke) {
    const p = l.strokeW || 1; // strokes straddle the edge
    bx -= p; by -= p; bw += 2 * p; bh += 2 * p;
  }
  if (l.type !== 'text' && l.rot && canRotate(l)) {
    // a turned layer needs the circle around it
    const r = Math.hypot(l.w, l.h) / 2 + (l.stroke ? (l.strokeW || 1) : 0) + 1;
    bx = l.x + l.w / 2 - r; by = l.y + l.h / 2 - r; bw = 2 * r; bh = 2 * r;
  }
  const left = Math.max(0, Math.floor(bx * k));
  const top = Math.max(0, Math.floor(by * k));
  const right = Math.min(pxW, Math.ceil((bx + bw) * k));
  const bottom = Math.min(pxH, Math.ceil((by + bh) * k));
  if (right <= left || bottom <= top) return null;

  const canvas = factory(right - left, bottom - top);
  const c = canvas.getContext('2d');
  c.setTransform(k, 0, 0, k, -left, -top);
  draw(c, l, geom);
  return { canvas, left, top, geom };
}

/**
 * @param page  result of buildPage()
 * @param k     pixels per design unit
 * @returns {{composite, tree, pxW, pxH}}
 */
export function renderPage(page, k) {
  const { geo } = page;
  const pxW = Math.round(geo.Wt * k);
  const pxH = Math.round(geo.Ht * k);
  const composite = factory(pxW, pxH);
  const cc = composite.getContext('2d');

  const walk = (nodes) =>
    nodes
      .map((n) => {
        if (n.type === 'group') {
          const children = walk(n.children);
          return children.length ? { kind: 'group', name: n.name, children } : null;
        }
        const r = renderLeaf(n, k, pxW, pxH);
        if (!r) return null;
        cc.globalAlpha = n.opacity ?? 1;
        cc.globalCompositeOperation = BLEND[n.blend] || 'source-over';
        cc.drawImage(r.canvas, r.left, r.top);
        cc.globalAlpha = 1;
        cc.globalCompositeOperation = 'source-over';
        return { kind: 'layer', name: n.name, node: n, ...r };
      })
      .filter(Boolean);

  return { composite, tree: walk(page.children), pxW, pxH };
}
