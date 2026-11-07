// "Big black & red" template — built from the supplied January 2026 wall-calendar design:
//   2026 | JANUARY | 2026 title row (red years, black month), black weekday bar with a red SUN box,
//   thin-ruled grid with huge Impact numbers (Sundays + holidays in red), holiday names inside the date cell,
//   moon-phase info (name, date, grey moon face) in the empty cells, 24/31 shared cell on 6-week months,
//   previous / next month mini calendars and a two-column red "• LEGAL HOLIDAYS •" list in the middle.
// Landscape matches the sample; in portrait an ad / photo / logo area is added on top.
import { rect, text, group, sharedCell, monthCells, parseHolidays, MONTHS, WEEKDAYS, mix, isOverlayHoliday, holidayOverlay, tweakHolidayNum } from './layout.js';
import { moonCellLayers } from './moonCell.js';
import { moonPhasesForMonth } from './moon.js';
import { listHolidays, listReminders } from './templatePhil.js';

const NUM_FONT = 'Impact';
const HEAD_FONT = 'Arial Black';
const SMALL_FONT = 'Arial Narrow';
const POSTER_RED = '#e4151c';
const MOON_GREY = '#6e6e6e';
const PHASE_LABEL = ['NEW MOON', '1ST QUARTER', 'FULL MOON', 'LAST QUARTER'];
const PHASE_KEY = ['new', 'fq', 'full', 'lq'];
const MON3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function miniCal(ctx, box, year, mon, c) {
  const { cfg } = ctx;
  const cells = monthCells(year, mon, cfg.weekStart);
  const rows = cells.length / 7;
  const hols = parseHolidays(cfg.holidays, year);
  const titleH = box.h * 0.17;
  const wdH = box.h * 0.12;
  const colW = box.w / 7;
  const bodyY = box.y + titleH + wdH + 2;
  const rowH = (box.y + box.h - bodyY - 1) / rows;
  const out = [rect('Mini background', box.x, box.y, box.w, box.h, c.panel || cfg.bg)];

  out.push(text('Mini title', `${MONTHS[mon].toUpperCase()} ${year}`, box.x, box.y, box.w, titleH, {
    font: HEAD_FONT, bold: true, size: titleH * 0.74, color: c.soft ? c.red : c.ink, align: 'center', fit: true,
  }));
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    const nm = WEEKDAYS[dow];
    if (!c.soft) out.push(rect(`Mini weekday box ${nm}`, box.x + i * colW + 0.75, box.y + titleH, colW - 1.5, wdH, dow === 0 ? c.red : c.ink));
    out.push(text(`Mini weekday ${nm}`, nm.toUpperCase(), box.x + i * colW, box.y + titleH, colW, wdH, {
      font: HEAD_FONT, bold: true, size: Math.min(wdH * 0.62, colW * 0.3), color: c.soft ? (dow === 0 ? c.red : c.ink) : '#ffffff', align: 'center', fit: true,
    }));
  }
  const segs = [];
  for (let r = 1; r < rows; r++) segs.push([box.x, bodyY + r * rowH, box.x + box.w, bodyY + r * rowH]);
  if (segs.length) out.push({ type: 'lines', name: 'Mini row lines', segs, color: c.soft ? c.red : mix(c.ink, cfg.bg, 0.72), lw: 1, x: box.x, y: bodyY, w: box.w, h: rows * rowH });
  cells.forEach((cell, i) => {
    if (!cell.inMonth) return;
    const r = Math.floor(i / 7);
    const col = i % 7;
    const red = cell.dow === 0 || !!hols[`${mon + 1}-${cell.day}`];
    out.push(text(`Mini day ${cell.day}`, cell.day, box.x + col * colW, bodyY + r * rowH, colW, rowH, {
      font: SMALL_FONT, bold: true, size: Math.min(rowH * 0.78, colW * 0.5), color: red ? c.red : c.ink, align: 'center',
    }));
  });
  return group(`Mini calendar ${MONTHS[mon]}`, out);
}

export function tplBigBlack(ctx, m) {
  return buildBigBlack(ctx, m, {});
}

/** v = look overrides: { accent, soft, panel, background, wdFill, wdText, cellFill, cellStroke, cellW, yearColor, month } */
export function buildBigBlack(ctx, m, v) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const land = W > H;
  const ink = cfg.themeB || '#000000';
  const red = v.accent ? (cfg.weekend === '#d64545' ? v.accent : cfg.weekend) : cfg.weekend === '#d64545' ? POSTER_RED : cfg.weekend;
  const c = { ink, red, body: cfg.bodyFont, soft: v.soft, panel: v.panel };
  const out = [];

  const M = 16;
  const cw = W - 2 * M;
  if (v.background) out.push(v.background(ctx, { W, H, m }, c));
  else out.push(rect('Background', 0, 0, W, H, cfg.bg, { bleed: 'ltrb' }));

  let y = M * 0.8;
  /* ---- photo / ads area (portrait only) ---- */
  if (!land) {
    const box = { x: M, y, w: cw, h: H * 0.27 };
    if (ctx.photo) {
      out.push(group('Photo', [
        { type: 'image', name: 'Photo', img: ctx.photo, fit: 'cover', zoom: cfg.photoZoom, fx: cfg.photoFx, fy: cfg.photoFy, ...box, radius: 0 },
        rect('Photo border', box.x, box.y, box.w, box.h, null, { stroke: ink, strokeW: 2 }),
      ]));
    } else if (ctx.logo) {
      out.push(group('Logo', [{ type: 'image', name: 'Logo', img: ctx.logo, fit: 'contain', ...box }, rect('Logo border', box.x, box.y, box.w, box.h, null, { stroke: ink, strokeW: 2 })]));
    } else {
      out.push(group('Photo or ads area (replace me)', [
        rect('Photo box', box.x, box.y, box.w, box.h, '#ffffff', { stroke: ink, strokeW: 2 }),
        text('Photo label', 'YOUR PHOTO / ADS HERE', box.x, box.y, box.w, box.h, { font: HEAD_FONT, bold: true, size: 60, color: mix(ink, '#ffffff', 0.82), align: 'center', fit: true }),
      ]));
    }
    y += box.h + H * 0.008;
  }

  /* ---- title row:  2026 | JANUARY | 2026 ---- */
  const barH = land ? H * 0.098 : H * 0.062;
  const yearW = cw * 0.17;
  out.push(group('Title row', [
    text('Year left', cfg.year, M, y, yearW, barH, { font: NUM_FONT, bold: true, size: barH * 1.12, color: v.yearColor || red, align: 'left', fit: true }),
    v.month ? v.month(MONTHS[m], M + yearW, y, cw - 2 * yearW, barH, c) : text('Month', MONTHS[m].toUpperCase(), M + yearW, y, cw - 2 * yearW, barH, { font: HEAD_FONT, bold: true, size: barH * 0.98, color: ink, align: 'center', fit: true }),
    text('Year right', cfg.year, M + cw - yearW, y, yearW, barH, { font: NUM_FONT, bold: true, size: barH * 1.12, color: v.yearColor || red, align: 'right', fit: true }),
  ]));
  y += barH + H * 0.004;

  /* ---- weekday bar (black, red SUN) ---- */
  const colW = cw / 7;
  const wdH = land ? H * 0.044 : H * 0.03;
  const wd = [];
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    const nm = WEEKDAYS[dow];
    wd.push(rect(`Weekday box ${nm}`, M + i * colW + (v.wdFill ? 0 : 0.75), y, colW - (v.wdFill ? 0 : 1.5), wdH, v.wdFill ? v.wdFill(dow) : dow === 0 ? red : ink));
    wd.push(text(`Weekday ${nm}`, nm.toUpperCase(), M + i * colW, y, colW, wdH, {
      font: HEAD_FONT, bold: true, size: wdH * 0.62, color: v.wdText ? v.wdText(dow) : '#ffffff', align: 'center', fit: true,
    }));
  }
  out.push(group('Weekday headers', wd));
  y += wdH;

  /* ---- bottom block geometry ---- */
  const noteH = 16;
  const miniH = land ? H * 0.2 : H * 0.118;
  const miniY = H - M * 0.5 - noteH - miniH;
  const gridY = y;
  const gridH = miniY - H * 0.008 - gridY;

  /* ---- day grid ---- */
  // always a 7 x 5 grid: 6-week months fold the overflow days into the row above (24/31),
  // 4-week months get a spare row of next-month days (hidden unless "show previous/next month days" is on)
  const cells = monthCells(cfg.year, m, cfg.weekStart);
  const rows = 5;
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
  const rowH = gridH / rows;
  const holidays = ctx.holidays;

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
  const redOf = (d) => d.dow === 0 || !!holidays[`${d.month + 1}-${d.day}`];

  cells.slice(0, rows * 7).forEach((cell, i) => {
    const r = Math.floor(i / 7);
    const col = i % 7;
    const x = M + col * colW;
    const cy = gridY + r * rowH;
    boxes.push(rect(`Cell ${i + 1}`, x, cy, colW, rowH, v.cellFill || cfg.bg, { stroke: v.cellStroke || ink, strokeW: v.cellW || 1.4 }));

    /* moon phase cell: name + date at the top-left, grey moon face at the right */
    const mp = moonCellOf[i];
    if (mp) {
      moons.push(...moonCellLayers(cfg, mp, {
        x, y: cy, w: colW, h: rowH, own: 'textleft', pad: 5,
        label: PHASE_LABEL[mp.phase], date: `${MON3[m]} ${String(mp.day).padStart(2, '0')}`,
        labelFont: SMALL_FONT, labelColor: ink, color: cfg.themeA || MOON_GREY, light: '#ffffff',
      }));
      return;
    }
    if (!cell.inMonth && !cfg.showAdj) return;

    const holName = cell.inMonth ? holidays[`${cell.month + 1}-${cell.day}`] : undefined;
    const tag = `${cell.month + 1}-${String(cell.day).padStart(2, '0')}`;
    const other = fold[i];

    /* two days sharing one cell (24 / 31) */
    if (other) {
      const sc = sharedCell(cfg, { own: 'diagonal', x, y: cy, w: colW, h: rowH, pad: 4, sz: Math.min(rowH * 0.5, colW * 0.46), font: NUM_FONT, a: { day: cell.day, tag, color: redOf(cell) ? red : ink }, b: { day: other.day, tag: `${other.month + 1}-${String(other.day).padStart(2, '0')}`, color: redOf(other) ? red : ink } });
      diag.push(...sc.segs);
      nums.push(...sc.nums);
      return;
    }

    const showLabel = holName && cfg.showHolidays;
    const ovl = !!showLabel && isOverlayHoliday(cfg);
    const lab = showLabel && !ovl;
    const numColor = !cell.inMonth ? mix(ink, cfg.bg, 0.78) : redOf(cell) ? red : ink;
    const top = lab ? rowH * 0.1 : rowH * 0.02;
    nums.push(text(`Day ${tag}`, cell.day, x, cy + top, colW, rowH - top - rowH * 0.02, {
      font: NUM_FONT, bold: true, size: Math.min(rowH * (lab ? 0.74 : 0.8), colW * 0.7), color: numColor, align: 'center',
    }));
    if (ovl) {
      tweakHolidayNum(nums[nums.length - 1], cfg);
      hol.push(...holidayOverlay(cfg, holName, { x: x, y: cy, w: colW, h: rowH }, tag, red));
    } else if (showLabel) {
      hol.push(text(`Holiday ${tag}`, holName.toUpperCase(), x + 4, cy + rowH * 0.05, colW * 0.62, rowH * 0.3, {
        font: SMALL_FONT, bold: true, size: Math.min(colW * 0.1, rowH * 0.14), color: ink, align: 'left', valign: 'top', fit: true,
      }));
    }
    // no empty cell left for the moon faces: put a small face in the corner of the day instead
    const here = !moonInBlanks && cell.inMonth ? phases.find((p) => p.day === cell.day) : null;
    if (here) {
      const d = Math.min(rowH * 0.26, colW * 0.26);
      moons.push({
        type: 'moon', name: `Moon ${PHASE_KEY[here.phase]} ${cell.day}`, phase: PHASE_KEY[here.phase], color: cfg.themeA || MOON_GREY, light: '#ffffff',
        x: x + 5, y: cy + rowH - d - 4, w: d, h: d,
      });
    }
  });

  out.push(group('Day cells', boxes));
  if (diag.length) out.push({ type: 'lines', name: 'Shared cell diagonal', segs: diag, color: v.soft ? red : ink, lw: 1.6, x: M, y: gridY, w: cw, h: rowH * rows });
  out.push(group('Dates', nums));
  if (hol.length) out.push(group('Holiday labels', hol));
  if (moons.length) out.push(group('Moon phases', moons));

  if (v.panel) out.push(rect('Bottom panel', M, miniY - 2, cw, miniH + 4, v.panel));
  /* ---- bottom: previous month | legal holidays | next month ---- */
  const miniW = cw * 0.268;
  const prevM = (m + 11) % 12;
  const nextM = (m + 1) % 12;
  out.push(miniCal(ctx, { x: M, y: miniY, w: miniW, h: miniH }, m === 0 ? cfg.year - 1 : cfg.year, prevM, c));
  out.push(miniCal(ctx, { x: M + cw - miniW, y: miniY, w: miniW, h: miniH }, m === 11 ? cfg.year + 1 : cfg.year, nextM, c));

  const items = listHolidays(cfg.holidays, cfg.year);
  const rem = listReminders(cfg.reminders, m + 1);
  const bx = M + miniW + 12;
  const bwid = cw - 2 * miniW - 24;
  if (items.length || rem.length) {
    const mid = [];
    const headH = miniH * 0.13;
    mid.push(text('Holidays title', `•  ${cfg.holidaysTitle.toUpperCase()}  •`, bx, miniY, bwid, headH, {
      font: HEAD_FONT, bold: true, size: headH * 0.82, color: red, align: 'center', fit: true,
    }));
    const yy = miniY + headH + 3;
    const avail = miniY + miniH - 1 - yy;
    let used = 0;
    if (items.length) {
      const share = rem.length ? 0.64 : 1;
      const perCol = Math.ceil(items.length / 2);
      const itemH = Math.min(15, (avail * share) / perCol);
      const colWid = bwid / 2 - 6;
      const dateW = colWid * 0.24;
      items.forEach((it, k) => {
        const col = k < perCol ? 0 : 1;
        const row = col === 0 ? k : k - perCol;
        const cx = bx + 2 + col * (bwid / 2 + 2);
        const ry = yy + row * itemH;
        mid.push(text(`Holiday date ${k + 1}`, `${String(it.d).padStart(2, '0')} ${MON3[it.m - 1]}`, cx, ry, dateW, itemH, {
          font: SMALL_FONT, bold: true, size: itemH * 0.82, color: red, align: 'left', fit: true,
        }));
        mid.push(text(`Holiday name ${k + 1}`, it.name.toUpperCase(), cx + dateW + 4, ry, colWid - dateW - 4, itemH, {
          font: SMALL_FONT, bold: true, size: itemH * 0.82, color: ink, align: 'left', fit: true,
        }));
      });
      used = avail * share;
    }
    if (rem.length) {
      const ry0 = yy + used;
      const itemH = Math.min(14, (miniY + miniH - 1 - ry0 - 13) / rem.length);
      mid.push(text('Reminders title', cfg.remindersTitle.toUpperCase(), bx + 8, ry0, bwid - 16, 13, { font: HEAD_FONT, bold: true, size: 9.5, color: ink, align: 'center', fit: true }));
      rem.forEach((it, k) => {
        mid.push(text(`Reminder ${k + 1}`, `${it.d}  -  ${it.text}`, bx + 8, ry0 + 13 + k * itemH, bwid - 16, itemH, {
          font: SMALL_FONT, bold: true, size: itemH * 0.82, color: red, fit: true,
        }));
      });
    }
    out.push(group('Holidays and reminders', mid));
  }

  /* ---- contact line ---- */
  const l1 = [cfg.company, cfg.phone, cfg.email, cfg.website].filter(Boolean).join('   •   ');
  if (l1) out.push(group('Footer notes', [text('Contact details', l1, M, H - M * 0.5 - noteH + 2, cw, noteH - 2, { font: SMALL_FONT, bold: true, size: 11, color: ink, align: 'center', fit: true })]));

  return out;
}
