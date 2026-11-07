// "Two-month blue & red" template — built from the supplied July / August 2026 sheet:
//   verse / photo banner on top, then two big month blocks stacked on one page.
//   Each block: `2026 | JULY | 2026` title row (red years, blue month), blue weekday bar with a red SUN box,
//   thick blue-ruled cells with huge Impact numbers (Sundays + holidays red), moon-phase cells in the empty
//   slots (red face, label above, date below), 24/31 shared cell on 6-week months.
//   Beside each block: a mini calendar (previous month beside the first block, next month beside the second),
//   half of the LEGAL HOLIDAYS list and a ruled NOTES area. Blocks alternate sides like the sample.
//   One page = two months, so the project has cover + 6 sheets (Jan–Feb … Nov–Dec).
import { rect, text, group, sharedCell, monthCells, parseHolidays, MONTHS, WEEKDAYS, mix, isOverlayHoliday, holidayOverlay, tweakHolidayNum } from './layout.js';
import { moonCellLayers } from './moonCell.js';
import { moonPhasesForMonth } from './moon.js';
import { listHolidays } from './templatePhil.js';

const NUM_FONT = 'Impact';
const HEAD_FONT = 'Arial Black';
const SMALL_FONT = 'Arial Narrow';
const BLUE = '#0b4dab';
const RED = '#b91c22';
const PHASE_LABEL = ['NEW MOON', 'FIRST QUARTER', 'FULL MOON', 'LAST QUARTER'];
const PHASE_KEY = ['new', 'fq', 'full', 'lq'];
const MON3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// split a verse into two balanced lines at a word boundary
function twoLines(str) {
  const words = String(str || '').trim().split(/\s+/);
  if (words.length < 4) return [words.join(' '), ''];
  const total = words.join(' ').length;
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ').length;
    const d = Math.abs(a - (total - a));
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
}

function banner(ctx, box, c) {
  const { cfg } = ctx;
  const out = [];
  if (ctx.photo) {
    out.push({ type: 'image', name: 'Photo', img: ctx.photo, fit: 'cover', zoom: cfg.photoZoom, fx: cfg.photoFx, fy: cfg.photoFy, ...box, radius: 0 });
  } else {
    out.push(rect('Photo placeholder (replace me)', box.x, box.y, box.w, box.h, { grad: [[0, '#5a2a0e'], [0.55, '#d9822b'], [1, '#f2c36b']] }));
    out.push(text('Placeholder label', 'YOUR PHOTO HERE', box.x, box.y + box.h * 0.72, box.w, box.h * 0.18, {
      font: HEAD_FONT, bold: true, size: 40, color: 'rgba(255,255,255,0.75)', align: 'center', fit: true,
    }));
  }
  const verse = String(cfg.verse || '').trim();
  const ref = String(cfg.verseRef || '').trim();
  const vg = [];
  if (verse) {
    const [l1, l2] = twoLines(verse);
    const bw = box.w * 0.74;
    const bh = box.h * (l2 ? 0.34 : 0.22);
    const bx = box.x + (box.w - bw) / 2;
    const by = box.y + box.h * 0.2;
    vg.push(rect('Verse box', bx, by, bw, bh, '#fdfdfb', { radius: bh * 0.18, opacity: 0.97 }));
    const lh = l2 ? bh * 0.42 : bh * 0.6;
    const sz = lh * 0.86;
    const ty = by + (bh - lh * (l2 ? 2 : 1)) / 2;
    vg.push(text('Verse line 1', l1, bx + 14, ty, bw - 28, lh, { font: 'Georgia', bold: true, size: sz, color: '#111111', align: 'center', fit: true }));
    if (l2) vg.push(text('Verse line 2', l2, bx + 14, ty + lh, bw - 28, lh, { font: 'Georgia', bold: true, size: sz, color: '#111111', align: 'center', fit: true }));
    if (ref) {
      const rh = box.h * 0.085;
      vg.push(text('Verse reference', ref, box.x, by + bh + box.h * 0.07, box.w, rh, {
        font: 'Georgia', bold: false, size: rh * 0.9, color: '#16205a', align: 'center', fit: true,
      }));
    }
  }
  out.push(group('Verse', vg));
  out.push(rect('Banner border', box.x, box.y, box.w, box.h, null, { stroke: mix(c.blue, '#000000', 0.3), strokeW: 1.5 }));
  return group('Banner', out);
}

export function miniCal(ctx, box, year, mon, c) {
  const { cfg } = ctx;
  const cells = monthCells(year, mon, cfg.weekStart);
  const rows = cells.length / 7;
  const hols = parseHolidays(cfg.holidays, year);
  const titleH = box.h * 0.15;
  const wdH = box.h * 0.1;
  const colW = box.w / 7;
  const bodyY = box.y + titleH + wdH;
  const rowH = (box.y + box.h - bodyY) / rows;
  const yw = box.w * 0.22;
  const out = [rect('Mini background', box.x, box.y, box.w, box.h, cfg.bg)];

  out.push(rect('Mini title bar', box.x, box.y, box.w, titleH, c.blue));
  out.push(rect('Mini year box left', box.x, box.y, yw, titleH, c.red));
  out.push(rect('Mini year box right', box.x + box.w - yw, box.y, yw, titleH, c.red));
  out.push(text('Mini year left', year, box.x, box.y, yw, titleH, { font: NUM_FONT, bold: true, size: titleH * 0.82, color: '#ffffff', align: 'center', fit: true }));
  out.push(text('Mini title', MONTHS[mon].toUpperCase(), box.x + yw, box.y, box.w - 2 * yw, titleH, {
    font: HEAD_FONT, bold: true, size: titleH * 0.78, color: '#ffffff', align: 'center', fit: true,
  }));
  out.push(text('Mini year right', year, box.x + box.w - yw, box.y, yw, titleH, { font: NUM_FONT, bold: true, size: titleH * 0.82, color: '#ffffff', align: 'center', fit: true }));

  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    const nm = WEEKDAYS[dow];
    out.push(rect(`Mini weekday box ${nm}`, box.x + i * colW + 0.5, box.y + titleH, colW - 1, wdH, dow === 0 ? c.red : c.blue));
    out.push(text(`Mini weekday ${nm}`, nm.toUpperCase(), box.x + i * colW, box.y + titleH, colW, wdH, {
      font: HEAD_FONT, bold: true, size: Math.min(wdH * 0.62, colW * 0.3), color: '#ffffff', align: 'center', fit: true,
    }));
  }
  const segs = [];
  for (let r = 0; r <= rows; r++) segs.push([box.x, bodyY + r * rowH, box.x + box.w, bodyY + r * rowH]);
  for (let k = 0; k <= 7; k++) segs.push([box.x + k * colW, bodyY, box.x + k * colW, bodyY + rows * rowH]);
  out.push({ type: 'lines', name: 'Mini grid lines', segs, color: c.blue, lw: 1.2, x: box.x - 1, y: bodyY - 1, w: box.w + 2, h: rows * rowH + 2 });
  cells.forEach((cell, i) => {
    if (!cell.inMonth) return;
    const r = Math.floor(i / 7);
    const col = i % 7;
    const red = cell.dow === 0 || !!hols[`${mon + 1}-${cell.day}`];
    out.push(text(`Mini day ${cell.day}`, cell.day, box.x + col * colW, bodyY + r * rowH, colW, rowH, {
      font: NUM_FONT, bold: true, size: Math.min(rowH * 0.78, colW * 0.62), color: red ? c.red : c.blue, align: 'center',
    }));
  });
  return group(`Mini calendar ${MONTHS[mon]}`, out);
}

// legal holidays (half of the list) + notes lines, below the mini calendar
export function sidePanel(ctx, box, items, c) {
  const { cfg } = ctx;
  const out = [];
  const headH = Math.min(box.h * 0.1, 20);
  let y = box.y;
  if (items.length) {
    out.push(text('Holidays title', `${cfg.holidaysTitle.toUpperCase()} ${cfg.year}`, box.x, y, box.w, headH, {
      font: SMALL_FONT, bold: true, size: headH * 0.82, color: c.red, align: 'center', fit: true,
    }));
    y += headH + 2;
    const avail = box.h * 0.56 - headH;
    const itemH = Math.min(16, avail / items.length);
    const dateW = box.w * 0.24;
    items.forEach((it, k) => {
      const ry = y + k * itemH;
      out.push(text(`Holiday name ${it.m}-${it.d}`, it.name.toUpperCase(), box.x + 6, ry, box.w - dateW - 10, itemH, {
        font: SMALL_FONT, bold: true, size: itemH * 0.8, color: c.red, align: 'left', fit: true,
      }));
      out.push(text(`Holiday date ${it.m}-${it.d}`, `${MON3[it.m - 1]} ${it.d}`, box.x + box.w - dateW - 4, ry, dateW, itemH, {
        font: SMALL_FONT, bold: true, size: itemH * 0.8, color: c.red, align: 'left', fit: true,
      }));
    });
    y += items.length * itemH + 4;
  }
  // notes
  const left = box.y + box.h - y;
  if (left > 24) {
    out.push(text('Notes title', 'NOTES', box.x, y, box.w, 18, { font: HEAD_FONT, bold: true, size: 15, color: c.blue, align: 'center', fit: true }));
    const n = Math.max(2, Math.min(6, Math.floor((left - 22) / 24)));
    const step = (left - 22) / n;
    const segs = [];
    for (let k = 1; k <= n; k++) segs.push([box.x + 4, y + 18 + k * step, box.x + box.w - 4, y + 18 + k * step]);
    out.push({ type: 'lines', name: 'Notes lines', segs, color: c.blue, lw: 1.6, x: box.x, y: y + 18, w: box.w, h: n * step + 2 });
  }
  return group('Holidays and notes', out);
}

// one month block (title row + weekday bar + 7x5 grid); returns layer nodes
export function monthBlock(ctx, box, m, c) {
  const { cfg } = ctx;
  const out = [];
  const titleH = box.h * 0.115;
  const wdH = box.h * 0.05;
  const yearW = box.w * 0.19;
  let y = box.y;

  out.push(rect('Title bar', box.x, y, box.w, titleH, c.blue));
  out.push(rect('Year box left', box.x, y, yearW, titleH, c.red));
  out.push(rect('Year box right', box.x + box.w - yearW, y, yearW, titleH, c.red));
  out.push(group('Title row', [
    text('Year left', cfg.year, box.x, y, yearW, titleH, { font: NUM_FONT, bold: true, size: titleH * 1.0, color: '#ffffff', align: 'center', fit: true }),
    text('Month', MONTHS[m].toUpperCase(), box.x + yearW, y, box.w - 2 * yearW, titleH, { font: HEAD_FONT, bold: true, size: titleH * 0.95, color: '#ffffff', align: 'center', fit: true }),
    text('Year right', cfg.year, box.x + box.w - yearW, y, yearW, titleH, { font: NUM_FONT, bold: true, size: titleH * 1.0, color: '#ffffff', align: 'center', fit: true }),
  ]));
  y += titleH;

  const colW = box.w / 7;
  const wd = [];
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    const nm = WEEKDAYS[dow];
    wd.push(rect(`Weekday box ${nm}`, box.x + i * colW, y, colW, wdH, c.wdLight ? cfg.bg : dow === 0 ? c.red : c.blue, c.wdLight ? { stroke: c.blue, strokeW: 2.2 } : {}));
    wd.push(text(`Weekday ${nm}`, nm.toUpperCase(), box.x + i * colW, y, colW, wdH, {
      font: HEAD_FONT, bold: true, size: wdH * 0.64, color: c.wdLight ? (dow === 0 ? c.red : c.blue) : '#ffffff', align: 'center', fit: true,
    }));
  }
  out.push(group('Weekday headers', wd));
  y += wdH;

  // 7 x 5 grid; 6-week months fold the overflow into the row above (24/31), 4-week months get a spare row
  const cells = monthCells(cfg.year, m, cfg.weekStart);
  const rows = 5;
  const gridY = y;
  const rowH = (box.y + box.h - gridY) / rows;
  const fold = {};
  if (cells.length / 7 === 6) {
    for (let col = 0; col < 7; col++) if (cells[35 + col].inMonth) fold[28 + col] = cells[35 + col];
  } else if (cells.length / 7 === 4) {
    const first = cells.findIndex((x) => x.inMonth);
    for (let i = 28; i < 35; i++) {
      const d = new Date(cfg.year, m, i - first + 1);
      cells.push({ day: d.getDate(), month: d.getMonth(), dow: d.getDay(), inMonth: false });
    }
  }
  const holidays = ctx.holidays;
  const redOf = (d) => d.dow === 0 || !!holidays[`${d.month + 1}-${d.day}`];

  const phases = cfg.showMoon ? moonPhasesForMonth(cfg.year, m, Number(cfg.utcOffset) || 0) : [];
  const blankIdx = [];
  cells.slice(0, rows * 7).forEach((cell, i) => !cell.inMonth && blankIdx.push(i));
  const moonInBlanks = phases.length > 0 && blankIdx.length >= phases.length;
  const moonCellOf = {};
  if (moonInBlanks) phases.forEach((p, j) => (moonCellOf[blankIdx[j]] = p));

  const boxes = [];
  const nums = [];
  const hol = [];
  const moons = [];
  const diag = [];

  cells.slice(0, rows * 7).forEach((cell, i) => {
    const r = Math.floor(i / 7);
    const col = i % 7;
    const x = box.x + col * colW;
    const cy = gridY + r * rowH;
    boxes.push(rect(`Cell ${i + 1}`, x, cy, colW, rowH, cfg.bg, { stroke: c.blue, strokeW: 2.2 }));

    const mp = moonCellOf[i];
    if (mp) {
      moons.push(...moonCellLayers(cfg, mp, {
        x, y: cy, w: colW, h: rowH, own: 'stack', pad: 3,
        label: PHASE_LABEL[mp.phase],
        date: c.moonTime ? `${MON3[m]} ${mp.day} ${((mp.hour + 11) % 12) + 1}:${String(mp.minute).padStart(2, '0')} ${mp.hour < 12 ? 'AM' : 'PM'}` : `${MON3[m]} ${String(mp.day).padStart(2, '0')}`,
        labelFont: SMALL_FONT, labelColor: c.red, color: c.red, light: '#ffffff',
      }));
      return;
    }
    if (!cell.inMonth && !cfg.showAdj) return;

    const holName = cell.inMonth ? holidays[`${cell.month + 1}-${cell.day}`] : undefined;
    const tag = `${cell.month + 1}-${String(cell.day).padStart(2, '0')}`;
    const other = fold[i];

    if (other) {
      const sc = sharedCell(cfg, { own: 'diagonal', x, y: cy, w: colW, h: rowH, pad: 3, sz: Math.min(rowH * 0.5, colW * 0.46), font: NUM_FONT, a: { day: cell.day, tag, color: redOf(cell) ? c.red : c.blue }, b: { day: other.day, tag: `${other.month + 1}-${String(other.day).padStart(2, '0')}`, color: redOf(other) ? c.red : c.blue } });
      diag.push(...sc.segs);
      nums.push(...sc.nums);
      return;
    }

    const showLabel = holName && cfg.showHolidays;
    const ovl = !!showLabel && isOverlayHoliday(cfg);
    const lab = showLabel && !ovl;
    const numColor = !cell.inMonth ? mix(c.blue, cfg.bg, 0.7) : redOf(cell) ? c.red : c.blue;
    // with a holiday label the number sits a little higher and smaller so the name stays readable
    nums.push(text(`Day ${tag}`, cell.day, x, cy + rowH * 0.01, colW, rowH * (lab ? 0.74 : 0.96), {
      font: NUM_FONT, bold: true, size: Math.min(rowH * (lab ? 0.6 : 0.78), colW * 0.7), color: numColor, align: 'center',
    }));
    if (ovl) {
      tweakHolidayNum(nums[nums.length - 1], cfg);
      hol.push(...holidayOverlay(cfg, holName, { x: x, y: cy, w: colW, h: rowH }, tag, c.red));
    } else if (showLabel) {
      // holiday name printed across the lower part of the date cell, like "NINOY AQUINO DAY" in the sample
      hol.push(text(`Holiday ${tag}`, holName.toUpperCase(), x + 2, cy + rowH * 0.72, colW - 4, rowH * 0.25, {
        font: SMALL_FONT, bold: true, size: Math.min(colW * 0.12, rowH * 0.16), color: c.red, align: 'center', valign: 'middle', fit: true,
      }));
    }
    const here = !moonInBlanks && cell.inMonth ? phases.find((p) => p.day === cell.day) : null;
    if (here) {
      const d = Math.min(rowH * 0.26, colW * 0.26);
      moons.push({
        type: 'moon', name: `Moon ${PHASE_KEY[here.phase]} ${cell.day}`, phase: PHASE_KEY[here.phase], color: c.red, light: '#ffffff',
        x: x + 4, y: cy + 4, w: d, h: d,
      });
    }
  });

  out.push(group('Day cells', boxes));
  if (diag.length) out.push({ type: 'lines', name: 'Shared cell diagonal', segs: diag, color: c.red, lw: 2.4, x: box.x, y: gridY, w: box.w, h: rowH * rows });
  out.push(group('Dates', nums));
  if (hol.length) out.push(group('Holiday labels', hol));
  if (moons.length) out.push(group('Moon phases', moons));
  return group(`${MONTHS[m]} block`, out);
}

/**
 * @param m first month shown on the sheet (0-11, even); the sheet shows m and m + 1
 */
export function tplDuo(ctx, m) {
  return buildDuo(ctx, m, {});
}

/** shared two-month sheet; `v` = { ink, moonTime, wdLight, header(ctx, box, c) } overrides for other looks */
export function buildDuo(ctx, m, v) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const blue = v.ink || (cfg.primary && cfg.primary !== '#1f3a5f' ? cfg.primary : BLUE);
  const red = cfg.weekend === '#d64545' ? RED : cfg.weekend;
  const c = { blue, red, moonTime: v.moonTime, wdLight: v.wdLight };
  const out = [];

  const M = 14;
  const cw = W - 2 * M;
  out.push(rect('Background', 0, 0, W, H, cfg.bg, { bleed: 'ltrb' }));

  // banner (photo + verse)
  const bannerH = H * (v.headerH || 0.275);
  let y = M * 0.8;
  out.push((v.header || banner)(ctx, { x: M, y, w: cw, h: bannerH }, c));
  y += bannerH + H * 0.008;

  // two stacked month blocks
  const gap = H * 0.008;
  const bottom = H - M * 0.7 - 14;
  const blockH = (bottom - y - gap) / 2;
  const sideW = cw * 0.235;
  const gapX = 8;
  const mainW = cw - sideW - gapX;

  const holItems = listHolidays(cfg.holidays, cfg.year);
  const half = Math.ceil(holItems.length / 2);
  const perPanel = [holItems.slice(0, half), holItems.slice(half)];

  [0, 1].forEach((k) => {
    const mon = m + k;
    const by = y + k * (blockH + gap);
    const mainX = k === 0 ? M : M + sideW + gapX;
    const sideX = k === 0 ? M + mainW + gapX : M;
    out.push(monthBlock(ctx, { x: mainX, y: by, w: mainW, h: blockH }, mon, c));

    // mini calendar: previous month beside the first block, next month beside the second
    const mm = k === 0 ? mon - 1 : mon + 1;
    const yr = mm < 0 ? cfg.year - 1 : mm > 11 ? cfg.year + 1 : cfg.year;
    const miniH = blockH * 0.4;
    out.push(miniCal(ctx, { x: sideX, y: by, w: sideW, h: miniH }, yr, (mm + 12) % 12, c));
    const py = by + miniH + blockH * 0.03;
    out.push(sidePanel(ctx, { x: sideX, y: py, w: sideW, h: by + blockH - py }, perPanel[k], c));
  });

  // contact line
  const l1 = [cfg.company, cfg.phone, cfg.email, cfg.website].filter(Boolean).join('   •   ');
  if (l1) out.push(group('Footer notes', [text('Contact details', l1, M, H - M * 0.7 - 12, cw, 13, { font: SMALL_FONT, bold: true, size: 10.5, color: blue, align: 'center', fit: true })]));

  return out;
}
