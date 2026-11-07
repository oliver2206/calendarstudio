// "Philippine ornate" template — the black & red wall calendar with the patterned (Chinese key) border,
// tide times above/below every date, small lunar-day characters, moon-phase faces in the empty cells,
// previous/next month mini calendars and the red "legal holidays" box.
// Portrait: ad / photo / logo area on top. Landscape: calendar only.
import { rect, text, group, monthCells, parseHolidays, MONTHS, WEEKDAYS, mix, isOverlayHoliday, holidayOverlay, tweakHolidayNum } from './layout.js';
import { moonCellLayers } from './moonCell.js';
import { moonPhasesForMonth } from './moon.js';
import { lunarDay, lunarChars } from './lunar.js';
import { parseTides } from './tides.js';
import { listHolidays, listReminders } from './templatePhil.js';

const PHASE_LABEL = ['NEW MOON', 'FIRST QUARTER', 'FULL MOON', 'LAST QUARTER'];
const PHASE_KEY = ['new', 'fq', 'full', 'lq'];
const NUM_FONT = 'Impact';
const HEAD_FONT = 'Arial Black';
const SMALL_FONT = 'Arial Narrow';
const CJK_FONT = 'SimSun';
// the stock red in the Style panel is a softer red; this template prints the stronger poster red unless you picked your own
const POSTER_RED = '#ee2a1f';

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

export function tplPhilOrnate(ctx, m) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const land = W > H;
  const ink = cfg.text;
  const red = cfg.weekend === '#d64545' ? POSTER_RED : cfg.weekend;
  const body = cfg.bodyFont;
  const c = { ink, red, body };
  const out = [];

  const F = 12; // frame inset from the page edge
  const bw = land ? 18 : 20; // width of the patterned band
  const noteH = 20; // room under the frame for the tide notes
  const fx = F + bw + 14; // content left edge
  const cw = W - 2 * fx;
  const frameBottom = H - F - noteH;

  out.push(rect('Background', 0, 0, W, H, cfg.bg, { bleed: 'ltrb' }));
  out.push({
    type: 'keyborder', name: 'Ornamental border', x: F, y: F, w: W - 2 * F, h: frameBottom - F, bw, color: ink, bg: cfg.bg,
  });

  /* ---- top area: photo / logo / ads (portrait only) ---- */
  let y = F + bw + 10;
  if (!land) {
    const topH = H * 0.315;
    const box = { x: fx, y, w: cw, h: topH };
    if (ctx.photo) {
      out.push(group('Photo', [{
        type: 'image', name: 'Photo', img: ctx.photo, fit: 'cover', zoom: cfg.photoZoom, fx: cfg.photoFx, fy: cfg.photoFy, ...box, radius: 0,
      }]));
    } else if (ctx.logo) {
      out.push(group('Logo', [{ type: 'image', name: 'Logo', img: ctx.logo, fit: 'contain', ...box }]));
    } else {
      out.push(group('Ads or logo area (replace me)', [
        text('Ads label', 'ADS OR LOGO HERE', box.x, box.y, box.w, box.h * 0.8, {
          font: HEAD_FONT, bold: true, size: 70, color: red, align: 'center', fit: true,
        }),
        cfg.company ? text('Company label', cfg.company.toUpperCase(), box.x, box.y + box.h * 0.62, box.w, 46, {
          font: HEAD_FONT, bold: true, size: 34, color: ink, align: 'center', fit: true,
        }) : null,
      ]));
    }
    y += topH + 8;
    out.push({ type: 'keyborder', mode: 'strip', name: 'Pattern strip', x: fx, y, w: cw, h: 15, color: ink, bg: cfg.bg });
    y += 15 + 3;
  }

  /* ---- title bar:  01 | JANUARY | 2027 ---- */
  const barH = land ? H * 0.078 : H * 0.047;
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
  y += barH + 6;

  /* ---- weekday row ---- */
  const colW = cw / 7;
  const wdH = land ? H * 0.05 : H * 0.03;
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
  y += wdH + 5;

  /* ---- bottom block geometry ---- */
  const miniH = land ? H * 0.205 : H * 0.118;
  const miniY = frameBottom - bw - 8 - miniH;
  const gridY = y;
  const gridH = miniY - 8 - gridY;

  /* ---- day grid ---- */
  const cells = monthCells(cfg.year, m, cfg.weekStart);
  let rows = cells.length / 7;
  // 6-week months: fold the overflow days into the cells a week earlier (e.g. 24 / 31), as printed calendars do
  const fold = {};
  if (rows === 6) {
    for (let col = 0; col < 7; col++) {
      const late = cells[35 + col];
      if (late.inMonth) fold[28 + col] = late;
    }
    rows = 5;
  }
  const rowH = gridH / rows;
  const holidays = ctx.holidays;
  const tides = cfg.showTides ? parseTides(cfg.tides, cfg.year) : {};
  const showLunar = !!cfg.showLunar;
  const hasTides = Object.keys(tides).some((k) => k.startsWith(`${m + 1}-`));

  const phases = cfg.showMoon ? moonPhasesForMonth(cfg.year, m, Number(cfg.utcOffset) || 0) : [];
  const blankIdx = [];
  cells.slice(0, rows * 7).forEach((cell, i) => !cell.inMonth && blankIdx.push(i));
  const moonInBlanks = phases.length > 0 && blankIdx.length >= phases.length;
  const moonCellOf = {};
  if (moonInBlanks) phases.forEach((p, j) => (moonCellOf[blankIdx[j]] = p));
  const light = mix(red, '#ffffff', 0.86);

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

  cells.slice(0, rows * 7).forEach((cell, i) => {
    const r = Math.floor(i / 7);
    const col = i % 7;
    const x = fx + col * colW;
    const cy = gridY + r * rowH;
    boxes.push(rect(`Cell ${i + 1}`, x, cy, colW, rowH, '#ffffff', { stroke: ink, strokeW: 2 }));

    /* moon phase cell */
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

    /* two days sharing one cell (24 over 31) */
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
          const lines = [...t.high.map((s) => [s, ink]), ...t.low.map((s) => [s, red])];
          const lh = Math.min(tl * 1.05, (half - 4) / Math.max(lines.length, 1));
          const tx = alignLeft ? x + colW * 0.5 + lw * 0.1 : x + 3;
          const tw = colW * 0.5 - 4 - (alignLeft ? 0 : lw * 0.5);
          lines.forEach(([s, col], k) => {
            tideT.push(tideText(`Tide ${dayCell.month + 1}-${String(dayCell.day).padStart(2, '0')} ${k + 1}`, s, tx, top + 2 + k * lh, tw, lh, col, lh * 0.9, alignLeft ? 'left' : 'left'));
          });
        }
      };
      sub(cell, cy, true);
      sub(foldedWith, cy + half, false);
      return;
    }

    /* normal day cell */
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
      if (td.high.length) tideT.push(tideText(`Tide high ${tag}`, td.high.join('  '), x + 2, cy + rowH * 0.02, colW - 4, rowH * 0.15, ink, ts2));
      if (td.low.length) tideT.push(tideText(`Tide low ${tag}`, td.low.join('  '), x + 2, cy + rowH * 0.83, colW - 4, rowH * 0.15, red, ts2));
    }
    // no empty cell for the moon faces: put a small face in the corner of the day instead
    const here = !moonInBlanks && cell.inMonth ? phases.find((p) => p.day === cell.day) : null;
    if (here) {
      const d = Math.min(rowH * 0.22, colW * 0.22);
      moons.push({
        type: 'moon', name: `Moon ${PHASE_KEY[here.phase]} ${cell.day}`, phase: PHASE_KEY[here.phase], color: red, light,
        x: x + 5, y: cy + rowH * 0.2, w: d, h: d,
      });
    }
  });

  // heavy outline around the whole grid
  const gridBorder = rect('Grid border', fx, gridY, cw, rowH * rows, null, { stroke: ink, strokeW: 6 });
  out.push(group('Day cells', boxes));
  out.push(gridBorder);
  if (sharedSegs.length) out.push({ type: 'lines', name: 'Shared cell diagonal', segs: sharedSegs, color: ink, lw: 1.4, x: fx, y: gridY, w: cw, h: rowH * rows });
  out.push(group('Dates', nums));
  if (tideT.length) out.push(group('Tide times', tideT));
  if (lunarT.length) out.push(group('Lunar days', lunarT));
  if (hol.length) out.push(group('Holiday labels', hol));
  if (moons.length) out.push(group('Moon phases', moons));

  /* ---- bottom: previous month | holidays + reminders | next month ---- */
  const miniW = cw * 0.295;
  const prevM = (m + 11) % 12;
  const nextM = (m + 1) % 12;
  out.push(miniCal(ctx, { x: fx, y: miniY, w: miniW, h: miniH }, m === 0 ? cfg.year - 1 : cfg.year, prevM, c));
  out.push(miniCal(ctx, { x: fx + cw - miniW, y: miniY, w: miniW, h: miniH }, m === 11 ? cfg.year + 1 : cfg.year, nextM, c));

  const items = listHolidays(cfg.holidays, cfg.year);
  const rem = listReminders(cfg.reminders, m + 1);
  const bx = fx + miniW + 12;
  const bwid = cw - 2 * miniW - 24;
  if (items.length || rem.length) {
    const mid = [];
    const headH = miniH * 0.17;
    mid.push(rect('Holiday box fill', bx, miniY, bwid, miniH, '#ffffff', { radius: 12 }));
    mid.push(rect('Holiday box header', bx + 3, miniY + 3, bwid - 6, headH, red, { radius: 9 }));
    mid.push(text('Holidays title', cfg.holidaysTitle.toUpperCase(), bx + 8, miniY + 3, bwid - 16, headH, {
      font: HEAD_FONT, bold: true, size: headH * 0.62, color: '#ffffff', align: 'center', fit: true,
    }));
    mid.push(rect('Holiday box border', bx, miniY, bwid, miniH, null, { radius: 12, stroke: red, strokeW: 4 }));
    let yy = miniY + headH + 8;
    const avail = miniY + miniH - 8 - yy;
    if (items.length) {
      const share = rem.length ? 0.6 : 1;
      const perCol = Math.ceil(items.length / 2);
      const itemH = Math.min(18, (avail * share) / perCol);
      const colWid = (bwid - 24) / 2 - 4;
      const longest = Math.max(...items.map((it) => it.name.length + 8));
      const hs = Math.min(itemH * 0.82, colWid / (longest * 0.43));
      items.forEach((it, k) => {
        const col = k < perCol ? 0 : 1;
        const row = col === 0 ? k : k - perCol;
        const s = `${MONTHS[it.m - 1].slice(0, 3).toUpperCase()} ${String(it.d).padStart(2, '0')}  ${it.name.toUpperCase()}`;
        mid.push(text(`Holiday ${k + 1}`, s, bx + 12 + col * ((bwid - 24) / 2), yy + row * itemH, (bwid - 24) / 2 - 4, itemH, {
          font: SMALL_FONT, bold: true, size: hs, color: red, fit: true,
        }));
      });
      yy += avail * share;
    }
    if (rem.length) {
      const itemH = Math.min(16, (miniY + miniH - 8 - yy - 16) / rem.length);
      mid.push(text('Reminders title', cfg.remindersTitle.toUpperCase(), bx + 12, yy, bwid - 24, 16, {
        font: HEAD_FONT, bold: true, size: 11, color: ink, align: 'center', fit: true,
      }));
      rem.forEach((it, k) => {
        mid.push(text(`Reminder ${k + 1}`, `${it.d}  -  ${it.text}`, bx + 14, yy + 16 + k * itemH, bwid - 28, itemH, {
          font: SMALL_FONT, bold: true, size: itemH * 0.8, color: red, fit: true,
        }));
      });
    }
    out.push(group('Holidays and reminders', mid));
  }

  /* ---- notes under the frame ---- */
  const noteY = H - F - noteH + 2;
  const foot = [];
  if (hasTides) {
    foot.push(text('Tide note high', 'Figures above the dates indicate HIGH TIDE', fx - bw, noteY, cw * 0.5, noteH - 4, {
      font: SMALL_FONT, bold: true, size: 12, color: ink, align: 'left', fit: true,
    }));
    foot.push(text('Tide note low', 'Figures in RED below the dates indicate LOW TIDE', fx + cw * 0.5 + bw, noteY, cw * 0.5, noteH - 4, {
      font: SMALL_FONT, bold: true, size: 12, color: red, align: 'right', fit: true,
    }));
  } else {
    const l1 = [cfg.company, cfg.phone, cfg.email, cfg.website].filter(Boolean).join('   •   ');
    if (l1) foot.push(text('Contact details', l1, fx, noteY, cw, noteH - 4, { font: SMALL_FONT, bold: true, size: 12, color: ink, align: 'center', fit: true }));
  }
  if (foot.length) out.push(group('Footer notes', foot));

  return out;
}
