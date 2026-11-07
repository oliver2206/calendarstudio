// "Philippine navy" template — blue & red wall calendar with a big navy numbers grid,
// "2027 | JANUARY | Year of the Goat" title row, outlined weekday boxes (red SUN),
// holiday names inside the date cells, 24/31 shared cell with a diagonal on 6-week months,
// previous (navy) / next (red) mini calendars and a spaced red HOLIDAYS list in the middle.
import { rect, text, group, sharedCell, monthCells, parseHolidays, MONTHS, WEEKDAYS, mix, isOverlayHoliday, holidayOverlay, tweakHolidayNum } from './layout.js';
import { listHolidays, listReminders } from './templatePhil.js';
import { moonPhasesForMonth } from './moon.js';
import { moonCellLayers } from './moonCell.js';

const NUM_FONT = 'Impact';
const HEAD_FONT = 'Arial Black';
const SMALL_FONT = 'Arial Narrow';
const SERIF = 'Times New Roman';
const NAVY = '#10208f';
const POSTER_RED = '#e8141c';
const PHASE_LABEL = ['NEW MOON', 'FIRST QUARTER', 'FULL MOON', 'LAST QUARTER'];
const PHASE_KEY = ['new', 'fq', 'full', 'lq'];
const ZODIAC = ['Monkey', 'Rooster', 'Dog', 'Pig', 'Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat'];

/** Fold the overflow week into the week above it (e.g. 24 / 31) so the grid never needs a 6th row. */
export function foldCells(cells) {
  let rows = cells.length / 7;
  const fold = {};
  const lastRow = rows - 1;
  const inLast = [];
  for (let col = 0; col < 7; col++) if (cells[lastRow * 7 + col].inMonth) inLast.push(col);
  if (rows === 6 || (rows === 5 && inLast.length === 1)) {
    inLast.forEach((col) => (fold[(lastRow - 1) * 7 + col] = cells[lastRow * 7 + col]));
    rows -= 1;
  }
  return { rows, fold };
}

function miniCal(ctx, box, year, mon, headFill, c) {
  const { cfg } = ctx;
  const cells = monthCells(year, mon, cfg.weekStart);
  const { rows, fold } = foldCells(cells);
  const hols = parseHolidays(cfg.holidays, year);
  const titleH = box.h * 0.16;
  const wdH = box.h * 0.1;
  const px = 4;
  const colW = (box.w - 2 * px) / 7;
  const bodyY = box.y + titleH + wdH + 3;
  const rowH = (box.y + box.h - 4 - bodyY) / rows;
  const out = [rect('Mini background', box.x, box.y, box.w, box.h, '#ffffff')];
  out.push(rect('Mini header', box.x, box.y, box.w, titleH, headFill));
  const ts = titleH * 0.72;
  out.push(text('Mini month', MONTHS[mon].toUpperCase(), box.x + 6, box.y, box.w * 0.6, titleH, { font: HEAD_FONT, bold: true, size: ts, color: '#ffffff', align: 'left', fit: true }));
  out.push(text('Mini year', year, box.x + box.w * 0.55, box.y, box.w * 0.45 - 6, titleH, { font: HEAD_FONT, bold: true, size: ts, color: '#ffffff', align: 'right', fit: true }));
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    out.push(text(`Mini weekday ${WEEKDAYS[dow]}`, WEEKDAYS[dow].toUpperCase(), box.x + px + i * colW, box.y + titleH + 1, colW, wdH, {
      font: HEAD_FONT, bold: true, size: Math.min(wdH * 0.62, colW * 0.3), color: dow === 0 ? c.red : c.ink, align: 'center', fit: true,
    }));
  }
  const isRed = (cell) => cell.dow === 0 || !!hols[`${cell.month + 1}-${cell.day}`];
  const lines = [];
  cells.slice(0, rows * 7).forEach((cell, i) => {
    if (!cell.inMonth) return;
    const r = Math.floor(i / 7);
    const col = i % 7;
    const x = box.x + px + col * colW;
    const y = bodyY + r * rowH;
    const other = fold[i];
    if (other) {
      lines.push([x + colW - 1, y + 1, x + 1, y + rowH - 1]);
      const sz = Math.min(rowH * 0.5, colW * 0.4);
      out.push(text(`Mini day ${cell.day}`, cell.day, x, y, colW * 0.65, rowH * 0.62, { font: c.body, bold: true, size: sz, color: isRed(cell) ? c.red : c.ink, align: 'left', valign: 'top' }));
      out.push(text(`Mini day ${other.day}`, other.day, x + colW * 0.35, y + rowH * 0.38, colW * 0.65, rowH * 0.62, { font: c.body, bold: true, size: sz, color: isRed(other) ? c.red : c.ink, align: 'right', valign: 'bottom' }));
      return;
    }
    out.push(text(`Mini day ${cell.day}`, cell.day, x, y, colW, rowH, {
      font: c.body, bold: true, size: Math.min(rowH * 0.7, colW * 0.52), color: isRed(cell) ? c.red : c.ink, align: 'center',
    }));
  });
  if (lines.length) out.push({ type: 'lines', name: 'Mini fold diagonal', segs: lines, color: c.ink, lw: 1, x: box.x, y: bodyY, w: box.w, h: rows * rowH });
  out.push(rect('Mini border', box.x, box.y, box.w, box.h, null, { stroke: c.ink, strokeW: 2.5 }));
  return group(`Mini calendar ${MONTHS[mon]}`, out);
}

export function tplNavy(ctx, m) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const land = W > H;
  const ink = '#000000';
  const navy = cfg.primary && cfg.primary !== '#1f3a5f' ? cfg.primary : NAVY;
  const red = cfg.weekend === '#d64545' ? POSTER_RED : cfg.weekend;
  const body = cfg.bodyFont;
  const c = { ink, red, body };
  const out = [];

  const M = 38;
  const cw = W - 2 * M;
  out.push(rect('Background', 0, 0, W, H, cfg.bg, { bleed: 'ltrb' }));

  let y = M * 0.9;
  /* ---- photo / ads area (portrait only) ---- */
  if (!land) {
    const box = { x: M, y, w: cw, h: H * 0.265 };
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
        text('Photo label', 'YOUR PHOTO / ADS HERE', box.x, box.y, box.w, box.h, { font: HEAD_FONT, bold: true, size: 60, color: mix(navy, '#ffffff', 0.7), align: 'center', fit: true }),
      ]));
    }
    y += box.h + H * 0.012;
  }

  /* ---- title row:  2027 | JANUARY bar | Year of the Goat ---- */
  const barH = land ? H * 0.09 : H * 0.06;
  const yearW = cw * 0.265;
  const barX = M + cw * 0.285;
  const barW = cw * 0.445;
  out.push(group('Title row', [
    text('Year', cfg.year, M, y, yearW, barH, { font: NUM_FONT, bold: true, size: barH * 1.12, color: navy, align: 'left', fit: true }),
    rect('Month bar', barX, y, barW, barH, navy),
    text('Month', MONTHS[m].toUpperCase(), barX, y, barW, barH, { font: NUM_FONT, bold: true, size: barH * 1.0, color: '#ffffff', align: 'center', fit: true }),
  ]));
  const animal = ZODIAC[((Number(cfg.year) % 12) + 12) % 12];
  const zx = barX + barW + cw * 0.025;
  const zw = M + cw - zx;
  const zodiac = [];
  const isGoat = animal === 'Goat';
  const iconW = isGoat ? zw * 0.46 : 0;
  if (isGoat) zodiac.push({ type: 'goat', name: 'Zodiac goat', color: red, x: zx, y: y - barH * 0.02, w: iconW, h: barH * 1.04 });
  const tx = zx + iconW + zw * 0.03;
  const tw = zx + zw - tx;
  const ls = barH * 0.3;
  ['YEAR', 'OF THE', animal.toUpperCase()].forEach((s, i) => {
    zodiac.push(text(`Zodiac text ${i + 1}`, s, tx, y + barH * 0.05 + i * ls * 1.08, tw, ls * 1.1, { font: SERIF, bold: true, size: ls, color: ink, align: 'center', fit: true }));
  });
  out.push(group('Year of the animal', zodiac));
  y += barH + H * 0.009;

  /* ---- weekday row ---- */
  const colW = cw / 7;
  const wdH = land ? H * 0.06 : H * 0.032;
  const wd = [];
  const gap = 7;
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    const nm = WEEKDAYS[dow];
    const bx = M + i * colW + gap / 2;
    wd.push(rect(`Weekday box ${nm}`, bx, y, colW - gap, wdH, '#ffffff', { stroke: ink, strokeW: 2 }));
    wd.push(text(`Weekday ${nm}`, nm.toUpperCase(), bx, y, colW - gap, wdH, { font: NUM_FONT, bold: true, size: wdH * 0.78, color: dow === 0 ? red : navy, align: 'center', fit: true }));
  }
  out.push(group('Weekday headers', wd));
  y += wdH + H * 0.007;

  /* ---- bottom block geometry ---- */
  const miniH = land ? H * 0.22 : H * 0.118;
  const noteH = 18;
  const miniY = H - M * 0.7 - noteH - miniH;
  const gridY = y;
  const gridH = miniY - H * 0.01 - gridY;

  /* ---- day grid ---- */
  const cells = monthCells(cfg.year, m, cfg.weekStart);
  const { rows, fold } = foldCells(cells);
  const rowH = gridH / rows;
  const holidays = ctx.holidays;
  const boxes = [];
  const nums = [];
  const hol = [];
  const diag = [];
  const moons = [];

  /* moon phases go in the empty cells (same rule as the other moon templates); with no room they mark the day instead */
  const phases = cfg.showMoon ? moonPhasesForMonth(cfg.year, m, Number(cfg.utcOffset) || 0) : [];
  const blankIdx = [];
  cells.slice(0, rows * 7).forEach((cell, i) => !cell.inMonth && blankIdx.push(i));
  const moonInBlanks = phases.length > 0 && blankIdx.length >= phases.length;
  const moonCellOf = {};
  if (moonInBlanks) phases.forEach((p, j) => (moonCellOf[blankIdx[j]] = p));

  cells.slice(0, rows * 7).forEach((cell, i) => {
    const r = Math.floor(i / 7);
    const col = i % 7;
    const x = M + col * colW;
    const cy = gridY + r * rowH;
    boxes.push(rect(`Cell ${i + 1}`, x, cy, colW, rowH, '#ffffff', { stroke: ink, strokeW: 2 }));

    const mp = moonCellOf[i];
    if (mp) {
      moons.push(...moonCellLayers(cfg, mp, {
        x, y: cy, w: colW, h: rowH, own: 'stack', pad: 4,
        label: PHASE_LABEL[mp.phase], date: `${MONTHS[m].slice(0, 3).toUpperCase()} ${String(mp.day).padStart(2, '0')}`,
        labelFont: SMALL_FONT, labelColor: red, dateColor: navy, color: red, light: '#ffffff',
      }));
      return;
    }
    if (!cell.inMonth && !cfg.showAdj) return;

    const holName = cell.inMonth ? holidays[`${cell.month + 1}-${cell.day}`] : undefined;
    const isRed = cell.dow === 0 || !!holName;
    const numColor = !cell.inMonth ? mix(navy, cfg.bg, 0.78) : isRed ? red : navy;
    const tag = `${cell.month + 1}-${String(cell.day).padStart(2, '0')}`;
    const other = fold[i];
    if (!moonInBlanks) {
      // moon mark in the corner of the date cell; in the shared cell (24 / 31) each day gets its own corner
      const mk = (c, pos) => {
        const here = c && c.inMonth ? phases.find((p) => p.day === c.day) : null;
        if (!here) return;
        const d = Math.min(rowH * 0.22, colW * 0.22);
        moons.push({
          type: 'moon', name: `Moon ${PHASE_KEY[here.phase]} ${c.day}`, phase: PHASE_KEY[here.phase], color: red, light: '#ffffff',
          x: pos === 'bl' ? x + 5 : x + colW - d - 5, y: pos === 'tr' ? cy + 5 : cy + rowH - d - 5, w: d, h: d,
        });
      };
      mk(cell, other ? 'tr' : 'br');
      if (other) mk(other, 'bl');
    }

    if (other) {
      const redOf = (d) => d.dow === 0 || !!holidays[`${d.month + 1}-${d.day}`];
      const sc = sharedCell(cfg, { own: 'diagonal', x, y: cy, w: colW, h: rowH, pad: 4, sz: Math.min(rowH * 0.46, colW * 0.46), font: NUM_FONT, a: { day: cell.day, tag, color: redOf(cell) ? red : navy }, b: { day: other.day, tag: `${other.month + 1}-${String(other.day).padStart(2, '0')}`, color: redOf(other) ? red : navy } });
      diag.push(...sc.segs);
      nums.push(...sc.nums);
      return;
    }

    const showLabel = holName && cfg.showHolidays;
    const ovl = !!showLabel && isOverlayHoliday(cfg);
    const lab = showLabel && !ovl;
    const top = lab ? rowH * 0.2 : rowH * 0.04;
    nums.push(text(`Day ${tag}`, cell.day, x, cy + top, colW, rowH - top - rowH * 0.04, {
      font: NUM_FONT, bold: true, size: Math.min(rowH * (lab ? 0.56 : 0.66), colW * 0.78), color: numColor, align: 'center',
    }));
    if (ovl) {
      tweakHolidayNum(nums[nums.length - 1], cfg);
      hol.push(...holidayOverlay(cfg, holName, { x: x, y: cy, w: colW, h: rowH }, tag, red));
    } else if (showLabel) {
      hol.push(text(`Holiday ${tag}`, holName.toUpperCase(), x + 3, cy + rowH * 0.05, colW - 6, rowH * 0.16, {
        font: HEAD_FONT, bold: true, size: Math.min(colW * 0.085, rowH * 0.1), color: ink, align: 'center', fit: true,
      }));
    }
  });

  out.push(group('Day cells', boxes));
  out.push(rect('Grid border', M, gridY, cw, rowH * rows, null, { stroke: ink, strokeW: 3.5 }));
  if (diag.length) out.push({ type: 'lines', name: 'Shared cell diagonal', segs: diag, color: ink, lw: 2, x: M, y: gridY, w: cw, h: rowH * rows });
  out.push(group('Dates', nums));
  if (hol.length) out.push(group('Holiday labels', hol));
  if (moons.length) out.push(group('Moon phases', moons));

  /* ---- bottom: previous month | holidays + reminders | next month ---- */
  const miniW = cw * 0.296;
  const prevM = (m + 11) % 12;
  const nextM = (m + 1) % 12;
  out.push(miniCal(ctx, { x: M, y: miniY, w: miniW, h: miniH }, m === 0 ? cfg.year - 1 : cfg.year, prevM, navy, c));
  out.push(miniCal(ctx, { x: M + cw - miniW, y: miniY, w: miniW, h: miniH }, m === 11 ? cfg.year + 1 : cfg.year, nextM, red, c));

  const items = listHolidays(cfg.holidays, cfg.year);
  const rem = listReminders(cfg.reminders, m + 1);
  const bx = M + miniW + 10;
  const bwid = cw - 2 * miniW - 20;
  if (items.length || rem.length) {
    const mid = [];
    const title = cfg.holidaysTitle === 'LEGAL HOLIDAYS' ? 'HOLIDAYS' : cfg.holidaysTitle.toUpperCase();
    const headH = miniH * 0.16;
    mid.push(text('Holidays title', [...title].join(' ').replace(/ {2}/g, '   '), bx, miniY, bwid, headH, {
      font: HEAD_FONT, bold: true, size: headH * 0.82, color: red, align: 'center', fit: true,
    }));
    let yy = miniY + headH + 4;
    const avail = miniY + miniH - 2 - yy;
    if (items.length) {
      const share = rem.length ? 0.62 : 1;
      const perCol = Math.ceil(items.length / 2);
      const itemH = Math.min(17, (avail * share) / perCol);
      const colWid = bwid / 2 - 6;
      const dateW = colWid * 0.2;
      items.forEach((it, k) => {
        const col = k < perCol ? 0 : 1;
        const row = col === 0 ? k : k - perCol;
        const cx = bx + 4 + col * (bwid / 2);
        const ry = yy + row * itemH;
        mid.push(text(`Holiday date ${k + 1}`, `${it.d} ${MONTHS[it.m - 1].slice(0, 3).toUpperCase()}`, cx, ry, dateW, itemH, {
          font: SMALL_FONT, bold: true, size: itemH * 0.8, color: red, align: 'left', fit: true,
        }));
        mid.push(text(`Holiday name ${k + 1}`, it.name.toUpperCase(), cx + dateW + 4, ry, colWid - dateW - 4, itemH, {
          font: SMALL_FONT, bold: true, size: itemH * 0.8, color: navy, align: 'left', fit: true,
        }));
      });
      yy += avail * share;
    }
    if (rem.length) {
      const itemH = Math.min(15, (miniY + miniH - 2 - yy - 14) / rem.length);
      mid.push(text('Reminders title', cfg.remindersTitle.toUpperCase(), bx + 8, yy, bwid - 16, 14, { font: HEAD_FONT, bold: true, size: 10, color: ink, align: 'center', fit: true }));
      rem.forEach((it, k) => {
        mid.push(text(`Reminder ${k + 1}`, `${it.d}  -  ${it.text}`, bx + 10, yy + 14 + k * itemH, bwid - 20, itemH, { font: SMALL_FONT, bold: true, size: itemH * 0.8, color: red, fit: true }));
      });
    }
    out.push(group('Holidays and reminders', mid));
  }

  /* ---- contact line ---- */
  const l1 = [cfg.company, cfg.phone, cfg.email, cfg.website].filter(Boolean).join('   •   ');
  if (l1) out.push(group('Footer notes', [text('Contact details', l1, M, H - M * 0.7 - noteH + 3, cw, noteH - 3, { font: SMALL_FONT, bold: true, size: 12, color: navy, align: 'center', fit: true })]));

  return out;
}
