// "Pink floral" template — built from the supplied January 2027 pink wall calendar:
//   soft pink floral background (or your own photo), black year numbers either side of a white-outlined magenta script month name,
//   magenta weekday bar (pale-pink SUN), translucent cells with huge black numbers (Sundays + holidays magenta),
//   moon-phase cells (name, date, grey moon), 24/31 shared cell, previous / next mini calendars and a two-column
//   magenta "• LEGAL HOLIDAYS •" list. Same layout engine as the big black & red template; landscape matches the sample.
import { rect, text, group, mix } from './layout.js';
import { buildBigBlack } from './templateBigBlack.js';

let MAGENTA = '#e3126f';
let PALE = '#fbb2d3';
const PETALS = ['#f06292', '#f8bbd0', '#ec407a', '#ff80ab', '#fce4ec', '#f48fb1'];

function rng(seed) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// procedural floral-ish backdrop; upload a photo to replace it
function background(ctx, { W, H, m }) {
  const { cfg } = ctx;
  if (ctx.photo) {
    return group('Background photo', [{ type: 'image', name: 'Photo', img: ctx.photo, fit: 'cover', zoom: cfg.photoZoom, fx: cfg.photoFx, fy: cfg.photoFy, x: 0, y: 0, w: W, h: H, radius: 0, bleed: 'ltrb' }]);
  }
  const r = rng(m + 3);
  const out = [rect('Pink base', 0, 0, W, H, { grad: [[0, '#f7a1c4'], [0.5, '#fbc3d9'], [1, '#f48fb1']] }, { bleed: 'ltrb' })];
  for (let i = 0; i < 34; i++) {
    // keep most blobs toward the edges, where they stay visible around the calendar
    const edge = r();
    const x = edge < 0.5 ? r() * W : r() < 0.5 ? r() * W * 0.12 : W - r() * W * 0.12;
    const y = edge < 0.35 ? r() * H * 0.16 : edge < 0.7 ? H - r() * H * 0.1 : r() * H;
    const rad = W * (0.03 + r() * 0.1);
    out.push(rect(`Petal ${i + 1}`, x - rad, y - rad, rad * 2, rad * 2, PETALS[Math.floor(r() * PETALS.length)], { radius: rad, opacity: 0.25 + r() * 0.35 }));
    if (i % 3 === 0) out.push(rect(`Petal ring ${i + 1}`, x - rad * 0.7, y - rad * 0.7, rad * 1.4, rad * 1.4, null, { stroke: '#ffffff', strokeW: 2, radius: rad * 0.7, opacity: 0.55 }));
  }
  for (let i = 0; i < 40; i++) {
    const d = 2 + r() * 4;
    out.push(rect(`Sparkle ${i + 1}`, r() * W, r() * H, d, d, '#ffffff', { radius: d / 2, opacity: 0.5 + r() * 0.4 }));
  }
  return group('Floral background (replace me)', out);
}

export function tplPink(ctx, m) {
  MAGENTA = ctx.cfg.themeA || '#e3126f';
  PALE = ctx.cfg.themeA ? mix(MAGENTA, '#ffffff', 0.65) : '#fbb2d3';
  const month = (name, x, y, w, h, c) =>
    text('Month', name, x, y + h * 0.04, w, h * 0.96, { font: 'Brush Script MT', bold: false, size: h * 1.05, color: c.red, fillColor: c.red, outline: Math.max(3, h * 0.07), outlineColor: '#ffffff', align: 'center', fit: true });
  return buildBigBlack(ctx, m, {
    accent: MAGENTA,
    soft: true,
    panel: 'rgba(255,246,250,0.88)',
    background,
    yearColor: '#000000',
    month,
    wdFill: (dow) => (dow === 0 ? PALE : MAGENTA),
    wdText: (dow) => (dow === 0 ? MAGENTA : '#ffffff'),
    cellFill: 'rgba(255,246,250,0.9)',
    cellStroke: mix(MAGENTA, '#7a1d6b', 0.5),
    cellW: 1.3,
  });
}
