// "Two-month black & red ornate" template — built from the supplied January + February 2027 sheet:
//   patterned key border around the whole page, ADS OR LOGO area on top, then two month blocks on one page.
//   Each block: `01 | JANUARY | 2027` title bar (black / red / black), SUN-red weekday row, thin-ruled cells with huge
//   Impact numbers, tide times above (blue = high) and below (red = low) the dates, small lunar-day characters,
//   moon faces in the empty cells, 24/31 shared cell on 6-week months.
//   Beside block 1: mini previous-month calendar + red "legal holidays" box.
//   Beside block 2: red ruled notes lines + mini next-month calendar (panels alternate sides).
//   One page = two months, so the project has cover + 6 sheets. Portrait paper works best.
import { rect, text, group, monthCells, parseHolidays, MONTHS, WEEKDAYS, mix, isOverlayHoliday, holidayOverlay, tweakHolidayNum } from './layout.js';
import { moonCellLayers } from './moonCell.js';
import { moonPhasesForMonth } from './moon.js';
import { lunarDay, lunarChars } from './lunar.js';
import { parseTides } from './tides.js';
import { listHolidays } from './templatePhil.js';

const PHASE_LABEL = ['NEW MOON', 'FIRST QUARTER', 'FULL MOON', 'LAST QUARTER'];
const PHASE_KEY = ['new', 'fq', 'full', 'lq'];
const NUM_FONT = 'Impact';
const HEAD_FONT = 'Arial Black';
const SMALL_FONT = 'Arial Narrow';
const CJK_FONT = 'SimSun';
const POSTER_RED = '#ee2a1f';
const TIDE_BLUE = '#1c3f9e';
const MON3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function miniCal(ctx, box, year, mon, c) {
  const { cfg } = ctx;
  const cells = monthCells(year, mon, cfg.weekStart);
  const rows = cells.length / 7;
  const hols = parseHolidays(cfg.holidays, year);
  const titleH = box.h * 0.17;
  const wdH = box.h * 0.12;
  const px = 5;
  const colW = (box.w - 2 * px) / 7;
  const bodyY = box.y + titleH + wdH;
  const rowH = (box.y + box.h - 6 - bodyY) / rows;
  const out = [rect('Mini background', box.x, box.y, box.w, box.h, '#ffffff')];

  const n1 = box.w * 0.16;
  const n3 = box.w * 0.3;
  out.push(rect('Mini number box', box.x, box.y, n1, titleH, c.ink));
  out.push(rect('Mini month box', box.x + n1, box.y, box.w - n1 - n3, titleH, c.red));
  out.push(rect('Mini year box', box.x + box.w - n3, box.y, n3, titleH, c.ink));
  const ts = titleH * 0.66;
  out.push(text('Mini month number', String(mon + 1).padStart(2, '0'), box.x, box.y, n1, titleH, { font: HEAD_FONT, bold: true, size: ts, color: '#ffffff', align: 'center', fit: true }));
  out.push(text('Mini month', MONTHS[mon].toUpperCase(), box.x + n1, box.y, box.w - n1 - n3, titleH, { font: HEAD_FONT, bold: true, size: ts, color: '#ffffff', align: 'center', fit: true }));
  out.push(text('Mini year', year, box.x + box.w - n3, box.y, n3, titleH, { font: HEAD_FONT, bold: true, size: ts, color: '#ffffff', align: 'center', fit: true }));
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    out.push(text(`Mini weekday ${WEEKDAYS[dow]}`, WEEKDAYS[dow].toUpperCase(), box.x + px + i * colW, box.y + titleH, colW, wdH, {
      font: HEAD_FONT, bold: true, size: Math.min(wdH * 0.62, colW * 0.36), color: dow === 0 ? c.red : c.ink, align: 'center', fit: true,
    }));
  }
  cells.forEach((cell, i) => {
    if (!cell.inMonth) return;
    const r = Math.floor(i / 7);
    const col = i % 7;
    const red = cell.dow === 0 || hols[`${mon + 1}-${cell.day}`];
    out.push(text(`Mini day ${cell.day}`, cell.day, box.x + px + col * colW, bodyY + r * rowH, colW, rowH, {
      font: c.body, bold: true, size: Math.min(rowH * 0.66, colW * 0.52), color: red ? c.red : c.ink, align: 'center',
    }));
  });
  out.push(rect('Mini border', box.x, box.y, box.w, box.h, null, { stroke: c.ink, strokeW: 3.5 }));
  return group(`Mini calendar ${MONTHS[mon]}`, out);
}

function holidayBox(ctx, box, c) {
  const { cfg } = ctx;
  const items = listHolidays(cfg.holidays, cfg.year);
  if (!items.length) return null;
  const out = [];
  const headH = Math.min(box.h * 0.12, 26);
  out.push(rect('Holiday box fill', box.x, box.y, box.w, box.h, '#ffffff', { radius: 12 }));
  out.push(rect('Holiday box header', box.x + 3, box.y + 3, box.w - 6, headH, c.red, { radius: 9 }));
  out.push(text('Holidays title', cfg.holidaysTitle.toUpperCase(), box.x + 6, box.y + 3, box.w - 12, headH, {
    font: HEAD_FONT, bold: true, size: headH * 0.62, color: '#ffffff', align: 'center', fit: true,
  }));
  out.push(rect('Holiday box border', box.x, box.y, box.w, box.h, null, { radius: 12, stroke: c.red, strokeW: 4 }));
  const yy = box.y + headH + 9;
  const avail = box.y + box.h - 8 - yy;
  const itemH = Math.min(17, avail / items.length);
  const dateW = (box.w - 24) * 0.3;
  items.forEach((it, k) => {
    const ry = yy + k * itemH;
    out.push(text(`Holiday date ${k + 1}`, `${MON3[it.m - 1]}  ${String(it.d).padStart(2, '0')}`, box.x + 12, ry, dateW, itemH, {
      font: SMALL_FONT, bold: true, size: itemH * 0.85, color: c.red, align: 'left', fit: true,
    }));
    out.push(text(`Holiday name ${k + 1}`, it.name.toUpperCase(), box.x + 12 + dateW, ry, box.w - 24 - dateW, itemH, {
      font: SMALL_FONT, bold: true, size: itemH * 0.85, color: c.red, align: 'left', fit: true,
    }));
  });
  return group('Legal holidays', out);
}

function notesLines(box, c) {
  const step = 21;
  const n = Math.floor(box.h / step);
  const segs = [];
  for (let k = 1; k <= n; k++) segs.push([box.x + 2, box.y + k * step, box.x + box.w - 2, box.y + k * step]);
  if (!segs.length) return null;
  return { type: 'lines', name: 'Notes lines', segs, color: c.red, lw: 1.6, x: box.x, y: box.y, w: box.w, h: n * step + 2 };
}

// one month: title bar + weekday row + 7x5 grid
function monthBlock(ctx, box, m, c) {
  const { cfg } = ctx;
  const { ink, red } = c;
  const out = [];
  const fx = box.x;
  const cw = box.w;

  /* ---- title bar:  01 | JANUARY | 2027 ---- */
  let y = box.y;
  const barH = box.h * 0.095;
  const wL = cw * 0.155;
  const wR = cw * 0.265;
  const ts = barH * 0.8;
  out.push(group('Title bar', [
    rect('Bar number', fx, y, wL, barH, ink),
    rect('Bar month', fx + wL, y, cw - wL - wR, barH, red),
    rect('Bar year', fx + cw - wR, y, wR, barH, ink),
    text('Month number', String(m + 1).padStart(2, '0'), fx, y, wL, barH, { font: HEAD_FONT, bold: true, size: ts, color: '#ffffff', align: 'center', fit: true }),
    text('Month', MONTHS[m].toUpperCase(), fx + wL, y, cw - wL - wR, barH, { font: HEAD_FONT, bold: true, size: ts, color: '#ffffff', align: 'center', fit: true }),
    text('Year', cfg.year, fx + cw - wR, y, wR, barH, { font: HEAD_FONT, bold: true, size: ts, color: '#ffffff', align: 'center', fit: true }),
  ]));
  y += barH + 5;

  /* ---- weekday row ---- */
  const colW = cw / 7;
  const wdH = box.h * 0.062;
  const wd = [];
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    const bx = fx + i * colW + 1.5;
    const bwid = colW - 3;
    const nm = WEEKDAYS[dow];
    if (dow === 0) wd.push(rect('Weekday box SUN', bx, y, bwid, wdH, red, { stroke: ink, strokeW: 2 }));
    else if (dow === 6) wd.push(rect('Weekday box SAT', bx, y, bwid, wdH, ink));
    else {
      wd.push(rect(`Weekday box ${nm}`, bx, y, bwid, wdH, '#ffffff', { stroke: ink, strokeW: 2.5 }));
      wd.push(rect(`Weekday box inner ${nm}`, bx + 4, y + 4, bwid - 8, wdH - 8, null, { stroke: ink, strokeW: 1 }));
    }
    wd.push(text(`Weekday ${nm}`, nm.toUpperCase(), bx, y, bwid, wdH, {
      font: HEAD_FONT, bold: true, size: wdH * 0.7, color: dow === 0 || dow === 6 ? '#ffffff' : ink, align: 'center', fit: true,
    }));
  }
  out.push(group('Weekday headers', wd));
  y += wdH + 4;

  /* ---- grid: always 7 x 5 (6-week months fold 24/31, 4-week months get a spare row for moon faces) ---- */
  const gridY = y;
  const gridH = box.y + box.h - gridY;
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
  const tides = cfg.showTides ? parseTides(cfg.tides, cfg.year) : {};
  const showLunar = !!cfg.showLunar;
  const light = mix(red, '#ffffff', 0.86);

  // moon phases: leading blank cells (first row) if they fit, else the last trailing blanks, else any blanks
  const phases = cfg.showMoon ? moonPhasesForMonth(cfg.year, m, Number(cfg.utcOffset) || 0) : [];
  const grid = cells.slice(0, rows * 7);
  const lead = [];
  const trail = [];
  const firstIn = grid.findIndex((x) => x.inMonth);
  const lastIn = grid.map((x) => x.inMonth).lastIndexOf(true);
  grid.forEach((x, i) => { if (!x.inMonth) (i < firstIn ? lead : i > lastIn ? trail : []).push(i); });
  let pool = [];
  if (phases.length) {
    if (lead.length >= phases.length) pool = lead.slice(0, phases.length);
    else if (trail.length >= phases.length) pool = trail.slice(trail.length - phases.length);
    else if (lead.length + trail.length >= phases.length) pool = [...lead, ...trail].slice(0, phases.length);
  }
  const moonInBlanks = pool.length > 0;
  const moonCellOf = {};
  if (moonInBlanks) phases.forEach((p, j) => (moonCellOf[pool[j]] = p));

  const sharedSegs = [];
  const boxes = [];
  const nums = [];
  const tideT = [];
  const lunarT = [];
  const hol = [];
  const moons = [];

  const tideText = (name, str, x, yy, w, hh, color, size, align = 'center') =>
    text(name, str, x, yy, w, hh, { font: SMALL_FONT, bold: true, size, color, align, fit: true });

  const lunarFor = (cell, x, yy, hh, color, size) => {
    const ch = lunarChars(lunarDay(cfg.year, cell.month, cell.day));
    if (!ch) return;
    const tag = `${cell.month + 1}-${String(cell.day).padStart(2, '0')}`;
    ch.forEach((t, k) => {
      lunarT.push(text(`Lunar ${tag} ${k + 1}`, t, x, yy + k * size * 1.12, size * 1.1, hh, { font: CJK_FONT, size, color, align: 'center', valign: 'top' }));
    });
  };

  grid.forEach((cell, i) => {
    const r = Math.floor(i / 7);
    const col = i % 7;
    const x = fx + col * colW;
    const cy = gridY + r * rowH;
    boxes.push(rect(`Cell ${i + 1}`, x, cy, colW, rowH, '#ffffff', { stroke: ink, strokeW: 2 }));

    const mp = moonCellOf[i];
    if (mp) {
      moons.push(...moonCellLayers(cfg, mp, {
        x, y: cy, w: colW, h: rowH, own: 'stack', pad: 4,
        label: PHASE_LABEL[mp.phase], date: `${MONTHS[m].toUpperCase()} ${mp.day}`,
        labelFont: HEAD_FONT, labelColor: red, color: red, light,
      }));
      return;
    }
    if (!cell.inMonth && !cfg.showAdj) return;

    const foldedWith = fold[i];
    const holName = cell.inMonth ? holidays[`${cell.month + 1}-${cell.day}`] : undefined;
    const isRed = cell.dow === 0 || !!holName;
    const numColor = !cell.inMonth ? mix(ink, cfg.bg, 0.75) : isRed ? red : ink;
    const td = tides[`${cell.month + 1}-${cell.day}`];
    const tag = `${cell.month + 1}-${String(cell.day).padStart(2, '0')}`;
    const lw = showLunar ? colW * 0.17 : 0;

    if (foldedWith) {
      const half = rowH / 2;
      const shSt = cfg.sharedCell || 'template';
      if (shSt === 'diagonal') sharedSegs.push([x + colW, cy, x, cy + rowH]);
      else if (shSt !== 'corners') boxes.push(rect(`Cell split ${i + 1}`, x, cy + half, colW, 0, null, { stroke: ink, strokeW: 1 }));
      const sz = Math.min(half * 0.82, colW * 0.34);
      const tl = Math.min(half * 0.21, 10);
      const sub = (dayCell, top, alignLeft) => {
        const hn = dayCell.inMonth ? holidays[`${dayCell.month + 1}-${dayCell.day}`] : undefined;
        const redDay = dayCell.dow === 0 || !!hn;
        const t = tides[`${dayCell.month + 1}-${dayCell.day}`];
        const nx = alignLeft ? x + 4 : x + colW * 0.5;
        nums.push(text(`Day ${dayCell.month + 1}-${String(dayCell.day).padStart(2, '0')}`, dayCell.day, nx, top, colW * 0.4, half, {
          font: NUM_FONT, bold: true, size: sz, color: redDay ? red : ink, align: alignLeft ? 'left' : 'right',
        }));
        if (showLunar) lunarFor(dayCell, alignLeft ? x + colW * 0.5 - lw * 0.85 : x + colW - lw * 0.95, top + half * 0.12, half, redDay ? red : ink, Math.min(colW * 0.095, half * 0.26));
        if (t) {
          const lines = [...t.high.map((s) => [s, TIDE_BLUE]), ...t.low.map((s) => [s, red])];
          const lh = Math.min(tl * 1.05, (half - 4) / Math.max(lines.length, 1));
          const tx = alignLeft ? x + colW * 0.5 + lw * 0.1 : x + 3;
          const tw = colW * 0.5 - 4 - (alignLeft ? 0 : lw * 0.5);
          lines.forEach(([s, colr], k) => {
            tideT.push(tideText(`Tide ${dayCell.month + 1}-${String(dayCell.day).padStart(2, '0')} ${k + 1}`, s, tx, top + 2 + k * lh, tw, lh, colr, lh * 0.9, 'left'));
          });
        }
      };
      sub(cell, cy, true);
      sub(foldedWith, cy + half, false);
      return;
    }

    const showLabel = holName && cfg.showHolidays;
    const ovl = !!showLabel && isOverlayHoliday(cfg);
    const lab = showLabel && !ovl;
    const bigSize = Math.min(rowH * (lab ? 0.5 : 0.62), (colW - lw) * 0.62);
    const topPad = td ? rowH * 0.16 : rowH * 0.06;
    const botPad = td ? rowH * 0.16 : rowH * 0.06;
    nums.push(text(`Day ${tag}`, cell.day, x, cy + topPad, colW - lw, rowH - topPad - botPad - (lab ? rowH * 0.14 : 0), {
      font: NUM_FONT, bold: true, size: bigSize, color: numColor, align: 'center',
    }));
    if (ovl) {
      tweakHolidayNum(nums[nums.length - 1], cfg);
      hol.push(...holidayOverlay(cfg, holName, { x: x, y: cy, w: colW - lw, h: rowH }, tag, red));
    } else if (showLabel) {
      hol.push(text(`Holiday ${tag}`, holName.toUpperCase(), x + 3, cy + rowH * 0.66, colW - lw - 4, rowH * 0.16, {
        font: HEAD_FONT, bold: true, size: Math.min(colW * 0.075, rowH * 0.085), color: red, align: 'center', fit: true,
      }));
    }
    if (showLunar && cell.inMonth) lunarFor(cell, x + colW - lw * 0.98, cy + rowH * 0.44, rowH * 0.5, isRed ? red : ink, Math.min(colW * 0.1, rowH * 0.115));
    if (td) {
      const ts2 = Math.min(rowH * 0.1, colW * 0.074);
      if (td.high.length) tideT.push(tideText(`Tide high ${tag}`, td.high.join('  '), x + 2, cy + rowH * 0.02, colW - 4, rowH * 0.15, TIDE_BLUE, ts2));
      if (td.low.length) tideT.push(tideText(`Tide low ${tag}`, td.low.join('  '), x + 2, cy + rowH * 0.83, colW - 4, rowH * 0.15, red, ts2));
    }
    const here = !moonInBlanks && cell.inMonth ? phases.find((p) => p.day === cell.day) : null;
    if (here) {
      const d = Math.min(rowH * 0.22, colW * 0.22);
      moons.push({
        type: 'moon', name: `Moon ${PHASE_KEY[here.phase]} ${cell.day}`, phase: PHASE_KEY[here.phase], color: red, light,
        x: x + 5, y: cy + rowH * 0.2, w: d, h: d,
      });
    }
  });

  out.push(group('Day cells', boxes));
  out.push(rect('Grid border', fx, gridY, cw, rowH * rows, null, { stroke: ink, strokeW: 6 }));
  if (sharedSegs.length) out.push({ type: 'lines', name: 'Shared cell diagonal', segs: sharedSegs, color: ink, lw: 1.4, x: fx, y: gridY, w: cw, h: rowH * rows });
  out.push(group('Dates', nums));
  if (tideT.length) out.push(group('Tide times', tideT));
  if (lunarT.length) out.push(group('Lunar days', lunarT));
  if (hol.length) out.push(group('Holiday labels', hol));
  if (moons.length) out.push(group('Moon phases', moons));
  return group(`${MONTHS[m]} block`, out);
}

/** @param m first month shown on the sheet (0-11, even); the sheet shows m and m + 1 */
export function tplDuoOrnate(ctx, m) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const land = W > H;
  const ink = cfg.text;
  const red = cfg.weekend === '#d64545' ? POSTER_RED : cfg.weekend;
  const c = { ink, red, body: cfg.bodyFont };
  const out = [];

  const F = 12;
  const bw = land ? 16 : 20;
  const noteH = 20;
  const fx = F + bw + 14;
  const cw = W - 2 * fx;
  const frameBottom = H - F - noteH;

  out.push(rect('Background', 0, 0, W, H, cfg.bg, { bleed: 'ltrb' }));
  out.push({ type: 'keyborder', name: 'Ornamental border', x: F, y: F, w: W - 2 * F, h: frameBottom - F, bw, color: ink, bg: cfg.bg });

  /* ---- top area: photo / logo / ads (portrait only) ---- */
  let y = F + bw + 10;
  if (!land) {
    const topH = H * 0.262;
    const box = { x: fx, y, w: cw, h: topH };
    if (ctx.photo) {
      out.push(group('Photo', [{ type: 'image', name: 'Photo', img: ctx.photo, fit: 'cover', zoom: cfg.photoZoom, fx: cfg.photoFx, fy: cfg.photoFy, ...box, radius: 0 }]));
    } else if (ctx.logo) {
      out.push(group('Logo', [{ type: 'image', name: 'Logo', img: ctx.logo, fit: 'contain', ...box }]));
    } else {
      out.push(group('Ads or logo area (replace me)', [
        text('Ads label', 'ADS OR LOGO HERE', box.x, box.y, box.w, box.h * 0.8, { font: HEAD_FONT, bold: true, size: 70, color: red, align: 'center', fit: true }),
        cfg.company ? text('Company label', cfg.company.toUpperCase(), box.x, box.y + box.h * 0.62, box.w, 46, { font: HEAD_FONT, bold: true, size: 34, color: ink, align: 'center', fit: true }) : null,
      ]));
    }
    y += topH + 8;
    out.push({ type: 'keyborder', mode: 'strip', name: 'Pattern strip', x: fx, y, w: cw, h: 15, color: ink, bg: cfg.bg });
    y += 15 + 5;
  }

  /* ---- two blocks ---- */
  const bottom = frameBottom - bw - 8;
  const gap = 8;
  const blockH = (bottom - y - gap) / 2;
  const panelW = cw * 0.27;
  const gapX = 8;
  const mainW = cw - panelW - gapX;
  const miniH = blockH * 0.3;

  [0, 1].forEach((k) => {
    const mon = m + k;
    const by = y + k * (blockH + gap);
    const mainX = k === 0 ? fx : fx + panelW + gapX;
    const panelX = k === 0 ? fx + mainW + gapX : fx;
    out.push(monthBlock(ctx, { x: mainX, y: by, w: mainW, h: blockH }, mon, c));

    const mm = k === 0 ? mon - 1 : mon + 1; // previous month beside the first block, next month beside the second
    const yr = mm < 0 ? cfg.year - 1 : mm > 11 ? cfg.year + 1 : cfg.year;
    if (k === 0) {
      out.push(miniCal(ctx, { x: panelX, y: by, w: panelW, h: miniH }, yr, (mm + 12) % 12, c));
      const hb = holidayBox(ctx, { x: panelX, y: by + miniH + 9, w: panelW, h: blockH - miniH - 9 }, c);
      if (hb) out.push(hb);
    } else {
      const nl = notesLines({ x: panelX, y: by, w: panelW, h: blockH - miniH - 12 }, c);
      if (nl) out.push(nl);
      out.push(miniCal(ctx, { x: panelX, y: by + blockH - miniH, w: panelW, h: miniH }, yr, (mm + 12) % 12, c));
    }
  });

  /* ---- notes under the frame ---- */
  const noteY = H - F - noteH + 2;
  const tides = cfg.showTides ? parseTides(cfg.tides, cfg.year) : {};
  const hasTides = [m + 1, m + 2].some((mo) => Object.keys(tides).some((key) => key.startsWith(`${mo}-`)));
  const foot = [];
  if (hasTides) {
    foot.push(text('Tide note high', 'Figures in BLUE above the dates indicate HIGH TIDE', fx - bw, noteY, cw * 0.5, noteH - 4, { font: SMALL_FONT, bold: true, size: 12, color: ink, align: 'left', fit: true }));
    foot.push(text('Tide note low', 'Figures in RED below the dates indicate LOW TIDE', fx + cw * 0.5 + bw, noteY, cw * 0.5, noteH - 4, { font: SMALL_FONT, bold: true, size: 12, color: red, align: 'right', fit: true }));
  } else {
    const l1 = [cfg.company, cfg.phone, cfg.email, cfg.website].filter(Boolean).join('   •   ');
    if (l1) foot.push(text('Contact details', l1, fx, noteY, cw, noteH - 4, { font: SMALL_FONT, bold: true, size: 12, color: ink, align: 'center', fit: true }));
  }
  if (foot.length) out.push(group('Footer notes', foot));
  return out;
}
