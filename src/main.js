import './style.css';
import JSZip from 'jszip';
import { DEFAULTS } from './defaults.js';
import { HOLIDAY_STYLES, SHARED_CELLS, BORDER_STYLES, BORDER_PARTS, buildPage, pageGeometry, FONTS, MONTHS, PAGE_SIZES, PAGE_SIZE_LABELS, pageCount, pageLabel, pageTitle, firstMonthOf, isDuo, isYear } from './layout.js';
import { renderPage, loadBorderArt, loadMoonSprites, setMoonSet, drawMoonTile } from './render.js';
import { MOON_DATA } from './moonData.js';
import { MOON_POS } from './moonCell.js';
import { BORDER_ART } from './borderArtData.js';
import { MOON_DATA2 } from './moonData2.js';
import { makePsd } from './psd.js';
import { createEditor } from './editor.js';
import { TIDES_JAN_2027 } from './tides.js';
import { loadGoatArt } from './goatArt.js';
import { loadWondersArt } from './wondersArt.js';

/* ---------------- state ---------------- */
const STORE_KEY = 'calendar-psd-studio:v1';
const cfg = { ...DEFAULTS, ...loadSaved() };
if (cfg.pageSize === 'Letter') cfg.pageSize = 'Short';
const photos = []; // { name, img, url }
let logo = null; // { name, img, url }
let page = 0;
let galleryRefresh = null; // set by the design gallery; re-draws its pictures once the moon artwork has loaded
let busy = false;

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(cfg));
  } catch {
    /* storage unavailable – ignore */
  }
}

/* ---------------- form schema ---------------- */
const opt = (arr) => arr.map((v) => (Array.isArray(v) ? v : [v, v]));
const fontOpts = opt(Object.keys(FONTS));

// "LEGAL HOLIDAYS" list from the printed sample image (choice 1). No year in front, so it works for any calendar year.
const PH_LEGAL_SAMPLE = [
  "01-01 New Year's Day", "01-29 Chinese New Year's Day", '02-25 People Power Anniversary', '03-30 Eidul Fitr',
  '04-09 The Day of Valor', '04-17 Maundy Thursday', '04-18 Good Friday', '04-19 Black Saturday', '05-01 Labor Day',
  '06-06 Eidal Adha', '06-12 Independence Day', '08-21 Ninoy Aquino Day', '08-25 National Heroes Day',
  "11-01 All Saints' Day", '11-30 Bonifacio Day', '12-08 Immaculate Conception', '12-25 Christmas Day', '12-30 Rizal Day',
].join('\n');

// Holiday list as printed on the sample calendar supplied by the user (2027).
const PH_2027 = [
  "2027-01-01 New Year's Day",
  '2027-03-25 Maundy Thursday',
  '2027-03-26 Good Friday',
  '2027-04-09 Araw ng Kagitingan',
  '2027-05-01 Labor Day',
  '2027-06-12 Independence Day',
  "2027-08-30 National Heroes' Day",
  '2027-11-30 Bonifacio Day',
  '2027-12-25 Christmas Day',
  '2027-12-30 Rizal Day',
].join('\n');

// Same list, grouped under "# Heading" lines like the printed year posters (other templates ignore the # lines).
const PH_2027_GROUPED = [
  '# Regular Holidays',
  "2027-01-01 New Year's Day", '2027-03-25 Maundy Thursday', '2027-03-26 Good Friday', '2027-04-09 Araw ng Kagitingan',
  '2027-05-01 Labor Day', '2027-06-12 Independence Day', "2027-08-30 National Heroes' Day", '2027-11-30 Bonifacio Day',
  '2027-12-25 Christmas Day', '2027-12-30 Rizal Day',
  '# Special (Non-Working) Days',
  '2027-08-21 Ninoy Aquino Day', "2027-11-01 All Saints' Day", '2027-12-08 Feast of the Immaculate Conception of Mary', '2027-12-31 Last Day of the Year',
  '# Special (Working) Day',
  '2027-02-25 EDSA People Power Revolution Anniversary',
  '# Additional Special (Non-Working) Days',
  '2027-02-06 Chinese New Year', '2027-03-27 Black Saturday', "2027-11-02 All Souls' Day", '2027-12-24 Christmas Eve',
].join('\n');

const SECTIONS = [
  {
    title: 'Brand',
    open: true,
    fields: [
      { k: 'company', label: 'Company name', type: 'text' },
      { k: 'tagline', label: 'Tagline', type: 'text' },
      { k: 'coverLabel', label: 'Cover label', type: 'text' },
      { k: 'verse', label: 'Banner verse / quote (two-month template)', type: 'text' },
      { k: 'verseRef', label: 'Verse reference (two-month template)', type: 'text' },
      { k: 'phone', label: 'Phone', type: 'text' },
      { k: 'email', label: 'Email', type: 'text' },
      { k: 'website', label: 'Website', type: 'text' },
      { k: 'address', label: 'Address', type: 'text' },
      { k: 'owner', label: 'Owner / proprietor line (full-year poster)', type: 'text' },
    ],
  },
  {
    title: 'Images',
    fields: [],
    custom: 'images',
  },
  {
    title: 'Tools',
    fields: [],
    custom: 'tools',
  },
  {
    title: 'Calendar',
    open: true,
    fields: [
      { k: 'year', label: 'Year', type: 'number', min: 1970, max: 2200 },
      { k: 'template', label: 'Template', type: 'select', options: [['classic', 'Classic wall'], ['minimal', 'Minimal studio'], ['bold', 'Bold corporate'], ['phil', 'Philippine wall (black & red, moon phases)'], ['ornate', 'Philippine ornate (patterned border, tides, lunar days)'], ['ornateblue', 'Philippine ornate BLUE & red (patterned border, tides, Chinese lunar days)'], ['navy', 'Philippine navy (blue & red, big numbers, year of the animal)'], ['bigblack', 'Big black & red (huge numbers, moon cells, legal holidays)'], ['duo', 'Two-month blue & red (verse banner, 2 months per sheet)'], ['duoornate', 'Two-month black & red ornate (border, tides, lunar, notes)'], ['chinese', 'Chinese lunar wall (lunar dates, solar terms, 宜/忌)'], ['duoblack', 'Two-month black & red (zodiac art + outline year header, moon times)'], ['pink', 'Pink floral (script month, magenta bar, moon cells, legal holidays)'], ['sky', 'Sky blue bubbles (script month, aqua bar, moon cells, legal holidays)'], ['collage', 'Photo collage, 2 months + notes (angled photos, script title)'], ['yearsari', 'Full-year poster — red & blue (photo banner, holidays box, footer bar)'], ['yearpharma', 'Full-year poster — red & green (swoosh header, grid months)'], ['goat', 'Year of the Goat 2027 (red & gold, your goat artwork on every page)'], ['wonders', 'Wonders of the Philippines (scenic photo per month, PH holidays)']] },
      { k: 'weekStart', label: 'Week starts on', type: 'select', num: true, options: [[0, 'Sunday'], [1, 'Monday']] },
      { k: 'showHolidays', label: 'Show holiday names', type: 'checkbox' },
      { k: 'holidayStyle', label: 'Holiday layout (name on the date cell)', type: 'select', options: HOLIDAY_STYLES },
      { k: 'sharedCell', label: 'Shared date cell on 6-week months (24 / 31)', type: 'select', options: SHARED_CELLS },
      { k: 'showAdj', label: 'Show previous/next month days', type: 'checkbox' },
      {
        k: 'holidays', label: 'Holidays — one per line: MM-DD Name (or YYYY-MM-DD Name)', type: 'textarea',
        preset: [
          { label: '1) Fill with the LEGAL HOLIDAYS list from your image (18 holidays, any year)', value: PH_LEGAL_SAMPLE },
          { label: '2) Fill with the Philippine 2027 list from your sample', value: PH_2027 },
        ],
        preset2: { label: '3) Fill with the grouped 2027 list (year-poster templates: # headings make the columns)', value: PH_2027_GROUPED },
      },
      { k: 'holidaysTitle', label: 'Holiday box title (Philippine template)', type: 'text' },
      { k: 'reminders', label: 'Monthly reminders — MM-DD Text, or *-DD Text for every month (Philippine template)', type: 'textarea' },
      { k: 'remindersTitle', label: 'Reminders box title (Philippine template)', type: 'text' },
      { k: 'showMoon', label: 'Moon phases (all templates)', type: 'checkbox' },
      { k: 'moonPos', label: 'Moon style position (name / face / date in the moon cell)', type: 'select', options: MOON_POS },
      { k: 'autoFit', label: 'Auto-fit text: shrink fonts so dates, tide times, lunar characters and holiday names never overlap (all designs)', type: 'checkbox' },
      { k: 'showLunar', label: 'Lunar day characters (Philippine ornate)', type: 'checkbox' },
      { k: 'showTides', label: 'Tide times: High / Low Tide schedule ON / OFF (works on every design; also the 🌊 Tides button in the toolbar)', type: 'checkbox' },
      { k: 'tideAuto', label: 'High / low tide schedule for every month (automatic ESTIMATE, Jan 2027 is the real sample; pasted days always win)', type: 'checkbox' },
      {
        k: 'tides', label: 'Tide table (Philippine ornate) — one line per day: YYYY-MM-DD | high tides | low tides', type: 'textarea',
        preset: { label: 'Fill with January 2027 from your sample', value: TIDES_JAN_2027 },
      },
      {
        k: 'almanac', label: 'Almanac 宜/忌 (Chinese lunar template) — one line per day: MM-DD | 宜 嫁娶 出行 | 忌 动土', type: 'textarea',
        preset: { label: 'Fill with a few sample lines', value: '01-01 | 宜 祭祀 出行 | 忌 动土 安葬\n01-02 | 宜 开市 纳财 | 忌 嫁娶 祈福' },
      },
      { k: 'utcOffset', label: 'Moon phase time zone, UTC offset in hours (e.g. 8)', type: 'number', min: -12, max: 14, step: 0.5 },
    ],
  },
  {
    title: 'Page',
    fields: [
      { k: 'pageSize', label: 'Canvas / paper size', type: 'select', options: Object.keys(PAGE_SIZE_LABELS).map((k) => [k, PAGE_SIZE_LABELS[k]]) },
      { k: 'orientation', label: 'Orientation', type: 'select', options: [['portrait', 'Portrait'], ['landscape', 'Landscape']] },
      { k: 'bleed', label: 'Print bleed', type: 'select', num: true, options: [[0, 'None'], [3, '3 mm'], [5, '5 mm']] },
    ],
  },
  {
    title: 'Colour theme',
    open: true,
    fields: [],
    custom: 'theme',
  },
  {
    title: 'Border & lines',
    open: true,
    custom: 'bordercolors',
    fields: [
      { k: 'borderStyle', label: 'Page border', type: 'select', options: BORDER_STYLES },
      { k: 'hlineOffset', label: 'Horizontal line position (move up ← 0 → down)', type: 'range', min: -400, max: 400, step: 2 },
      { k: 'borderParts', label: 'Pattern / design border: border only, or with line(s)', type: 'select', options: BORDER_PARTS },
      { k: 'borderLineFollow', label: 'Line colour is the same as the border', type: 'checkbox' },
      { k: 'borderLineColor', label: 'Line colour (when the box above is off)', type: 'color' },
      { k: 'borderFollow', label: 'Border colour follows the colour theme', type: 'checkbox' },
      { k: 'borderColor', label: 'Border colour (when the box above is off)', type: 'color' },
      { k: 'borderWidth', label: 'Border thickness', type: 'range', min: 1, max: 20, step: 0.5 },
      { k: 'borderInset', label: 'Distance from the page edge', type: 'range', min: 0, max: 30, step: 1 },
      { k: 'gridFollow', label: 'Grid / cell lines follow the template colour', type: 'checkbox' },
      { k: 'gridColor', label: 'Grid / cell line colour (when the box above is off)', type: 'color' },
      { k: 'gridWidth', label: 'Grid / cell line thickness (0 = template)', type: 'range', min: 0, max: 8, step: 0.5 },
    ],
  },
  {
    title: 'Style',
    fields: [
      { k: 'headingFont', label: 'Heading font', type: 'select', options: fontOpts },
      { k: 'bodyFont', label: 'Body font', type: 'select', options: fontOpts },
      { k: 'primary', label: 'Primary colour', type: 'color' },
      { k: 'accent', label: 'Accent colour', type: 'color' },
      { k: 'text', label: 'Text colour', type: 'color' },
      { k: 'bg', label: 'Page background', type: 'color' },
      { k: 'weekend', label: 'Weekend / holiday colour', type: 'color' },
    ],
  },
  {
    title: 'Photo framing',
    fields: [
      { k: 'photoZoom', label: 'Zoom', type: 'range', min: 1, max: 2.5, step: 0.05 },
      { k: 'photoFx', label: 'Focus left ↔ right', type: 'range', min: 0, max: 1, step: 0.01 },
      { k: 'photoFy', label: 'Focus top ↔ bottom', type: 'range', min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: 'PSD export',
    open: true,
    fields: [
      { k: 'dpi', label: 'Resolution', type: 'select', num: true, options: [[150, '150 dpi (fast, drafts)'], [200, '200 dpi'], [300, '300 dpi (print)']] },
      { k: 'editableText', label: 'Keep text layers editable in Photoshop', type: 'checkbox' },
    ],
  },
];

/* ---------------- build the form ---------------- */
const formEl = document.getElementById('form');

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  });
  kids.flat().forEach((c) => c && el.append(c));
  return el;
}

function makeInput(f) {
  let input;
  if (f.type === 'select') {
    input = h('select', {}, ...f.options.map(([v, l]) => h('option', { value: v, text: l })));
  } else if (f.type === 'textarea') {
    input = h('textarea', { rows: 5, spellcheck: 'false' });
  } else {
    input = h('input', { type: f.type });
    ['min', 'max', 'step'].forEach((a) => f[a] !== undefined && input.setAttribute(a, f[a]));
  }
  input.dataset.k = f.k;
  if (f.type === 'checkbox') input.checked = !!cfg[f.k];
  else input.value = cfg[f.k];

  input.addEventListener('input', () => {
    let v;
    if (f.type === 'checkbox') v = input.checked;
    else if (f.type === 'number' || f.type === 'range' || f.num) v = Number(input.value);
    else v = input.value;
    if (f.type === 'number' && Number.isNaN(v)) return;
    cfg[f.k] = v;
    save();
    schedule();
  });
  return input;
}


/* ---------------- colour theme ----------------
   B = main colour (title bars, borders, ink), A = highlight colour (Sundays, holidays, moons, accents).
   Picking a theme rewrites the Style colours, so every template and every month page re-colours at once. */
// [name, highlight colour (A), main colour (B)]
const THEME_GROUPS = [
  { title: '', items: [
    ['Original', '', ''],
    ['Black & Red', '#e4151c', '#111111'],
    ['Red & Black', '#111111', '#d4141c'],
    ['Blue & Red', '#d4141c', '#0b4dab'],
    ['Red & Blue', '#0b4dab', '#d4141c'],
    ['Navy & Gold', '#e0a100', '#10208f'],
    ['Green & Blue', '#0b4dab', '#1f8a3b'],
    ['Green & Red', '#d4141c', '#1f8a3b'],
    ['Purple & Pink', '#e3126f', '#5b2a9a'],
    ['Teal & Orange', '#f06a1a', '#0e7c86'],
    ['Brown & Gold', '#d99a00', '#6b3f1d'],
    ['Black & Gold', '#d4a017', '#111111'],
  ] },
  { title: '🍀 Lucky colours 2027', note: 'Year of the Fire Goat 丁未 (Fire + Earth): red, orange, yellow, brown, purple, pink', year: 2027, items: [
    ['Fire Red & Gold', '#d99a00', '#b3121b'],
    ['Brown & Red', '#d4141c', '#6b3f1d'],
    ['Purple & Orange', '#f06a1a', '#5b2a9a'],
    ['Maroon & Pink', '#e3126f', '#7a1020'],
    ['Brown & Orange', '#f06a1a', '#6b3f1d'],
    ['Crimson & Yellow', '#e0a100', '#c1121f'],
  ] },
  { title: '🍀 Lucky colours 2028', note: 'Year of the Earth Monkey 戊申 (Earth + Metal): yellow, brown, gold, white; red & orange support', year: 2028, items: [
    ['Earth Brown & Gold', '#d99a00', '#6b3f1d'],
    ['Dark Gold & Brown', '#6b3f1d', '#a87400'],
    ['Charcoal & Gold', '#d4a017', '#2f3640'],
    ['Brown & Orange', '#f06a1a', '#5a3517'],
    ['Dark Gold & Red', '#d4141c', '#8a6a00'],
    ['Slate & Yellow', '#e0a100', '#3d4852'],
  ] },
  { title: '🍀 Lucky colours 2029', note: 'Year of the Earth Rooster 己酉 (Earth + Metal): yellow, brown, gold, white/silver; red supports', year: 2029, items: [
    ['Gold & Brown', '#6b3f1d', '#b07d00'],
    ['Charcoal & Gold', '#d4a017', '#2b2f36'],
    ['Brown & Red', '#d4141c', '#5a3517'],
    ['Silver Grey & Gold', '#d4a017', '#5b6670'],
    ['Navy & Yellow', '#e0a100', '#14246b'],
    ['Maroon & Gold', '#d99a00', '#7a1020'],
  ] },
  { title: 'More combinations', items: [
    ['Navy & Red', '#d4141c', '#10208f'],
    ['Red & Gold', '#d99a00', '#c1121f'],
    ['Maroon & Gold', '#d99a00', '#7a1020'],
    ['Blue & Gold', '#e0a100', '#0b4dab'],
    ['Blue & Orange', '#f06a1a', '#0b4dab'],
    ['Royal Blue & Green', '#1f8a3b', '#1a21a0'],
    ['Forest & Gold', '#d99a00', '#14532d'],
    ['Green & Orange', '#f06a1a', '#1f8a3b'],
    ['Green & Pink', '#e3126f', '#1f8a3b'],
    ['Teal & Pink', '#e3126f', '#0e7c86'],
    ['Teal & Gold', '#d99a00', '#0e7c86'],
    ['Purple & Gold', '#d99a00', '#5b2a9a'],
    ['Purple & Red', '#d4141c', '#5b2a9a'],
    ['Indigo & Yellow', '#e0a100', '#312e81'],
    ['Burgundy & Pink', '#e3126f', '#6d0f2b'],
    ['Black & Orange', '#f06a1a', '#111111'],
    ['Black & Blue', '#0b4dab', '#111111'],
    ['Charcoal & Red', '#d4141c', '#2f3640'],
    ['Brown & Teal', '#0e7c86', '#6b3f1d'],
    ['Pink & Purple', '#5b2a9a', '#e3126f'],
    ['Orange & Blue', '#0b4dab', '#e8590c'],
    ['Gold & Navy', '#10208f', '#c99700'],
  ] },
];
const THEMES = THEME_GROUPS.flatMap((g) => g.items);

function applyTheme(a, b) {
  cfg.themeA = a;
  cfg.themeB = b;
  if (a && b) {
    cfg.weekend = a;
    cfg.primary = b;
    cfg.accent = b;
    cfg.text = b;
  } else {
    cfg.weekend = DEFAULTS.weekend;
    cfg.primary = DEFAULTS.primary;
    cfg.accent = DEFAULTS.accent;
    cfg.text = DEFAULTS.text;
  }
  formEl.querySelectorAll('input[data-k]').forEach((el) => {
    if (el.type === 'color' && cfg[el.dataset.k] !== undefined) el.value = cfg[el.dataset.k];
  });
  save();
  schedule(0);
}

function themeBlock() {
  const wrap = h('div', { class: 'theme' });
  const swatches = h('div', { class: 'swatches' });
  const pickA = h('input', { type: 'color' });
  const pickB = h('input', { type: 'color' });
  pickA.value = cfg.themeA || cfg.weekend;
  pickB.value = cfg.themeB || cfg.primary;
  const btns = [];
  const refresh = () => {
    btns.forEach(({ btn, a, b }) => {
      btn.classList.toggle('on', (cfg.themeA || '') === a && (cfg.themeB || '') === b);
    });
    pickA.value = cfg.themeA || cfg.weekend;
    pickB.value = cfg.themeB || cfg.primary;
  };
  THEME_GROUPS.forEach((g) => {
    if (g.title) {
      swatches.append(h('div', { class: 'swatch-head' + (g.year && Number(cfg.year) === g.year ? ' now' : ''), text: g.title + (g.year && Number(cfg.year) === g.year ? '  ★ your calendar year' : '') }));
      if (g.note) swatches.append(h('div', { class: 'swatch-note', text: g.note }));
    }
    g.items.forEach(([name, a, b]) => {
      const dot = (col) => { const d = h('i'); d.style.background = col || '#888'; return d; };
      const btn = h('button', { class: 'swatch', title: name }, name === 'Original' ? h('i', { class: 'orig', text: '↺' }) : h('span', { class: 'dots' }, dot(b), dot(a)), h('em', { text: name }));
      btn.addEventListener('click', () => { applyTheme(a, b); refresh(); });
      swatches.append(btn);
      btns.push({ btn, a, b });
    });
  });
  const custom = () => { applyTheme(pickA.value, pickB.value); refresh(); };
  pickA.addEventListener('input', custom);
  pickB.addEventListener('input', custom);
  wrap.append(
    h('div', { class: 'hint', text: 'Pick a colour pair — every month and every page updates automatically. The name reads Main & Highlight. Lucky colours follow traditional feng shui five-element guidance; sources differ, so treat them as suggestions.' }),
    swatches,
    h('label', { class: 'field color' }, h('span', { text: 'Main colour (title bars, borders, numbers)' }), pickB),
    h('label', { class: 'field color' }, h('span', { text: 'Highlight colour (Sundays, holidays, moon phases)' }), pickA),
  );
  refresh();
  return wrap;
}

/* quick border colours: one click sets the border colour (and turns off "follow the colour theme") */
const BORDER_QUICK = [
  ['Red', '#d4141c'], ['Blue', '#0b4dab'], ['Black', '#111111'], ['Green', '#1f8a3b'],
  ['Gold', '#d4a017'], ['Navy', '#10208f'], ['Purple', '#5b2a9a'], ['Pink', '#e3126f'],
];
function borderColorBlock() {
  const wrap = h('div', { class: 'theme' });
  const row = h('div', { class: 'qcolors' });
  const syncInputs = () => formEl.querySelectorAll('input[data-k]').forEach((el) => {
    if (el.dataset.k === 'borderFollow') el.checked = !!cfg.borderFollow;
    if (el.dataset.k === 'borderColor') el.value = cfg.borderColor;
  });
  const mark = () => [...row.children].forEach((b) => b.classList.toggle('on', cfg.borderFollow === false && (b.dataset.c || '') === (cfg.borderColor || '').toLowerCase()));
  BORDER_QUICK.forEach(([name, hex]) => {
    const b = h('button', { class: 'qc', title: `${name} border`, 'data-c': hex });
    b.style.background = hex;
    b.addEventListener('click', () => {
      cfg.borderFollow = false;
      cfg.borderColor = hex;
      if (cfg.borderStyle === 'template' || cfg.borderStyle === 'none') cfg.borderStyle = 'artwork';
      formEl.querySelectorAll('select[data-k="borderStyle"]').forEach((el) => { el.value = cfg.borderStyle; });
      syncInputs();
      mark();
      save();
      schedule(0);
    });
    row.append(b);
  });
  const follow = h('button', { class: 'link', text: 'Use the colour theme instead' });
  follow.addEventListener('click', () => { cfg.borderFollow = true; syncInputs(); mark(); save(); schedule(0); });
  const del = h('button', { class: 'link', text: '🗑 Delete the border (no border)' });
  del.addEventListener('click', () => {
    cfg.borderStyle = 'none';
    formEl.querySelectorAll('select[data-k="borderStyle"]').forEach((el) => { el.value = 'none'; });
    mark(); save(); schedule(0);
  });
  wrap.append(h('div', { class: 'hint', text: 'Quick border colour — tap Red, Blue… (or use the colour box below for any colour).' }), row, follow, del);
  mark();
  return wrap;
}

function imagesBlock() {
  const photoList = h('div', { class: 'thumbs' });
  const photoCount = h('div', { class: 'hint' });
  const logoInfo = h('div', { class: 'hint', text: 'No logo yet (PNG with transparent background works best).' });

  const refreshPhotos = () => {
    photoList.innerHTML = '';
    photoCount.textContent = photos.length
      ? `${photos.length} photo${photos.length === 1 ? '' : 's'} added. Cover + one per page: 13 for monthly templates, 7 for the two-month template; fewer will repeat.`
      : 'No photos yet. Cover + one per page: 13 for monthly templates, 7 for the two-month template; fewer will repeat.';
    photos.forEach((p, i) => {
      const label = photos.length >= 13 ? (i === 0 ? 'Cover' : MONTHS[i - 1].slice(0, 3)) : `#${i + 1}`;
      const rm = h('button', { class: 'x', title: 'Remove', text: '×' });
      rm.addEventListener('click', () => {
        URL.revokeObjectURL(p.url);
        photos.splice(i, 1);
        refreshPhotos();
        schedule();
      });
      const th = h('div', { class: 'thumb' }, h('img', { src: p.url, alt: p.name }), h('span', { text: label }), rm);
      photoList.append(th);
    });
  };

  const addPhotos = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) { setStatus('Drop image files (JPG, PNG, WebP…).'); return; }
    for (const file of list) {
      const item = await loadImage(file);
      if (item) photos.push(item);
    }
    refreshPhotos();
    schedule();
    setStatus(`Added ${list.length} photo${list.length === 1 ? '' : 's'}.`);
  };

  /* drop zone + browse: page photos */
  const photoInput = h('input', { type: 'file', accept: 'image/*', multiple: '', hidden: '' });
  photoInput.addEventListener('change', async () => {
    await addPhotos(photoInput.files);
    photoInput.value = '';
  });
  const zone = h('button', { class: 'dropzone', type: 'button' },
    h('span', { class: 'dz-ico', text: '🖼' }),
    h('span', { class: 'dz-main', text: 'Import photos' }),
    h('span', { class: 'dz-sub', text: 'Click to browse, or drag image files here' }),
  );
  zone.addEventListener('click', () => photoInput.click());
  ['dragenter', 'dragover'].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.remove('over'); }));
  zone.addEventListener('drop', (e) => addPhotos(e.dataTransfer?.files || []));

  const clearPhotos = h('button', { class: 'link', text: 'Remove all photos' });
  clearPhotos.addEventListener('click', () => {
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    photos.length = 0;
    refreshPhotos();
    schedule();
  });

  /* logo */
  const logoInput = h('input', { type: 'file', accept: 'image/*' });
  logoInput.addEventListener('change', async () => {
    const file = logoInput.files[0];
    if (!file) return;
    const item = await loadImage(file);
    if (item) {
      if (logo) URL.revokeObjectURL(logo.url);
      logo = item;
      logoInfo.textContent = `Logo: ${item.name}`;
      schedule();
    }
  });
  const clearLogo = h('button', { class: 'link', text: 'Remove logo' });
  clearLogo.addEventListener('click', () => {
    if (logo) URL.revokeObjectURL(logo.url);
    logo = null;
    logoInput.value = '';
    logoInfo.textContent = 'No logo yet (PNG with transparent background works best).';
    schedule();
  });

  /* free image layer placed on the current page (move / resize / crop it on the canvas) */
  const layerInput = h('input', { type: 'file', accept: 'image/*', multiple: '', hidden: '' });
  layerInput.addEventListener('change', () => {
    [...layerInput.files].forEach((f) => editor.addImage(f));
    layerInput.value = '';
  });
  const layerBtn = h('button', { class: 'primary wide', type: 'button', text: '＋ Place an image on this page' });
  layerBtn.addEventListener('click', () => layerInput.click());

  refreshPhotos();

  return h('div', { class: 'images' },
    h('div', { class: 'imggroup' }, h('h3', { text: 'Page photos' }), zone, photoInput, photoCount, photoList, clearPhotos),
    h('div', { class: 'imggroup' }, h('h3', { text: 'Logo' }), h('label', { class: 'field' }, h('span', { text: 'Choose a logo file' }), logoInput), logoInfo, clearLogo),
    h('div', { class: 'imggroup' }, h('h3', { text: 'Extra image on the page' }),
      h('div', { class: 'hint', text: 'Adds a loose picture layer on the page you are viewing. Drag to move, corner handles to resize, Delete to remove. You can also drop a file straight onto the page or paste (Ctrl+V).' }),
      layerBtn, layerInput),
  );
}

function loadImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ name: file.name, img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus(`Could not read "${file.name}" as an image.`);
      resolve(null);
    };
    img.src = url;
  });
}

SECTIONS.forEach((s) => {
  const body = h('div', { class: 'section-body' });
  s.fields.forEach((f) => {
    const input = makeInput(f);
    if (f.type === 'checkbox') body.append(h('label', { class: 'field check' }, input, h('span', { text: f.label })));
    else if (f.type === 'color') body.append(h('label', { class: 'field color' }, h('span', { text: f.label }), input));
    else body.append(h('label', { class: 'field' }, h('span', { text: f.label }), input));
    [].concat(f.preset || [], f.preset2 || []).forEach((pr) => {
      const b = h('button', { class: 'link', text: pr.label });
      b.addEventListener('click', () => {
        cfg[f.k] = pr.value;
        input.value = pr.value;
        save();
        schedule();
      });
      body.append(b);
    });
  });
  if (s.custom === 'images') body.append(imagesBlock());
  if (s.custom === 'tools') body.classList.add('toolsbody'); // the editing toolbar is moved in here at the end of this file
  if (s.custom === 'theme') body.append(themeBlock());
  if (s.custom === 'bordercolors') body.prepend(borderColorBlock());
  const d = h('details', {}, h('summary', { text: s.title }), body);
  if (s.open) d.setAttribute('open', '');
  d.dataset.title = s.title;
  formEl.append(d);
});

/* ---------------- "Moon & tides" group: moon / tide / lunar buttons and size + position controllers (filled in at the end) ---------------- */
const lookBody = h('div', { class: 'section-body lookpanel' });
{
  const d = h('details', {}, h('summary', { text: 'Moon & tides' }), lookBody);
  d.dataset.title = 'Moon & tides';
  formEl.append(d);
}

/* ---------------- Photoshop-style tool rail: one icon per settings group (T = Brand text) ---------------- */
(function buildToolRail() {
  const svg = (inner) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    Brand: svg('<path d="M5 6V4h14v2"/><path d="M12 4v16"/><path d="M9 20h6"/>'),
    Images: svg('<rect x=\"3.5\" y=\"4.5\" width=\"17\" height=\"15\" rx=\"2\"/><circle cx=\"9\" cy=\"10\" r=\"1.6\"/><path d=\"M4 18l5-5 4 4 3-3 4 4\"/>'),
    Tools: svg('<path d=\"M5 3l14 7-6 2-2 6z\"/><path d=\"M13 12l5 6\"/>'),
    Calendar: svg('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    Page: svg('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'),
    'Colour theme': svg('<path d="M12 3c4 4.5 6 7.4 6 10a6 6 0 0 1-12 0c0-2.600 2-5.500 6-10z"/>'),
    'Border & lines': svg('<rect x="4" y="4" width="16" height="16" rx="1"/><rect x="8" y="8" width="8" height="8" rx="1"/>'),
    Style: svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'),
    'Photo framing': svg('<path d="M7 3v14h14"/><path d="M3 7h14v14"/>'),
    'Moon & tides': svg('<path d="M15 4a8 8 0 1 0 5 12.500A7 7 0 0 1 15 4z"/><path d="M3 20c2-1.500 3-1.500 5 0s3 1.500 5 0"/>'),
    'PSD export': svg('<path d="M12 4v11"/><path d="M7.500 10.500 12 15l4.500-4.500"/><path d="M5 20h14"/>'),
  };
  const ALL_ICON = svg('<circle cx="5" cy="12" r="1.200"/><circle cx="12" cy="12" r="1.200"/><circle cx="19" cy="12" r="1.200"/>');
  const rail = document.getElementById('rail');
  const tabsBox = document.getElementById('ptabs');
  const panel = document.querySelector('.panel');
  const groups = [...formEl.querySelectorAll(':scope > details')];
  const KEY = 'calendarstudio.railTool';
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage may be blocked */ }
  let active = groups.some((g) => g.dataset.title === saved) || saved === '*' ? saved : 'Brand';
  const btns = new Map();

  const show = (title) => {
    active = title;
    try { localStorage.setItem(KEY, title); } catch { /* ignore */ }
    const all = title === '*';
    panel.classList.toggle('show-all', all);
    groups.forEach((g) => {
      const on = all || g.dataset.title === title;
      g.hidden = !on;
      if (!all && on) g.setAttribute('open', '');
    });
    btns.forEach((b, k) => { b.classList.toggle('on', k === title); b.setAttribute('aria-pressed', String(k === title)); });
    tabsBox.innerHTML = '';
    tabsBox.append(h('span', { class: 'ptab', text: all ? 'All settings' : title }));
    const hint = h('span', { class: 'phint', text: all ? '' : 'Settings' });
    tabsBox.append(hint);
    const sc = panel.querySelector('.pcontent');
    if (sc) sc.scrollTop = 0;
  };

  const mk = (key, label, icon) => {
    const b = h('button', { class: 'railbtn', type: 'button', title: label, 'aria-label': label });
    b.innerHTML = icon;
    b.addEventListener('click', () => show(key));
    btns.set(key, b);
    rail.append(b);
    return b;
  };
  groups.forEach((g) => {
    const t = g.dataset.title;
    mk(t, t === 'Brand' ? 'Type — Brand text (T)' : t === 'Tools' ? 'Tools — select, text, layers, undo' : t, ICONS[t] || ICONS.Page);
  });
  rail.append(h('span', { class: 'railsep' }));
  mk('*', 'Show all settings', ALL_ICON);
  show(active);

  /* press T on the keyboard (outside a text box) to jump to the Brand text fields, like Photoshop's Type tool */
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
    if (e.key === 't' || e.key === 'T') {
      document.body.classList.remove('hide-left');
      show('Brand');
    }
  });
})();

/* ---------------- page tabs ---------------- */
const tabsEl = document.getElementById('tabs');
let tabsFor = '';
function buildTabs() {
  const n = pageCount(cfg);
  const key = `${n}:${isDuo(cfg)}:${isYear(cfg)}`;
  if (key === tabsFor) return;
  tabsFor = key;
  if (page >= n) page = 0;
  tabsEl.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const b = h('button', { class: 'tab', text: pageLabel(i, cfg) });
    b.addEventListener('click', () => {
      page = i;
      [...tabsEl.children].forEach((t, j) => t.classList.toggle('active', j === i));
      editor.onPageChange();
      schedule(0);
    });
    tabsEl.append(b);
  }
  tabsEl.children[page].classList.add('active');
}

/* ---------------- rendering ---------------- */
const canvas = document.getElementById('preview');

/* ---------------- on-screen zoom ----------------
   Zoom bar (bottom-right of the page area), Ctrl + mouse wheel / pinch, keys + - 0, and Space / middle-mouse drag to move around.
   100 % = the normal size; the preview is re-drawn sharper after zooming in. */
const wrapEl = canvas.parentElement;
const stageEl = wrapEl.parentElement;
const Z_MIN = 0.25;
const Z_MAX = 4;
let viewZoom = 1;
let zoomTimer = 0;
let zoomUi = null;
const baseWidth = () => Math.max(240, Math.min((wrapEl.clientWidth || 808) - 48, 760));
const cssWidth = () => baseWidth() * viewZoom;
/** pixel width the preview is drawn at: sharp enough for the zoom level, capped to keep dragging smooth */
const previewPx = () => Math.round(Math.min(2800, Math.max(900, cssWidth() * Math.min(window.devicePixelRatio || 1, 2))));

function updateZoomUi() {
  if (!zoomUi) return;
  zoomUi.val.textContent = `${Math.round(viewZoom * 100)}%`;
  zoomUi.range.value = Math.log(viewZoom);
}

/** zoom to z (1 = normal). ax/ay = screen point that stays put (default: centre of the visible area). */
function setZoom(z, ax, ay) {
  z = Math.min(Z_MAX, Math.max(Z_MIN, z));
  const wr = wrapEl.getBoundingClientRect();
  if (ax == null) ax = wr.left + wr.width / 2;
  if (ay == null) ay = wr.top + wr.height / 2;
  const c0 = canvas.getBoundingClientRect();
  const fx = c0.width ? (ax - c0.left) / c0.width : 0.5;
  const fy = c0.height ? (ay - c0.top) / c0.height : 0.5;
  viewZoom = z;
  canvas.style.width = `${Math.round(cssWidth())}px`;
  const c1 = canvas.getBoundingClientRect();
  wrapEl.scrollLeft += c1.left + fx * c1.width - ax;
  wrapEl.scrollTop += c1.top + fy * c1.height - ay;
  updateZoomUi();
  clearTimeout(zoomTimer);
  zoomTimer = setTimeout(() => drawPreview(), 140); // re-draw crisp once the zooming settles
}

function zoomFit() {
  const aspect = canvas.height ? canvas.width / canvas.height : 0.7;
  const w = Math.min(wrapEl.clientWidth - 48, (wrapEl.clientHeight - 48) * aspect);
  setZoom(w / baseWidth());
  wrapEl.scrollLeft = 0;
  wrapEl.scrollTop = 0;
}

(function buildZoomBar() {
  const btn = (text, title, fn, cls = '') => {
    const b = h('button', { text, title, type: 'button', class: cls });
    b.addEventListener('click', fn);
    return b;
  };
  const range = h('input', { type: 'range', min: Math.log(Z_MIN), max: Math.log(Z_MAX), step: 0.01, title: 'Zoom' });
  range.addEventListener('input', () => setZoom(Math.exp(Number(range.value))));
  const val = btn('100%', 'Back to 100%', () => setZoom(1), 'zval');
  const bar = h('div', { class: 'zoombar', title: 'Zoom the page. Ctrl + mouse wheel also zooms; hold Space and drag to move around.' },
    btn('−', 'Zoom out (-)', () => setZoom(viewZoom / 1.25)),
    range,
    btn('+', 'Zoom in (+)', () => setZoom(viewZoom * 1.25)),
    val,
    btn('Fit page', 'Show the whole page (0)', zoomFit, 'zfit'));
  stageEl.append(bar);
  zoomUi = { val, range };
  updateZoomUi();

  // Ctrl + wheel (also trackpad pinch) zooms around the pointer
  wrapEl.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(viewZoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)), e.clientX, e.clientY);
  }, { passive: false });

  // + / - / 0 keys
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/input|textarea|select/i.test(e.target.tagName) && e.target.type !== 'range') return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(viewZoom * 1.25); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(viewZoom / 1.25); }
    else if (e.key === '0') { e.preventDefault(); zoomFit(); }
  });

  // hand tool: hold Space (or use the middle mouse button) and drag to move around a zoomed page
  let space = false;
  let pan = null;
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || /input|textarea|select|button/i.test(e.target.tagName)) return;
    e.preventDefault();
    if (!space) { space = true; wrapEl.classList.add('hand'); }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code !== 'Space') return;
    space = false;
    if (!pan) wrapEl.classList.remove('hand');
  });
  wrapEl.addEventListener('pointerdown', (e) => {
    if (!(space && e.button === 0) && e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation(); // do not select / move layers while panning
    pan = { x: e.clientX, y: e.clientY, sl: wrapEl.scrollLeft, st: wrapEl.scrollTop, id: e.pointerId };
    wrapEl.setPointerCapture(e.pointerId);
    wrapEl.classList.add('hand', 'panning');
  }, true);
  wrapEl.addEventListener('pointermove', (e) => {
    if (!pan) return;
    wrapEl.scrollLeft = pan.sl - (e.clientX - pan.x);
    wrapEl.scrollTop = pan.st - (e.clientY - pan.y);
  });
  const endPan = () => {
    if (!pan) return;
    pan = null;
    wrapEl.classList.remove('panning');
    if (!space) wrapEl.classList.remove('hand');
  };
  wrapEl.addEventListener('pointerup', endPan);
  wrapEl.addEventListener('pointercancel', endPan);
  window.addEventListener('resize', () => setZoom(viewZoom));
})();

const statusEl = document.getElementById('status');
const setStatus = (t) => (statusEl.textContent = t);
// short messages from the editor stay visible for a few seconds instead of being overwritten by the page info
let flashUntil = 0;
const flash = (t) => {
  setStatus(t);
  flashUntil = performance.now() + 4500;
};

const pickPhoto = (idx) => (photos.length ? photos[idx % photos.length].img : null);

// every page (preview and all exports) goes through the editor so manual edits are included
function makePage(idx) {
  setMoonSet(cfg.moonSet);
  return editor.applyTo(idx, applyLook(buildPage(cfg, idx, pickPhoto(idx), logo ? logo.img : null)));
}

/** Left-panel controller: size and position of the lunar characters, tide times and moon faces on EVERY page.
    Runs after the auto-fit, so what you set here wins; the editor's own per-layer edits are applied on top. */
const LOOK_GROUPS = { 'Lunar days': 'lunar', 'Lunar dates': 'lunar', 'Tide times': 'tide', 'Moon phases': 'moon' };
function applyLook(pg) {
  const u = 1 / pg.geo.mmPerUnit;
  const walkL = (nodes, kind) => nodes.forEach((n) => {
    if (n.type === 'group') return walkL(n.children, LOOK_GROUPS[n.name] || kind);
    if (!kind) return;
    const sc = cfg[kind + 'Scale'] ?? 1;
    const dx = (cfg[kind + 'Dx'] || 0) * u;
    const dy = (cfg[kind + 'Dy'] || 0) * u;
    const grows = n.type === 'text' || (kind === 'moon' && n.type === 'moon');
    if (grows && sc !== 1) {
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      n.w *= sc; n.h *= sc;
      n.x = cx - n.w / 2; n.y = cy - n.h / 2;
      if (n.type === 'text' && n.size) n.size *= sc;
    }
    n.x += dx; n.y += dy;
  });
  if (['lunar', 'tide', 'moon'].some((k) => (cfg[k + 'Scale'] ?? 1) !== 1 || cfg[k + 'Dx'] || cfg[k + 'Dy'])) walkL(pg.children, '');
  return pg;
}

let timer = 0;
function schedule(delay = 120) {
  clearTimeout(timer);
  timer = setTimeout(drawPreview, delay);
}
let raf = 0;
function requestDraw() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    drawPreview();
  });
}

const editor = createEditor({
  canvas,
  getPage: () => page,
  getCfg: () => cfg,
  redraw: requestDraw,
  setStatus: flash,
  h,
  toolsEl: document.getElementById('tools'),
  inspEl: document.getElementById('inspector'),
  layersEl: document.getElementById('layers'),
});


/* ---------------- Moon picker ----------------
   Click any design: that artwork set is used for every moon cell of every month, in every template.
   Each cell keeps the phase computed for its own month (e.g. January: new moon 8th, first quarter 16th ...). */
(function buildMoonPicker() {
  const toolsEl = document.getElementById('tools');
  const wrap = h('span', { class: 'moon-wrap' });
  const b = h('button', { class: 'tool', title: 'Choose the moon-phase design for all months', text: '☾ Moon' });
  const pop = h('div', { class: 'moon-pop', hidden: '' });
  const PH = [['new', 'New Moon'], ['fq', 'First Quarter'], ['full', 'Full Moon'], ['lq', 'Last Quarter']];
  const fill = () => {
    pop.innerHTML = '';
    const col = cfg.themeA || cfg.weekend || '#d4141c';
    [1, 2, 3, 4, 5].forEach((set) => {
      const row = h('div', { class: 'moon-row' + (cfg.moonSet === set ? ' on' : '') });
      PH.forEach(([ph, label]) => {
        const cv = h('canvas', { width: 120, height: 120 });
        drawMoonTile(cv, set, ph, set === 3 || set === 5 ? '#888' : col);
        const t = h('button', { class: 'moon-tile', title: `Design ${set} — used on every month` }, cv, h('span', { text: label }));
        t.addEventListener('click', () => {
          cfg.moonSet = set;
          save();
          pop.hidden = true;
          schedule(0);
          flash(`Moon design ${set} applied to every month.`);
        });
        row.append(t);
      });
      pop.append(row);
    });
  };
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pop.hidden) fill();
    pop.hidden = !pop.hidden;
  });
  document.addEventListener('click', (e) => { if (!pop.contains(e.target)) pop.hidden = true; });
  wrap.append(b, pop);
  toolsEl.insertBefore(wrap, toolsEl.children[4] || null);
})();

function drawPreview() {
  try {
    buildTabs();
    const pg = makePage(page);
    canvas.style.width = `${Math.round(cssWidth())}px`;
    const k = previewPx() / pg.geo.Wt;
    const r = renderPage(pg, k);
    canvas.width = r.pxW;
    canvas.height = r.pxH;
    const pctx = canvas.getContext('2d');
    pctx.drawImage(r.composite, 0, 0);
    editor.setCurrent(pg, k);
    editor.drawOverlay(pctx);
    canvas.style.aspectRatio = `${r.pxW} / ${r.pxH}`;
    const g = pg.geo;
    const kx = (cfg.dpi / 25.4) * g.mmPerUnit;
    if (performance.now() > flashUntil) setStatus(
      `${pageTitle(cfg, page)} ${cfg.year} · ${cfg.pageSize} ${cfg.orientation}` +
        ` · export size ${Math.round(g.Wt * kx)} × ${Math.round(g.Ht * kx)} px at ${cfg.dpi} dpi`,
    );
  } catch (e) {
    console.error(e);
    setStatus(`Preview error: ${e.message}`);
  }
}

/* ---------------- exporting ---------------- */
const tick = () => new Promise((r) => setTimeout(r, 30));

function fileName(idx, ext) {
  let part = isYear(cfg) ? 'full-year' : '00-cover';
  if (idx > 0 && !isYear(cfg)) {
    const m = firstMonthOf(cfg, idx);
    part = isDuo(cfg)
      ? `${String(idx).padStart(2, '0')}-${MONTHS[m].toLowerCase()}-${MONTHS[m + 1].toLowerCase()}`
      : `${String(idx).padStart(2, '0')}-${MONTHS[m].toLowerCase()}`;
  }
  return `calendar-${cfg.year}-${part}.${ext}`;
}

function exportScale() {
  const g = pageGeometry(cfg);
  return (cfg.dpi / 25.4) * g.mmPerUnit;
}

function buildPsd(idx) {
  const k = exportScale();
  const r = renderPage(makePage(idx), k);
  return makePsd(r, { dpi: cfg.dpi, editableText: cfg.editableText, k });
}

function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function guarded(fn) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('.actions button').forEach((b) => (b.disabled = true));
  try {
    await fn();
  } catch (e) {
    console.error(e);
    setStatus(`Export failed: ${e.message}`);
  } finally {
    busy = false;
    document.querySelectorAll('.actions button').forEach((b) => (b.disabled = false));
  }
}

const PSD_TYPE = 'image/vnd.adobe.photoshop';

/** Save one page as a layered .psd (template + every edit you made in the editor).
    Chrome / Edge show a real "Save as" window; other browsers download the file. */
async function savePsd(idx = page) {
  const name = fileName(idx, 'psd');
  let handle = null;
  if (window.showSaveFilePicker) {
    try {
      handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'Photoshop document', accept: { [PSD_TYPE]: ['.psd'] } }] });
    } catch (e) {
      if (e.name === 'AbortError') return setStatus('Save cancelled.');
      handle = null; // picker blocked: fall back to a normal download
    }
  }
  setStatus('Converting to PSD…');
  await tick();
  const blob = new Blob([buildPsd(idx)], { type: PSD_TYPE });
  if (handle) {
    const w = await handle.createWritable();
    await w.write(blob);
    await w.close();
    setStatus(`Saved ${handle.name} (layered PSD - open it in Photoshop).`);
  } else {
    download(blob, name);
    setStatus(`Saved ${name} (layered PSD - open it in Photoshop).`);
  }
}

/** One page -> file bytes in the chosen format (psd / png / jpg). */
async function buildFile(idx, fmt, quality) {
  if (fmt === 'psd') return new Blob([buildPsd(idx)], { type: PSD_TYPE });
  const r = renderPage(makePage(idx), exportScale());
  let cv = r.composite;
  if (fmt === 'jpg') {
    // JPG has no transparency: flatten onto white
    const flat = document.createElement('canvas');
    flat.width = cv.width;
    flat.height = cv.height;
    const g = flat.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, flat.width, flat.height);
    g.drawImage(cv, 0, 0);
    cv = flat;
  }
  return new Promise((res) => cv.toBlob(res, fmt === 'jpg' ? 'image/jpeg' : 'image/png', quality));
}

/** Export the chosen pages. pack: 'zip' (one ZIP) or 'files' (separate downloads, lighter on memory at 300 dpi). */
async function exportPages(idxs, fmt, quality, pack) {
  const n = idxs.length;
  const FMT = fmt.toUpperCase();
  if (n === 1) {
    if (fmt === 'psd') return savePsd(idxs[0]);
    setStatus(`Rendering ${FMT}…`);
    await tick();
    download(await buildFile(idxs[0], fmt, quality), fileName(idxs[0], fmt));
    return setStatus(`Saved ${fileName(idxs[0], fmt)}`);
  }
  if (pack === 'zip') {
    const zip = new JSZip();
    for (let i = 0; i < n; i++) {
      setStatus(`Building ${FMT} ${i + 1} of ${n}…`);
      await tick();
      zip.file(fileName(idxs[i], fmt), await buildFile(idxs[i], fmt, quality), { compression: 'STORE' });
    }
    setStatus('Packing ZIP…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    const zname = `calendar-${cfg.year}-${fmt}.zip`;
    download(blob, zname);
    return setStatus(`Saved ${zname}`);
  }
  for (let i = 0; i < n; i++) {
    setStatus(`Building ${FMT} ${i + 1} of ${n}…`);
    await tick();
    download(await buildFile(idxs[i], fmt, quality), fileName(idxs[i], fmt));
    await new Promise((r) => setTimeout(r, 700)); // let the browser start each download
  }
  setStatus(`Saved ${n} ${FMT} files (check your browser allows multiple downloads).`);
}

/* ---------------- Export As… window (Photoshop style): pages on the left, preview in the middle, File Settings on the right ---------------- */
const exportUi = (function buildExportDialog() {
  const KEY = 'calendarstudio.export';
  let st = { fmt: 'psd', quality: 90, pack: 'zip' };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* storage blocked: fine */ }
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ } };

  let checked = new Set();
  let focus = 0;
  let thumbRun = 0;
  let prevRun = 0;
  const thumbs = new Map(); // idx -> canvas (drawn by renderThumbs)

  const mkSel = (opts, val) => {
    const s = h('select', {}, ...opts.map(([v, l]) => h('option', { value: v, text: l })));
    s.value = val;
    return s;
  };
  const row = (label, ctrl) => h('div', { class: 'xrow' }, h('label', { text: label }), ctrl);

  /* left: pages */
  const listEl = h('div', { class: 'xlist' });
  const allBtn = h('button', { class: 'link', type: 'button', text: 'All' });
  const noneBtn = h('button', { class: 'link', type: 'button', text: 'None' });
  const left = h('div', { class: 'xleft' },
    h('div', { class: 'xhead' }, h('span', { text: 'Pages' }), h('span', { class: 'xlinks' }, allBtn, noneBtn)),
    listEl);

  /* middle: preview */
  const prevCv = h('canvas', { class: 'xprev' });
  const prevCap = h('div', { class: 'xcap' });
  const mid = h('div', { class: 'xmid' }, h('div', { class: 'xstage' }, prevCv), prevCap);

  /* right: file settings */
  const fmtSel = mkSel([['psd', 'PSD (layered)'], ['png', 'PNG'], ['jpg', 'JPG']], st.fmt);
  const qRange = h('input', { type: 'range', min: 10, max: 100, step: 1 });
  qRange.value = st.quality;
  const qVal = h('span', { class: 'xval' });
  const qRow = row('Quality', h('div', { class: 'xq' }, qRange, qVal));
  const dpiSel = mkSel([[150, '150 dpi (fast, drafts)'], [200, '200 dpi'], [300, '300 dpi (print)']], cfg.dpi);
  const wOut = h('input', { type: 'text', readonly: '', tabindex: '-1' });
  const hOut = h('input', { type: 'text', readonly: '', tabindex: '-1' });
  const textChk = h('input', { type: 'checkbox' });
  textChk.checked = !!cfg.editableText;
  const textRow = h('label', { class: 'xcheck' }, textChk, h('span', { text: 'Keep text layers editable in Photoshop' }));
  const packSel = mkSel([['zip', 'One ZIP file'], ['files', 'Separate files, one by one']], st.pack);
  const packRow = row('Package', packSel);
  const sumEl = h('div', { class: 'xsum' });
  const right = h('div', { class: 'xright' },
    h('fieldset', {}, h('legend', { text: 'File Settings' }), row('Format', fmtSel), qRow, textRow),
    h('fieldset', {}, h('legend', { text: 'Image Size' }), row('Resolution', dpiSel), row('Width', h('div', { class: 'xpx' }, wOut, h('em', { text: 'px' }))), row('Height', h('div', { class: 'xpx' }, hOut, h('em', { text: 'px' })))),
    h('fieldset', {}, h('legend', { text: 'Pages' }), packRow, sumEl));

  const cancelBtn = h('button', { class: 'xbtn', type: 'button', text: 'Cancel' });
  const goBtn = h('button', { class: 'xbtn xgo', type: 'button', text: 'Export' });
  const closeX = h('button', { class: 'xclose', type: 'button', title: 'Close', 'aria-label': 'Close', text: '×' });
  const msg = h('div', { class: 'xmsg' });
  const dlg = h('div', { class: 'xdlg', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Export As' },
    h('div', { class: 'xtitle' }, h('span', { text: 'Export As' }), closeX),
    h('div', { class: 'xbody' }, left, mid, right),
    h('div', { class: 'xfoot' }, msg, cancelBtn, goBtn));
  const overlay = h('div', { class: 'xover', hidden: '' }, dlg);
  document.body.append(overlay);

  const idxs = () => [...checked].sort((a, b) => a - b);
  const ext = () => st.fmt;

  function sizePx() {
    const g = pageGeometry(cfg);
    const kx = (cfg.dpi / 25.4) * g.mmPerUnit;
    return [Math.round(g.Wt * kx), Math.round(g.Ht * kx)];
  }

  function sync() {
    const n = pageCount(cfg);
    const [w, hh] = sizePx();
    wOut.value = w;
    hOut.value = hh;
    qRow.hidden = st.fmt !== 'jpg';
    textRow.hidden = st.fmt !== 'psd';
    qVal.textContent = st.quality;
    const c = checked.size;
    packRow.hidden = c < 2;
    goBtn.disabled = busy || c === 0;
    goBtn.textContent = c > 1 ? `Export ${c} pages` : 'Export';
    sumEl.textContent = c === 0 ? 'Tick at least one page.' : `${c} of ${n} page${n > 1 ? 's' : ''} · ${w} × ${hh} px · .${ext()}`;
    [...listEl.children].forEach((r, i) => {
      r.classList.toggle('sel', i === focus);
      const cb = r.querySelector('input');
      if (cb) cb.checked = checked.has(i);
      const sz = r.querySelector('.xsz');
      if (sz) sz.textContent = `${w} × ${hh} · .${ext()}`;
    });
  }

  function buildList() {
    const n = pageCount(cfg);
    listEl.innerHTML = '';
    thumbs.clear();
    for (let i = 0; i < n; i++) {
      const cb = h('input', { type: 'checkbox', 'aria-label': `Export ${pageLabel(i, cfg)}` });
      cb.addEventListener('change', () => {
        if (cb.checked) checked.add(i); else checked.delete(i);
        sync();
      });
      const cv = h('canvas', { class: 'xthumb', width: 40, height: 52 });
      thumbs.set(i, cv);
      const r = h('div', { class: 'xitem', tabindex: '0' }, cb, cv,
        h('span', { class: 'xnm' }, h('b', { text: pageTitle(cfg, i) }), h('span', { class: 'xsz' })));
      const pick = (e) => {
        if (e && e.target === cb) return;
        focus = i;
        sync();
        drawPrev();
      };
      r.addEventListener('click', pick);
      r.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); cb.checked = !cb.checked; cb.dispatchEvent(new Event('change')); pick(); }
      });
      listEl.append(r);
    }
  }

  async function drawThumbs() {
    const run = ++thumbRun;
    for (const [i, cv] of thumbs) {
      await new Promise((r) => setTimeout(r, 10));
      if (run !== thumbRun || overlay.hidden) return;
      try {
        const pg = makePage(i);
        const r = renderPage(pg, 120 / pg.geo.Wt);
        const g = cv.getContext('2d');
        const s = Math.min(cv.width / r.pxW, cv.height / r.pxH);
        const dw = r.pxW * s, dh = r.pxH * s;
        g.clearRect(0, 0, cv.width, cv.height);
        g.fillStyle = '#fff';
        g.fillRect((cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
        g.drawImage(r.composite, (cv.width - dw) / 2, (cv.height - dh) / 2, dw, dh);
      } catch (e) { console.error(e); }
    }
  }

  async function drawPrev() {
    const run = ++prevRun;
    await new Promise((r) => setTimeout(r, 20));
    if (run !== prevRun || overlay.hidden) return;
    try {
      const pg = makePage(focus);
      const r = renderPage(pg, 640 / pg.geo.Wt);
      prevCv.width = r.pxW;
      prevCv.height = r.pxH;
      prevCv.getContext('2d').drawImage(r.composite, 0, 0);
      prevCap.textContent = `${pageTitle(cfg, focus)} ${cfg.year} · ${cfg.pageSize} ${cfg.orientation}`;
    } catch (e) { console.error(e); }
  }

  function open() {
    if (busy) return;
    const n = pageCount(cfg);
    focus = Math.min(page, n - 1);
    checked = new Set([focus]); // starts as "this page", like the old Download PSD button
    dpiSel.value = String(cfg.dpi);
    textChk.checked = !!cfg.editableText;
    msg.textContent = '';
    buildList();
    overlay.hidden = false;
    sync();
    drawPrev();
    drawThumbs();
    goBtn.focus();
  }
  function close() {
    overlay.hidden = true;
    thumbRun++;
    prevRun++;
  }

  allBtn.addEventListener('click', () => { checked = new Set([...Array(pageCount(cfg)).keys()]); sync(); });
  noneBtn.addEventListener('click', () => { checked = new Set(); sync(); });
  fmtSel.addEventListener('change', () => { st.fmt = fmtSel.value; persist(); sync(); });
  qRange.addEventListener('input', () => { st.quality = Number(qRange.value); persist(); sync(); });
  packSel.addEventListener('change', () => { st.pack = packSel.value; persist(); });
  // Resolution and "editable text" are the same settings as the "PSD export" group on the left, so keep both in step
  dpiSel.addEventListener('change', () => {
    cfg.dpi = Number(dpiSel.value);
    save();
    const f = formEl.querySelector('[data-k="dpi"]');
    if (f) f.value = cfg.dpi;
    schedule();
    sync();
  });
  textChk.addEventListener('change', () => {
    cfg.editableText = textChk.checked;
    save();
    const f = formEl.querySelector('[data-k="editableText"]');
    if (f) f.checked = cfg.editableText;
  });
  cancelBtn.addEventListener('click', close);
  closeX.addEventListener('click', close);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden && !busy) close(); });

  goBtn.addEventListener('click', async () => {
    const list = idxs();
    if (!list.length || busy) return;
    const watch = setInterval(() => { msg.textContent = statusEl.textContent; }, 150);
    await guarded(() => exportPages(list, st.fmt, st.quality / 100, st.pack));
    clearInterval(watch);
    msg.textContent = statusEl.textContent;
    sync();
  });
  // keep the Export button honest while an export is running
  const origDisable = () => { goBtn.disabled = busy || checked.size === 0; };
  new MutationObserver(origDisable).observe(document.querySelector('.actions'), { subtree: true, attributes: true, attributeFilter: ['disabled'] });

  return { open, close, isOpen: () => !overlay.hidden };
})();

document.getElementById('btnExport').addEventListener('click', () => exportUi.open());
document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
    e.preventDefault(); // Ctrl+S saves this page as PSD instead of the web page
    guarded(() => savePsd(page));
  } else if (mod && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') {
    e.preventDefault(); // Ctrl+Shift+E opens Export As…
    exportUi.open();
  }
});

drawPreview();
loadGoatArt(() => { drawPreview(); if (galleryRefresh) galleryRefresh(); });
loadWondersArt(() => { drawPreview(); if (galleryRefresh) galleryRefresh(); });
loadBorderArt((uri) => new Promise((res, rej) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = rej;
  im.src = uri;
}), BORDER_ART).then(drawPreview).catch(() => {});
loadMoonSprites((uri) => new Promise((res, rej) => {
  const im = new Image();
  im.onload = () => res(im);
  im.onerror = rej;
  im.src = uri;
}), { ...MOON_DATA, ...MOON_DATA2 }).then(() => { drawPreview(); if (galleryRefresh) galleryRefresh(); }).catch(() => {});

/* ---------------- Shared date cell picker (24 / 31) ----------------
   Visual choices for the box where two days share one cell on 6-week months. */
(function buildSharedPicker() {
  const toolsEl = document.getElementById('tools');
  const wrap = h('span', { class: 'moon-wrap' });
  const b = h('button', { class: 'tool', title: 'Choose how 24 / 31 is shown in the shared date box', text: '▨ 24/31' });
  const pop = h('div', { class: 'moon-pop shared-pop', hidden: '' });
  const CHOICES = SHARED_CELLS.filter(([k]) => k !== 'template');
  const draw = (cv, st) => {
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#555'; g.lineWidth = 3; g.strokeRect(2, 2, W - 4, H - 4);
    g.fillStyle = '#d4141c'; g.font = `bold ${H * 0.4}px Arial`; g.textBaseline = 'middle';
    g.strokeStyle = '#222'; g.lineWidth = 2;
    if (st === 'slash') { g.textAlign = 'center'; g.font = `bold ${H * 0.3}px Arial`; g.fillText('24/31', W / 2, H / 2); return; }
    if (st === 'rows' || st === 'rowsflip' || st === 'rowsfree') {
      const flip = st === 'rowsflip';
      const rowDraw = (n, glyph, yMid) => {
        g.fillStyle = '#d4141c'; g.font = `bold ${H * 0.3}px Arial`; g.textAlign = flip ? 'right' : 'left';
        g.fillText(n, flip ? W - 8 : 8, yMid);
        g.font = `${H * 0.17}px serif`; g.textAlign = 'center';
        g.fillText(glyph[0], W * 0.5, yMid - H * 0.07); g.fillText(glyph[1], W * 0.5, yMid + H * 0.09);
        g.fillStyle = '#1b2a9a'; g.font = `bold ${H * 0.1}px Arial`; g.textAlign = 'left';
        const tx = flip ? 8 : W * 0.62;
        g.fillText('1:05 PM', tx, yMid - H * 0.08); g.fillStyle = '#d4141c'; g.fillText('6:59 AM', tx, yMid + H * 0.08);
      };
      rowDraw('24', '十七', H * 0.26); rowDraw('31', '廿四', H * 0.75);
      if (st !== 'rowsfree') { g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.moveTo(2, H / 2); g.lineTo(W - 2, H / 2); g.stroke(); }
      return;
    }
    if (st === 'stacked') { g.textAlign = 'center'; g.fillText('24', W / 2, H * 0.26); g.fillText('31', W / 2, H * 0.74); g.beginPath(); g.moveTo(2, H / 2); g.lineTo(W - 2, H / 2); g.stroke(); return; }
    g.textAlign = 'left'; g.fillText('24', 8, H * 0.28);
    g.textAlign = 'right'; g.fillText('31', W - 8, H * 0.74);
    if (st === 'diagonal') { g.beginPath(); g.moveTo(W - 2, 2); g.lineTo(2, H - 2); g.stroke(); }
  };
  const fill = () => {
    pop.innerHTML = '';
    const row = h('div', { class: 'moon-row shared-row' });
    const own = h('button', { class: 'moon-tile' + (cfg.sharedCell === 'template' ? ' on' : ''), title: "Each template's own layout" }, h('span', { text: "Template's own" }));
    own.addEventListener('click', () => pick('template'));
    row.append(own);
    CHOICES.forEach(([k, label]) => {
      const cv = h('canvas', { width: 160, height: 120 });
      draw(cv, k);
      const t = h('button', { class: 'moon-tile' + (cfg.sharedCell === k ? ' on' : ''), title: label }, cv, h('span', { text: label.split(':')[0] }));
      t.addEventListener('click', () => pick(k));
      row.append(t);
    });
    pop.append(row);
  };
  const pick = (k) => {
    cfg.sharedCell = k;
    formEl.querySelectorAll('select[data-k="sharedCell"]').forEach((el) => { el.value = k; });
    save();
    pop.hidden = true;
    schedule(0);
    flash(`Shared date box: ${(SHARED_CELLS.find(([v]) => v === k) || [])[1] || k}.`);
  };
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pop.hidden) fill();
    pop.hidden = !pop.hidden;
  });
  document.addEventListener('click', (e) => { if (!pop.contains(e.target)) pop.hidden = true; });
  wrap.append(b, pop);
  toolsEl.insertBefore(wrap, toolsEl.children[5] || null);
})();

/* ---------------- Moon position picker ----------------
   Visual choices for where the phase name, moon face and date sit inside every moon cell. */
(function buildMoonPosPicker() {
  const toolsEl = document.getElementById('tools');
  const wrap = h('span', { class: 'moon-wrap' });
  const b = h('button', { class: 'tool', title: 'Choose where the moon name, face and date sit in the moon cells', text: '☾ Position' });
  const pop = h('div', { class: 'moon-pop shared-pop', hidden: '' });
  const CHOICES = MOON_POS.filter(([k]) => k !== 'template');
  const draw = (cv, st) => {
    const g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#555'; g.lineWidth = 3; g.strokeRect(2, 2, W - 4, H - 4);
    const red = '#d4141c';
    const bar = (x, y, w, al) => { g.fillStyle = red; g.fillRect(al === 'right' ? x - w : al === 'center' ? x - w / 2 : x, y, w, H * 0.07); };
    const disc = (cx, cy, r) => { g.fillStyle = '#fff'; g.strokeStyle = red; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke(); };
    if (st === 'stack') { bar(W / 2, H * 0.09, W * 0.6, 'center'); disc(W / 2, H * 0.5, H * 0.24); bar(W / 2, H * 0.84, W * 0.45, 'center'); }
    else if (st === 'facetop') { disc(W / 2, H * 0.3, H * 0.24); bar(W / 2, H * 0.62, W * 0.6, 'center'); bar(W / 2, H * 0.76, W * 0.45, 'center'); }
    else if (st === 'none') { disc(W / 2, H * 0.5, H * 0.3); g.strokeStyle = '#888'; g.lineWidth = 5; g.beginPath(); g.moveTo(W / 2 - H * 0.26, H * 0.5 + H * 0.26); g.lineTo(W / 2 + H * 0.26, H * 0.5 - H * 0.26); g.stroke(); }
    else if (st === 'textleft') { bar(10, H * 0.1, W * 0.55, 'left'); bar(10, H * 0.23, W * 0.38, 'left'); disc(W * 0.72, H * 0.68, H * 0.22); }
    else { bar(W - 10, H * 0.1, W * 0.55, 'right'); bar(W - 10, H * 0.23, W * 0.38, 'right'); disc(W * 0.28, H * 0.68, H * 0.22); }
  };
  const pick = (k) => {
    cfg.moonPos = k;
    if (k !== 'none') cfg.showMoon = true;
    formEl.querySelectorAll('input[data-k="showMoon"]').forEach((el) => { el.checked = !!cfg.showMoon; });
    formEl.querySelectorAll('select[data-k="moonPos"]').forEach((el) => { el.value = k; });
    save();
    pop.hidden = true;
    schedule(0);
    flash(k === 'none' ? 'No moon phases on any page.' : `Moon position: ${(MOON_POS.find(([v]) => v === k) || [])[1] || k}.`);
  };
  const fill = () => {
    pop.innerHTML = '';
    const row = h('div', { class: 'moon-row shared-row' });
    const own = h('button', { class: 'moon-tile' + (cfg.moonPos === 'template' ? ' on' : ''), title: "Each template's own layout" }, h('span', { text: "Template's own" }));
    own.addEventListener('click', () => pick('template'));
    row.append(own);
    CHOICES.forEach(([k, label]) => {
      const cv = h('canvas', { width: 160, height: 120 });
      draw(cv, k);
      const t = h('button', { class: 'moon-tile' + (cfg.moonPos === k ? ' on' : ''), title: label }, cv, h('span', { text: label }));
      t.addEventListener('click', () => pick(k));
      row.append(t);
    });
    pop.append(row);
  };
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pop.hidden) fill();
    pop.hidden = !pop.hidden;
  });
  document.addEventListener('click', (e) => { if (!pop.contains(e.target)) pop.hidden = true; });
  wrap.append(b, pop);
  toolsEl.insertBefore(wrap, toolsEl.children[6] || null);
})();

/* ---------------- Tides ON / OFF switch ----------------
   One click in the toolbar hides (or shows) the high / low tide schedule on every page, for clients who do not want tides.
   Same setting as Calendar -> "Tide times". */
(function buildTideSwitch() {
  const toolsEl = document.getElementById('tools');
  const b = h('button', { class: 'tool', title: 'Show or hide the High Tide / Low Tide schedule on the calendar (every page)' });
  const paint = () => {
    b.textContent = cfg.showTides ? '🌊 Tides: ON' : '🌊 Tides: OFF';
    b.classList.toggle('on', !!cfg.showTides);
  };
  b.addEventListener('click', () => {
    cfg.showTides = !cfg.showTides;
    formEl.querySelectorAll('input[data-k="showTides"]').forEach((el) => { el.checked = !!cfg.showTides; });
    save();
    paint();
    schedule(0);
    const tooSmall = ['yearsari', 'yearpharma', 'collage'].includes(cfg.template);
    flash(!cfg.showTides ? 'Tide schedule is OFF: no tide times on any page.'
      : tooSmall ? 'Tide schedule is ON, but this design has date cells too small to print tide times. Pick another design to show them.'
      : 'Tide schedule is ON: high tide (blue) and low tide (red) in every date cell.');
  });
  formEl.addEventListener('input', paint);
  paint();
  toolsEl.insertBefore(b, toolsEl.children[5] || null);
})();

/* ---------------- Moon & tides panel (left): the toolbar buttons moved here + size / position controllers ---------------- */
(function buildLookPanel() {
  const toolsEl = document.getElementById('tools');
  const byText = (re) => [...toolsEl.querySelectorAll('button.tool')].find((b) => re.test(b.textContent));
  const moveOut = (btn) => (btn && btn.parentElement && btn.parentElement.classList.contains('moon-wrap') ? btn.parentElement : btn);
  const bMoon = moveOut(byText(/^☾ Moon$/));
  const bPos = moveOut(byText(/^☾ Position$/));
  const bShared = moveOut(byText(/24\/31/));
  const bTide = byText(/^🌊/);

  // popups open next to the panel (the panel scrolls, so they cannot sit inside it)
  const placePop = (wrap) => () => {
    const pop = wrap.querySelector && wrap.querySelector('.moon-pop');
    if (!pop || pop.hidden) return;
    const r = wrap.getBoundingClientRect();
    const pr = (document.querySelector('.panel') || wrap).getBoundingClientRect(); // open beside the settings panel, not on top of it
    const w = Math.min(460, window.innerWidth * 0.9);
    const left = pr.right + 10 + w < window.innerWidth ? pr.right + 10 : Math.max(8, pr.left - w - 10);
    pop.style.left = `${left}px`;
    pop.style.top = `${Math.max(8, Math.min(r.top, window.innerHeight - 420))}px`;
  };
  [bMoon, bPos, bShared].forEach((w) => { if (w && w.querySelector) w.querySelector('button').addEventListener('click', placePop(w)); });

  const hd = (t) => h('div', { class: 'lookhead', text: t });
  const btnRow = (...els) => h('div', { class: 'lookbtns' }, ...els.filter(Boolean));

  let step = 0.5;
  const stepSel = h('select', {}, ...[0.25, 0.5, 1, 2, 5].map((v) => h('option', { value: v, text: `${v} mm` })));
  stepSel.value = String(step);
  stepSel.addEventListener('change', () => { step = Number(stepSel.value); });
  const readouts = [];

  /** one controller: A- / A+ for size, arrow pad for position, reset */
  function controller(kind, label) {
    const out = h('div', { class: 'lookout' });
    const paint = () => {
      const sc = Math.round((cfg[kind + 'Scale'] ?? 1) * 100);
      out.textContent = `Size ${sc}% · X ${(cfg[kind + 'Dx'] || 0).toFixed(2)} mm · Y ${(cfg[kind + 'Dy'] || 0).toFixed(2)} mm`;
    };
    readouts.push(paint);
    const set = (k, v) => { cfg[k] = v; save(); paint(); schedule(0); };
    const size = (d, ev) => {
      const v = Math.round(((cfg[kind + 'Scale'] ?? 1) + d * (ev.shiftKey ? 0.2 : 0.05)) * 100) / 100;
      set(kind + 'Scale', Math.min(2.5, Math.max(0.4, v)));
    };
    const move = (dx, dy) => {
      if (dx) set(kind + 'Dx', Math.round(((cfg[kind + 'Dx'] || 0) + dx * step) * 100) / 100);
      if (dy) set(kind + 'Dy', Math.round(((cfg[kind + 'Dy'] || 0) + dy * step) * 100) / 100);
    };
    const mk = (txt, tip, fn, cls = '') => {
      const b = h('button', { class: 'tool ' + cls, type: 'button', title: tip, 'aria-label': tip, text: txt });
      b.addEventListener('click', fn);
      return b;
    };
    const reset = h('button', { class: 'link', type: 'button', text: 'Reset' });
    reset.addEventListener('click', () => { cfg[kind + 'Scale'] = 1; cfg[kind + 'Dx'] = 0; cfg[kind + 'Dy'] = 0; save(); paint(); schedule(0); });
    paint();
    return h('div', { class: 'ctl' },
      h('div', { class: 'ctlt' }, h('b', { text: label }), reset),
      h('div', { class: 'ctlrow' },
        h('div', { class: 'szcol' },
          mk('A+', 'Bigger (Shift = 20%)', (ev) => size(1, ev)),
          mk('A−', 'Smaller (Shift = 20%)', (ev) => size(-1, ev))),
        h('div', { class: 'dpad' },
          mk('▲', 'Move up', () => move(0, -1), 'pu'), mk('◀', 'Move left', () => move(-1, 0), 'pl'),
          mk('▶', 'Move right', () => move(1, 0), 'pr'), mk('▼', 'Move down', () => move(0, 1), 'pd'))),
      out);
  }

  // lunar characters on/off (same setting as Calendar -> Lunar day characters)
  const lunarChk = h('input', { type: 'checkbox' });
  lunarChk.checked = !!cfg.showLunar;
  lunarChk.addEventListener('change', () => {
    cfg.showLunar = lunarChk.checked;
    formEl.querySelectorAll('input[data-k="showLunar"]').forEach((el) => { el.checked = cfg.showLunar; });
    save();
    schedule(0);
  });
  formEl.addEventListener('input', () => { lunarChk.checked = !!cfg.showLunar; });

  lookBody.append(
    h('div', { class: 'hint', text: 'Size and position apply to every page. Arrow buttons move by the step below.' }),
    h('label', { class: 'field' }, h('span', { text: 'Move by' }), stepSel),
    hd('Moon'), btnRow(bMoon, bPos), controller('moon', 'Moon faces'),
    hd('Tides'), btnRow(bTide), controller('tide', 'Tide times'),
    hd('Lunar day characters'),
    h('label', { class: 'field check' }, lunarChk, h('span', { text: 'Show lunar day characters (初一 …)' })),
    controller('lunar', 'Lunar characters'),
    hd('Shared date box'), btnRow(bShared),
  );
  // moon / tide / lunar settings may be changed elsewhere (templates, reset): keep the read-outs honest
  formEl.addEventListener('input', () => readouts.forEach((f) => f()));
})();

/* ---------------- Design gallery (like Photoshop's Home / Recent view) ----------------
   "▦ Designs" opens a grid with a thumbnail of the calendar page for every template, drawn with your current year, colours,
   photos, logo and moon settings. Click one to switch the calendar to that design. */
const GREEN_RED_PREVIEW = { themeA: '#d4141c', themeB: '#1f8a3b', weekend: '#d4141c', primary: '#1f8a3b', accent: '#1f8a3b', text: '#1f8a3b' };
// design key -> month page (1 = January) shown on its landscape gallery card
const BLACK_RED_PREVIEW = { themeA: '#e4151c', themeB: '#111111', weekend: '#e4151c', primary: '#111111', accent: '#111111', text: '#111111' };
// Landscape look of Sky, Minimal, Bold, Pink floral, Philippine ornate and Two-month ornate (Green & Red, Jan 2027): theme + the few settings that make the sample picture.
// Used for the landscape gallery cards and applied when one of those four landscape cards is clicked. Portrait and every other design are untouched.
const BLANK_BRAND = { company: '', tagline: '', phone: '', email: '', website: '', address: '' };
const LANDSCAPE_PREVIEWS = {
  sky: { month: 1, theme: GREEN_RED_PREVIEW, look: { moonPos: 'facetop', sharedCell: 'slash' }, blank: true },
  minimal: { month: 2, theme: GREEN_RED_PREVIEW, look: {}, blank: true },
  bold: { month: 2, theme: GREEN_RED_PREVIEW, look: {}, blank: true },
  ornate: { month: 1, theme: GREEN_RED_PREVIEW, look: { moonPos: 'facetop', borderStyle: 'none' }, blank: true },
  pink: { month: 1, theme: GREEN_RED_PREVIEW, look: { moonPos: 'facetop', sharedCell: 'slash' }, blank: true },
  duoornate: { month: 1, theme: GREEN_RED_PREVIEW, look: { moonPos: 'facetop' }, blank: true },
};
function applyLandscapeLook(key) {
  const fx = LANDSCAPE_PREVIEWS[key];
  if (!fx || !fx.blank) return;
  Object.assign(cfg, fx.look);
  cfg.showMoon = true;
  Object.entries(fx.look).forEach(([k, v]) => formEl.querySelectorAll(`select[data-k="${k}"]`).forEach((el) => { el.value = v; }));
  applyTheme(fx.theme.themeA, fx.theme.themeB);
}
(function buildGallery() {
  const toolsEl = document.getElementById('tools');
  const b = h('button', { class: 'tool', title: 'See every calendar design as a picture and pick one', text: '▦ Designs' });
  const overlay = h('div', { class: 'gal-overlay', hidden: '' });
  const filter = h('input', { type: 'text', placeholder: 'Filter designs…', class: 'gal-filter' });
  const grid = h('div', { class: 'gal-sections' });
  const closeBtn = h('button', { class: 'gal-close', title: 'Back to the editor without changing the design', text: 'Continue editing ›' });
  overlay.append(
    h('div', { class: 'gal-box' },
      h('div', { class: 'gal-head' }, h('div', { class: 'gal-title' }, h('h2', { text: 'Welcome to Calendar PSD Studio' }), h('p', { text: 'Pick a calendar design to start. Each picture uses your current year, colours, photos, logo and moon settings.' })), filter, closeBtn),
      grid),
  );
  document.body.append(overlay);

  const close = () => { overlay.hidden = true; gen++; };
  let gen = 0;
  const templates = () => [...formEl.querySelector('select[data-k="template"]').options].map((o) => {
    const [name, ...rest] = o.text.split(' (');
    return { key: o.value, name, note: rest.join(' (').replace(/\)$/, '') };
  });

  const ORI = [['portrait', 'Portrait designs', 'Tall pages — the photo / ads area sits on top'], ['landscape', 'Landscape designs', 'Wide pages — the calendar fills the sheet']];
  const open = () => {
    overlay.hidden = false;
    filter.value = '';
    grid.innerHTML = '';
    const my = ++gen;
    const cards = [];
    // the orientation you are working in comes first
    [...ORI].sort((x, y) => (x[0] === cfg.orientation ? -1 : y[0] === cfg.orientation ? 1 : 0)).forEach(([ori, title, sub]) => {
      const sec = h('section', { class: 'gal-section' }, h('h3', { class: 'gal-sec', text: title }), h('p', { class: 'gal-subsec', text: sub }));
      const g = h('div', { class: 'gal-grid ' + ori });
      sec.append(g);
      grid.append(sec);
      templates().forEach((t) => {
        const cv = h('canvas', { class: 'gal-thumb' });
        const card = h('button', { class: 'gal-card' + (cfg.template === t.key && cfg.orientation === ori ? ' on' : ''), title: `${t.name} — ${ori}` }, h('div', { class: 'gal-pic' }, cv), h('b', { text: t.name }), h('span', { text: t.note }));
        card.dataset.search = `${t.name} ${t.note}`.toLowerCase();
        card.addEventListener('click', () => {
          cfg.template = t.key;
          cfg.orientation = ori;
          formEl.querySelectorAll('select[data-k="template"]').forEach((el) => { el.value = t.key; });
          formEl.querySelectorAll('select[data-k="orientation"]').forEach((el) => { el.value = ori; });
          page = 0;
          if (ori === 'landscape') applyLandscapeLook(t.key);
          save();
          close();
          schedule(0);
          flash(`Design: ${t.name} (${ori}).`);
        });
        g.append(card);
        cards.push({ t, cv, ori });
      });
    });
    // draw the thumbnails one after another so the window stays responsive
    let i = 0;
    const next = () => {
      if (my !== gen || i >= cards.length) return;
      const { t, cv, ori } = cards[i++];
      try {
        let c = { ...cfg, template: t.key, orientation: ori };
        setMoonSet(cfg.moonSet);
        let idx = isYear(c) ? 0 : 1;
        let ph = pickPhoto(idx);
        let lg = logo ? logo.img : null;
        // landscape cards of these four designs show the fixed sample picture (Green & Red, 2027, no photo / logo); portrait cards are unchanged
        const fx = ori === 'landscape' ? LANDSCAPE_PREVIEWS[t.key] : null;
        if (fx) {
          c = { ...c, ...fx.theme, ...(fx.blank ? BLANK_BRAND : {}), ...fx.look, year: 2027, holidays: DEFAULTS.holidays, showHolidays: true, weekStart: 0, showAdj: false };
          idx = fx.month;
          ph = null;
          lg = null;
        }
        const pg = buildPage(c, idx, ph, lg);
        const r = renderPage(pg, (ori === 'landscape' ? 600 : 420) / pg.geo.Wt);
        cv.width = r.pxW;
        cv.height = r.pxH;
        cv.getContext('2d').drawImage(r.composite, 0, 0);
      } catch (e) {
        console.error(e);
      }
      setTimeout(next, 10);
    };
    next();
  };

  filter.addEventListener('input', () => {
    const q = filter.value.trim().toLowerCase();
    grid.querySelectorAll('.gal-card').forEach((c) => { c.hidden = !!q && !c.dataset.search.includes(q); });
    grid.querySelectorAll('.gal-section').forEach((sec) => { sec.hidden = ![...sec.querySelectorAll('.gal-card')].some((c) => !c.hidden); });
  });
  galleryRefresh = () => { if (!overlay.hidden) { const q = filter.value; open(); filter.value = q; filter.dispatchEvent(new Event('input')); } };
  b.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) close(); });
  toolsEl.insertBefore(b, toolsEl.firstChild);
  open(); // the gallery is the opening screen of the site
})();

/* ---------------- Hide / show the navigation ----------------
   Small floating bar (bottom centre): hide the top toolbar, the left settings panel and / or the right layers panel
   to give the calendar the whole screen. "Focus" hides all three at once (keyboard: the \ key). Remembered between visits. */
(function buildNavToggle() {
  const KEY = 'calendarstudio.nav';
  const parts = { top: 'hide-top', left: 'hide-left', right: 'hide-right' };
  let st = { top: false, left: false, right: false };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { /* storage blocked: fine */ }
  const bar = h('div', { class: 'navtoggle', title: 'Hide or show the menus' });
  const btns = {};
  const apply = () => {
    Object.entries(parts).forEach(([k, cls]) => document.body.classList.toggle(cls, !!st[k]));
    Object.entries(btns).forEach(([k, b]) => b.classList.toggle('off', k === 'focus' ? st.top && st.left && st.right : !!st[k]));
    btns.focus.textContent = st.top && st.left && st.right ? '⛶ Show all' : '⛶ Focus';
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ }
    window.dispatchEvent(new Event('resize')); // refit the page preview to the new space
  };
  const mk = (k, label, tip, fn) => {
    const b = h('button', { type: 'button', title: tip });
    b.textContent = label;
    b.addEventListener('click', fn);
    btns[k] = b;
    bar.appendChild(b);
  };
  mk('left', '◧ Settings', 'Hide / show the left settings panel', () => { st.left = !st.left; apply(); });
  mk('top', '▤ Toolbar', 'Hide / show the top page tabs, download buttons and tools', () => { st.top = !st.top; apply(); });
  mk('right', 'Layers ◨', 'Hide / show the right Properties + Layers panel', () => { st.right = !st.right; apply(); });
  mk('focus', '⛶ Focus', 'Hide / show everything (shortcut: \\ key)', () => {
    const all = st.top && st.left && st.right;
    st = { top: !all, left: !all, right: !all };
    apply();
  });
  // workspace presets: where the panels sit
  const WS = [['classic', 'Classic'], ['ps', 'Photoshop (tools left, panels right)'], ['swap', 'Swap sides'], ['left', 'Both panels left']];
  const WSKEY = 'calendarstudio.workspace';
  let ws = 'classic';
  try { ws = localStorage.getItem(WSKEY) || 'classic'; } catch (e) { /* storage blocked: fine */ }
  if (!WS.some(([v]) => v === ws)) ws = 'classic';
  const wsSel = h('select', { title: 'Choose where the panels sit' }, ...WS.map(([v, l]) => h('option', { value: v, text: l })));
  const applyWs = () => {
    WS.forEach(([v]) => document.body.classList.toggle('ws-' + v, v === ws && v !== 'classic'));
    wsSel.value = ws;
    try { localStorage.setItem(WSKEY, ws); } catch (e) { /* ignore */ }
    window.dispatchEvent(new Event('resize'));
  };
  wsSel.addEventListener('change', () => { ws = wsSel.value; applyWs(); });
  bar.appendChild(h('div', { class: 'wsbar' }, h('span', { text: 'Workspace' }), wsSel));
  document.body.appendChild(bar);
  applyWs();

  // drag the edge of the Settings / Properties panel to resize it (double-click = reset)
  const WKEY = 'calendarstudio.widths';
  let wd = {};
  try { wd = JSON.parse(localStorage.getItem(WKEY) || '{}'); } catch (e) { /* ignore */ }
  const root = document.documentElement;
  const setW = (v, px) => { if (px) root.style.setProperty(v, px + 'px'); else root.style.removeProperty(v); };
  setW('--lw', wd.lw); setW('--rw', wd.rw);
  const mkSplit = (cls, panelSel, varName, key) => {
    const el = h('div', { class: 'splitter ' + cls, title: 'Drag to resize this panel (double-click to reset)' });
    document.body.appendChild(el);
    const panel = () => document.querySelector(panelSel);
    const inner = (r) => { // the panel edge that touches the canvas
      const st = document.querySelector('.stage').getBoundingClientRect();
      return r.left + r.width / 2 < st.left + st.width / 2 ? { x: r.right, left: true } : { x: r.left, left: false };
    };
    const place = () => {
      const p = panel();
      if (!p || getComputedStyle(p).display === 'none' || window.innerWidth <= 960) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.left = inner(p.getBoundingClientRect()).x + 'px';
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('drag');
      document.body.classList.add('dragging-split');
      const move = (ev) => {
        const r = panel().getBoundingClientRect();
        const w = inner(r).left ? ev.clientX - r.left : r.right - ev.clientX;
        const px = Math.round(Math.max(220, Math.min(620, w)));
        setW(varName, px); wd[key] = px; place();
        window.dispatchEvent(new Event('resize'));
      };
      const up = () => {
        el.classList.remove('drag');
        document.body.classList.remove('dragging-split');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        try { localStorage.setItem(WKEY, JSON.stringify(wd)); } catch (err) { /* ignore */ }
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });
    el.addEventListener('dblclick', () => {
      setW(varName, null); delete wd[key];
      try { localStorage.setItem(WKEY, JSON.stringify(wd)); } catch (err) { /* ignore */ }
      window.dispatchEvent(new Event('resize'));
    });
    window.addEventListener('resize', place);
    new MutationObserver(place).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setTimeout(place, 0);
  };
  mkSplit('s-left', '.panel', '--lw', 'lw');
  mkSplit('s-right', '.side', '--rw', 'rw');
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key !== '\\' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    btns.focus.click();
  });
  apply();
})();

/* ---------------- Lock / freeze the design ----------------
   The padlock in the zoom bar freezes the calendar: nothing can be selected, moved, resized, typed into, deleted,
   dropped, pasted or undone, and the settings / tools / layers panels are switched off. Zoom, page tabs and the
   download buttons still work. Click the padlock again to unlock. Remembered between visits. */
(function buildLock() {
  const KEY = 'calendarstudio.locked';
  let locked = false;
  try { locked = localStorage.getItem(KEY) === '1'; } catch (e) { /* storage blocked: fine */ }
  const bar = document.querySelector('.zoombar');
  const wrap = document.querySelector('.canvas-wrap');
  if (!bar || !wrap) return;
  const btn = h('button', { type: 'button', class: 'zlock' });
  bar.append(btn);
  const badge = h('div', { class: 'lockbadge' });
  badge.textContent = '🔒 Design locked — click the padlock to edit again';
  stageEl.append(badge);
  const inertEls = [document.querySelector('.panel'), document.querySelector('.side'), document.getElementById('tools')].filter(Boolean);

  const apply = (announce) => {
    document.body.classList.toggle('locked', locked);
    btn.classList.toggle('on', locked);
    btn.textContent = locked ? '🔒' : '🔓';
    btn.title = locked ? 'Design is LOCKED (nothing can move or change). Click to unlock.' : 'Lock the design so nothing can be moved or changed';
    inertEls.forEach((el) => (locked ? el.setAttribute('inert', '') : el.removeAttribute('inert')));
    try { localStorage.setItem(KEY, locked ? '1' : '0'); } catch (e) { /* ignore */ }
    if (announce) flash(locked ? 'Design locked: nothing can be moved or changed.' : 'Design unlocked.');
  };
  btn.addEventListener('click', () => { locked = !locked; apply(true); });

  // block every editing gesture on the page itself (capture phase = before the editor sees it)
  const stop = (e) => { if (locked) { e.stopImmediatePropagation(); e.preventDefault(); } };
  ['pointerdown', 'pointermove', 'pointerup', 'dblclick', 'dragover', 'drop', 'contextmenu'].forEach((t) => {
    wrap.addEventListener(t, (e) => {
      if (!locked) return;
      // let the hand tool (Space / middle mouse) and scrolling keep working
      if ((t === 'pointermove' || t === 'pointerup') && e.target !== canvas) return;
      if (t === 'pointerdown' && e.button === 1) return;
      stop(e);
    }, true);
  });
  document.addEventListener('paste', stop, true);
  const EDIT_KEYS = ['Delete', 'Backspace', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'];
  document.addEventListener('keydown', (e) => {
    if (!locked) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const editing = EDIT_KEYS.includes(e.key) || (mod && ['z', 'y', 'a', 'c', 'x', 'v', 'd', '[', ']'].includes(k)) || (mod && (e.code === 'BracketLeft' || e.code === 'BracketRight'));
    if (editing && !(e.target && e.target.type === 'range')) stop(e);
  }, true);
  apply(false);
})();

/* ---------------- Editing toolbar -> left panel "Tools" ----------------
   Everything that used to sit in the bar above the page (Designs, Select, Text, Rectangle, Duplicate, order, Delete, Undo / Redo, Snap)
   now lives in the Tools panel on the left rail. The buttons keep their handlers, so they work exactly as before. */
(function moveToolsToPanel() {
  const src = document.getElementById('tools');
  const dst = document.querySelector('#form .toolsbody');
  if (!src || !dst) return;
  [...src.children].forEach((el) => dst.append(el));
  src.hidden = true;
  document.body.classList.add('tools-in-panel');
})();
