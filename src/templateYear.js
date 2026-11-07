// Full-year poster templates (ONE page = all 12 months), built from two printed 2027 wall posters:
//   yearsari   — "red & blue": photo/brand banner, big 2027 + ribbon, 4 x 3 month cards with alternating red / blue headers,
//                a cream "PHILIPPINE HOLIDAYS" box (columns grouped by "# Heading" lines) and a red contact bar.
//   yearpharma — "red & green": swoosh header with big outlined name + script tagline, owner / address pills, big outlined year,
//                3 x 4 grid-lined month cards (red / green headers, Sat in green) and a 3-column national-holidays footer.
import { moonDayMarks } from './moonMarks.js';
import { rect, text, group, monthCells, MONTHS, WEEKDAYS, mix } from './layout.js';

const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** holidays text -> [{ title, items:[{m,d,name}] }]; "# Heading" lines start a group (other templates ignore them) */
export function holidayGroups(src, year) {
  const groups = [];
  let cur = null;
  String(src || '').split(/\r?\n/).forEach((raw) => {
    const line = raw.trim();
    const head = line.match(/^#\s*(.+)$/);
    if (head) {
      cur = { title: head[1].trim(), items: [] };
      groups.push(cur);
      return;
    }
    const m = line.match(/^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})\s+(.+)$/);
    if (!m || (m[1] && Number(m[1]) !== Number(year))) return;
    if (!cur) {
      cur = { title: '', items: [] };
      groups.push(cur);
    }
    cur.items.push({ m: Number(m[2]), d: Number(m[3]), name: m[4].trim() });
  });
  groups.forEach((g) => g.items.sort((a, b) => a.m - b.m || a.d - b.d));
  return groups.filter((g) => g.items.length);
}

function monthCard(ctx, box, m, st) {
  const { cfg } = ctx;
  const out = [];
  const cells = monthCells(cfg.year, m, cfg.weekStart);
  const colW = box.w / 7;
  const hdrH = box.h * st.hdr;
  const wdH = box.h * 0.095;
  const gridY = box.y + hdrH + wdH + 2;
  const rowH = (box.y + box.h - 3 - gridY) / 6;
  const r = st.radius;
  const hol = ctx.holidays;

  out.push(rect('Card', box.x, box.y, box.w, box.h, '#ffffff', { stroke: st.border, strokeW: 1.6, radius: r }));
  out.push(rect('Header', box.x, box.y, box.w, hdrH, st.head, { radius: r }));
  out.push(rect('Header square', box.x, box.y + hdrH * 0.5, box.w, hdrH * 0.5, st.head));
  out.push(text('Month', st.title(m), box.x, box.y, box.w, hdrH, { font: 'Arial', bold: true, size: hdrH * 0.62, color: '#ffffff', align: 'center', fit: true }));
  for (let i = 0; i < 7; i++) {
    const dow = (cfg.weekStart + i) % 7;
    out.push(text(`Weekday ${WEEKDAYS[dow]}`, WEEKDAYS[dow].toUpperCase().replace(/^(\w)(\w+)$/, (a, b, c) => (st.capWd ? a : b + c.toLowerCase())), box.x + i * colW, box.y + hdrH, colW, wdH, {
      font: 'Arial', bold: true, size: Math.min(wdH * 0.7, colW * 0.34), color: dow === 0 ? st.red : dow === 6 && st.sat ? st.sat : st.ink, align: 'center', fit: true,
    }));
  }
  if (st.lines) {
    const segs = [];
    for (let k = 0; k <= 6; k++) segs.push([box.x + 4, gridY + k * rowH, box.x + box.w - 4, gridY + k * rowH]);
    for (let k = 0; k <= 7; k++) segs.push([box.x + 4 + (k * (box.w - 8)) / 7, gridY, box.x + 4 + (k * (box.w - 8)) / 7, gridY + 6 * rowH]);
    out.push({ type: 'lines', name: 'Grid lines', segs, color: '#c9c9c9', lw: 1, x: box.x, y: gridY, w: box.w, h: 6 * rowH });
  }
  const gx = st.lines ? box.x + 4 : box.x;
  const gw = st.lines ? box.w - 8 : box.w;
  const nums = [];
  const cellAt = {};
  cells.forEach((cell, i) => {
    if (!cell.inMonth) return;
    const rr = Math.floor(i / 7);
    const col = i % 7;
    cellAt[cell.day] = { x: gx + (col * gw) / 7, y: gridY + rr * rowH };
    const isHol = !!hol[`${m + 1}-${cell.day}`];
    const color = cell.dow === 0 || isHol ? st.red : cell.dow === 6 && st.sat ? st.sat : st.ink;
    nums.push(text(`Day ${m + 1}-${String(cell.day).padStart(2, '0')}`, cell.day, gx + (col * gw) / 7, gridY + rr * rowH, gw / 7, rowH, {
      font: 'Arial', bold: true, size: Math.min(rowH * 0.58, colW * 0.46), color, align: 'center',
    }));
  });
  out.push(group('Dates', nums));
  const md = Math.min(rowH * 0.36, colW * 0.34);
  const mk = moonDayMarks(cfg, m, (d) => (cellAt[d] ? { x: cellAt[d].x + gw / 7 - md - 1, y: cellAt[d].y + 1, d: md } : null), st.red);
  if (mk.length) out.push(group('Moon phases', mk));
  return group(`${MONTHS[m]} card`, out);
}

function photoOrArt(ctx, name, box, grad, label) {
  const { cfg, photo } = ctx;
  if (photo) return [{ type: 'image', name, img: photo, fit: 'cover', zoom: cfg.photoZoom, fx: cfg.photoFx, fy: cfg.photoFy, ...box, radius: 0 }];
  return [rect(`${name} placeholder (replace me)`, box.x, box.y, box.w, box.h, { grad }), text(`${name} label`, label, box.x, box.y + box.h * 0.75, box.w, box.h * 0.12, { font: 'Arial', bold: true, size: 40, color: 'rgba(255,255,255,0.8)', align: 'center', fit: true })];
}

function logoCircle(ctx, name, cx, cy, d, ring, fill) {
  const out = [rect(`${name} ring`, cx - d / 2, cy - d / 2, d, d, fill, { stroke: ring, strokeW: d * 0.06, radius: d / 2 })];
  if (ctx.logo) out.push({ type: 'image', name: 'Logo', img: ctx.logo, fit: 'contain', x: cx - d * 0.42, y: cy - d * 0.42, w: d * 0.84, h: d * 0.84 });
  else out.push(text(`${name} initials`, String(ctx.cfg.company || '').split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase(), cx - d / 2, cy - d / 2, d, d, { font: 'Arial Black', bold: true, size: d * 0.36, color: ring, align: 'center', fit: true }));
  return group(name, out);
}

const withWd = (ctx, it) => `${it.name} (${WEEKDAYS[new Date(ctx.cfg.year, it.m - 1, it.d).getDay()]})`;

/* ================================================================ red & blue ================================================================ */
export function tplYearSari(ctx) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const red = cfg.weekend === '#d64545' ? '#c8242c' : cfg.weekend;
  const blue = cfg.primary && cfg.primary !== '#1f3a5f' ? cfg.primary : '#2b4cb3';
  const cream = cfg.bg === '#ffffff' ? '#fdf1d0' : cfg.bg;
  const out = [rect('Background', 0, 0, W, H, cream, { bleed: 'ltrb' })];

  /* hero banner */
  const heroH = H * 0.3;
  out.push(group('Hero banner', photoOrArt(ctx, 'Banner', { x: 0, y: 0, w: W, h: heroH }, [[0, '#6b2f10'], [0.55, '#c8651b'], [1, '#f0b24a']], 'YOUR PHOTO / BRAND ART HERE').map((n) => ({ ...n, bleed: n.type === 'image' || n.type === 'rect' ? 'ltr' : n.bleed }))));
  out.push(rect('Hero shade', 0, heroH * 0.55, W, heroH * 0.45, { grad: [[0, 'rgba(60,20,0,0)'], [1, 'rgba(60,20,0,0.55)']] }));
  out.push(logoCircle(ctx, 'Logo badge', W * 0.15, heroH * 0.42, W * 0.22, '#222222', '#ffffff'));
  out.push(group('Brand title', [
    text('Company name', cfg.company, W * 0.3, heroH * 0.12, W * 0.42, heroH * 0.26, { font: 'Arial Black', bold: true, size: heroH * 0.2, color: '#ffb300', fillColor: '#ffb300', outline: heroH * 0.025, outlineColor: '#8a2a0a', align: 'center', fit: true }),
    rect('Tagline ribbon', W * 0.31, heroH * 0.42, W * 0.4, heroH * 0.13, '#ffd21f', { radius: 8 }),
    text('Tagline', cfg.tagline, W * 0.31, heroH * 0.42, W * 0.4, heroH * 0.13, { font: 'Georgia', bold: true, size: heroH * 0.08, color: '#8a1c0e', align: 'center', fit: true }),
  ]));
  /* year + ribbon */
  const yy = heroH + H * 0.004;
  out.push(group('Year', [
    text('Year', cfg.year, W * 0.2, yy - H * 0.008, W * 0.6, H * 0.056, { font: 'Arial Black', bold: true, size: H * 0.052, color: red, fillColor: red, outline: 5, outlineColor: '#ffffff', align: 'center', fit: true }),
    rect('Ribbon', W * 0.33, yy + H * 0.044, W * 0.34, H * 0.02, blue, { radius: 4 }),
    text('Ribbon text', (cfg.coverLabel || 'CALENDAR').toUpperCase(), W * 0.33, yy + H * 0.044, W * 0.34, H * 0.02, { font: 'Arial', bold: true, size: H * 0.014, color: '#ffffff', align: 'center', fit: true }),
    text('Star left', '★', W * 0.1, yy + H * 0.012, W * 0.06, H * 0.04, { font: 'Arial', size: H * 0.034, color: '#f2b705', align: 'center' }),
    text('Star right', '★', W * 0.84, yy + H * 0.012, W * 0.06, H * 0.04, { font: 'Arial', size: H * 0.034, color: '#f2b705', align: 'center' }),
  ]));

  /* month cards: 4 x 3, alternating red / blue like the poster */
  const M = W * 0.028;
  const gap = 10;
  const cw = (W - 2 * M - 3 * gap) / 4;
  const gy = H * 0.375;
  const ch = (H * 0.4 - 2 * gap) / 3;
  const heads = [red, blue, red, blue, blue, red, blue, red, red, blue, red, blue];
  const cards = [];
  for (let m = 0; m < 12; m++) {
    const r = Math.floor(m / 4);
    const c = m % 4;
    cards.push(monthCard(ctx, { x: M + c * (cw + gap), y: gy + r * (ch + gap), w: cw, h: ch }, m, {
      head: heads[m], hdr: 0.15, radius: 9, border: '#e6d8ac', ink: '#222222', red, sat: null, lines: false, capWd: false, title: (mm) => MONTHS[mm].toUpperCase(),
    }));
  }
  out.push(group('Months', cards));

  /* holidays box */
  const hy = gy + 3 * ch + 2 * gap + H * 0.01;
  const hh = H * 0.935 - hy - H * 0.004;
  out.push(rect('Holidays box', M, hy, W - 2 * M, hh, '#fffaf0', { stroke: '#e6d8ac', strokeW: 2, radius: 12 }));
  out.push(text('Holidays title', `${cfg.year} ${(cfg.holidaysTitle || 'HOLIDAYS').toUpperCase()}`, M, hy + 4, W - 2 * M, hh * 0.13, { font: 'Arial Black', bold: true, size: hh * 0.11, color: red, align: 'center', fit: true }));
  let groups = holidayGroups(cfg.holidays, cfg.year);
  const flat = groups.every((g) => !g.title);
  if (flat && groups.length) {
    const all = groups.flatMap((g) => g.items);
    const per = Math.ceil(all.length / 3);
    groups = [0, 1, 2].map((k) => ({ title: '', items: all.slice(k * per, (k + 1) * per) })).filter((g) => g.items.length);
  }
  const cols = [[], [], []];
  const hts = [0, 0, 0];
  groups.forEach((g) => {
    const k = hts.indexOf(Math.min(...hts));
    cols[k].push(g);
    hts[k] += g.items.length + (g.title ? 1.6 : 0);
  });
  const rows = Math.max(...hts, 1);
  const top = hy + hh * 0.16;
  const unit = Math.min(15, (hy + hh - 6 - top) / rows);
  const colW = (W - 2 * M - 24) / 3;
  const palette = [red, blue, red, blue];
  const hl = [];
  let gi = 0;
  cols.forEach((col, k) => {
    let yy2 = top;
    const x = M + 12 + k * (colW + 6);
    col.forEach((g) => {
      if (g.title) {
        hl.push(rect(`Group bar ${gi + 1}`, x, yy2, colW - 8, unit * 1.35, palette[gi % palette.length], { radius: 4 }));
        hl.push(text(`Group title ${gi + 1}`, g.title, x, yy2, colW - 8, unit * 1.35, { font: 'Arial', bold: true, size: unit * 0.95, color: '#ffffff', align: 'center', fit: true }));
        yy2 += unit * 1.6;
      }
      g.items.forEach((it, j) => {
        hl.push(text(`Holiday date ${it.m}-${it.d}`, `${MON3[it.m - 1]} ${it.d}`, x, yy2, colW * 0.17, unit, { font: 'Arial', bold: true, size: unit * 0.78, color: palette[gi % palette.length], align: 'left', fit: true }));
        hl.push(text(`Holiday name ${it.m}-${it.d}`, withWd(ctx, it), x + colW * 0.18, yy2, colW * 0.8 - 8, unit, { font: 'Arial', size: unit * 0.78, color: '#222222', align: 'left', fit: true }));
        yy2 += unit;
      });
      gi++;
    });
  });
  out.push(group('Holidays', hl));

  /* contact bar */
  const by = H * 0.945;
  out.push(rect('Contact bar', 0, by, W, H - by, '#b3261e', { bleed: 'lrb' }));
  const segs = [[0.02, 0.33, cfg.address, 'left'], [0.37, 0.22, cfg.company, 'center'], [0.61, 0.17, cfg.phone, 'center'], [0.8, 0.18, cfg.tagline, 'center']];
  const bar = [];
  segs.forEach(([fx, fw, t, al], i) => {
    if (t) bar.push(text(`Contact ${i + 1}`, t, W * fx, by, W * fw, (H - by) * 0.9, { font: i === 3 ? 'Brush Script MT' : 'Arial', bold: i < 3, size: (H - by) * 0.34, color: '#ffffff', align: al, fit: true }));
    if (i) bar.push({ type: 'lines', name: `Divider ${i}`, segs: [[W * (fx - 0.01), by + (H - by) * 0.18, W * (fx - 0.01), by + (H - by) * 0.72]], color: '#ffffff', lw: 1.6, x: W * (fx - 0.012), y: by, w: 4, h: H - by });
  });
  out.push(group('Contact bar text', bar));
  return out;
}

/* ================================================================ red & green ================================================================ */
export function tplYearPharma(ctx) {
  const { cfg, geo } = ctx;
  const { W, H } = geo;
  const red = cfg.weekend === '#d64545' ? '#c8161d' : cfg.weekend;
  const green = cfg.accent && cfg.accent !== '#f2a900' ? cfg.accent : '#2e8b2f';
  const out = [rect('Background', 0, 0, W, H, cfg.bg, { bleed: 'ltrb' })];

  /* header: faded photo + swooshes */
  const hh = H * 0.3;
  out.push(group('Header photo', photoOrArt(ctx, 'Header photo', { x: 0, y: 0, w: W, h: hh }, [[0, '#dfe7ea'], [1, '#f5f5f5']], 'YOUR PHOTO HERE').map((n) => ({ ...n, bleed: n.type === 'image' || n.type === 'rect' ? 'ltr' : n.bleed }))));
  out.push(rect('Header fade', 0, 0, W, hh, { grad: [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0.95)']] }, { bleed: 'ltr' }));
  const sw = (name, pts, fill) => {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const b = { x: Math.min(...xs), y: Math.min(...ys) };
    b.w = Math.max(...xs) - b.x;
    b.h = Math.max(...ys) - b.y;
    return rect(name, b.x, b.y, b.w, b.h, fill, { shape: pts.map(([x, y]) => [(x - b.x) / b.w, (y - b.y) / b.h]) });
  };
  out.push(group('Swooshes', [
    sw('Red swoosh top', [[0, 0], [W * 0.5, 0], [W * 0.18, H * 0.04], [0, H * 0.12]], red),
    sw('Green swoosh top', [[0, H * 0.12], [W * 0.18, H * 0.04], [W * 0.1, H * 0.13], [0, H * 0.19]], green),
    sw('Red swoosh right', [[W, 0], [W, H * 0.07], [W * 0.82, H * 0.03], [W * 0.78, 0]], red),
    sw('Green swoosh right', [[W, H * 0.07], [W, H * 0.1], [W * 0.88, H * 0.06]], green),
    sw('Red swoosh low', [[0, H * 0.185], [W * 0.5, H * 0.235], [W, H * 0.22], [W, H * 0.245], [W * 0.5, H * 0.26], [0, H * 0.205]], red),
    sw('Green swoosh low', [[0, H * 0.2], [W * 0.5, H * 0.255], [W, H * 0.245], [W, H * 0.255], [W * 0.5, H * 0.275], [0, H * 0.215]], green),
  ]));
  out.push(logoCircle(ctx, 'Logo badge', W * 0.15, H * 0.125, W * 0.2, red, '#ffffff'));
  out.push(group('Brand title', [
    text('Company name', cfg.company.toUpperCase(), W * 0.27, H * 0.055, W * 0.54, H * 0.085, { font: 'Arial Black', bold: true, size: H * 0.07, color: red, fillColor: '#ffffff', outline: 5, align: 'center', fit: true }),
    text('Tagline', cfg.tagline ? `“${cfg.tagline}”` : '', W * 0.27, H * 0.145, W * 0.54, H * 0.04, { font: 'Brush Script MT', size: H * 0.034, color: red, align: 'center', fit: true }),
  ]));
  if (cfg.owner) {
    out.push(rect('Owner pill', W * 0.07, H * 0.205, W * 0.52, H * 0.034, red, { radius: H * 0.017 }));
    out.push(text('Owner', cfg.owner, W * 0.09, H * 0.205, W * 0.48, H * 0.034, { font: 'Arial', bold: true, size: H * 0.019, color: '#ffffff', align: 'left', fit: true }));
  }
  if (cfg.address) {
    out.push(rect('Address pill', W * 0.06, H * 0.245, W * 0.56, H * 0.034, green, { radius: H * 0.017, stroke: '#ffffff', strokeW: 2 }));
    out.push(text('Address', cfg.address, W * 0.09, H * 0.245, W * 0.52, H * 0.034, { font: 'Arial', bold: true, size: H * 0.019, color: '#ffffff', align: 'left', fit: true }));
  }
  out.push(text('Year', cfg.year, W * 0.63, H * 0.205, W * 0.35, H * 0.1, { font: 'Arial Black', bold: true, size: H * 0.085, color: red, fillColor: red, outline: 6, outlineColor: '#ffffff', align: 'right', fit: true }));

  /* month cards: 3 x 4 grid-lined */
  const M = W * 0.026;
  const gap = 12;
  const cw = (W - 2 * M - 2 * gap) / 3;
  const gy = H * 0.31;
  const ch = (H * 0.54 - 3 * gap) / 4;
  const cards = [];
  for (let m = 0; m < 12; m++) {
    const r = Math.floor(m / 3);
    const c = m % 3;
    cards.push(monthCard(ctx, { x: M + c * (cw + gap), y: gy + r * (ch + gap), w: cw, h: ch }, m, {
      head: (r + c) % 2 === 0 ? red : green, hdr: 0.15, radius: 9, border: '#cfcfcf', ink: '#111111', red, sat: green, lines: true, capWd: true, title: (mm) => `${MONTHS[mm].toUpperCase()} ${cfg.year}`,
    }));
  }
  out.push(group('Months', cards));

  /* footer: swoosh corners + national holidays */
  const fy = gy + 4 * ch + 3 * gap + H * 0.008;
  out.push(group('Footer swooshes', [
    sw('Footer red left', [[0, H * 0.935], [W * 0.035, H * 0.965], [0, H]], red),
    sw('Footer green left', [[0, H * 0.965], [W * 0.02, H * 0.985], [0, H]], green),
    sw('Footer red right', [[W, H * 0.935], [W * 0.965, H * 0.965], [W, H]], red),
    sw('Footer green right', [[W, H * 0.965], [W * 0.98, H * 0.985], [W, H]], green),
  ]));
  const barH = H * 0.027;
  out.push(rect('Holidays bar', M + 10, fy, W - 2 * M - 20, barH, green, { radius: 8 }));
  out.push(text('Holidays title', `${(cfg.holidaysTitle || 'HOLIDAYS').toUpperCase()} (${cfg.year})`, M + 10, fy, W - 2 * M - 20, barH, { font: 'Arial', bold: true, size: barH * 0.58, color: '#ffffff', align: 'center', fit: true }));
  const all = holidayGroups(cfg.holidays, cfg.year)
    .flatMap((g) => g.items)
    .sort((a, b) => a.m - b.m || a.d - b.d);
  const per = Math.max(1, Math.ceil(all.length / 3));
  const top = fy + barH + H * 0.008;
  const unit = Math.min(16, (H * 0.972 - top) / per);
  const colW = (W - 2 * M - 60) / 3;
  const hl = [];
  [0, 1, 2].forEach((k) => {
    const x = M + 30 + k * colW;
    if (k) hl.push({ type: 'lines', name: `Column divider ${k}`, segs: [[x - 8, top, x - 8, top + per * unit]], color: k === 1 ? green : red, lw: 2, x: x - 10, y: top, w: 4, h: per * unit });
    all.slice(k * per, (k + 1) * per).forEach((it, j) => {
      hl.push(text(`Holiday date ${it.m}-${it.d}`, `${MON3[it.m - 1]} ${it.d}`, x, top + j * unit, colW * 0.2, unit, { font: 'Arial', bold: true, size: unit * 0.82, color: red, align: 'left', fit: true }));
      hl.push(text(`Holiday name ${it.m}-${it.d}`, it.name, x + colW * 0.21, top + j * unit, colW * 0.76 - 14, unit, { font: 'Arial', size: unit * 0.82, color: '#111111', align: 'left', fit: true }));
    });
  });
  out.push(group('Holidays', hl));
  out.push(text('Holiday note', '*Holiday dates subject to official proclamation.', W * 0.3, H * 0.975, W * 0.5, H * 0.014, { font: 'Arial', size: H * 0.0095, color: '#444444', align: 'center', fit: true }));
  return out;
}
