// Edit model: per-page "overrides" for template layers (move / resize / hide / restyle)
// plus "custom" layers the user adds (text, image, rectangle).
// Everything here is plain data (JSON-able) so undo/redo is a simple snapshot.
import { textGeom, text as textNode, rect as rectNode } from './layout.js';
import { measure } from './render.js';

export const emptyPage = () => ({ over: {}, custom: [] });

let uidN = 0;
export const uid = () => `c${Date.now().toString(36)}${(uidN++).toString(36)}`;

/** custom text boxes are drawn in a box 1.3x the font size tall, vertically centred */
export const TEXT_BOX = 1.3;
// distance (in font sizes) from the top of a custom text box to the top of its visible glyph bounds:
// baseline = y + h/2 + 0.36*size, glyph top = baseline - 0.82*size  ->  y + 0.19*size
export const TEXT_Y_OFF = TEXT_BOX / 2 + 0.36 - 0.82;

const customName = (c) => {
  if (c.type === 'text') return `Text: ${(c.text || '').trim().slice(0, 28) || '(empty)'}`;
  if (c.type === 'image') return `Image: ${c.name || 'picture'}`;
  return 'Rectangle';
};

/** URL a Layers-panel thumbnail can show for a picture (null when there is nothing usable). */
const thumbOf = (img) => (img && typeof img.src === 'string' && img.src ? img.src : null);

/** Apply the user's overrides to one template node (mutates the node). */
function applyOver(n, o) {
  if (o.dx || o.dy) {
    const dx = o.dx || 0;
    const dy = o.dy || 0;
    n.x += dx;
    n.y += dy;
    if (n.segs) n.segs = n.segs.map(([a, b, c, d]) => [a + dx, b + dy, c + dx, d + dy]);
  }
  if (n.type !== 'text' && n.type !== 'lines') {
    if (o.dw) n.w = Math.max(4, n.w + o.dw);
    if (o.dh) n.h = Math.max(4, n.h + o.dh);
  }
  if (o.opacity != null) n.opacity = o.opacity;
  if (o.rot !== undefined) n.rot = o.rot;
  if (o.flipX !== undefined) n.flipX = o.flipX;
  if (o.flipY !== undefined) n.flipY = o.flipY;
  if (n.type === 'image') {
    ['fit', 'zoom', 'fx', 'fy'].forEach((k) => {
      if (o[k] !== undefined) n[k] = o[k];
    });
  }
  if (n.type === 'text') {
    ['text', 'font', 'bold', 'align', 'color'].forEach((k) => {
      if (o[k] !== undefined) n[k] = o[k];
    });
    if (o.size) {
      n.size = o.size;
      n.fit = false;
    }
  } else if (o.color) {
    if (n.type === 'rect') n.fill = o.color;
    else if (n.type === 'lines' || n.type === 'moon' || n.type === 'keyborder' || n.type === 'goat') n.color = o.color;
  }
}

function customToNode(c, imgs) {
  let n;
  if (c.type === 'text') {
    const w = measure(c.text || ' ', c.font, c.bold, c.size) + c.size * 0.1;
    n = textNode(customName(c), c.text || ' ', c.x, c.y, w, c.size * TEXT_BOX, {
      font: c.font, bold: !!c.bold, size: c.size, color: c.color, align: 'left', valign: 'middle',
    });
  } else if (c.type === 'image') {
    const it = imgs.get(c.imgId);
    if (!it) return null;
    n = { type: 'image', name: customName(c), img: it.img, fit: c.fit || 'contain', zoom: c.zoom, fx: c.fx, fy: c.fy, x: c.x, y: c.y, w: c.w, h: c.h };
  } else {
    n = rectNode(customName(c), c.x, c.y, c.w, c.h, c.color, { radius: c.radius || 0 });
  }
  if (c.rot) n.rot = c.rot;
  if (c.flipX) n.flipX = true;
  if (c.flipY) n.flipY = true;
  n.id = c.id;
  n.custom = true;
  n.opacity = c.opacity ?? 1;
  return n;
}

/**
 * @param pg    result of buildPage() (children already in final units)
 * @param ps    this page's edit state {over, custom}
 * @param imgs  Map imgId -> {img, name, url}
 * @returns the same page object with: children (edited), flat (leaf layers, paint order),
 *          meta (layer tree for the Layers panel incl. hidden layers)
 */
/** give every template leaf its stable id (path in the ORIGINAL tree + name) before anything is moved */
function assignIds(nodes, path) {
  nodes.forEach((n, i) => {
    const p = path ? `${path}.${i}` : `${i}`;
    if (n.type === 'group') assignIds(n.children, p);
    else n.id = `${p}:${n.name}`;
  });
}
function locate(nodes, id) {
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'group') {
      const r = locate(n.children, id);
      if (r) return r;
    } else if (n.id === id) return { arr: nodes, i, node: n };
  }
  return null;
}
/** Template layers the user re-stacked: over[id].pos = 'before:<id>' | 'after:<id>' (replayed in the order they were set). */
function applyMoves(pg, ps) {
  Object.entries(ps.over)
    .filter(([, o]) => o.pos)
    .sort((a, b) => (a[1].seq || 0) - (b[1].seq || 0))
    .forEach(([id, o]) => {
      const m = /^(before|after):(.+)$/.exec(o.pos);
      const from = m && id !== m[2] && locate(pg.children, id);
      if (!from || !locate(pg.children, m[2])) return;
      from.arr.splice(from.i, 1);
      const to = locate(pg.children, m[2]);
      to.arr.splice(to.i + (m[1] === 'after' ? 1 : 0), 0, from.node);
    });
}

export function applyEdits(pg, ps, imgs) {
  ps = ps || emptyPage();
  assignIds(pg.children, '');
  applyMoves(pg, ps);
  const meta = [];
  const names = {}; // template layer id -> name (for the "Behind …" notes in the Layers panel)

  // Layers the user added. Each may carry `pos` = 'before:<template layer id>' | 'after:<template layer id>'
  // (where it sits in the paint order, so a picture can go BEHIND template text). No pos = on top of everything.
  const before = {};
  const after = {};
  const onTop = [];
  const built = ps.custom.map((c) => ({ c, n: c.hidden ? null : customToNode(c, imgs) }));
  built.forEach((b) => {
    const m = /^(before|after):(.+)$/.exec(b.c.pos || '');
    if (!m) onTop.push(b);
    else ((m[1] === 'before' ? before : after)[m[2]] ||= []).push(b);
  });
  const placed = new Set();
  const put = (list, kept) =>
    (list || []).forEach((b) => {
      placed.add(b);
      if (b.n) kept.push(b.n);
    });

  const walk = (nodes, path, out) => {
    const kept = [];
    nodes.forEach((n, i) => {
      const p = path ? `${path}.${i}` : `${i}`;
      if (n.type === 'group') {
        const gm = { kind: 'group', key: `g${p}`, name: n.name, children: [] };
        out.push(gm);
        n.children = walk(n.children, p, gm.children);
        kept.push(n);
        return;
      }
      names[n.id] = n.name;
      const o = ps.over[n.id] || {};
      out.push({ kind: 'layer', id: n.id, name: n.name, type: n.type, hidden: !!o.hidden, thumb: thumbOf(n.img) });
      put(before[n.id], kept);
      if (!o.hidden) {
        applyOver(n, o);
        kept.push(n);
      }
      put(after[n.id], kept);
    });
    return kept;
  };

  const children = walk(pg.children, '', meta);
  // layers with no position, or whose anchor no longer exists on this page, go on top
  const leftovers = built.filter((b) => !placed.has(b));
  leftovers.forEach((b) => b.n && children.push(b.n));

  const customMeta = built.map(({ c }) => {
    const m = /^(before|after):(.+)$/.exec(c.pos || '');
    const anchor = m && names[m[2]];
    return {
      kind: 'layer', id: c.id, name: customName(c), type: c.type, hidden: !!c.hidden, custom: true,
      thumb: c.type === 'image' ? imgs.get(c.imgId)?.url || null : null,
      note: anchor ? `${m[1] === 'before' ? 'Behind' : 'Above'} “${anchor}”` : '',
    };
  });

  const flat = [];
  const collect = (nodes) => nodes.forEach((n) => (n.type === 'group' ? collect(n.children) : flat.push(n)));
  collect(children);

  pg.children = children;
  pg.flat = flat;
  pg.meta = meta;
  pg.customMeta = customMeta;
  return pg;
}

/** Visible bounding box of a (final) node, in design units. */
export function boundsOf(n) {
  if (n.type === 'text') {
    const g = textGeom(n, measure);
    const w = Math.max(measure(n.text, n.font, n.bold, g.size), 4);
    const x = n.align === 'left' ? g.anchorX : n.align === 'right' ? g.anchorX - w : g.anchorX - w / 2;
    return { x, y: g.baselineY - g.size * 0.82, w, h: g.size * 1.05, size: g.size };
  }
  if (n.type === 'lines') {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    n.segs.forEach(([a, b, c, d]) => {
      x1 = Math.min(x1, a, c); x2 = Math.max(x2, a, c);
      y1 = Math.min(y1, b, d); y2 = Math.max(y2, b, d);
    });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  return { x: n.x, y: n.y, w: n.w, h: n.h };
}

/** the point a layer turns around (text turns around its own box, like the renderer does) */
export function rotCenter(n, b) {
  return n.type === 'text' ? { x: n.x + n.w / 2, y: n.y + n.h / 2 } : { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** a point (world units) expressed in the layer's own, un-rotated frame */
export function unturn(n, b, x, y) {
  if (!n.rot) return { x, y };
  const { x: cx, y: cy } = rotCenter(n, b);
  const t = (-n.rot * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * Math.cos(t) - dy * Math.sin(t), y: cy + dx * Math.sin(t) + dy * Math.cos(t) };
}
/** the reverse: a point of the layer's own frame -> world units */
export function turn(n, b, x, y) {
  if (!n.rot) return { x, y };
  const { x: cx, y: cy } = rotCenter(n, b);
  const t = (n.rot * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * Math.cos(t) - dy * Math.sin(t), y: cy + dx * Math.sin(t) + dy * Math.cos(t) };
}

/** Top-most selectable layer under the point (design units). */
export function hitTest(pg, x, y, allowTemplate = true) {
  const { Wt, Ht } = pg.geo;
  for (let i = pg.flat.length - 1; i >= 0; i--) {
    const n = pg.flat[i];
    if (n.type === 'keyborder' && n.mode !== 'strip') {
      // click on the border band itself to select it (then Delete removes it)
      const inX = x >= n.x && x <= n.x + n.w;
      const inY = y >= n.y && y <= n.y + n.h;
      const onBand = inX && inY && (x < n.x + n.bw || x > n.x + n.w - n.bw || y < n.y + n.bw || y > n.y + n.h - n.bw);
      if (onBand) return n;
      continue;
    }
    if (n.type === 'keyborder' && n.mode === 'strip') {
      // horizontal line / pattern strip: always clickable (thin, so give it a few units of reach)
      const pad = Math.max(0, 8 - n.h / 2);
      if (x >= n.x && x <= n.x + n.w && y >= n.y - pad && y <= n.y + n.h + pad) return n;
      continue;
    }
    if (n.type === 'lines' || n.type === 'keyborder') continue; // grid lines: pick them from the Layers panel
    if (!n.custom && !allowTemplate) continue;
    if (n.type === 'rect' && !n.fill) continue; // outline-only boxes
    const b = boundsOf(n);
    if (!n.custom && b.w >= Wt * 0.97 && b.h >= Ht * 0.97) continue; // page-sized backgrounds
    const q = unturn(n, b, x, y);
    if (q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h) return n;
  }
  return null;
}
