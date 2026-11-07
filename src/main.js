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
    custom: 'images',
  },
  {
    title: 'Calendar',
    open: true,
    fields: [
      { k: 'year', label: 'Year', type: 'number', min: 1970, max: 2200 },
      { k: 'template', label: 'Template', type: 'select', options: [['classic', 'Classic wall'], ['minimal', 'Minimal studio'], ['bold', 'Bold corporate'], ['phil', 'Philippine wall (black & red, moon phases)'], ['ornate', 'Philippine ornate (patterned border, tides, lunar days)'], ['navy', 'Philippine navy (blue & red, big numbers, year of the animal)'], ['bigblack', 'Big black & red (huge numbers, moon cells, legal holidays)'], ['duo', 'Two-month blue & red (verse banner, 2 months per sheet)'], ['duoornate', 'Two-month black & red ornate (border, tides, lunar, notes)'], ['chinese', 'Chinese lunar wall (lunar dates, solar terms, 宜/忌)'], ['duoblack', 'Two-month black & red (zodiac art + outline year header, moon times)'], ['pink', 'Pink floral (script month, magenta bar, moon cells, legal holidays)'], ['sky', 'Sky blue bubbles (script month, aqua bar, moon cells, legal holidays)'], ['collage', 'Photo collage, 2 months + notes (angled photos, script title)'], ['yearsari', 'Full-year poster — red & blue (photo banner, holidays box, footer bar)'], ['yearpharma', 'Full-year poster — red & green (swoosh header, grid months)']] },
      { k: 'weekStart', label: 'Week starts on', type: 'select', num: true, options: [[0, 'Sunday'], [1, 'Monday']] },
      { k: 'showHolidays', label: 'Show holiday names', type: 'checkbox' },
      { k: 'holidayStyle', label: 'Holiday layout (name on the date cell)', type: 'select', options: HOLIDAY_STYLES },
      { k: 'sharedCell', label: 'Shared date cell on 6-week months (24 / 31)', type: 'select', options: SHARED_CELLS },
      { k: 'showAdj', label: 'Show previous/next month days', type: 'checkbox' },
      {
        k: 'holidays', label: 'Holidays — one per line: MM-DD Name (or YYYY-MM-DD Name)', type: 'textarea',
        preset: { label: 'Fill with the Philippine 2027 list from your sample', value: PH_2027 },
        preset2: { label: 'Fill with the grouped 2027 list (year-poster templates: # headings make the columns)', value: PH_2027_GROUPED },
      },
      { k: 'holidaysTitle', label: 'Holiday box title (Philippine template)', type: 'text' },
      { k: 'reminders', label: 'Monthly reminders — MM-DD Text, or *-DD Text for every month (Philippine template)', type: 'textarea' },
      { k: 'remindersTitle', label: 'Reminders box title (Philippine template)', type: 'text' },
      { k: 'showMoon', label: 'Moon phases (all templates)', type: 'checkbox' },
      { k: 'moonPos', label: 'Moon style position (name / face / date in the moon cell)', type: 'select', options: MOON_POS },
      { k: 'showLunar', label: 'Lunar day characters (Philippine ornate)', type: 'checkbox' },
      { k: 'showTides', label: 'Tide times (Philippine ornate)', type: 'checkbox' },
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
const THEMES = [
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
];

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
  const refresh = () => {
    [...swatches.children].forEach((b, i) => {
      b.classList.toggle('on', (cfg.themeA || '') === THEMES[i][1] && (cfg.themeB || '') === THEMES[i][2]);
    });
    pickA.value = cfg.themeA || cfg.weekend;
    pickB.value = cfg.themeB || cfg.primary;
  };
  THEMES.forEach(([name, a, b]) => {
    const dot = (col) => { const d = h('i'); d.style.background = col || '#888'; return d; };
    const btn = h('button', { class: 'swatch', title: name }, name === 'Original' ? h('i', { class: 'orig', text: '↺' }) : h('span', { class: 'dots' }, dot(b), dot(a)), h('em', { text: name }));
    btn.addEventListener('click', () => { applyTheme(a, b); refresh(); });
    swatches.append(btn);
  });
  const custom = () => { applyTheme(pickA.value, pickB.value); refresh(); };
  pickA.addEventListener('input', custom);
  pickB.addEventListener('input', custom);
  wrap.append(
    h('div', { class: 'hint', text: 'Pick a colour pair — every month and every page updates automatically. The name reads Main & Highlight.' }),
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
  const logoInfo = h('div', { class: 'hint', text: 'No logo yet (PNG with transparent background works best).' });

  const refreshPhotos = () => {
    photoList.innerHTML = '';
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

  const photoInput = h('input', { type: 'file', accept: 'image/*', multiple: '' });
  photoInput.addEventListener('change', async () => {
    for (const file of photoInput.files) {
      const item = await loadImage(file);
      if (item) photos.push(item);
    }
    photoInput.value = '';
    refreshPhotos();
    schedule();
  });

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

  return h('div', { class: 'images' },
    h('label', { class: 'field' }, h('span', { text: 'Photos — cover + one per page (13 for monthly templates, 7 for the two-month template); fewer will repeat' }), photoInput),
    photoList,
    h('label', { class: 'field' }, h('span', { text: 'Logo' }), logoInput),
    logoInfo,
    clearLogo,
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
  if (s.custom === 'theme') body.append(themeBlock());
  if (s.custom === 'bordercolors') body.prepend(borderColorBlock());
  const d = h('details', {}, h('summary', { text: s.title }), body);
  if (s.open) d.setAttribute('open', '');
  formEl.append(d);
});

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
  const zip = document.getElementById('btnZip');
  const seq = document.getElementById('btnSeq');
  if (zip) zip.textContent = `All ${n} pages · ZIP`;
  if (seq) seq.textContent = `All ${n} pages · one by one`;
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
  return editor.applyTo(idx, buildPage(cfg, idx, pickPhoto(idx), logo ? logo.img : null));
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

document.getElementById('btnPsd').addEventListener('click', () =>
  guarded(async () => {
    setStatus('Building PSD…');
    await tick();
    download(new Blob([buildPsd(page)], { type: PSD_TYPE }), fileName(page, 'psd'));
    setStatus(`Saved ${fileName(page, 'psd')}`);
  }),
);

document.getElementById('btnPng').addEventListener('click', () =>
  guarded(async () => {
    setStatus('Rendering PNG…');
    await tick();
    const r = renderPage(makePage(page), exportScale());
    const blob = await new Promise((res) => r.composite.toBlob(res, 'image/png'));
    download(blob, fileName(page, 'png'));
    setStatus(`Saved ${fileName(page, 'png')}`);
  }),
);

document.getElementById('btnZip').addEventListener('click', () =>
  guarded(async () => {
    const zip = new JSZip();
    for (let i = 0; i < pageCount(cfg); i++) {
      setStatus(`Building PSD ${i + 1} of ${pageCount(cfg)}…`);
      await tick();
      zip.file(fileName(i, 'psd'), buildPsd(i), { compression: 'STORE' });
    }
    setStatus('Packing ZIP…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
    download(blob, `calendar-${cfg.year}-psd.zip`);
    setStatus(`Saved calendar-${cfg.year}-psd.zip`);
  }),
);

document.getElementById('btnSeq').addEventListener('click', () =>
  guarded(async () => {
    for (let i = 0; i < pageCount(cfg); i++) {
      setStatus(`Building PSD ${i + 1} of ${pageCount(cfg)}…`);
      await tick();
      download(new Blob([buildPsd(i)], { type: PSD_TYPE }), fileName(i, 'psd'));
      await new Promise((r) => setTimeout(r, 700)); // let the browser start each download
    }
    setStatus(`Saved ${pageCount(cfg)} PSD files (check your browser allows multiple downloads).`);
  }),
);

drawPreview();
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
