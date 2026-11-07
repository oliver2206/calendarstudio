// "Philippine wall" template: black/red title bar, boxed day cells with big numbers,
// moon-phase cells, mini previous/next month calendars, holiday list and reminders box.
// Layout is inspired by the common Philippine commercial wall calendar; portrait works best.
import { rect, text, group, monthCells, parseHolidays, MONTHS, WEEKDAYS, mix, isOverlayHoliday, holidayOverlay, tweakHolidayNum } from './layout.js';
import { moonCellLayers } from './moonCell.js';
import { moonPhasesForMonth, formatMoonTime } from './moon.js';

const PHASE_LABEL = ['NEW MOON', 'FIRST QUARTER', 'FULL MOON', 'LAST QUARTER'];
const PHASE_KEY = ['new', 'fq', 'full', 'lq'];

export function listHolidays(src, year) {
  const out = [];
  String(src || '').split(/\r?\n/).forEach((line) => {
    const m = line.trim().match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})\s+(.+)$/);
    if (!m) return;
    if (m[1] && Number(m[1]) !== Number(year)) return;
    out.push({ m: Number(m[2]), d: Number(m[3]), name: m[4].trim() });
  });
  return out.sort((a, b) => a.m - b.m || a.d - b.d);
}

export function listReminders(src, month1) {
  const out = [];
  String(src || '').split(/\r?\n/).forEach((line) => {
    const m = line.trim().match(/^(\*|\d{1,2})-(\d{1,2})\s+(.+)$/);
    if (!m) return;
    if (m[1] !== '*' && Number(m[1]) !== month1) return;
    out.push({ d: Number(m[2]), text: m[3].trim() });
  });
  return out.sort((a, b) => a.d - b.d);
}

function miniCal(ctx, box, year, mon, c) {
  const { cfg } = ctx;
  const cells = monthCells(year, mon, cfg.weekStart);
  const rows = cells.length / 7;
  const hols = parseHolidays(cfg.holidays, year);
  const titleH = box.h * 0.2;
  const wdH = box.h * 0.13;
  const px = 6;
  const colW = (box.w - 2 * px) / 7;
  const bodyY = box.y + titleH + wdH;
  const rowH = (box.y + box.h - 5 - bodyY) / rows;
  const out = [rect('Mini border', box.x, box.y, box.w, box.h, '#ffffff', { radius: 4, stroke: c.ink, strokeW: 2 })];

  out.push(text('Mini month', MONTHS[mon].toUpperCase(), box.x + px, box.y + 2, box.w * 0.62, titleH, {
    font: c.font, bold: true, size: titleH * 0.62, color: c.red, fit: true,
  }));
  out.push(text('Mini year', year, box.x + box.w * 0.6, box.y + 2, box.w * 0.4 - px, titleH, {
    font: c.font, bold: true, size: titleH * 0.62, color: c.red, align: 'right',
  }));
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    out.push(text(`Mini weekday ${WEEKDAYS[dow]}`, WEEKDAYS[dow].toUpperCase(), box.x + px + i * colW, box.y + titleH, colW, wdH, {
      font: c.font, bold: true, size: Math.min(wdH * 0.62, colW * 0.34), color: dow === 0 ? c.red : c.ink, align: 'center', fit: true,
    }));
  }
  cells.forEach((cell, i) => {
    if (!cell.inMonth) return;
    const r = Math.floor(i / 7);
    const col = i % 7;
    const red = cell.dow === 0 || hols[`${mon + 1}-${cell.day}`];
    out.push(text(`Mini day ${cell.day}`, cell.day, box.x + px + col * colW, bodyY + r * rowH, colW, rowH, {
      font: c.font, bold: true, size: Math.min(rowH * 0.62, colW * 0.5), color: red ? c.red : c.ink, align: 'center',
    }));
  });
  return group(`Mini calendar ${MONTHS[mon]}`, out);
}

export function tplPhil(ctx, m) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const ink = cfg.text;
  const red = cfg.weekend;
  const font = cfg.bodyFont;
  const c = { ink, red, font };
  const F = 20;
  const M = 50;
  const cw = W - 2 * M;
  const out = [];

  out.push(rect('Background', 0, 0, W, H, cfg.bg, { bleed: 'ltrb' }));
  out.push(group('Frame', [
    rect('Frame outer', F, F, W - 2 * F, H - 2 * F, null, { stroke: ink, strokeW: 7 }),
    rect('Frame inner', F + 10, F + 10, W - 2 * F - 20, H - 2 * F - 20, null, { stroke: ink, strokeW: 2 }),
  ]));

  /* artwork / photo area */
  const photoY = M - 6;
  const photoH = H * 0.3;
  const box = { x: M, y: photoY, w: cw, h: photoH };
  if (ctx.photo) {
    out.push(group('Photo', [
      {
        type: 'image', name: 'Photo', img: ctx.photo, fit: 'cover', zoom: cfg.photoZoom, fx: cfg.photoFx, fy: cfg.photoFy,
        ...box, radius: 0,
      },
      rect('Photo border', box.x, box.y, box.w, box.h, null, { stroke: ink, strokeW: 3 }),
    ]));
  } else {
    out.push(group('Artwork area (replace me)', [
      rect('Artwork box', box.x, box.y, box.w, box.h, '#ffffff', { stroke: ink, strokeW: 3 }),
      text('Artwork label', 'YOUR ARTWORK / PHOTO HERE', box.x, box.y, box.w, box.h, {
        font, bold: true, size: 34, color: mix(ink, cfg.bg, 0.78), align: 'center', fit: true,
      }),
    ]));
  }

  /* title bar */
  const barY = photoY + photoH + 14;
  const barH = H * 0.046;
  const sideW = cw * 0.22;
  out.push(group('Title bar', [
    rect('Bar left', M, barY, sideW, barH, ink),
    rect('Bar month', M + sideW, barY, cw - 2 * sideW, barH, red),
    rect('Bar right', M + cw - sideW, barY, sideW, barH, ink),
    text('Year left', cfg.year, M, barY, sideW, barH, { font, bold: true, size: barH * 0.78, color: '#ffffff', align: 'center', fit: true }),
    text('Month', MONTHS[m].toUpperCase(), M + sideW, barY, cw - 2 * sideW, barH, { font, bold: true, size: barH * 0.82, color: '#ffffff', align: 'center', fit: true }),
    text('Year right', cfg.year, M + cw - sideW, barY, sideW, barH, { font, bold: true, size: barH * 0.78, color: '#ffffff', align: 'center', fit: true }),
  ]));

  /* weekday row */
  const colW = cw / 7;
  const g = 5;
  const wdY = barY + barH + 10;
  const wdH = H * 0.034;
  const wd = [];
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    wd.push(rect(`Weekday box ${WEEKDAYS[dow]}`, M + i * colW + g / 2, wdY, colW - g, wdH, '#ffffff', { radius: 8, stroke: ink, strokeW: 2.5 }));
    wd.push(text(`Weekday ${WEEKDAYS[dow]}`, WEEKDAYS[dow].toUpperCase(), M + i * colW, wdY, colW, wdH, {
      font, bold: true, size: wdH * 0.74, color: dow === 0 ? red : ink, align: 'center', fit: true,
    }));
  }
  out.push(group('Weekday headers', wd));

  /* vertical budget */
  const footH = H * 0.03;
  const footY = H - M * 0.55 - footH;
  const miniH = H * 0.13;
  const miniY = footY - miniH - 10;
  const gridY = wdY + wdH + 6;
  const gridH = miniY - 12 - gridY;

  /* day grid */
  const cells = monthCells(cfg.year, m, cfg.weekStart);
  const rows = cells.length / 7;
  const rowH = gridH / rows;
  const holidays = ctx.holidays;

  const phases = cfg.showMoon ? moonPhasesForMonth(cfg.year, m, Number(cfg.utcOffset) || 0) : [];
  const blankIdx = [];
  cells.forEach((cell, i) => !cell.inMonth && blankIdx.push(i));
  const moonInBlanks = phases.length > 0 && blankIdx.length >= phases.length;
  const moonCellOf = {};
  if (moonInBlanks) phases.forEach((p, j) => (moonCellOf[blankIdx[j]] = p));

  const boxes = [];
  const nums = [];
  const hol = [];
  const moons = [];
  const light = mix(red, '#ffffff', 0.86);

  cells.forEach((cell, i) => {
    const r = Math.floor(i / 7);
    const col = i % 7;
    const x = M + col * colW;
    const y = gridY + r * rowH;
    const tag = `${cell.month + 1}-${String(cell.day).padStart(2, '0')}`;
    boxes.push(rect(`Cell ${i + 1}`, x + g / 2, y + g / 2, colW - g, rowH - g, '#ffffff', { radius: 9, stroke: ink, strokeW: 2 }));

    const mp = moonCellOf[i];
    if (mp) {
      moons.push(...moonCellLayers(cfg, mp, {
        x, y, w: colW, h: rowH, own: 'stack', pad: 5, dateName: 'Moon time',
        label: PHASE_LABEL[mp.phase], date: formatMoonTime(mp, m),
        labelFont: font, labelColor: red, dateColor: ink, color: red, light,
      }));
      return;
    }

    if (!cell.inMonth && !cfg.showAdj) return;
    const holName = cell.inMonth ? holidays[`${cell.month + 1}-${cell.day}`] : undefined;
    const isRed = cell.dow === 0 || holName;
    const showLabel = holName && cfg.showHolidays;
    const ovl = !!showLabel && isOverlayHoliday(cfg);
    const lab = showLabel && !ovl;
    const size = Math.min(rowH * (lab ? 0.6 : 0.74), colW * 0.66);
    nums.push(text(`Day ${tag}`, cell.day, x, y + rowH * 0.02, colW, rowH * (lab ? 0.74 : 0.92), {
      font, bold: true, size, color: !cell.inMonth ? mix(ink, cfg.bg, 0.75) : isRed ? red : ink, align: 'center',
    }));
    if (ovl) {
      tweakHolidayNum(nums[nums.length - 1], cfg);
      hol.push(...holidayOverlay(cfg, holName, { x: x, y: y, w: colW, h: rowH }, tag, red));
    } else if (showLabel) {
      const ls = Math.min(colW * 0.095, rowH * 0.1);
      hol.push(text(`Holiday ${tag}`, holName.toUpperCase(), x + 7, y + rowH * 0.74, colW - 14, rowH * 0.2, {
        font, bold: true, size: ls, color: red, align: 'center', fit: true,
      }));
    }
    // no blank cell available for the moon icons: mark the day instead
    const here = !moonInBlanks && cell.inMonth ? phases.find((p) => p.day === cell.day) : null;
    if (here) {
      const d = Math.min(rowH * 0.24, colW * 0.24);
      moons.push({
        type: 'moon', name: `Moon ${PHASE_KEY[here.phase]} ${cell.day}`, phase: PHASE_KEY[here.phase], color: red, light,
        x: x + colW - d - 9, y: y + 9, w: d, h: d,
      });
    }
  });

  out.push(group('Day cells', boxes));
  out.push(group('Dates', nums));
  if (hol.length) out.push(group('Holiday labels', hol));
  if (moons.length) out.push(group('Moon phases', moons));

  /* bottom: mini calendars + holiday list + reminders */
  const miniW = cw * 0.26;
  const prevM = (m + 11) % 12;
  const nextM = (m + 1) % 12;
  out.push(miniCal(ctx, { x: M, y: miniY, w: miniW, h: miniH }, m === 0 ? cfg.year - 1 : cfg.year, prevM, c));
  out.push(miniCal(ctx, { x: M + cw - miniW, y: miniY, w: miniW, h: miniH }, m === 11 ? cfg.year + 1 : cfg.year, nextM, c));

  const items = listHolidays(cfg.holidays, cfg.year);
  const rem = listReminders(cfg.reminders, m + 1);
  const cx = M + miniW + 16;
  const cwid = cw - 2 * miniW - 32;
  if (items.length || rem.length) {
    const mid = [];
    const titleH = 18;
    let yy = miniY;
    if (items.length) {
      const share = rem.length ? 0.56 : 1;
      const areaH = miniH * share - titleH;
      const perCol = Math.ceil(items.length / 2);
      const itemH = Math.min(15, areaH / perCol);
      mid.push(text('Holidays title', cfg.holidaysTitle, cx, yy, cwid, titleH, { font, bold: true, size: 13, color: ink, align: 'center', fit: true }));
      items.forEach((it, i) => {
        const col = i < perCol ? 0 : 1;
        const row = col === 0 ? i : i - perCol;
        const s = `${MONTHS[it.m - 1].slice(0, 3)} ${it.d}  ${it.name}`;
        mid.push(text(`Holiday ${i + 1}`, s, cx + col * (cwid / 2) + 4, yy + titleH + row * itemH, cwid / 2 - 8, itemH, {
          font, bold: true, size: itemH * 0.76, color: red, fit: true,
        }));
      });
      yy += miniH * share + 2;
    }
    if (rem.length) {
      const areaH = miniY + miniH - yy - titleH;
      const itemH = Math.min(15, areaH / rem.length);
      mid.push(text('Reminders title', cfg.remindersTitle, cx, yy, cwid, titleH, { font, bold: true, size: 13, color: ink, align: 'center', fit: true }));
      rem.forEach((it, i) => {
        mid.push(text(`Reminder ${i + 1}`, `${it.d}  -  ${it.text}`, cx + 6, yy + titleH + i * itemH, cwid - 12, itemH, {
          font, bold: true, size: itemH * 0.76, color: red, fit: true,
        }));
      });
    }
    out.push(group('Holidays and reminders', mid));
  }

  /* footer */
  const l1 = [cfg.company, cfg.phone, cfg.email, cfg.website].filter(Boolean).join('   •   ');
  const foot = [];
  if (l1) foot.push(text('Contact details', l1, M, footY, cw, footH * (cfg.address ? 0.55 : 1), { font, bold: true, size: 12, color: ink, align: 'center', fit: true }));
  if (cfg.address) foot.push(text('Address', cfg.address, M, footY + footH * 0.5, cw, footH * 0.5, { font, size: 11, color: ink, align: 'center', fit: true }));
  if (foot.length) out.push(group('Footer', foot));

  return out;
}
