// "Two-month black & red" template — built from the supplied January / February 2027 sheet:
//   header with a zodiac emblem (red, in a flower ring) + "HAPPY CHINESE NEW YEAR / YEAR OF THE GOAT" on the left and a big
//   outlined diagonal year (20 / 27) on the right, then two black & red month blocks per page (black title bar with red year
//   boxes, white weekday bar with red SUN, thick black cells, moon-phase cells with the exact time, 24/31 shared cell),
//   a mini month + LEGAL HOLIDAYS + NOTES beside each block. Same page logic as the blue two-month template (cover + 6 sheets).
import { rect, text, group } from './layout.js';
import { buildDuo } from './templateDuo.js';

const ZODIAC = ['Monkey', 'Rooster', 'Dog', 'Pig', 'Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat'];
const ZH = { Monkey: '猴', Rooster: '鸡', Dog: '狗', Pig: '猪', Rat: '鼠', Ox: '牛', Tiger: '虎', Rabbit: '兔', Dragon: '龙', Snake: '蛇', Horse: '马', Goat: '羊' };

function header(ctx, box, c) {
  const { cfg } = ctx;
  const out = [];
  const animal = ZODIAC[((Number(cfg.year) % 12) + 12) % 12];
  const leftW = box.w * 0.5;
  const art = Math.min(leftW * 0.8, box.h * 0.78);
  const ax = box.x + (leftW - art) / 2;
  const ay = box.y + box.h * 0.02;

  /* ---- emblem (or your photo) ---- */
  if (ctx.photo) {
    out.push({ type: 'image', name: 'Photo', img: ctx.photo, fit: 'cover', zoom: cfg.photoZoom, fx: cfg.photoFx, fy: cfg.photoFy, x: box.x, y: box.y, w: leftW, h: box.h * 0.82, radius: 0 });
  } else {
    const em = [];
    // flower ring
    const n = 14;
    const R = art * 0.46;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const fr = art * (i % 2 ? 0.055 : 0.075);
      const fx = ax + art / 2 + Math.cos(a) * R - fr;
      const fy = ay + art / 2 + Math.sin(a) * R * 0.98 - fr;
      em.push(rect(`Flower ${i + 1}`, fx, fy, fr * 2, fr * 2, i % 2 ? '#ffffff' : c.red, { stroke: c.red, strokeW: Math.max(1.5, art * 0.012), radius: fr }));
      em.push(rect(`Flower centre ${i + 1}`, fx + fr * 0.55, fy + fr * 0.55, fr * 0.9, fr * 0.9, i % 2 ? c.red : '#ffffff', { radius: fr * 0.45 }));
    }
    em.push(rect('Emblem ring', ax + art * 0.06, ay + art * 0.06, art * 0.88, art * 0.88, null, { stroke: c.red, strokeW: Math.max(1, art * 0.006), radius: art * 0.44 }));
    if (animal === 'Goat') em.push({ type: 'goat', name: 'Zodiac goat', color: c.red, x: ax + art * 0.14, y: ay + art * 0.14, w: art * 0.72, h: art * 0.72 });
    else em.push(text('Zodiac character big', ZH[animal], ax, ay, art, art, { font: 'SimSun', bold: true, size: art * 0.55, color: c.red, align: 'center' }));
    em.push(text('Zodiac character', ZH[animal], ax + art * 0.62, ay + art * 0.1, art * 0.2, art * 0.2, { font: 'SimSun', bold: true, size: art * 0.15, color: c.red, align: 'center' }));
    out.push(group('Zodiac emblem', em));
  }
  const capY = box.y + box.h * 0.84;
  out.push(text('Greeting', 'HAPPY CHINESE NEW YEAR', box.x, capY, leftW, box.h * 0.07, { font: 'Arial', size: box.h * 0.055, color: c.red, align: 'center', fit: true }));
  out.push(text('Year of the animal', `YEAR OF THE ${animal.toUpperCase()}`, box.x, capY + box.h * 0.07, leftW, box.h * 0.09, { font: 'Arial', bold: true, size: box.h * 0.075, color: c.red, align: 'center', fit: true }));

  /* ---- outlined diagonal year ---- */
  const yr = String(cfg.year);
  const top = yr.slice(0, 2);
  const bot = yr.slice(2);
  const rx = box.x + leftW + box.w * 0.02;
  const rw = box.w * 0.46;
  const lh = box.h * 0.5;
  const sz = lh * 1.02;
  const lw = Math.max(2, box.h * 0.012);
  const yg = [];
  yg.push(text('Year top', top, rx - rw * 0.06, box.y + box.h * 0.0, rw * 0.9, lh, { font: 'Arial Black', bold: true, size: sz, color: c.red, outline: lw, fillColor: cfg.bg, align: 'left', fit: true }));
  yg.push(text('Year bottom', bot, rx + rw * 0.12, box.y + box.h * 0.5, rw * 0.9, lh, { font: 'Arial Black', bold: true, size: sz, color: c.red, outline: lw, fillColor: cfg.bg, align: 'right', fit: true }));
  yg.push({ type: 'lines', name: 'Year slash', segs: [[rx + rw * 1.0, box.y + box.h * 0.36, rx + rw * 0.0, box.y + box.h * 0.66]], color: c.red, lw: lw * 1.4, x: rx, y: box.y, w: rw, h: box.h });
  out.push(group('Outline year', yg));
  return group('Header', out);
}

export function tplDuoBlack(ctx, m) {
  return buildDuo(ctx, m, { ink: ctx.cfg.themeB || '#0d0d0d', moonTime: true, wdLight: true, headerH: 0.285, header });
}
