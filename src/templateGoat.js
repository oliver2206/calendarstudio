// "Year of the Goat 2027" template - red & gold wall calendar that uses the bundled goat artwork (goatArt.js):
//   a full-bleed cover, then each month has one of the five designs (banner, flower goat, swirl, 福 brush goat, gold 2027)
//   with a red month bar, gold year, weekday bar (red Sundays) and grid cells. Holidays come from the Holidays box,
//   plus the 2027 Chinese festival dates. Portrait = art on top; landscape = art on the left.
import { rect, text, group, monthCells, parseHolidays, MONTHS, WEEKDAYS, mix } from './layout.js';
import { moonDayMarks } from './moonMarks.js';
import { GOAT_ART, GOAT_FILES, GOAT_ORDER } from './goatArt.js';

const RED = '#a60a12';
const GOLD = '#b8860b';
const CREAM = '#fff8ec';
const FESTIVALS = { '2027-2-6': 'Chinese New Year', '2027-2-20': 'Lantern Festival', '2027-6-9': 'Dragon Boat', '2027-9-15': 'Mid-Autumn' };

function art(key, x, y, w, h, fit, bleed) {
  const f = GOAT_FILES[key];
  const out = [rect(`Artwork backdrop`, x, y, w, h, f.bg, { bleed })];
  if (GOAT_ART[key]) out.push({ type: 'image', name: 'Goat artwork', img: GOAT_ART[key], fit, zoom: 1, fx: 0.5, fy: 0.5, x, y, w, h, radius: 0, bleed });
  return group('Artwork', out);
}

export function tplGoatCover(ctx) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const red = cfg.themeA || RED;
  const out = [rect('Background', 0, 0, W, H, GOAT_FILES.gold.bg, { bleed: 'ltrb' })];
  const ah = Math.min(W * 0.95, H * 0.72);
  out.push(art('gold', 0, 0, W, ah, 'contain', 'ltr'));
  const gold = '#f3dc8a';
  out.push(text('Cover year', `${cfg.year} ${cfg.coverLabel || 'CALENDAR'}`, 40, ah + H * 0.02, W - 80, H * 0.09, { font: cfg.headingFont, bold: true, size: 70, color: gold, align: 'center', fit: true }));
  out.push(text('Cover subtitle', 'YEAR OF THE GOAT', 40, ah + H * 0.115, W - 80, H * 0.04, { font: cfg.bodyFont, size: 30, color: gold, align: 'center', fit: true }));
  if (cfg.company && cfg.company !== 'Your Company Name') out.push(text('Company name', cfg.company, 40, H - H * 0.07, W - 80, H * 0.04, { font: cfg.bodyFont, size: 24, color: mix(gold, red, 0.2), align: 'center', fit: true }));
  return out;
}

export function tplGoat(ctx, m) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const land = W > H;
  const red = cfg.themeA || RED;
  const gold = cfg.themeB || GOLD;
  const hol = { ...ctx.holidays };
  Object.entries(FESTIVALS).forEach(([k, v]) => {
    const [y, mo, d] = k.split('-').map(Number);
    if (y === Number(cfg.year) && !hol[`${mo}-${d}`]) hol[`${mo}-${d}`] = v;
  });
  const out = [rect('Background', 0, 0, W, H, CREAM, { bleed: 'ltrb' })];
  const key = GOAT_ORDER[m % GOAT_ORDER.length];
  let cx, cy, cw, ch;
  if (land) {
    const aw = W * 0.4;
    out.push(art(key, 0, 0, aw, H, GOAT_FILES[key].bg === '#ffffff' || key === 'flower' ? 'cover' : 'contain', 'ltb'));
    out.push(rect('Gold edge', aw, 0, 6, H, gold));
    cx = aw + 30; cy = 24; cw = W - aw - 54; ch = H - 48;
  } else {
    const ah = H * 0.42;
    out.push(art(key, 0, 0, W, ah, key === 'banner' || key === 'flower' ? 'cover' : 'contain', 'ltr'));
    out.push(rect('Gold edge', 0, ah, W, 6, gold, { bleed: 'lr' }));
    cx = 40; cy = ah + 12; cw = W - 80; ch = H - ah - 12 - 30;
  }
  const headH = Math.min(ch * 0.13, 90);
  out.push(text('Month', MONTHS[m].toUpperCase(), cx, cy, cw * 0.65, headH, { font: cfg.headingFont, bold: true, size: 64, color: red, fit: true }));
  out.push(text('Year', String(cfg.year), cx + cw * 0.65, cy, cw * 0.35, headH, { font: cfg.headingFont, bold: true, size: 64, color: gold, align: 'right', fit: true }));
  const barY = cy + headH + 6;
  const barH = Math.min(ch * 0.045, 28);
  const cells = monthCells(Number(cfg.year), m, Number(cfg.weekStart) || 0);
  const rows = cells.length / 7;
  const gy = barY + barH;
  const cellW = cw / 7;
  const cellH = (cy + ch - gy) / 6;
  out.push(rect('Weekday bar', cx, barY, cw, barH, red));
  for (let i = 0; i < 7; i++) {
    const dow = ((Number(cfg.weekStart) || 0) + i) % 7;
    out.push(text(`Weekday ${WEEKDAYS[dow]}`, WEEKDAYS[dow].toUpperCase(), cx + i * cellW, barY, cellW, barH, { font: cfg.bodyFont, bold: true, size: 18, color: '#ffffff', align: 'center', fit: true }));
  }
  const at = {};
  cells.forEach((c, i) => {
    const x = cx + (i % 7) * cellW;
    const y = gy + Math.floor(i / 7) * cellH;
    out.push(rect(`Cell ${i + 1}`, x, y, cellW, cellH, c.inMonth ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.03)', { stroke: mix(gold, '#ffffff', 0.4), strokeW: 1 }));
    if (!c.inMonth) return;
    const name = hol[`${m + 1}-${c.day}`];
    const col = c.dow === 0 || name ? red : '#3a0a0e';
    out.push(text(`Day ${c.day}`, c.day, x + 6, y + 3, cellW * 0.55, cellH * 0.42, { font: cfg.bodyFont, bold: true, size: Math.min(cellH * 0.34, 40), color: col, align: 'left', valign: 'top', fit: true }));
    if (name) out.push(text(`Holiday ${c.day}`, name, x + 4, y + cellH * 0.62, cellW - 8, cellH * 0.34, { font: cfg.bodyFont, bold: true, size: 12, color: gold, align: 'left', valign: 'bottom', fit: true }));
    at[c.day] = { x, y, w: cellW, h: cellH };
  });
  if (cfg.showMoon) {
    const md = Math.min(cellH * 0.26, cellW * 0.3);
    const mk = moonDayMarks(cfg, m, (d) => (at[d] ? { x: at[d].x + at[d].w - md - 3, y: at[d].y + 3, d: md } : null), red);
    if (mk && mk.length) out.push(group('Moon phases', mk));
  }
  return out;
}
