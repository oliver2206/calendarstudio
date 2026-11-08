// "Wonders of the Philippines" template - a Philippine scenic wall calendar: bundled photos (wondersArt.js), one place per month with a caption,
// flag-colour stripe (blue / red / gold), blue weekday bar, red Sundays + holidays, Philippine regular / special holidays added to your Holidays list.
// Portrait = photo on top; landscape = photo on the left. Change the colours with Highlight (A, red) / Main (B, blue).
import { rect, text, group, monthCells, MONTHS, WEEKDAYS, rgba, mix } from './layout.js';
import { moonDayMarks } from './moonMarks.js';
import { tideTable, tideOf, tideLayers, tideSharedCell, tideLegend, monthHasTides } from './tides.js';
import { WONDERS, WONDERS_MONTHS, WONDERS_COVER, WONDERS_ART } from './wondersArt.js';

const BLUE = '#0038a8';
const RED = '#ce1126';
const GOLD = '#e8b400';
const CREAM = '#fffdf6';
const INK = '#1a2340';
// 2027 Philippine holidays - verify against the official proclamations before printing
const PH_2027 = {
  '1-1': "New Year's Day", '2-6': 'Chinese New Year', '2-25': 'EDSA Anniv.', '3-25': 'Maundy Thursday', '3-26': 'Good Friday', '3-27': 'Black Saturday', '3-28': 'Easter Sunday',
  '4-9': 'Araw ng Kagitingan', '5-1': 'Labor Day', '6-12': 'Independence Day', '8-21': 'Ninoy Aquino Day', '8-30': 'National Heroes Day', '11-1': "All Saints' Day",
  '11-30': 'Bonifacio Day', '12-8': 'Immaculate Conception', '12-24': 'Christmas Eve', '12-25': 'Christmas Day', '12-30': 'Rizal Day', '12-31': "New Year's Eve",
};

function photo(key, x, y, w, h, bleed) {
  const w0 = WONDERS[key];
  const out = [rect('Photo backdrop', x, y, w, h, '#223', { bleed })];
  if (WONDERS_ART[key]) out.push({ type: 'image', name: `Photo - ${w0.name}`, img: WONDERS_ART[key], fit: 'cover', zoom: 1, fx: 0.5, fy: w0.fy, x, y, w, h, radius: 0, bleed });
  return group('Photo', out);
}

export function tplWondersCover(ctx) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const blue = cfg.themeB || BLUE;
  const out = [photo(WONDERS_COVER, 0, 0, W, H, 'ltrb')];
  out.push(rect('Bottom shade', 0, H * 0.45, W, H * 0.55, { grad: [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.78)']] }, { bleed: 'lrb' }));
  out.push(text('Cover top', 'P H I L I P P I N E S', 40, H * 0.68, W - 80, H * 0.04, { font: cfg.bodyFont, bold: true, size: 30, color: GOLD, align: 'center', fit: true }));
  out.push(text('Cover title 1', 'WONDERS OF THE', 40, H * 0.72, W - 80, H * 0.09, { font: cfg.headingFont, bold: true, size: 80, color: '#ffffff', align: 'center', fit: true }));
  out.push(text('Cover title 2', 'PHILIPPINES', 40, H * 0.805, W - 80, H * 0.09, { font: cfg.headingFont, bold: true, size: 80, color: '#ffffff', align: 'center', fit: true }));
  out.push(rect('Gold rule', W / 2 - 80, H * 0.9, 160, 4, GOLD));
  out.push(text('Cover year', `${cfg.year} ${cfg.coverLabel || 'CALENDAR'}`, 40, H * 0.915, W - 80, H * 0.05, { font: cfg.headingFont, bold: true, size: 52, color: '#ffffff', align: 'center', fit: true }));
  if (cfg.company && cfg.company !== 'Your Company Name') out.push(text('Company name', cfg.company, 40, H * 0.965, W - 80, H * 0.03, { font: cfg.bodyFont, size: 22, color: mix(blue, '#ffffff', 0.8), align: 'center', fit: true }));
  return out;
}

export function tplWonders(ctx, m) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const land = W > H;
  const red = cfg.themeA || RED;
  const blue = cfg.themeB || BLUE;
  const hol = { ...ctx.holidays };
  if (Number(cfg.year) === 2027) Object.entries(PH_2027).forEach(([k, v]) => { if (!hol[k]) hol[k] = v; });
  const key = WONDERS_MONTHS[m % 12];
  const info = WONDERS[key];
  const out = [rect('Background', 0, 0, W, H, CREAM, { bleed: 'ltrb' })];
  let cx, cy, cw, ch;
  const caption = (x, y, w) => {
    out.push(rect('Caption shade', x, y - 110, w, 110, { grad: [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.6)']] }));
    out.push(text('Place name', info.name.toUpperCase(), x + 40, y - 66, w - 80, 36, { font: cfg.headingFont, bold: true, size: 30, color: '#ffffff', fit: true }));
    out.push(text('Place location', info.place.toUpperCase(), x + 40, y - 32, w - 80, 22, { font: cfg.bodyFont, size: 18, color: GOLD, fit: true }));
  };
  const stripe = (x, y, w, vertical) => [BLUE, RED, GOLD].forEach((c, i) => {
    const cc = i === 0 ? blue : i === 1 ? red : GOLD;
    out.push(vertical ? rect(`Flag stripe ${i + 1}`, x, y + i * (H / 3), 8, H / 3, cc) : rect(`Flag stripe ${i + 1}`, x + i * (w / 3), y, w / 3, 8, cc));
  });
  if (land) {
    const pw = W * 0.4;
    out.push(photo(key, 0, 0, pw, H, 'ltb'));
    out.push(rect('Caption shade', 0, H - 150, pw, 150, { grad: [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.6)']] }));
    out.push(text('Place name', info.name.toUpperCase(), 24, H - 90, pw - 48, 36, { font: cfg.headingFont, bold: true, size: 30, color: '#ffffff', fit: true }));
    out.push(text('Place location', info.place.toUpperCase(), 24, H - 52, pw - 48, 24, { font: cfg.bodyFont, size: 18, color: GOLD, fit: true }));
    stripe(pw, 0, 0, true);
    cx = pw + 34; cy = 24; cw = W - pw - 58; ch = H - 48;
  } else {
    const ph = H * 0.45;
    out.push(photo(key, 0, 0, W, ph, 'ltr'));
    caption(0, ph, W);
    stripe(0, ph, W, false);
    cx = 40; cy = ph + 14; cw = W - 80; ch = H - ph - 14 - 30;
  }
  const headH = Math.min(ch * 0.13, 90);
  out.push(text('Month', MONTHS[m].toUpperCase(), cx, cy, cw * 0.65, headH, { font: cfg.headingFont, bold: true, size: 64, color: blue, fit: true }));
  out.push(text('Year', String(cfg.year), cx + cw * 0.65, cy, cw * 0.35, headH, { font: cfg.headingFont, bold: true, size: 64, color: red, align: 'right', fit: true }));
  const barY = cy + headH + 6;
  const barH = Math.min(ch * 0.045, 28);
  const ws = Number(cfg.weekStart) || 0;
  const cells = monthCells(Number(cfg.year), m, ws);
  const gy = barY + barH;
  const cellW = cw / 7;
  const cellH = (cy + ch - gy) / 6;
  out.push(rect('Weekday bar', cx, barY, cw, barH, blue));
  for (let i = 0; i < 7; i++) {
    const dow = (ws + i) % 7;
    out.push(text(`Weekday ${WEEKDAYS[dow]}`, WEEKDAYS[dow].toUpperCase(), cx + i * cellW, barY, cellW, barH, { font: cfg.bodyFont, bold: true, size: 18, color: '#ffffff', align: 'center', fit: true }));
  }
  const at = {};
  const tides = tideTable(cfg);
  const hasTides = monthHasTides(tides, m);
  const tideT = [];
  cells.forEach((c, i) => {
    const x = cx + (i % 7) * cellW;
    const y = gy + Math.floor(i / 7) * cellH;
    out.push(rect(`Cell ${i + 1}`, x, y, cellW, cellH, c.inMonth ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.03)', { stroke: '#c9d2ea', strokeW: 1 }));
    if (!c.inMonth) return;
    const name = hol[`${m + 1}-${c.day}`];
    out.push(text(`Day ${c.day}`, c.day, x + 6, y + 3, cellW * 0.55, cellH * 0.42, { font: cfg.bodyFont, bold: true, size: Math.min(cellH * 0.34, 40), color: c.dow === 0 || name ? red : INK, align: 'left', valign: 'top', fit: true }));
    if (name) out.push(text(`Holiday ${c.day}`, name, x + 4, y + cellH * 0.6, cellW - 8, cellH * 0.36, { font: cfg.bodyFont, bold: true, size: 12, color: red, align: 'left', valign: 'bottom', fit: true }));
    const td = tideOf(tides, c);
    if (td) tideT.push(...tideLayers(td, { x, y, w: cellW, h: cellH }, { mode: 'lower', from: 0.4, tag: String(c.day) }));
    at[c.day] = { x, y, w: cellW, h: cellH };
  });
  if (tideT.length) out.push(group('Tide times', tideT));
  if (hasTides) out.push(group('Tide legend', tideLegend({ x: cx, y: gy + 6 * cellH + 2, w: cw, h: 11 }, {})));
  if (cfg.showMoon) {
    const md = Math.min(cellH * 0.26, cellW * 0.3);
    const mk = moonDayMarks(cfg, m, (d) => (at[d] ? { x: at[d].x + at[d].w - md - 3, y: at[d].y + 3, d: md } : null), red);
    if (mk && mk.length) out.push(group('Moon phases', mk));
  }
  return out;
}
