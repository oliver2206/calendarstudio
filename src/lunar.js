// Chinese lunar-calendar day (1-30) for a Gregorian date, via the browser's Intl chinese calendar.
// Uses China Standard Time at noon of the date, which matches the printed Philippine wall calendars.
let fmt = null;
try {
  fmt = new Intl.DateTimeFormat('en-u-ca-chinese', { day: 'numeric', timeZone: 'Asia/Shanghai' });
} catch {
  fmt = null;
}

export function lunarDay(year, month0, day) {
  if (!fmt) return null;
  try {
    const part = fmt.formatToParts(new Date(Date.UTC(year, month0, day, 4))).find((p) => p.type === 'day');
    const n = Number(part && part.value);
    return n >= 1 && n <= 30 ? n : null;
  } catch {
    return null;
  }
}

const DIGITS = '一二三四五六七八九十';

/** Two traditional characters for a lunar day: 初一…初十, 十一…十九, 二十, 廿一…廿九, 三十 */
export function lunarChars(n) {
  if (!n) return null;
  if (n <= 10) return ['初', DIGITS[n - 1]];
  if (n < 20) return ['十', DIGITS[n - 11]];
  if (n === 20) return ['二', '十'];
  if (n < 30) return ['廿', DIGITS[n - 21]];
  return ['三', '十'];
}

/* ---------- extras for the Chinese lunar wall calendar template ---------- */
let fmtM = null;
try {
  fmtM = new Intl.DateTimeFormat('en-u-ca-chinese', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Shanghai' });
} catch {
  fmtM = null;
}
const MONTH_NAMES = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

/** { n: 1-12, leap: bool, day: 1-30 } for a Gregorian date, or null when Intl has no Chinese calendar. */
export function lunarInfo(year, month0, day) {
  if (!fmtM) return null;
  try {
    const parts = fmtM.formatToParts(new Date(Date.UTC(year, month0, day, 4)));
    const mp = parts.find((p) => p.type === 'month');
    const dp = parts.find((p) => p.type === 'day');
    const n = parseInt(mp && mp.value, 10);
    const d = Number(dp && dp.value);
    if (!(n >= 1 && n <= 12 && d >= 1 && d <= 30)) return null;
    return { n, leap: /bis|闰|閏/.test(String(mp.value)), day: d };
  } catch {
    return null;
  }
}
export const lunarMonthName = (info) => (info ? (info.leap ? '闰' : '') + MONTH_NAMES[info.n - 1] : '');
export const lunarDayName = (n) => {
  const ch = lunarChars(n);
  return ch ? ch.join('') : '';
};

/** First day (Gregorian Date at local midnight) of the lunar year that starts in `year`. */
export function lunarNewYear(year) {
  for (let d = 18; d <= 52; d++) {
    const dt = new Date(year, 0, d);
    const info = lunarInfo(dt.getFullYear(), dt.getMonth(), dt.getDate());
    if (info && info.n === 1 && info.day === 1 && !info.leap) return dt;
  }
  return null;
}

/* Solar terms (节气) by the standard 21st-century formula: day = floor(Y*0.2422 + C) - L.
   Good for 2001-2100 with the usual handful of corrections; double-check before printing. */
const TERMS = [
  ['小寒', 1, 5.4055], ['大寒', 1, 20.12], ['立春', 2, 3.87], ['雨水', 2, 18.73], ['惊蛰', 3, 5.63], ['春分', 3, 20.646],
  ['清明', 4, 4.81], ['谷雨', 4, 20.1], ['立夏', 5, 5.52], ['小满', 5, 21.04], ['芒种', 6, 5.678], ['夏至', 6, 21.37],
  ['小暑', 7, 7.108], ['大暑', 7, 22.83], ['立秋', 8, 7.5], ['处暑', 8, 23.13], ['白露', 9, 7.646], ['秋分', 9, 23.042],
  ['寒露', 10, 8.318], ['霜降', 10, 23.438], ['立冬', 11, 7.438], ['小雪', 11, 22.36], ['大雪', 12, 7.18], ['冬至', 12, 21.94],
];
const FIX = { '小寒2019': -1, '大寒2082': 1, '立春2021': -1, '雨水2026': -1, '春分2084': 1, '小满2008': 1, '夏至2016': 1, '小暑2016': 1, '大暑2089': 1, '冬至2021': -1 };

/** { day: name } for the solar terms that fall in this month (0-11). */
export function solarTermsOfMonth(year, month0) {
  const out = {};
  const Y = year % 100;
  TERMS.forEach(([name, mon, C]) => {
    if (mon !== month0 + 1) return;
    const L = Math.floor((mon <= 2 ? Y - 1 : Y) / 4);
    const day = Math.floor(Y * 0.2422 + C) - L + (FIX[name + year] || 0);
    out[day] = name;
  });
  return out;
}

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
export const ganzhi = (y) => STEMS[(((y - 4) % 10) + 10) % 10] + BRANCHES[(((y - 4) % 12) + 12) % 12];
export const cnYear = (y) => [...String(y)].map((d) => '〇一二三四五六七八九'[Number(d)]).join('');
