// "Sky blue bubbles" template - a sister of the pink floral wall calendar: soft aqua / sky-blue bubble background (upload a photo to
// use your own artwork), black years either side of a white-outlined script month name, aqua weekday bar (pale SUN), translucent cells
// with huge numbers, moon-phase cells (name + date left, moon face right), 24/31 shared cell, previous / next mini calendars and a
// two-column "• LEGAL HOLIDAYS •" list. Same layout engine as the big black & red and pink floral templates; landscape or portrait.
import { rect, text, group, mix } from './layout.js';
import { buildBigBlack } from './templateBigBlack.js';

const AQUA = '#0a86c4';
const BUBBLES = ['#4fc3f7', '#81d4fa', '#29b6f6', '#b3e5fc', '#e1f5fe', '#4dd0e1', '#80deea'];

function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// procedural bubble backdrop; upload a photo to replace it
function background(ctx, { W, H, m }) {
  const { cfg } = ctx;
  if (ctx.photo) {
    return group('Background photo', [{ type: 'image', name: 'Photo', img: ctx.photo, fit: 'cover', zoom: cfg.photoZoom, fx: cfg.photoFx, fy: cfg.photoFy, x: 0, y: 0, w: W, h: H, radius: 0, bleed: 'ltrb' }]);
  }
  const r = rng(m + 11);
  const out = [rect('Sky base', 0, 0, W, H, { grad: [[0, '#6ccbf0'], [0.45, '#bfeaf9'], [1, '#3fa9e0']] }, { bleed: 'ltrb' })];
  // big soft waves along the bottom and top corners
  out.push(rect('Wave bottom left', -W * 0.2, H * 0.84, W * 0.8, W * 0.5, '#ffffff', { radius: W * 0.25, opacity: 0.28 }));
  out.push(rect('Wave bottom right', W * 0.45, H * 0.88, W * 0.8, W * 0.5, '#e1f5fe', { radius: W * 0.25, opacity: 0.3 }));
  out.push(rect('Wave top', W * 0.1, -W * 0.38, W * 0.9, W * 0.45, '#ffffff', { radius: W * 0.22, opacity: 0.22 }));
  for (let i = 0; i < 38; i++) {
    // keep most bubbles toward the edges, where they stay visible around the calendar
    const edge = r();
    const x = edge < 0.5 ? r() * W : r() < 0.5 ? r() * W * 0.12 : W - r() * W * 0.12;
    const y = edge < 0.35 ? r() * H * 0.16 : edge < 0.7 ? H - r() * H * 0.1 : r() * H;
    const rad = W * (0.02 + r() * 0.07);
    out.push(rect(`Bubble ${i + 1}`, x - rad, y - rad, rad * 2, rad * 2, BUBBLES[Math.floor(r() * BUBBLES.length)], { radius: rad, opacity: 0.22 + r() * 0.35 }));
    out.push(rect(`Bubble ring ${i + 1}`, x - rad * 0.92, y - rad * 0.92, rad * 1.84, rad * 1.84, null, { stroke: '#ffffff', strokeW: 2, radius: rad * 0.92, opacity: 0.6 }));
    out.push(rect(`Bubble shine ${i + 1}`, x - rad * 0.5, y - rad * 0.6, rad * 0.35, rad * 0.22, '#ffffff', { radius: rad * 0.11, opacity: 0.8 }));
  }
  for (let i = 0; i < 46; i++) {
    const d = 2 + r() * 4;
    out.push(rect(`Sparkle ${i + 1}`, r() * W, r() * H, d, d, '#ffffff', { radius: d / 2, opacity: 0.5 + r() * 0.4 }));
  }
  return group('Bubble background (replace me)', out);
}

export function tplSky(ctx, m) {
  const A = ctx.cfg.themeA || AQUA;
  const pale = mix(A, '#ffffff', 0.7);
  const month = (name, x, y, w, h, c) =>
    text('Month', name, x, y + h * 0.04, w, h * 0.96, { font: 'Brush Script MT', bold: false, size: h * 1.05, color: c.red, fillColor: c.red, outline: Math.max(3, h * 0.07), outlineColor: '#ffffff', align: 'center', fit: true });
  return buildBigBlack(ctx, m, {
    accent: A,
    soft: true,
    panel: 'rgba(240,251,255,0.9)',
    background,
    yearColor: '#0b2a5b',
    month,
    wdFill: (dow) => (dow === 0 ? pale : A),
    wdText: (dow) => (dow === 0 ? A : '#ffffff'),
    cellFill: 'rgba(240,251,255,0.9)',
    cellStroke: mix(A, '#0b2a5b', 0.45),
    cellW: 1.3,
  });
}
