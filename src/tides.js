// Tide table parser. One line per day:
//   YYYY-MM-DD | high tides | low tides        (the year is optional: MM-DD | ... | ...)
// Tides are separated by ; or , e.g.
//   2027-01-01 | 4:25 AM 0.8m, 5:35 PM 1.2m | 10:20 AM 0.3m
// Tide times are NOT calculated by this app: paste them from your local tide table (PAGASA / NAMRIA).
export function parseTides(src, year) {
  const map = {};
  String(src || '').split(/\r?\n/).forEach((line) => {
    const m = line.trim().match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})\s*\|([^|]*)\|?(.*)$/);
    if (!m) return;
    if (m[1] && Number(m[1]) !== Number(year)) return;
    const list = (s) => s.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
    map[`${Number(m[2])}-${Number(m[3])}`] = { high: list(m[4]), low: list(m[5]) };
  });
  return map;
}

// January 2027 as printed on the sample calendar supplied by the user (use it to check the layout).
export const TIDES_JAN_2027 = [
  '2027-01-01 | 4:25 AM 0.8m, 5:35 PM 1.2m | 10:20 AM 0.3m',
  '2027-01-02 | 5:59 AM 0.5m, 6:35 PM 1.3m | 1:10 AM 0.4m, 10:34 AM 0.4m',
  '2027-01-03 | 9:55 AM 0.5m, 7:36 PM 1.3m | 3:05 AM 0.2m, 10:11 AM 0.4m',
  '2027-01-04 | 8:34 PM 1.4m | 4:08 AM 0.1m',
  '2027-01-05 | 11:50 AM 0.6m, 9:24 PM 1.5m | 4:49 AM -0.1m, 1:42 PM 0.5m',
  '2027-01-06 | 12:00 PM 0.6m, 10:08 PM 1.6m | 5:23 AM -0.2m, 3:00 PM 0.5m',
  '2027-01-07 | 12:16 PM 0.7m, 10:48 PM 1.7m | 5:54 AM -0.2m, 3:53 PM 0.5m',
  '2027-01-08 | 12:36 PM 0.7m, 11:25 PM 1.7m | 6:23 AM -0.3m, 4:37 PM 0.4m',
  '2027-01-09 | 12:58 PM 0.7m, 11:59 PM 1.7m | 6:51 AM -0.3m, 5:16 PM 0.4m',
  '2027-01-10 | 1:22 PM 0.8m | 7:18 AM -0.3m, 5:53 PM 0.3m',
  '2027-01-11 | 12:31 AM 1.7m, 1:47 PM 0.8m | 7:45 AM -0.2m, 6:30 PM 0.3m',
  '2027-01-12 | 1:03 AM 1.6m, 2:12 PM 0.9m | 8:09 AM -0.2m, 7:09 PM 0.3m',
  '2027-01-13 | 1:35 AM 1.5m, 2:38 PM 0.9m | 8:32 AM -0.1m, 7:52 PM 0.3m',
  '2027-01-14 | 2:09 AM 1.3m, 3:06 PM 1.0m | 8:54 AM 0.0m, 8:43 PM 0.3m',
  '2027-01-15 | 2:46 AM 1.1m, 3:37 PM 1.1m | 9:12 AM 0.2m, 9:49 PM 0.3m',
  '2027-01-16 | 3:32 AM 0.9m, 4:17 PM 1.2m | 9:28 AM 0.3m, 11:23 PM 0.3m',
  '2027-01-17 | 4:42 AM 0.6m, 5:10 PM 1.3m | 9:36 AM 0.4m',
  '2027-01-18 | 6:22 PM 1.4m | 1:36 AM 0.2m',
  '2027-01-19 | 7:43 PM 1.5m | 3:22 AM 0.0m',
  '2027-01-20 | 8:55 PM 1.7m | 4:24 AM -0.2m',
  '2027-01-21 | 12:14 PM 0.6m, 9:56 PM 1.8m | 5:10 AM -0.4m, 2:37 PM 0.5m',
  '2027-01-22 | 12:23 PM 0.7m, 10:49 PM 1.9m | 5:50 AM -0.5m, 3:53 PM 0.5m',
  '2027-01-23 | 12:42 PM 0.7m, 11:37 PM 1.9m | 6:26 AM -0.5m, 4:52 PM 0.3m',
  '2027-01-24 | 1:05 PM 0.8m | 6:59 AM -0.5m, 5:45 PM 0.2m',
  '2027-01-25 | 12:22 AM 1.9m, 1:30 PM 0.9m | 7:29 AM -0.4m, 6:35 PM 0.1m',
  '2027-01-26 | 1:04 AM 1.7m, 1:57 PM 1.0m | 7:55 AM -0.3m, 7:26 PM 0.1m',
  '2027-01-27 | 1:43 AM 1.5m, 2:26 PM 1.2m | 8:17 AM -0.1m, 8:18 PM 0.1m',
  '2027-01-28 | 2:21 AM 1.2m, 2:57 PM 1.2m | 8:36 AM 0.0m, 9:14 PM 0.2m',
  '2027-01-29 | 2:58 AM 0.9m, 3:31 PM 1.3m | 8:48 AM 0.2m, 10:21 PM 0.3m',
  '2027-01-30 | 3:35 AM 0.7m, 4:10 PM 1.3m | 8:53 AM 0.3m',
  '2027-01-31 | 4:21 AM 0.4m, 5:04 PM 1.3m | 12:01 AM 0.3m, 8:36 AM 0.3m',
].join('\n');

/* ---------------- automatic tide schedule (ESTIMATE) ----------------
   Harmonic model (M2, S2, N2, K1, O1) fitted to the January 2027 Philippine sample calendar, Philippine time (UTC+8).
   It makes a high / low tide schedule for ANY month, but it is an estimate (roughly +/- 1 hour and +/- 0.1-0.2 m);
   for a final print, paste the official PAGASA / NAMRIA table into "Tide table" - pasted days always win. */
const T_EPOCH = Date.UTC(2027, 0, 1);
const T_MEAN = 0.6373;
const T_CONS = [ // [speed deg/hour, cos coefficient, sin coefficient]
  [28.9841042, -0.42211, 0.13462], // M2
  [30.0, 0.163, 0.1328],           // S2
  [28.4397295, -0.04058, -0.05883], // N2
  [15.0410686, 0.35347, -0.21764],  // K1
  [13.9430356, -0.25078, 0.18928],  // O1
];
const tideH = (t) => {
  let y = T_MEAN;
  for (const [sp, a, b] of T_CONS) {
    const w = (sp * Math.PI) / 180 * t;
    y += a * Math.cos(w) + b * Math.sin(w);
  }
  return y;
};
const fmtTide = (min, h) => {
  const hh = Math.floor(min / 60) % 24;
  const mm = Math.round(min % 60);
  const H = mm === 60 ? (hh + 1) % 24 : hh;
  const M = mm === 60 ? 0 : mm;
  const ap = H >= 12 ? 'PM' : 'AM';
  const h12 = H % 12 === 0 ? 12 : H % 12;
  const v = (Math.round(h * 10) / 10) || 0;
  return `${h12}:${String(M).padStart(2, '0')} ${ap} ${v.toFixed(1)}m`;
};
const autoCache = {};
export function autoTides(year) {
  if (autoCache[year]) return autoCache[year];
  const map = {};
  const start = (Date.UTC(year, 0, 1) - T_EPOCH) / 3.6e6 - 2; // hours since epoch, 2 h margin
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 864e5;
  const step = 1 / 6; // 10 minutes, then refined by a parabola
  const n = Math.round((days * 24 + 4) / step);
  let y0 = tideH(start), y1 = tideH(start + step);
  for (let i = 2; i < n; i++) {
    const y2 = tideH(start + i * step);
    const isMax = y1 > y0 && y1 >= y2;
    const isMin = y1 < y0 && y1 <= y2;
    if (isMax || isMin) {
      const den = y0 - 2 * y1 + y2;
      const off = den ? (0.5 * (y0 - y2)) / den : 0; // parabolic peak position (in steps)
      const t = start + (i - 1 + off) * step;
      const val = y1 - 0.25 * (y0 - y2) * off;
      const ms = T_EPOCH + Math.round(t * 60) * 60000;
      const d = new Date(ms);
      if (d.getUTCFullYear() === year) {
        const key = `${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
        const rec = map[key] || (map[key] = { high: [], low: [] });
        (isMax ? rec.high : rec.low).push(fmtTide(d.getUTCHours() * 60 + d.getUTCMinutes(), val));
      }
    }
    y0 = y1; y1 = y2;
  }
  autoCache[year] = map;
  return map;
}

/** Tide table used by the ornate templates: pasted days first, then the real January 2027 sample, then the estimate. */
export function tideTable(cfg) {
  if (!cfg.showTides) return {};
  const pasted = parseTides(cfg.tides, cfg.year);
  if (cfg.tideAuto === false) return pasted;
  const auto = Number(cfg.year) === 2027 ? { ...autoTides(cfg.year), ...parseTides(TIDES_JAN_2027, 2027) } : autoTides(cfg.year);
  return { ...auto, ...pasted };
}

/* ---------------- tide text for ANY calendar design ----------------
   Every template calls these helpers so that "Tides: ON" shows the high / low tide times in the day cells of every design:
   high tides in BLUE, low tides in RED. */
export const TIDE_BLUE = '#1b5fb8'; // high tide
export const TIDE_RED = '#d6282c'; // low tide (fixed, so the legend wording "RED" is always true whatever the theme colours)
const TIDE_FONT = 'Arial Narrow';
const dayKey = (cell) => `${cell.month + 1}-${cell.day}`;

/** the tide record of one calendar cell (or undefined) */
export const tideOf = (tides, cell) => (cell && cell.inMonth ? tides[dayKey(cell)] : undefined);

const tText = (name, str, x, y, w, h, color, size, align) => ({
  type: 'text', name, text: String(str), x, y, w, h,
  font: TIDE_FONT, bold: true, size, color, align, valign: 'middle', fit: true,
});

/**
 * Text layers for one day cell.
 *  mode 'strips' : high tide in a strip along the TOP of the cell, low tide along the BOTTOM (big-number designs)
 *  mode 'lower'  : high + low tide on two lines in the lower half (designs with a small date in the corner)
 *  box = {x, y, w, h};  o = {low: colour of the low tide text, tag, hi?}
 */
export function tideLayers(td, box, o) {
  if (!td) return [];
  const { x, y, w, h } = box;
  const hi = o.hi || TIDE_BLUE;
  const tag = o.tag || '';
  const out = [];
  if (o.mode === 'lower') {
    const sz = Math.min(h * 0.12, w * 0.085);
    const lh = sz * 1.4;
    const y0 = y + h * (o.from ?? 0.46);
    if (td.high.length) out.push(tText(`Tide high ${tag}`, td.high.join('  '), x + 2, y0, w - 4, lh, hi, sz, 'center'));
    if (td.low.length) out.push(tText(`Tide low ${tag}`, td.low.join('  '), x + 2, y0 + lh, w - 4, lh, o.low || TIDE_RED, sz, 'center'));
    return out;
  }
  const sz = Math.min(h * 0.1, w * 0.074);
  if (td.high.length) out.push(tText(`Tide high ${tag}`, td.high.join('  '), x + 2, y + h * 0.02, w - 4, h * 0.15, hi, sz, 'center'));
  if (td.low.length) out.push(tText(`Tide low ${tag}`, td.low.join('  '), x + 2, y + h * 0.83, w - 4, h * 0.15, o.low || TIDE_RED, sz, 'center'));
  return out;
}

/** how the big date number of a 'strips' cell is made to leave room for the tide strips */
export const tideNum = (td) => ({ top: td ? 0.16 : null, bot: td ? 0.16 : null, k: td ? 0.8 : 1 });

/**
 * Two days sharing one cell (24 / 31) WHEN they have tide times: the cell is split into two halves,
 * 24 + its tides in the top half, 31 + its tides in the bottom half, so nothing crosses a diagonal.
 * Same return shape as sharedCell() in layout.js, plus `tides`.
 *  a / b = {day, tag, color};  o = {font, hi?, low?}
 */
export function tideSharedCell(tdA, tdB, box, a, b, o) {
  const { x, y, w, h } = box;
  const half = h / 2;
  const sz = Math.min(half * 0.82, w * 0.34);
  const num = (d, nx, ny, nw, align) => ({
    type: 'text', name: `Day ${d.tag}`, text: String(d.day), x: nx, y: ny, w: nw, h: half,
    font: o.font, bold: true, size: sz, color: d.color, align, valign: 'middle', fit: false,
  });
  const nums = [num(a, x + 4, y, w * 0.4, 'left'), num(b, x + w * 0.56, y + half, w * 0.4, 'right')];
  const tides = [];
  const lines = (td, d, tx, top) => {
    if (!td) return;
    const all = [...td.high.map((t) => [t, o.hi || TIDE_BLUE]), ...td.low.map((t) => [t, o.low || TIDE_RED])];
    if (!all.length) return;
    const lh = Math.min(half * 0.24, (half - 4) / all.length, 11);
    all.forEach(([t, col], k) => tides.push(tText(`Tide ${d.tag} ${k + 1}`, t, tx, top + 2 + k * lh, w * 0.5 - 4, lh, col, lh * 0.9, 'left')));
  };
  lines(tdA, a, x + w * 0.5 + 1, y);
  lines(tdB, b, x + 3, y + half);
  return { nums, segs: [[x, y + half, x + w, y + half]], tides };
}

/** the two-part legend printed once on the page (blue = high, red = low) */
export function tideLegend(box, o) {
  const half = box.w / 2;
  return [
    tText('Tide note high', 'Figures in BLUE indicate HIGH TIDE', box.x, box.y, half - 4, box.h, o.hi || TIDE_BLUE, box.h * 0.82, 'left'),
    tText('Tide note low', 'Figures in RED indicate LOW TIDE', box.x + half + 4, box.y, half - 4, box.h, o.low || TIDE_RED, box.h * 0.82, 'right'),
  ];
}

/** does this month have any tide data (so a legend is worth printing)? */
export const monthHasTides = (tides, m) => Object.keys(tides).some((k) => k.startsWith(`${m + 1}-`));
