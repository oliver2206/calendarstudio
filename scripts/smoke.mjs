// Node smoke test: builds real PSDs with the same code the browser uses,
// reads them back, and writes composite PNGs for eyeballing.
// Usage: node scripts/smoke.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from 'canvas';
import { initializeCanvas, readPsd } from 'ag-psd';
import { setCanvasFactory, renderPage, loadMoonSprites } from '../src/render.js';
import { MOON_DATA } from '../src/moonData.js';
import { MOON_DATA2 } from '../src/moonData2.js';
import { buildPage, pageGeometry } from '../src/layout.js';
import { makePsd } from '../src/psd.js';
import { DEFAULTS } from '../src/defaults.js';
import { TIDES_JAN_2027 } from '../src/tides.js';

const out = process.argv[2] || './smoke-out';
fs.mkdirSync(out, { recursive: true });

initializeCanvas((w, h) => createCanvas(w, h));
setCanvasFactory((w, h) => createCanvas(w, h));
await loadMoonSprites(loadImage, { ...MOON_DATA, ...MOON_DATA2 });

// fake "photo": a landscape gradient with shapes
const photo = createCanvas(1600, 1000);
{
  const c = photo.getContext('2d');
  const g = c.createLinearGradient(0, 0, 1600, 1000);
  g.addColorStop(0, '#2b6cb0'); g.addColorStop(0.5, '#68d391'); g.addColorStop(1, '#f6ad55');
  c.fillStyle = g; c.fillRect(0, 0, 1600, 1000);
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(1150, 320, 170, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.moveTo(0, 1000); c.lineTo(500, 520); c.lineTo(950, 1000); c.fill();
}
const logo = createCanvas(400, 160);
{
  const c = logo.getContext('2d');
  c.fillStyle = '#1f3a5f'; c.fillRect(10, 10, 140, 140);
  c.fillStyle = '#f2a900'; c.font = 'bold 60px sans-serif'; c.fillText('LOGO', 170, 100);
}

let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.error('FAIL:', msg); } else console.log('ok  :', msg); };

const PH = [
  "2027-01-01 New Year's Day", '2027-03-25 Maundy Thursday', '2027-03-26 Good Friday', '2027-04-09 Araw ng Kagitingan',
  '2027-05-01 Labor Day', '2027-06-12 Independence Day', "2027-08-30 National Heroes' Day", '2027-11-30 Bonifacio Day',
  '2027-12-25 Christmas Day', '2027-12-30 Rizal Day',
].join('\n');
const REM = '*-15 Sample monthly reminder\n01-05 Sample January reminder\n*-25 Another reminder';

const PH26 = [
  "2026-01-01 New Year's Day", '2026-02-17 Chinese New Year', '2026-04-02 Maundy Thursday', '2026-04-03 Good Friday',
  '2026-04-04 Black Saturday', '2026-04-09 Day of Valor', '2026-05-01 Labor Day', '2026-06-12 Independence Day',
  '2026-08-21 Ninoy Aquino Day', "2026-08-31 National Heroes Day", "2026-11-01 All Saints' Day", '2026-11-02 All Souls Day',
  '2026-11-30 Bonifacio Day', '2026-12-08 Immaculate Conception', '2026-12-24 Christmas Eve', '2026-12-25 Christmas Day',
  '2026-12-30 Rizal Day', "2026-12-31 New Year's Eve",
].join('\n');

const GROUPED = ['# Regular Holidays', "2027-01-01 New Year's Day", '2027-03-25 Maundy Thursday', '2027-12-25 Christmas Day', '# Special (Non-Working) Days', '2027-08-21 Ninoy Aquino Day', '2027-11-01 All Saints Day', '# Additional Special (Non-Working) Days', '2027-02-06 Chinese New Year'].join('\n');
const runs = [
  { name: 'yearsari-2027-A4', cfg: { template: 'yearsari', year: 2027, holidays: GROUPED, owner: 'Owner Name' }, idx: 0, photo, logo },
  { name: 'yearpharma-2027-A4', cfg: { template: 'yearpharma', year: 2027, holidays: PH, owner: 'Proprietress: Owner Name' }, idx: 0, photo: null, logo: null },
  { name: 'collage-mar-apr-2027', cfg: { template: 'collage', year: 2027, holidays: PH }, idx: 2, photo: null, logo: null },
  { name: 'collage-jul-aug-2027-photo', cfg: { template: 'collage', year: 2027, holidays: PH }, idx: 4, photo, logo },
  { name: 'pink-jan-2027-landscape', cfg: { template: 'pink', year: 2027, orientation: 'landscape', holidays: PH }, idx: 1, photo: null, logo: null },
  { name: 'sky-jan-2027-landscape', cfg: { template: 'sky', year: 2027, orientation: 'landscape', holidays: PH }, idx: 1, photo: null, logo: null },
  { name: 'sky-mar-2027-portrait', cfg: { template: 'sky', year: 2027, holidays: PH }, idx: 3, photo, logo: null },
  { name: 'pink-mar-2027-portrait', cfg: { template: 'pink', year: 2027, holidays: PH }, idx: 3, photo, logo: null },
  { name: 'duoblack-jan-feb-2027-long', cfg: { template: 'duoblack', year: 2027, pageSize: 'Long', holidays: PH }, idx: 1, photo: null, logo: null },
  { name: 'duoblack-nov-dec-2027-A4', cfg: { template: 'duoblack', year: 2027, pageSize: 'A4', holidays: PH }, idx: 6, photo, logo: null },
  { name: 'chinese-jan-2022-landscape', cfg: { template: 'chinese', year: 2022, orientation: 'landscape', holidays: '2022-01-01 元旦', almanac: '01-01 | 宜 祭祀 出行 | 忌 动土 安葬' }, idx: 1, photo, logo: null },
  { name: 'chinese-mar-2027-portrait', cfg: { template: 'chinese', holidays: PH }, idx: 3, photo: null, logo: null },
  { name: 'duoornate-jan-feb-2027-A3', cfg: { template: 'duoornate', year: 2027, pageSize: 'A3', holidays: PH, tides: TIDES_JAN_2027 }, idx: 1, photo: null, logo: null },
  { name: 'duoornate-jul-aug-2027-long', cfg: { template: 'duoornate', year: 2027, pageSize: 'Long', holidays: PH }, idx: 4, photo, logo: null },
  { name: 'duoornate-nov-dec-2027-short', cfg: { template: 'duoornate', year: 2027, pageSize: 'Short', holidays: PH }, idx: 6, photo: null, logo: null },
  { name: 'duo-jul-aug-2026-A3', cfg: { template: 'duo', year: 2026, pageSize: 'A3', holidays: PH26 }, idx: 4, photo, logo: null },
  { name: 'duo-jan-feb-2026-long', cfg: { template: 'duo', year: 2026, pageSize: 'Long', holidays: PH26 }, idx: 1, photo: null, logo: null },
  { name: 'duo-nov-dec-2026-short', cfg: { template: 'duo', year: 2026, pageSize: 'Short', holidays: PH26 }, idx: 6, photo, logo: null },
  { name: 'duo-jul-aug-2026-A4', cfg: { template: 'duo', year: 2026, pageSize: 'A4', holidays: PH26 }, idx: 4, photo, logo: null },
  { name: 'phil-jan-2027', cfg: { template: 'phil', holidays: PH, reminders: REM }, idx: 1, photo: null, logo: null },
  { name: 'phil-feb-2026-photo', cfg: { template: 'phil', year: 2026, holidays: '', reminders: '' }, idx: 2, photo, logo },
  { name: 'phil-dec-2027', cfg: { template: 'phil', holidays: PH, reminders: REM }, idx: 12, photo: null, logo: null },
  { name: 'ornate-jan-2027-portrait', cfg: { template: 'ornate', holidays: PH, reminders: REM, tides: TIDES_JAN_2027 }, idx: 1, photo: null, logo: null },
  { name: 'ornate-jan-2027-landscape', cfg: { template: 'ornate', orientation: 'landscape', holidays: PH, tides: TIDES_JAN_2027 }, idx: 1, photo: null, logo: null },
  { name: 'ornate-jul-2027-photo', cfg: { template: 'ornate', holidays: PH }, idx: 7, photo, logo },
  { name: 'navy-jan-2027', cfg: { template: 'navy', holidays: PH, reminders: REM }, idx: 1, photo, logo: null },
  { name: 'navy-feb-2027', cfg: { template: 'navy', holidays: PH }, idx: 2, photo: null, logo: null },
  { name: 'navy-jul-2027-landscape', cfg: { template: 'navy', orientation: 'landscape', holidays: PH }, idx: 7, photo: null, logo: null },
  { name: 'bigblack-jan-2026-landscape', cfg: { template: 'bigblack', year: 2026, orientation: 'landscape', holidays: PH26 }, idx: 1, photo: null, logo: null },
  { name: 'bigblack-mar-2026-landscape', cfg: { template: 'bigblack', year: 2026, orientation: 'landscape', holidays: PH26 }, idx: 3, photo: null, logo: null },
  { name: 'bigblack-aug-2026-landscape', cfg: { template: 'bigblack', year: 2026, orientation: 'landscape', holidays: PH26, reminders: REM }, idx: 8, photo: null, logo: null },
  { name: 'bigblack-feb-2026-landscape', cfg: { template: 'bigblack', year: 2026, orientation: 'landscape', holidays: PH26 }, idx: 2, photo: null, logo: null },
  { name: 'bigblack-jan-2026-portrait', cfg: { template: 'bigblack', year: 2026, holidays: PH26 }, idx: 1, photo, logo: null },
  { name: 'classic-mar', cfg: { template: 'classic' }, idx: 3, photo, logo },
  { name: 'minimal-sep', cfg: { template: 'minimal', weekStart: 1 }, idx: 9, photo, logo },
  { name: 'bold-feb', cfg: { template: 'bold', showAdj: true }, idx: 2, photo, logo },
  { name: 'cover', cfg: { template: 'classic' }, idx: 0, photo, logo },
  { name: 'classic-nophoto-landscape-bleed', cfg: { template: 'classic', orientation: 'landscape', bleed: 3 }, idx: 12, photo: null, logo: null },
];

for (const r of runs) {
  const cfg = { ...DEFAULTS, ...r.cfg };
  const geo = pageGeometry(cfg);
  const k = (cfg.dpi / 25.4) * geo.mmPerUnit;
  const pg = buildPage(cfg, r.idx, r.photo, r.logo);
  const t0 = Date.now();
  const rendered = renderPage(pg, k);
  const buf = makePsd(rendered, { dpi: cfg.dpi, editableText: true, k });
  const file = path.join(out, `${r.name}.psd`);
  fs.writeFileSync(file, Buffer.from(buf));
  fs.writeFileSync(path.join(out, `${r.name}.png`), rendered.composite.toBuffer('image/png'));

  const back = readPsd(Buffer.from(buf), { skipCompositeImageData: true, skipThumbnail: true });
  const flat = [];
  const walk = (cs) => cs.forEach((c) => (c.children ? walk(c.children) : flat.push(c)));
  walk(back.children);
  const texts = flat.filter((l) => l.text);
  console.log(`\n[${r.name}] ${rendered.pxW}x${rendered.pxH}px, ${(buf.byteLength / 1e6).toFixed(1)} MB, ${Date.now() - t0} ms`);
  check(back.width === rendered.pxW && back.height === rendered.pxH, 'document size round-trips');
  check(flat.length > 10, `has many layers (${flat.length})`);
  check(texts.length > 5, `has live text layers (${texts.length})`);
  check(back.children.some((c) => c.children), 'has layer groups');
  check(Math.round(back.imageResources?.resolutionInfo?.horizontalResolution) === cfg.dpi, 'dpi stored');
  if (r.idx > 0) check(texts.some((l) => l.text.text === (cfg.year + '')), 'year text layer present');
}

// calendar maths sanity: Feb 2027 starts on Monday, 28 days; Sun-first => 5 rows
import { monthCells } from '../src/layout.js';
const feb = monthCells(2027, 1, 0);
check(feb.length === 35 && feb[0].inMonth === false && feb[1].inMonth === true && feb[1].day === 1, 'Feb 2027 grid (Sun-first) correct');
const feb2 = monthCells(2027, 1, 1);
check(feb2.length === 28 && feb2[0].day === 1, 'Feb 2027 grid (Mon-first) correct');
const aug = monthCells(2026, 7, 0); // Aug 2026 starts Saturday, 31 days -> 6 rows
check(aug.length === 42 && aug[6].day === 1, 'Aug 2026 needs 6 rows');

// ---- editor: custom layers, overrides, delete, PSD round-trip ----
import { applyEdits, emptyPage, boundsOf, hitTest } from '../src/edits.js';
{
  const cfg = { ...DEFAULTS, template: 'classic' };
  const geo = pageGeometry(cfg);
  const k = (cfg.dpi / 25.4) * geo.mmPerUnit;
  const imgs = new Map([['i1', { img: logo, name: 'logo.png' }]]);

  const base = applyEdits(buildPage(cfg, 3, photo, null), emptyPage(), imgs);
  const baseCount = base.flat.length;
  const aTemplateText = base.flat.find((n) => n.type === 'text' && /^\d+$/.test(n.text));
  check(!!aTemplateText && !!aTemplateText.id, 'template layers get stable ids');
  const photoId = base.flat.find((n) => n.name === 'Photo').id;

  const ps = emptyPage();
  ps.custom.push({ id: 'c1', type: 'text', text: 'HELLO PSD', font: 'Georgia', bold: true, size: 70, color: '#ff0000', opacity: 1, x: 100, y: 100 });
  ps.custom.push({ id: 'c2', type: 'image', imgId: 'i1', name: 'logo.png', x: 600, y: 100, w: 250, h: 100, opacity: 0.8 });
  ps.custom.push({ id: 'c3', type: 'rect', x: 50, y: 800, w: 300, h: 80, color: '#00aa00', opacity: 1, radius: 10 });
  ps.over[photoId] = { hidden: true };                                   // delete the template photo
  ps.over[aTemplateText.id] = { text: 'EDITED', size: 55, color: '#0000ff', dx: 30, dy: 10 }; // restyle a date

  const ed = applyEdits(buildPage(cfg, 3, photo, null), ps, imgs);
  check(!ed.flat.some((n) => n.id === photoId), 'deleted template layer is gone');
  check(ed.flat.length === baseCount - 1 + 3, 'custom layers added (text + image + rectangle)');
  const moved = ed.flat.find((n) => n.id === aTemplateText.id);
  check(moved.text === 'EDITED' && moved.color === '#0000ff' && Math.abs(moved.x - aTemplateText.x - 30) < 1e-6, 'template text restyled + moved');
  check(ed.meta.length > 0 && JSON.stringify(ed.meta).includes(photoId), 'hidden layer still listed in Layers panel');
  const hit = hitTest(ed, 120, 130, true);
  check(hit && hit.id === 'c1', 'click on custom text selects it');
  check(boundsOf(ed.flat.find((n) => n.id === 'c2')).w === 250, 'image bounds');

  // picture controls: zoom / top-bottom / fit overrides on a template photo and on an added image
  {
    const pid = base.flat.find((n) => n.name === 'Photo').id;
    const mk = (over, cust) => {
      const q = emptyPage();
      q.over[pid] = over;
      if (cust) q.custom.push(cust);
      return applyEdits(buildPage(cfg, 3, photo, null), q, imgs);
    };
    const top = mk({ zoom: 2, fx: 0.5, fy: 0 }).flat.find((n) => n.id === pid);
    const bot = mk({ zoom: 2, fx: 0.5, fy: 1 }).flat.find((n) => n.id === pid);
    check(top.zoom === 2 && top.fy === 0 && bot.fy === 1, 'template photo takes zoom + top/bottom override');
    const px = (nodePage) => {
      const r = renderPage(nodePage, k);
      return r.composite.getContext('2d').getImageData(Math.round(top.x * k + top.w * k / 2), Math.round(top.y * k + top.h * k / 2), 1, 1).data.join(',');
    };
    check(px(mk({ zoom: 2, fy: 0 })) !== px(mk({ zoom: 2, fy: 1 })), 'top vs bottom part of the photo renders differently');
    const cc = mk({}, { id: 'c9', type: 'image', imgId: 'i1', name: 'logo.png', x: 100, y: 100, w: 300, h: 300, opacity: 1, fit: 'cover', zoom: 1.5, fx: 0, fy: 1 }).flat.find((n) => n.id === 'c9');
    check(cc.fit === 'cover' && cc.zoom === 1.5 && cc.fx === 0 && cc.fy === 1, 'added image keeps fit / zoom / focus');
  }

  const rendered = renderPage(ed, k);
  const buf = makePsd(rendered, { dpi: cfg.dpi, editableText: true, k });
  fs.writeFileSync(path.join(out, 'edited-classic-mar.psd'), Buffer.from(buf));
  fs.writeFileSync(path.join(out, 'edited-classic-mar.png'), rendered.composite.toBuffer('image/png'));
  const back = readPsd(Buffer.from(buf), { skipCompositeImageData: true, skipThumbnail: true });
  const flat = [];
  const walk = (cs) => cs.forEach((c) => (c.children ? walk(c.children) : flat.push(c)));
  walk(back.children);
  const myText = flat.find((l) => l.text && l.text.text === 'HELLO PSD');
  check(!!myText, 'custom text is a live text layer in the PSD');
  check(myText && myText.text.style.font.name === 'Georgia-Bold', 'custom font is written to the PSD (Georgia-Bold)');
  check(flat.some((l) => l.name === 'Image: logo.png') && flat.some((l) => l.name === 'Rectangle'), 'custom image + rectangle layers are in the PSD');
  check(!flat.some((l) => l.name === 'Photo'), 'deleted photo is not in the PSD');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
