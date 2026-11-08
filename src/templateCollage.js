// "Photo collage" template — built from the supplied "2027 Calendar" sheet (portrait):
//   an angled photo collage on top (three photo panels + a dark blue brand panel), the bold "2027" with a script "Calendar",
//   then two clean months per page, staggered (left month, then right month lower), each with a NOTES block with ruled lines.
//   Month header `03/ … MARCH`, tiny weekday row, grey dates with bold Sat/Sun. Cover + 6 sheets (Jan–Feb … Nov–Dec).
//   The page photo fills the three photo panels with different crops; swap any panel with the Image tool in the editor.
import { moonDayMarks } from './moonMarks.js';
import { rect, text, group, mix, monthCells, MONTHS, WEEKDAYS } from './layout.js';

let INK = '#111111';
const GREY = '#5b5b5b';
let CORAL = '#f0605d';

function bbox(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

// photo (or placeholder) clipped to a polygon given in page units
function panel(ctx, name, pts, look) {
  const { cfg, photo } = ctx;
  const b = bbox(pts);
  const shape = pts.map(([px, py]) => [(px - b.x) / b.w, (py - b.y) / b.h]);
  if (photo && !look.dark) {
    return { type: 'image', name, img: photo, fit: 'cover', zoom: (cfg.photoZoom || 1) * look.zoom, fx: look.fx ?? cfg.photoFx, fy: look.fy ?? cfg.photoFy, ...b, shape, radius: 0 };
  }
  return rect(look.dark ? name : `${name} (replace me)`, b.x, b.y, b.w, b.h, { grad: look.grad }, { shape });
}

function monthBlock(ctx, box, m, rowsFixed) {
  const { cfg } = ctx;
  const out = [];
  const cells = monthCells(cfg.year, m, cfg.weekStart);
  const rows = cells.length / 7;
  const colW = box.w / 7;
  const tH = box.w * 0.15;
  const wdH = box.w * 0.06;
  const rowH = box.w * 0.145;
  const holidays = ctx.holidays;

  out.push(text('Month number', `${String(m + 1).padStart(2, '0')}/`, box.x, box.y, box.w * 0.4, tH, { font: 'Arial', bold: true, size: tH * 0.9, color: INK, align: 'left', fit: true }));
  out.push(text('Month name', MONTHS[m].toUpperCase(), box.x + box.w * 0.4, box.y, box.w * 0.6, tH, { font: 'Arial', bold: true, size: tH * 0.46, color: INK, align: 'right', valign: 'bottom', fit: true }));

  const wy = box.y + tH + box.w * 0.02;
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    const edge = dow === 0 || dow === 6;
    out.push(text(`Weekday ${WEEKDAYS[dow]}`, WEEKDAYS[dow].toUpperCase(), box.x + i * colW, wy, colW, wdH, { font: 'Arial', bold: edge, size: wdH * 0.78, color: edge ? INK : GREY, align: 'center', fit: true }));
  }
  const dates = [];
  const cellAt = {};
  cells.forEach((cell, i) => {
    if (!cell.inMonth && !cfg.showAdj) return;
    const r = Math.floor(i / 7);
    const col = i % 7;
    if (cell.inMonth) cellAt[cell.day] = { x: box.x + col * colW, y: wy + wdH + box.w * 0.02 + r * rowH };
    const edge = cell.dow === 0 || cell.dow === 6;
    const hol = cell.inMonth && holidays[`${cell.month + 1}-${cell.day}`];
    dates.push(text(`Day ${cell.month + 1}-${String(cell.day).padStart(2, '0')}`, cell.day, box.x + col * colW, wy + wdH + box.w * 0.02 + r * rowH, colW, rowH, {
      font: 'Arial', bold: edge || !!hol, size: Math.min(rowH * 0.5, colW * 0.46), color: !cell.inMonth ? '#bbbbbb' : hol ? CORAL : edge ? INK : GREY, align: 'center',
    }));
  });
  out.push(group('Dates', dates));
  const md = Math.min(rowH * 0.3, colW * 0.3);
  const mk = moonDayMarks(cfg, m, (d) => (cellAt[d] ? { x: cellAt[d].x + colW - md * 1.05, y: cellAt[d].y - md * 0.1, d: md } : null), cfg.themeA || CORAL);
  if (mk.length) out.push(group('Moon phases', mk));
  return { node: group(`${MONTHS[m]} block`, out), bottom: wy + wdH + box.w * 0.02 + rows * rowH };
}

function notes(box, n = 5) {
  const out = [text('Notes title', 'NOTES', box.x, box.y, box.w, box.w * 0.09, { font: 'Arial', bold: true, size: box.w * 0.062, color: CORAL, align: 'center', fit: true })];
  const top = box.y + box.w * 0.15;
  const step = Math.min(box.w * 0.083, (box.h - box.w * 0.15) / n);
  const segs = [];
  for (let k = 0; k < n; k++) segs.push([box.x, top + k * step, box.x + box.w, top + k * step]);
  out.push({ type: 'lines', name: 'Notes lines', segs, color: '#7a7a7a', lw: 1.4, x: box.x, y: top - 1, w: box.w, h: n * step });
  return group('Notes', out);
}

export function tplCollage(ctx, m) {
  INK = ctx.cfg.themeB || '#111111';
  CORAL = ctx.cfg.themeA || '#f0605d';
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const out = [];
  out.push(rect('Background', 0, 0, W, H, cfg.bg, { bleed: 'ltrb' }));

  /* ---- collage header ---- */
  const bx = W * 0.017;
  const by = W * 0.017;
  const bw = W - 2 * bx;
  const bh = H * 0.425;
  const P = (fx, fy) => [bx + fx * bw, by + fy * bh];
  const collage = [
    panel(ctx, 'Photo 1', [P(0, 0), P(0.575, 0), P(0.695, 0.32), P(0.53, 0.56), P(0, 0.56)], { zoom: 1, grad: [[0, '#7a5a9a'], [1, '#d68a3c']] }),
    panel(ctx, 'Brand panel', [P(0.585, 0), P(1, 0), P(1, 0.31), P(0.68, 0.31)], { dark: true, grad: ctx.cfg.themeB ? [[0, mix(ctx.cfg.themeB, '#000000', 0.15)], [1, mix(ctx.cfg.themeB, '#000000', 0.7)]] : [[0, '#0d3a78'], [1, '#050c1c']] }),
    panel(ctx, 'Photo 2', [P(0.685, 0.335), P(1, 0.335), P(1, 0.71), P(0.6, 0.71), P(0.53, 0.53)], { zoom: 1.9, fx: 0.8, fy: 0.45, grad: [[0, '#8ec5e8'], [1, '#2a6fa8']] }),
    panel(ctx, 'Photo 3', [P(0, 0.565), P(0.53, 0.565), P(0.61, 0.73), P(0.61, 1), P(0, 1)], { zoom: 1.9, fx: 0.2, fy: 0.85, grad: [[0, '#6c9a6a'], [1, '#2f5a3a']] }),
  ];
  out.push(group('Photo collage', collage));

  const brand = [];
  if (ctx.logo) brand.push({ type: 'image', name: 'Logo', img: ctx.logo, fit: 'contain', x: bx + bw * 0.72, y: by + bh * 0.04, w: bw * 0.24, h: bh * 0.2 });
  else if (cfg.company) brand.push(text('Company name', cfg.company, bx + bw * 0.7, by + bh * 0.04, bw * 0.28, bh * 0.1, { font: 'Arial', bold: true, size: bh * 0.07, color: '#ffffff', align: 'center', fit: true }));
  if (!ctx.logo && cfg.tagline) brand.push(text('Tagline', cfg.tagline, bx + bw * 0.7, by + bh * 0.15, bw * 0.28, bh * 0.07, { font: 'Arial', size: bh * 0.045, color: '#cfe0ff', align: 'center', fit: true }));
  if (brand.length) out.push(group('Brand', brand));

  const title = [
    text('Year', cfg.year, bx + bw * 0.68, by + bh * 0.735, bw * 0.3, bh * 0.14, { font: 'Arial Black', bold: true, size: bh * 0.12, color: INK, align: 'right', fit: true }),
    text('Calendar script', 'Calendar', bx + bw * 0.62, by + bh * 0.82, bw * 0.37, bh * 0.2, { font: 'Brush Script MT', size: bh * 0.2, color: INK, align: 'right', fit: true }),
  ];
  out.push(group('Title', title));

  /* ---- two staggered months with notes ---- */
  const T = by + bh + H * 0.045;
  const blockW = W * 0.4;
  const leftX = W * 0.078;
  const rightX = W * 0.525;
  const stagger = H * 0.214;
  const left = monthBlock(ctx, { x: leftX, y: T, w: blockW }, m);
  const right = monthBlock(ctx, { x: rightX, y: T + stagger, w: blockW }, m + 1);
  out.push(left.node, right.node);
  const gapN = H * 0.03;
  out.push(notes({ x: leftX, y: left.bottom + gapN, w: blockW, h: H - W * 0.05 - (left.bottom + gapN) }, 6));
  out.push(notes({ x: rightX, y: T, w: blockW, h: stagger - gapN }, 5));

  const line = [cfg.company, cfg.phone, cfg.email, cfg.website].filter(Boolean).join('   •   ');
  if (line) out.push(group('Footer', [text('Contact details', line, W * 0.05, H - W * 0.04, W * 0.9, W * 0.025, { font: 'Arial', size: 11, color: GREY, align: 'center', fit: true })]));
  return out;
}
