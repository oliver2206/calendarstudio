// "Chinese lunar wall" template — red wall calendar: painted banner with a huge red month number,
// bilingual weekday bar (red Sun/Sat), rounded grey cells with a big date, lunar day / solar term / holiday under it,
// optional 宜 / 忌 almanac columns, zodiac card in the empty leading cells, 24/31-style shared cell on 6-week months.
import { moonDayMarks } from './moonMarks.js';
import { rect, text, group, sharedCell, monthCells, MONTHS, WEEKDAYS, mix } from './layout.js';
import { foldCells } from './templateNavy.js';
import { lunarInfo, lunarMonthName, lunarDayName, lunarNewYear, solarTermsOfMonth, ganzhi, cnYear } from './lunar.js';

const CJK = 'SimSun';
const NUM = 'Arial Black';
const SERIF = 'Times New Roman';
const RED = '#d4141c';
const ZODIAC = ['Monkey', 'Rooster', 'Dog', 'Pig', 'Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat'];
const ZH = { Monkey: '猴', Rooster: '鸡', Dog: '狗', Pig: '猪', Rat: '鼠', Ox: '牛', Tiger: '虎', Rabbit: '兔', Dragon: '龙', Snake: '蛇', Horse: '马', Goat: '羊' };
const WD_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const MON_FMT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `MM-DD | 宜 嫁娶 出行 | 忌 动土`  (or YYYY-MM-DD) -> { 'M-D': { yi: [...], ji: [...] } } */
export function parseAlmanac(src, year) {
  const map = {};
  String(src || '').split(/\r?\n/).forEach((line) => {
    const m = line.trim().match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})\s*\|(.*)$/);
    if (!m || (m[1] && Number(m[1]) !== Number(year))) return;
    const e = { yi: [], ji: [] };
    m[4].split('|').forEach((seg) => {
      const s = seg.trim();
      const words = s.slice(1).trim().split(/[\s,，、]+/).filter(Boolean);
      if (s[0] === '宜') e.yi = words;
      else if (s[0] === '忌') e.ji = words;
    });
    map[`${Number(m[2])}-${Number(m[3])}`] = e;
  });
  return map;
}

// rough line wrap for a single-line-only text layer (CJK ≈ 1em, Latin ≈ 0.5em)
function wrap(str, maxW, size, maxLines) {
  const lines = [];
  let cur = '';
  let w = 0;
  let sp = -1; // last space in cur
  for (const ch of String(str)) {
    const cw = (/[\u2e80-\u9fff\uff00-\uffef]/.test(ch) ? 1 : 0.52) * size;
    if (w + cw > maxW && cur) {
      if (sp > 0 && ch !== ' ') {
        lines.push(cur.slice(0, sp).trim());
        cur = cur.slice(sp + 1);
      } else {
        lines.push(cur.trim());
        cur = '';
      }
      w = [...cur].reduce((t, c) => t + (/[\u2e80-\u9fff\uff00-\uffef]/.test(c) ? 1 : 0.52) * size, 0);
      sp = -1;
    }
    if (ch === ' ') sp = cur.length;
    cur += ch;
    w += cw;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, maxLines);
}

const fmtD = (d) => `${MON_FMT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

export function tplChinese(ctx, m) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const land = W > H;
  const red = cfg.weekend === '#d64545' ? RED : cfg.weekend;
  const ink = '#111111';
  const out = [];
  const M = 22;
  const cw = W - 2 * M;

  out.push(rect('Background', 0, 0, W, H, cfg.bg, { bleed: 'ltrb' }));

  const bandH = H * 0.004; // small top margin (spiral binding removed)

  /* ---- header ---- */
  const hy = bandH + H * 0.014;
  const hh = H * (land ? 0.2 : 0.155);
  const info1 = lunarInfo(cfg.year, m, 1);
  const terms = solarTermsOfMonth(cfg.year, m);
  const head = [];

  // banner photo (right)
  const px = M + cw * 0.5;
  const pw = cw * 0.5;
  if (ctx.photo) {
    head.push({ type: 'image', name: 'Banner photo', img: ctx.photo, fit: 'cover', zoom: cfg.photoZoom, fx: cfg.photoFx, fy: cfg.photoFy, x: px, y: hy, w: pw, h: hh, radius: 0 });
  } else {
    head.push(rect('Banner placeholder (replace me)', px, hy, pw, hh, { grad: [[0, '#efe6cf'], [1, '#c9b98e']] }));
    head.push(text('Banner label', 'YOUR PAINTING / PHOTO HERE', px, hy, pw * 0.44, hh, { font: 'Arial', bold: true, size: 28, color: '#ffffff', align: 'center', fit: true }));
  }
  // translucent text card over the banner
  const cardW = pw * 0.52;
  const cardX = px + pw - cardW - pw * 0.02;
  const cardY = hy + hh * 0.08;
  const cardH = hh * 0.84;
  const ts = Math.min(hh * 0.075, cardW * 0.05);
  head.push(rect('Text card', cardX, cardY, cardW, cardH, '#ffffff', { opacity: 0.86 }));
  const heading = cfg.tagline || '';
  if (heading) {
    head.push(rect('Heading chip', cardX + cardW * 0.03, cardY + cardH * 0.06, Math.min(cardW * 0.94, heading.length * ts * 1.1 + ts * 1.2), ts * 1.7, red));
    head.push(text('Heading', heading, cardX + cardW * 0.03, cardY + cardH * 0.06, cardW * 0.94, ts * 1.7, { font: CJK, bold: true, size: ts * 1.15, color: '#ffffff', align: 'left', fit: true }));
  }
  wrap(cfg.verse, cardW * 0.92, ts, 6).forEach((ln, i) => {
    head.push(text(`Banner text ${i + 1}`, ln, cardX + cardW * 0.04, cardY + cardH * 0.06 + ts * 2.2 + i * ts * 1.35, cardW * 0.92, ts * 1.3, { font: CJK, size: ts, color: '#333333', align: 'left', fit: true }));
  });
  if (cfg.verseRef) head.push(text('Banner reference', cfg.verseRef, cardX + cardW * 0.04, cardY + cardH - ts * 1.6, cardW * 0.92, ts * 1.4, { font: 'Arial', bold: true, size: ts, color: red, align: 'right', fit: true }));

  // year + month abbreviation + lunar lines (left)
  const lx = M + cw * 0.015;
  const yearSize = hh * 0.3;
  head.push(text('Year', cfg.year, lx, hy + hh * 0.06, cw * 0.2, yearSize * 1.15, { font: SERIF, bold: true, size: yearSize, color: red, align: 'left', fit: true }));
  head.push(text('Month abbreviation', MON_FMT[m], lx + cw * 0.175, hy + hh * 0.06 + yearSize * 0.48, cw * 0.07, yearSize * 0.6, { font: 'Arial', size: yearSize * 0.42, color: ink, align: 'left', fit: true }));
  const termLine = Object.keys(terms)
    .map(Number)
    .sort((a, b) => a - b)
    .map((d) => {
      const li = lunarInfo(cfg.year, m, d);
      return `${li ? lunarMonthName(li) + lunarDayName(li.day) : ''} ${terms[d]}`.trim();
    })
    .join('  ');
  if (termLine) head.push(text('Solar terms', termLine, lx, hy + hh * 0.06 + yearSize * 1.25, cw * 0.3, hh * 0.1, { font: CJK, bold: true, size: hh * 0.075, color: ink, align: 'left', fit: true }));
  head.push(text('Chinese year', `公元${cnYear(cfg.year)}年  ${ganzhi(cfg.year)}${ZH[ZODIAC[((cfg.year % 12) + 12) % 12]]}年`, lx, hy + hh * 0.06 + yearSize * 1.25 + hh * 0.115, cw * 0.3, hh * 0.1, { font: CJK, size: hh * 0.075, color: ink, align: 'left', fit: true }));

  // huge month number
  head.push(text('Month number', m + 1, M + cw * 0.3, hy - hh * 0.02, cw * 0.2, hh * 1.04, { font: NUM, bold: true, size: hh * 0.95, color: red, align: 'center', fit: true }));
  out.push(group('Header', head));

  /* ---- weekday bar ---- */
  const colW = cw / 7;
  const wy = hy + hh + H * 0.01;
  const wdH = H * (land ? 0.04 : 0.024);
  const wd = [rect('Weekday bar', M, wy, cw, wdH, '#ffffff', { stroke: '#bdbdbd', strokeW: 1.5, radius: 4 })];
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    wd.push(text(`Weekday ${WEEKDAYS[dow]}`, `星期${WD_ZH[dow]}${WEEKDAYS[dow].toUpperCase()}`, M + i * colW, wy, colW, wdH, {
      font: CJK, bold: true, size: wdH * 0.55, color: dow === 0 || dow === 6 ? red : ink, align: 'center', fit: true,
    }));
  }
  out.push(group('Weekday headers', wd));

  /* ---- grid ---- */
  const footH = 14;
  const gy = wy + wdH + H * 0.006;
  const gh = H - M * 0.55 - footH - gy;
  const cells = monthCells(cfg.year, m, cfg.weekStart);
  const { rows, fold } = foldCells(cells);
  const rowH = gh / rows;
  const gap = 3;
  const alm = parseAlmanac(cfg.almanac, cfg.year);
  const boxes = [];
  const nums = [];
  const sharedSegs = [];
  const lun = [];
  const yiji = [];
  const zod = [];

  const redOf = (c) => c.dow === 0 || c.dow === 6 || !!ctx.holidays[`${c.month + 1}-${c.day}`];
  const lunarLine = (c) => {
    const li = lunarInfo(cfg.year, c.month, c.day);
    if (!li) return '';
    const hol = cfg.showHolidays ? ctx.holidays[`${c.month + 1}-${c.day}`] : '';
    const term = solarTermsOfMonth(cfg.year, c.month)[c.day];
    const base = li.day === 1 ? `${lunarMonthName(li)}/初一` : lunarDayName(li.day);
    const lead = hol || term;
    return lead ? `${lead}/${lunarDayName(li.day)}` : base;
  };

  const cellAt = {};
  cells.slice(0, rows * 7).forEach((cell, i) => {
    const r = Math.floor(i / 7);
    const col = i % 7;
    const x = M + col * colW;
    const y = gy + r * rowH;
    if (cell.inMonth) cellAt[cell.day] = { x, y };
    boxes.push(rect(`Cell ${i + 1}`, x + gap / 2, y + gap / 2, colW - gap, rowH - gap, '#ffffff', { stroke: '#c9c9c9', strokeW: 1.5, radius: 5 }));
    if (!cell.inMonth && !cfg.showAdj) return;
    const tag = `${cell.month + 1}-${String(cell.day).padStart(2, '0')}`;
    const other = fold[i];
    if (other && other.inMonth) cellAt[other.day] = { x, y, bl: true };
    const dim = !cell.inMonth;
    const colorOf = (c) => (dim ? mix(ink, cfg.bg, 0.75) : redOf(c) ? red : ink);

    if (other) {
      const sc = sharedCell(cfg, { own: 'corners', x, y, w: colW, h: rowH, pad: colW * 0.06, sz: Math.min(rowH * 0.42, colW * 0.4), font: NUM, a: { day: cell.day, tag, color: colorOf(cell) }, b: { day: other.day, tag: `${other.month + 1}-${String(other.day).padStart(2, '0')}`, color: colorOf(other) } });
      sharedSegs.push(...sc.segs);
      nums.push(...sc.nums);
      return;
    }

    const e = alm[`${cell.month + 1}-${cell.day}`];
    const stripW = e ? colW * 0.17 : 0;
    const numSz = Math.min(rowH * 0.5, colW * 0.46);
    const nx = x + stripW;
    const nw = colW - stripW * 2;
    nums.push(text(`Day ${tag}`, cell.day, nx, y + rowH * 0.07, nw, rowH * 0.56, { font: NUM, bold: true, size: numSz, color: colorOf(cell), align: 'center' }));
    const ll = lunarLine(cell);
    if (ll) lun.push(text(`Lunar ${tag}`, ll, nx, y + rowH * 0.66, nw, rowH * 0.26, { font: CJK, bold: true, size: Math.min(rowH * 0.15, colW * 0.15), color: colorOf(cell), align: 'center', fit: true }));

    if (e) {
      const cs = Math.min(colW * 0.105, rowH * 0.105);
      const col2 = (arr, label, cx, c) => {
        const chars = [label, ...arr.slice(0, 3).flatMap((w) => [...w])].slice(0, 8);
        chars.forEach((ch, k) => yiji.push(text(`${label} ${tag} ${k}`, ch, cx, y + rowH * 0.06 + k * cs * 1.12, cs * 1.2, cs * 1.2, { font: CJK, bold: k === 0, size: cs, color: c, align: 'center', valign: 'top' })));
      };
      if (e.yi.length) col2(e.yi, '宜', x + colW * 0.04, red);
      if (e.ji.length) col2(e.ji, '忌', x + colW - colW * 0.04 - cs * 1.2, ink);
    }
  });

  const mdia = Math.min(rowH * 0.2, colW * 0.2);
  const moonMarks = moonDayMarks(cfg, m, (d) => (cellAt[d] ? (cellAt[d].bl ? { x: cellAt[d].x + colW * 0.08, y: cellAt[d].y + rowH - mdia - rowH * 0.06, d: mdia } : { x: cellAt[d].x + colW - mdia - colW * 0.08, y: cellAt[d].y + rowH * 0.06, d: mdia }) : null), red);
  out.push(group('Day cells', boxes));
  if (sharedSegs.length) out.push({ type: 'lines', name: 'Shared cell line', segs: sharedSegs, color: ink, lw: 1.6, x: M, y: gy, w: cw, h: rowH * rows });
  out.push(group('Dates', nums));
  if (lun.length) out.push(group('Lunar dates', lun));
  if (moonMarks.length) out.push(group('Moon phases', moonMarks));
  if (yiji.length) out.push(group('Almanac 宜 忌', yiji));

  /* ---- zodiac card in the empty leading cells ---- */
  const lead = cells.findIndex((c) => c.inMonth);
  if (lead >= 1 && !cfg.showAdj) {
    const animal = ZODIAC[((cfg.year % 12) + 12) % 12];
    const bs = Math.min(colW, rowH) * 0.5;
    zod.push(rect('Zodiac badge', M + colW / 2 - bs / 2, gy + rowH * 0.1, bs, bs, '#fff3d6', { stroke: red, strokeW: 3, radius: bs / 2 }));
    zod.push(text('Zodiac character', ZH[animal], M + colW / 2 - bs / 2, gy + rowH * 0.1, bs, bs, { font: CJK, bold: true, size: bs * 0.62, color: red, align: 'center' }));
    zod.push(text('Zodiac name', animal, M, gy + rowH * 0.1 + bs, colW, rowH * 0.2, { font: 'Arial', bold: true, size: rowH * 0.12, color: ink, align: 'center', fit: true }));
    if (lead >= 2) {
      const bx = M + colW;
      const bw = colW * (lead - 1);
      const lines = [`The Lunar Years Of The ${animal}`, 'In The Western Calendar'];
      for (let k = (lead >= 4 ? 6 : 3); k >= 0; k--) {
        const y0 = cfg.year - 12 * k;
        const a = lunarNewYear(y0);
        const b = lunarNewYear(y0 + 1);
        if (a && b) lines.push(`${fmtD(a)} – ${fmtD(new Date(b.getFullYear(), b.getMonth(), b.getDate() - 1))}`);
      }
      const ls = Math.min((rowH * 0.86) / (lines.length * 1.25), bw * 0.075);
      lines.forEach((ln, k) => zod.push(text(`Zodiac line ${k + 1}`, ln, bx + 4, gy + rowH * 0.5 - (lines.length * ls * 1.25) / 2 + k * ls * 1.25, bw - 8, ls * 1.2, { font: 'Arial', bold: k < 2, size: ls, color: k < 2 ? red : ink, align: 'center', fit: true })));
    }
    out.push(group('Zodiac card', zod));
  }

  /* ---- footer ---- */
  const line = [cfg.company, cfg.phone, cfg.email, cfg.website].filter(Boolean).join('   •   ');
  if (line) out.push(group('Footer', [text('Contact details', line, M, H - M * 0.55 - footH, cw, footH, { font: 'Arial', size: 10, color: '#444444', align: 'center', fit: true })]));
  return out;
}
