// Pure layout engine: turns a config into a tree of layers (no canvas needed).
// All coordinates are in "design units": the page is always 1000 units wide.

import { moonDayMarks } from './moonMarks.js';
import { tplPhil } from './templatePhil.js';
import { tplPhilOrnate } from './templatePhilOrnate.js';
import { tplNavy } from './templateNavy.js';
import { tplBigBlack } from './templateBigBlack.js';
import { tplDuo } from './templateDuo.js';
import { tplDuoOrnate } from './templateDuoOrnate.js';
import { tplChinese } from './templateChinese.js';
import { tplDuoBlack } from './templateDuoBlack.js';
import { tplPink } from './templatePink.js';
import { tplSky } from './templateSky.js';
import { tplCollage } from './templateCollage.js';
import { tplYearSari, tplYearPharma } from './templateYear.js';

// sizes in mm (width x height, portrait). Short / Long are the Philippine "short bond" and "long bond" papers.
export const PAGE_SIZES = {
  A5: [148, 210],
  A4: [210, 297],
  A3: [297, 420],
  Short: [215.9, 279.4], // 8.5 x 11 in
  Long: [215.9, 330.2], // 8.5 x 13 in
  Legal: [215.9, 355.6], // 8.5 x 14 in
  Tabloid: [279.4, 431.8],
  Letter: [215.9, 279.4], // old name of Short (kept so saved settings still load)
};
export const PAGE_SIZE_LABELS = {
  A5: 'A5 — 148 × 210 mm',
  A4: 'A4 — 210 × 297 mm',
  A3: 'A3 — 297 × 420 mm',
  Short: 'Short bond — 8.5 × 11 in',
  Long: 'Long bond — 8.5 × 13 in',
  Legal: 'Legal — 8.5 × 14 in',
  Tabloid: 'Tabloid — 11 × 17 in',
};

// Only fonts installed on virtually every Windows/Mac machine, so the preview,
// the PSD pixels and Photoshop's live text all agree. `ps` = PostScript names.
export const FONTS = {
  Arial: { css: 'Arial, Helvetica, sans-serif', ps: 'ArialMT', psBold: 'Arial-BoldMT' },
  Georgia: { css: 'Georgia, serif', ps: 'Georgia', psBold: 'Georgia-Bold' },
  'Times New Roman': {
    css: '"Times New Roman", Times, serif',
    ps: 'TimesNewRomanPSMT',
    psBold: 'TimesNewRomanPS-BoldMT',
  },
  'Trebuchet MS': { css: '"Trebuchet MS", sans-serif', ps: 'TrebuchetMS', psBold: 'TrebuchetMS-Bold' },
  Verdana: { css: 'Verdana, sans-serif', ps: 'Verdana', psBold: 'Verdana-Bold' },
  Impact: { css: 'Impact, Haettenschweiler, sans-serif', ps: 'Impact', psBold: 'Impact' },
  'Arial Black': { css: '"Arial Black", Arial, sans-serif', ps: 'Arial-Black', psBold: 'Arial-Black' },
  'Arial Narrow': { css: '"Arial Narrow", "Liberation Sans Narrow", Arial, sans-serif', ps: 'ArialNarrow', psBold: 'ArialNarrow-Bold' },
  'Brush Script MT': { css: '"Brush Script MT", "Segoe Script", "Lucida Handwriting", cursive', ps: 'BrushScriptMT', psBold: 'BrushScriptMT' },
  SimSun: { css: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", SimSun, sans-serif', ps: 'SimSun', psBold: 'SimSun' },
  Tahoma: { css: 'Tahoma, Geneva, sans-serif', ps: 'Tahoma', psBold: 'Tahoma-Bold' },
  'Courier New': { css: '"Courier New", Courier, monospace', ps: 'CourierNewPSMT', psBold: 'CourierNewPS-BoldMT' },
  'Comic Sans MS': { css: '"Comic Sans MS", cursive', ps: 'ComicSansMS', psBold: 'ComicSansMS-Bold' },
};

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const PAGE_COUNT = 13; // cover + 12 months
// two-month sheets (the "duo" template) put two months on each page: cover + 6 sheets
export const isDuo = (cfg) => cfg.template === 'duo' || cfg.template === 'duoornate' || cfg.template === 'duoblack' || cfg.template === 'collage';
export const isYear = (cfg) => cfg.template === 'yearsari' || cfg.template === 'yearpharma'; // whole year on ONE page
export const pageCount = (cfg) => (isYear(cfg) ? 1 : isDuo(cfg) ? 7 : PAGE_COUNT);
// first month (0-11) shown on page idx >= 1
export const firstMonthOf = (cfg, idx) => (isDuo(cfg) ? (idx - 1) * 2 : idx - 1);
export const pageLabel = (i, cfg = {}) => {
  if (isYear(cfg)) return 'Full year';
  if (i === 0) return 'Cover';
  const m = firstMonthOf(cfg, i);
  const a = MONTHS[m].slice(0, 3).toUpperCase();
  return isDuo(cfg) ? `${a}–${MONTHS[m + 1].slice(0, 3).toUpperCase()}` : a;
};
export const pageTitle = (cfg, i) => {
  if (isYear(cfg)) return 'Full-year poster';
  if (i === 0) return 'Cover';
  const m = firstMonthOf(cfg, i);
  return isDuo(cfg) ? `${MONTHS[m]} – ${MONTHS[m + 1]}` : MONTHS[m];
};

/* ---------- colour helpers ---------- */
export const hexToRgb = (h) => {
  h = String(h).replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
export const rgba = (h, a) => {
  const { r, g, b } = hexToRgb(h);
  return `rgba(${r},${g},${b},${a})`;
};
// t = 0 -> a, t = 1 -> b
export const mix = (a, b, t) => {
  const A = hexToRgb(a), B = hexToRgb(b);
  const f = (x, y) => Math.round(x + (y - x) * t);
  return '#' + [f(A.r, B.r), f(A.g, B.g), f(A.b, B.b)].map((v) => v.toString(16).padStart(2, '0')).join('');
};

/* ---------- calendar maths ---------- */
export function parseHolidays(src, year) {
  const map = {};
  String(src || '').split(/\r?\n/).forEach((line) => {
    const m = line.trim().match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})\s+(.+)$/);
    if (!m) return;
    if (m[1] && Number(m[1]) !== Number(year)) return;
    map[`${Number(m[2])}-${Number(m[3])}`] = m[4].trim();
  });
  return map;
}

export function monthCells(year, month, weekStart) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() - weekStart + 7) % 7;
  const dim = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((offset + dim) / 7);
  const cells = [];
  for (let i = 0; i < rows * 7; i++) {
    const dayIndex = i - offset + 1;
    const d = new Date(year, month, dayIndex);
    cells.push({
      day: d.getDate(),
      month: d.getMonth(),
      dow: d.getDay(),
      inMonth: dayIndex >= 1 && dayIndex <= dim,
    });
  }
  return cells;
}

export function pageGeometry(cfg) {
  let [pw, ph] = PAGE_SIZES[cfg.pageSize] || PAGE_SIZES.A4;
  if (cfg.orientation === 'landscape') [pw, ph] = [ph, pw];
  const perMm = 1000 / pw;
  const W = 1000;
  const H = ph * perMm;
  const b = Number(cfg.bleed || 0) * perMm;
  return { pw, ph, W, H, b, Wt: W + 2 * b, Ht: H + 2 * b, mmPerUnit: pw / 1000 };
}

/* ---------- node constructors ---------- */
export const rect = (name, x, y, w, h, fill, o = {}) => ({ type: 'rect', name, x, y, w, h, fill, ...o });
export const text = (name, str, x, y, w, h, o = {}) => ({
  type: 'text', name, text: String(str), x, y, w, h,
  font: 'Arial', bold: false, size: 16, color: '#000000', align: 'left', valign: 'middle', fit: false, ...o,
});

/* ---------- holiday name styles drawn over the big date number ---------- */
export const HOLIDAY_STYLES = [
  ['classic', 'Classic — small name in the cell'],
  ['faded', 'Faded date + name centred over it'],
  ['across', 'Big date + name across the bottom of it'],
  ['diagonal', 'Big date + name slanted over it (white)'],
];
export const isOverlayHoliday = (cfg) => ['faded', 'across', 'diagonal'].includes(cfg.holidayStyle);

/** 'faded' also softens the date number itself */
export function tweakHolidayNum(n, cfg) {
  if (cfg.holidayStyle === 'faded' && n) n.color = mix(n.color, cfg.bg, 0.4);
}

/** b = the day cell {x,y,w,h}; returns the text layers for the chosen style */
export function holidayOverlay(cfg, name, b, tag, red) {
  const st = cfg.holidayStyle;
  const full = String(name);
  const up = full.toUpperCase();
  if (st === 'faded') {
    return [text(`Holiday ${tag}`, up, b.x + 2, b.y + b.h * 0.38, b.w - 4, b.h * 0.24, {
      font: 'Arial', bold: true, size: Math.min(b.w * 0.095, b.h * 0.1), color: '#111111', align: 'center', valign: 'middle', fit: true,
    })];
  }
  if (st === 'across') {
    const size = Math.min(b.w * 0.13, b.h * 0.15);
    return [text(`Holiday ${tag}`, up, b.x + b.w * 0.06, b.y + b.h * 0.66, b.w * 0.88, b.h * 0.22, {
      font: 'Times New Roman', bold: true, size, color: red, fillColor: red, outline: Math.max(1.5, size * 0.14), outlineColor: cfg.bg,
      align: 'center', valign: 'middle', fit: true,
    })];
  }
  // diagonal: split long names over two lines, rotate the block -12 degrees
  let lines = [full];
  const sp = full.split(' ');
  if (full.length > 10 && sp.length > 1) {
    let best = 1, diff = 1e9;
    for (let i = 1; i < sp.length; i++) {
      const d = Math.abs(sp.slice(0, i).join(' ').length - sp.slice(i).join(' ').length);
      if (d < diff) { diff = d; best = i; }
    }
    lines = [sp.slice(0, best).join(' '), sp.slice(best).join(' ')];
  }
  const size = Math.min(b.w * 0.25, b.h * 0.24) * (lines.length > 1 ? 1 : 0.9);
  const lh = size * 1.15;
  const th = (-12 * Math.PI) / 180;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h * 0.5;
  const dark = mix(red, '#000000', 0.35);
  return lines.map((ln, i) => {
    const d = (i - (lines.length - 1) / 2) * lh;
    const mx = cx - Math.sin(th) * d;
    const my = cy + Math.cos(th) * d;
    const w = b.w * 0.96;
    return text(`Holiday ${tag}${lines.length > 1 ? ` ${i + 1}` : ''}`, ln, mx - w / 2, my - lh / 2, w, lh, {
      font: 'Georgia', bold: true, size, color: dark, fillColor: '#ffffff', outline: Math.max(1.5, size * 0.16), outlineColor: dark,
      align: 'center', valign: 'middle', fit: true, rot: -12,
    });
  });
}

export const group = (name, children) => ({ type: 'group', name, children: children.flat().filter(Boolean) });

/* ---------- two days sharing one cell (24 / 31 on 6-week months) ---------- */
export const SHARED_CELLS = [
  ['template', "Template's own layout"],
  ['diagonal', 'Diagonal line: 24 top-left, 31 bottom-right'],
  ['corners', 'Corners, no line: 24 top-left, 31 bottom-right'],
  ['slash', 'One line: 24 / 31'],
  ['stacked', 'Stacked: 24 over 31 with a line between'],
];
/**
 * @param o {own, x, y, w, h, pad, sz, font, a:{day,tag,color}, b:{...}}  own = the template's usual layout
 * @returns {nums, segs}  text layers + line segments (design units) for the diagonal / divider
 */
export function sharedCell(cfg, o) {
  const st = cfg.sharedCell && cfg.sharedCell !== 'template' ? cfg.sharedCell : o.own;
  const { x, y, w, h, pad, a, b } = o;
  const nums = [];
  const segs = [];
  const mk = (d, bx, by, bw, bh, size, align, valign) => text(`Day ${d.tag}`, d.day, bx, by, bw, bh, { font: o.font, bold: true, size, color: d.color, align, valign });
  if (st === 'slash') {
    const sz = Math.min(h * 0.5, w * 0.36);
    const sl = sz * 0.45;
    nums.push(mk(a, x + pad, y, w / 2 - pad - sl / 2, h, sz, 'right', 'middle'));
    nums.push(text(`Day ${a.tag} slash`, '/', x + w / 2 - sl / 2, y, sl, h, { font: o.font, bold: true, size: sz, color: a.color, align: 'center', valign: 'middle' }));
    nums.push(mk(b, x + w / 2 + sl / 2, y, w / 2 - pad - sl / 2, h, sz, 'left', 'middle'));
  } else if (st === 'stacked') {
    const sz = Math.min(h * 0.44, w * 0.5);
    nums.push(mk(a, x, y + h * 0.02, w, h * 0.48, sz, 'center', 'middle'));
    nums.push(mk(b, x, y + h * 0.5, w, h * 0.48, sz, 'center', 'middle'));
    segs.push([x, y + h / 2, x + w, y + h / 2]);
  } else {
    nums.push(mk(a, x + pad, y + 2, w * 0.62, h * 0.58, o.sz, 'left', 'top'));
    nums.push(mk(b, x + w * 0.38 - pad, y + h * 0.42 - 2, w * 0.62, h * 0.58, o.sz, 'right', 'bottom'));
    if (st === 'diagonal') segs.push([x + w, y, x, y + h]);
  }
  return { nums, segs };
}


/* ---------- text geometry shared by preview + PSD ---------- */
export function textGeom(l, measure) {
  const f = FONTS[l.font] || FONTS.Arial;
  let size = l.size;
  if (l.fit) {
    const w = measure(l.text, l.font, l.bold, size);
    if (w > l.w) size = (size * l.w) / w;
  }
  const anchorX = l.align === 'left' ? l.x : l.align === 'right' ? l.x + l.w : l.x + l.w / 2;
  let baselineY;
  if (l.valign === 'top') baselineY = l.y + size * 0.85;
  else if (l.valign === 'bottom') baselineY = l.y + l.h - size * 0.2;
  else baselineY = l.y + l.h / 2 + size * 0.36;
  return { size, anchorX, baselineY, psFont: l.bold ? f.psBold : f.ps };
}

/* ---------- building blocks ---------- */
function photoNodes(ctx, box, { bleed = '', radius = 0 } = {}) {
  const { cfg, photo } = ctx;
  if (photo) {
    return [
      {
        type: 'image', name: 'Photo', img: photo, fit: 'cover',
        zoom: cfg.photoZoom, fx: cfg.photoFx, fy: cfg.photoFy,
        x: box.x, y: box.y, w: box.w, h: box.h, radius, bleed,
      },
    ];
  }
  return [
    rect('Photo placeholder (replace me)', box.x, box.y, box.w, box.h,
      { grad: [[0, mix(cfg.primary, '#000000', 0.15)], [1, mix(cfg.primary, cfg.accent, 0.55)]] }, { radius, bleed }),
    text('Placeholder label', 'YOUR PHOTO HERE', box.x, box.y, box.w, box.h,
      { font: cfg.bodyFont, bold: true, size: Math.min(40, box.w / 12), color: '#ffffff', align: 'center', fit: true }),
  ];
}

function logoBadge(ctx, x, y, w, h, bg = '#ffffff') {
  if (!ctx.logo) return [];
  return [
    group('Logo', [
      rect('Logo badge', x, y, w, h, bg, { radius: 14, opacity: 0.95 }),
      { type: 'image', name: 'Logo', img: ctx.logo, fit: 'contain', x: x + 12, y: y + 10, w: w - 24, h: h - 20 },
    ]),
  ];
}

function footerNodes(ctx, x, y, w, h, o) {
  const { cfg } = ctx;
  const l1 = [cfg.phone, cfg.email, cfg.website].filter(Boolean).join('   •   ');
  const lines = [];
  if (l1) lines.push(['Contact details', l1, o.size]);
  if (cfg.address) lines.push(['Address', cfg.address, o.size * 0.92]);
  if (!lines.length) return [];
  const lh = o.size * 1.55;
  let yy = y + (h - lines.length * lh) / 2;
  return [
    group('Footer text', lines.map(([name, str, sz]) => {
      const t = text(name, str, x, yy, w, lh, { font: cfg.bodyFont, size: sz, color: o.color, align: o.align, fit: true });
      yy += lh;
      return t;
    })),
  ];
}

function gridNodes(ctx, box, monthIdx, o) {
  const { cfg } = ctx;
  const cells = monthCells(cfg.year, monthIdx, cfg.weekStart);
  const rows = cells.length / 7;
  const holidays = ctx.holidays;
  const hh = o.headerH;
  const colW = box.w / 7;
  const rowH = (box.h - hh) / rows;
  const top = box.y + hh;

  const bgNodes = [];
  const head = [];
  const dates = [];
  const hols = [];

  if (o.headerFill) head.push(rect('Weekday bar', box.x, box.y, box.w, hh, o.headerFill, { radius: o.headerRadius || 0 }));
  for (let c = 0; c < 7; c++) {
    const dow = (cfg.weekStart + c) % 7;
    const weekend = dow === 0 || dow === 6;
    head.push(text(`Weekday ${WEEKDAYS[dow]}`, WEEKDAYS[dow].toUpperCase(), box.x + c * colW, box.y, colW, hh, {
      font: cfg.bodyFont, bold: true, size: o.weekdaySize,
      color: weekend ? o.headerWeekendColor : o.headerColor, align: 'center',
    }));
  }

  if (o.style === 'lines') {
    const segs = [];
    for (let r = 0; r <= rows; r++) segs.push([box.x, top + r * rowH, box.x + box.w, top + r * rowH]);
    for (let c = 0; c <= 7; c++) segs.push([box.x + c * colW, top, box.x + c * colW, top + rows * rowH]);
    const pad = o.lineW;
    bgNodes.push({
      type: 'lines', name: 'Grid lines', segs, color: o.lineColor, lw: o.lineW,
      x: box.x - pad, y: top - pad, w: box.w + 2 * pad, h: rows * rowH + 2 * pad,
    });
  }

  const cardNodes = [];
  const cellAt = {};
  const numSize = Math.min(o.numSize, rowH * 0.42);
  const holSize = Math.min(o.holSize, rowH * 0.2);

  cells.forEach((cell, i) => {
    const r = Math.floor(i / 7);
    const c = i % 7;
    const x = box.x + c * colW;
    const y = top + r * rowH;
    const weekend = cell.dow === 0 || cell.dow === 6;
    const holName = cell.inMonth ? holidays[`${cell.month + 1}-${cell.day}`] : undefined;
    const show = cell.inMonth || cfg.showAdj;
    const label = String(cell.day).padStart(2, '0');

    if (o.style === 'cards' && show) {
      const g = o.gap;
      cardNodes.push(rect(`Cell ${cell.month + 1}-${label}`, x + g / 2, y + g / 2, colW - g, rowH - g,
        !cell.inMonth ? o.cardAdjFill : weekend || holName ? o.cardWeekendFill : o.cardFill, { radius: o.radius }));
    }
    if (!show) return;
    if (cell.inMonth) cellAt[cell.day] = { x, y };

    let color = o.numColor || cfg.text;
    if (!cell.inMonth) color = o.mutedColor;
    else if (weekend || holName) color = cfg.weekend;

    dates.push(text(`Day ${cell.month + 1}-${label}`, cell.day, x + o.pad, y + o.pad * 0.7, colW - 2 * o.pad, numSize * 1.3, {
      font: cfg.bodyFont, bold: true, size: numSize, color, align: o.numAlign, valign: 'top',
    }));

    if (holName && cfg.showHolidays) {
      hols.push(text(`Holiday ${cell.month + 1}-${label}`, holName, x + o.pad, y + rowH - o.pad * 0.6 - holSize * 1.4, colW - 2 * o.pad, holSize * 1.4, {
        font: cfg.bodyFont, size: holSize, color: cfg.weekend, align: o.numAlign, valign: 'bottom', fit: true,
      }));
    }
  });

  const md = Math.min(rowH * 0.26, colW * 0.26);
  const moons = moonDayMarks(cfg, monthIdx, (d) => {
    const p = cellAt[d];
    return p ? { x: o.numAlign === 'right' ? p.x + o.pad * 0.6 : p.x + colW - md - o.pad * 0.6, y: p.y + o.pad * 0.6, d: md } : null;
  }, cfg.themeA || cfg.weekend);

  return [
    group('Calendar grid', [
      bgNodes,
      cardNodes.length ? group('Cells', cardNodes) : null,
      group('Weekday headers', head),
      group('Dates', dates),
      hols.length ? group('Holidays', hols) : null,
      moons.length ? group('Moon phases', moons) : null,
    ]),
  ];
}

/* ---------- templates ---------- */
function tplClassic(ctx, m) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const M = 48;
  const land = W > H;
  const photoH = H * (land ? 0.46 : 0.5);
  const bandH = H * 0.075;
  const footH = H * 0.075;
  const gridY = photoH + bandH + 14;
  const out = [];

  out.push(rect('Background', 0, 0, W, H, cfg.bg, { bleed: 'ltrb' }));
  out.push(group('Photo', photoNodes(ctx, { x: 0, y: 0, w: W, h: photoH }, { bleed: 'ltr' })));
  out.push(rect('Photo top shade', 0, 0, W, photoH * 0.4, { grad: [[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']] }, { bleed: 'ltr' }));
  out.push(group('Brand', [
    text('Company name', cfg.company, M, M * 0.65, W * 0.58, 52, { font: cfg.headingFont, bold: true, size: 40, color: '#ffffff', fit: true }),
    cfg.tagline ? text('Tagline', cfg.tagline, M, M * 0.65 + 50, W * 0.58, 30, { font: cfg.bodyFont, size: 20, color: '#ffffff', fit: true }) : null,
  ]));
  out.push(logoBadge(ctx, W - M - 190, M * 0.65, 190, 86));
  out.push(group('Month band', [
    rect('Band', 0, photoH, W, bandH, cfg.primary, { bleed: 'lr' }),
    rect('Band accent', 0, photoH + bandH - 6, W, 6, cfg.accent, { bleed: 'lr' }),
    text('Month', MONTHS[m].toUpperCase(), M, photoH, W * 0.62, bandH, { font: cfg.headingFont, bold: true, size: bandH * 0.56, color: '#ffffff', fit: true }),
    text('Year', cfg.year, W - M - W * 0.3, photoH, W * 0.3, bandH, { font: cfg.headingFont, bold: true, size: bandH * 0.56, color: cfg.accent, align: 'right' }),
  ]));
  out.push(gridNodes(ctx, { x: M, y: gridY, w: W - 2 * M, h: H - footH - gridY - 10 }, m, {
    style: 'lines', headerH: 44, weekdaySize: 17,
    headerFill: mix(cfg.primary, cfg.bg, 0.9), headerColor: cfg.primary, headerWeekendColor: cfg.weekend,
    lineColor: mix(cfg.text, cfg.bg, 0.8), lineW: 1.5,
    numSize: 30, holSize: 12.5, pad: 9, numAlign: 'left', mutedColor: mix(cfg.text, cfg.bg, 0.7),
  }));
  out.push(group('Footer', [
    rect('Footer band', 0, H - footH, W, footH, cfg.primary, { bleed: 'lrb' }),
    footerNodes(ctx, M, H - footH, W - 2 * M, footH, { size: Math.min(16, footH * 0.26), color: '#ffffff', align: 'center' }),
  ]));
  return out;
}

function tplMinimal(ctx, m) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const M = 52;
  const land = W > H;
  const topH = H * (land ? 0.4 : 0.34);
  const footH = H * 0.07;
  const gridY = topH + M * 0.6;
  const out = [];

  out.push(rect('Background', 0, 0, W, H, cfg.bg, { bleed: 'ltrb' }));
  out.push(group('Photo', photoNodes(ctx, { x: W * 0.5, y: 0, w: W * 0.5, h: topH }, { bleed: 'tr' })));
  out.push(group('Title block', [
    text('Company name', cfg.company.toUpperCase(), M, M * 0.8, W * 0.44, 30, { font: cfg.bodyFont, bold: true, size: 20, color: cfg.accent, fit: true }),
    text('Month', MONTHS[m], M, topH * 0.2, W * 0.5 - M - 24, 150, { font: cfg.headingFont, bold: true, size: 130, color: cfg.primary, fit: true }),
    text('Year', cfg.year, M, topH * 0.2 + 150, W * 0.4, 70, { font: cfg.headingFont, size: 56, color: cfg.accent }),
    cfg.tagline ? text('Tagline', cfg.tagline, M, topH - 52, W * 0.44, 28, { font: cfg.bodyFont, size: 18, color: mix(cfg.text, cfg.bg, 0.35), fit: true }) : null,
  ]));
  out.push(logoBadge(ctx, W - M - 170, M * 0.6, 170, 76));
  out.push(gridNodes(ctx, { x: M, y: gridY, w: W - 2 * M, h: H - footH - gridY - 24 }, m, {
    style: 'lines', headerH: 40, weekdaySize: 16,
    headerFill: null, headerColor: cfg.accent, headerWeekendColor: cfg.weekend,
    lineColor: mix(cfg.text, cfg.bg, 0.86), lineW: 1.2,
    numSize: 30, holSize: 12.5, pad: 10, numAlign: 'right', mutedColor: mix(cfg.text, cfg.bg, 0.72),
  }));
  out.push(group('Footer', [
    rect('Footer rule', M, H - footH, W - 2 * M, 2, cfg.primary),
    footerNodes(ctx, M, H - footH + 4, W - 2 * M, footH - 4, { size: Math.min(15, footH * 0.26), color: cfg.primary, align: 'left' }),
  ]));
  return out;
}

function tplBold(ctx, m) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const M = 44;
  const land = W > H;
  const photoH = H * (land ? 0.4 : 0.42);
  const titleY = M + photoH + 14;
  const titleH = H * 0.07;
  const footH = H * 0.06;
  const gridY = titleY + titleH + 8;
  const out = [];

  out.push(rect('Background', 0, 0, W, H, cfg.primary, { bleed: 'ltrb' }));
  out.push(group('Photo', photoNodes(ctx, { x: M, y: M, w: W - 2 * M, h: photoH }, { radius: 28 })));
  out.push(group('Brand', [
    rect('Brand pill', M + 20, M + photoH - 84, 500, 64, rgba(cfg.primary, 0.88), { radius: 32 }),
    text('Company name', cfg.company, M + 44, M + photoH - 84, 452, 64, { font: cfg.headingFont, bold: true, size: 28, color: '#ffffff', fit: true }),
  ]));
  out.push(logoBadge(ctx, W - M - 190, M + 20, 170, 80));
  out.push(group('Month title', [
    text('Month', MONTHS[m].toUpperCase(), M, titleY, W * 0.62, titleH, { font: cfg.headingFont, bold: true, size: titleH * 0.82, color: '#ffffff', fit: true }),
    text('Year', cfg.year, W - M - W * 0.3, titleY, W * 0.3, titleH, { font: cfg.headingFont, bold: true, size: titleH * 0.82, color: cfg.accent, align: 'right' }),
  ]));
  out.push(gridNodes(ctx, { x: M, y: gridY, w: W - 2 * M, h: H - footH - gridY - 22 }, m, {
    style: 'cards', headerH: 40, weekdaySize: 16, gap: 8, radius: 14,
    headerFill: null, headerColor: '#ffffff', headerWeekendColor: cfg.accent,
    cardFill: '#ffffff', cardWeekendFill: mix('#ffffff', cfg.weekend, 0.1), cardAdjFill: mix(cfg.primary, '#ffffff', 0.14),
    numSize: 30, holSize: 12, pad: 12, numAlign: 'left', numColor: cfg.text,
    mutedColor: mix(cfg.primary, '#ffffff', 0.5),
  }));
  out.push(footerNodes(ctx, M, H - footH - 10, W - 2 * M, footH, { size: Math.min(15, footH * 0.3), color: '#ffffff', align: 'center' }));
  return out;
}

function buildCover(ctx) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const M = 56;
  const out = [];
  const yearSize = Math.min(W * 0.3, H * 0.2);
  const yearY = H * 0.6;

  out.push(rect('Background', 0, 0, W, H, cfg.primary, { bleed: 'ltrb' }));
  out.push(group('Photo', photoNodes(ctx, { x: 0, y: 0, w: W, h: H }, { bleed: 'ltrb' })));
  out.push(rect('Bottom shade', 0, H * 0.35, W, H * 0.65,
    { grad: [[0, rgba(cfg.primary, 0)], [0.55, rgba(cfg.primary, 0.8)], [1, rgba(cfg.primary, 0.96)]] }, { bleed: 'lrb' }));
  out.push(group('Cover title', [
    text('Cover label', cfg.coverLabel, M, yearY - 44, W - 2 * M, 34, { font: cfg.bodyFont, bold: true, size: 24, color: cfg.accent, fit: true }),
    text('Year', cfg.year, M, yearY, W - 2 * M, yearSize * 1.15, { font: cfg.headingFont, bold: true, size: yearSize, color: '#ffffff', fit: true }),
    rect('Accent bar', M, yearY + yearSize * 1.2, 140, 10, cfg.accent),
    text('Company name', cfg.company, M, yearY + yearSize * 1.2 + 28, W - 2 * M, 60, { font: cfg.headingFont, bold: true, size: 44, color: '#ffffff', fit: true }),
    cfg.tagline ? text('Tagline', cfg.tagline, M, yearY + yearSize * 1.2 + 86, W - 2 * M, 34, { font: cfg.bodyFont, size: 24, color: '#ffffff', fit: true }) : null,
  ]));
  out.push(logoBadge(ctx, M, M, 200, 90));
  out.push(footerNodes(ctx, M, H - H * 0.09, W - 2 * M, H * 0.07, { size: 15, color: '#ffffff', align: 'left' }));
  return out;
}

export const TEMPLATES = { classic: tplClassic, minimal: tplMinimal, bold: tplBold, phil: tplPhil, ornate: tplPhilOrnate, navy: tplNavy, bigblack: tplBigBlack, duo: tplDuo, duoornate: tplDuoOrnate, chinese: tplChinese, duoblack: tplDuoBlack, pink: tplPink, sky: tplSky, collage: tplCollage, yearsari: tplYearSari, yearpharma: tplYearPharma };

/* ---------- bleed + final placement ---------- */
function place(node, b) {
  if (node.type === 'group') {
    node.children.forEach((n) => place(n, b));
    return;
  }
  const f = node.bleed || '';
  if (f.includes('l')) { node.x -= b; node.w += b; }
  if (f.includes('r')) node.w += b;
  if (f.includes('t')) { node.y -= b; node.h += b; }
  if (f.includes('b')) node.h += b;
  node.x += b;
  node.y += b;
  if (node.segs) node.segs = node.segs.map(([a, c, d, e]) => [a + b, c + b, d + b, e + b]);
}

/**
 * @param cfg   config object (see defaults.js)
 * @param idx   0 = cover, 1..12 = January..December
 * @param photo drawable image for this page or null
 * @param logo  drawable logo or null
 * @returns {{geo, children}} bottom-to-top layer tree in final (bleed-shifted) units
 */

/* ---------- page border + grid line options (Border & lines panel) ---------- */
export const BORDER_STYLES = [
  ['template', "Template's own border"],
  ['none', 'No border'],
  ['line', 'Solid line'],
  ['line+h', 'Solid line + horizontal line'],
  ['double', 'Double line'],
  ['double+h', 'Double line + horizontal line'],
  ['rounded', 'Rounded line'],
  ['rounded+h', 'Rounded line + horizontal line'],
  ['pattern', 'Key pattern (Greek key)'],
  ['pattern+h', 'Key pattern + horizontal line'],
  ['artwork', 'Your border design (BOARDER.png) — any colour'],
  ['artwork+h', 'Your border design + horizontal line'],
];

/* "Border only" or "border + line(s)" — extra lines drawn just inside the ornamental / artwork band */
export const BORDER_PARTS = [
  ['only', 'Border only (no extra line)'],
  ['line', 'Border + one line'],
  ['double', 'Border + double line'],
];

function applyBorderOptions(children, cfg, geo) {
  const rawStyle = cfg.borderStyle || 'template';
  const hline = rawStyle.endsWith('+h'); // "... + horizontal line" choices
  const style = rawStyle.replace('+h', '');
  let sawStrip = false;
  const hOff = Number(cfg.hlineOffset) || 0; // moves the horizontal line up (-) / down (+)
  const themed = cfg.themeB || cfg.text || '#111111';
  const bColor = cfg.borderFollow === false ? cfg.borderColor : null; // null = keep template / theme colour
  const gColor = cfg.gridFollow === false ? cfg.gridColor : null;
  const gW = Number(cfg.gridWidth) || 0;
  const bw = Math.max(0.5, Number(cfg.borderWidth) || 4);
  const inset = Math.max(0, Number(cfg.borderInset) || 0);
  const col = bColor || themed;
  let sawFrame = false;
  const parts = cfg.borderParts || 'only';
  const extraLines = []; // lines that go with a pattern / artwork band (kept out of the tree slots so layer ids stay stable)
  const lineColor = cfg.borderLineFollow === false ? cfg.borderLineColor : null;
  const addLines = (n) => {
    if (parts === 'only' || n.mode === 'strip') return;
    const lc = lineColor || n.color || col;
    const lw = Math.max(0.75, n.bw * 0.12);
    const gap = n.bw * 0.28;
    const mkLine = (nm, off, ww) => {
      const o = n.bw + gap + off + ww / 2;
      return rect(nm, n.x + o, n.y + o, n.w - 2 * o, n.h - 2 * o, null, { stroke: lc, strokeW: ww });
    };
    const ls = [mkLine('Border line', 0, lw)];
    if (parts === 'double') ls.push(mkLine('Border line 2', lw + gap * 0.7, Math.max(0.5, lw * 0.5)));
    extraLines.push(group(parts === 'double' ? 'Border double line' : 'Border line', ls));
  };

  const frame = () => {
    const x = inset + bw / 2;
    const y = inset + bw / 2;
    const w = geo.W - 2 * x;
    const h = geo.H - 2 * y;
    const mk = (nm, o, ww) => rect(nm, x + o, y + o, w - 2 * o, h - 2 * o, null, { stroke: col, strokeW: ww, radius: style === 'rounded' ? 16 : 0 });
    if (style === 'double') return group('Page border', [mk('Border outer', 0, bw), mk('Border inner', bw * 2.4, Math.max(0.5, bw * 0.45))]);
    return group('Page border', [mk('Border', 0, bw)]);
  };

  // horizontal rule(s) matching the chosen line style: ONE layer, so it can be selected, dragged up / down with the mouse and deleted
  const hLines = (x, yc, w) => {
    const t = Math.max(1, bw);
    const dbl = style === 'double';
    const th = dbl ? t * 2.4 : t;
    return { type: 'keyborder', mode: 'strip', hl: dbl ? 'double' : 'line', name: 'Horizontal line', x, y: yc - th / 2, w, h: th, color: col, bg: cfg.bg };
  };

  const walk = (nodes) => nodes.map((n) => {
    if (!n) return n;
    if (n.type === 'group') {
      if (style === 'none' && n.name === 'Frame') return group('Frame (hidden)', []);
      n.children = walk(n.children);
      return n;
    }
    if (n.type === 'keyborder') {
      if (bColor) n.color = bColor;
      if (n.mode === 'strip' && style !== 'template') {
        sawStrip = true;
        if (!hline) return group('Horizontal line (hidden)', []);
        if (['line', 'double', 'rounded'].includes(style)) return hLines(n.x, n.y + n.h / 2 + hOff, n.w);
        n.y += hOff;
      }
      if (n.mode !== 'strip') {
        sawFrame = true;
        if (style === 'none') return group('Ornamental border (hidden)', []);
        if (style === 'artwork') n.art = 'img';
        if (!['line', 'double', 'rounded'].includes(style)) addLines(n);
        if (['line', 'double', 'rounded'].includes(style)) {
          // same slot, so the editor's per-layer edits keep their numbering
          const x = n.x + bw / 2;
          const y = n.y + bw / 2;
          const w = n.w - bw;
          const h = n.h - bw;
          const mk = (nm, o, ww) => rect(nm, x + o, y + o, w - 2 * o, h - 2 * o, null, { stroke: col, strokeW: ww, radius: style === 'rounded' ? 16 : 0 });
          return style === 'double'
            ? group('Page border', [mk('Border outer', 0, bw), mk('Border inner', bw * 2.4, Math.max(0.5, bw * 0.45))])
            : group('Page border', [mk('Border', 0, bw)]);
        }
      }
      return n;
    }
    if (n.type === 'rect' && n.stroke && (n.name === 'Grid border' || /^Cell \d+/.test(n.name))) {
      if (gColor) n.stroke = gColor;
      if (gW) n.strokeW = n.name === 'Grid border' ? gW * 1.6 : gW;
    }
    return n;
  });

  const out = walk(children);
  if (!sawFrame && style !== 'template' && style !== 'none') {
    if (style === 'artwork') {
      const b = bw * 3;
      const kb = { type: 'keyborder', art: 'img', name: 'Page border (your design)', x: inset, y: inset, w: geo.W - 2 * inset, h: geo.H - 2 * inset, bw: b, color: col, bg: cfg.bg };
      out.push(kb);
      addLines(kb);
    } else if (style === 'pattern') {
      const b = bw * 3;
      const kb = { type: 'keyborder', name: 'Page border', x: inset, y: inset, w: geo.W - 2 * inset, h: geo.H - 2 * inset, bw: b, color: col, bg: cfg.bg };
      out.push(kb);
      addLines(kb);
    } else {
      out.push(frame());
    }
  }
  if (hline && !sawStrip && style !== 'template') {
    // template has no ads/logo strip: draw one rule across the top section (move / hide it from the Layers panel)
    const m = inset + (style === 'pattern' || style === 'artwork' ? bw * 3 : bw) + 4;
    const yc = geo.H * 0.2 + hOff;
    if (style === 'pattern' || style === 'artwork') out.push({ type: 'keyborder', mode: 'strip', name: 'Horizontal pattern line', x: m, y: yc - 7.5, w: geo.W - 2 * m, h: 15, color: col, bg: cfg.bg });
    else out.push(hLines(m, yc, geo.W - 2 * m));
  }
  out.push(...extraLines);
  return out;
}

export function buildPage(cfg, idx, photo = null, logo = null) {
  if (cfg.moonPos === 'none' && cfg.showMoon) cfg = { ...cfg, showMoon: false }; // "No moon" choice: every template drops its moons
  const geo = pageGeometry(cfg);
  const ctx = { cfg, geo, photo, logo, holidays: parseHolidays(cfg.holidays, cfg.year) };
  const raw = idx === 0 && !isYear(cfg) ? buildCover(ctx) : (TEMPLATES[cfg.template] || tplClassic)(ctx, firstMonthOf(cfg, idx));
  const children = applyBorderOptions(raw.flat().filter(Boolean), cfg, geo);
  children.forEach((n) => place(n, geo.b));
  return { geo, children };
}
