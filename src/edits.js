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
export function applyEdits(pg, ps, imgs) {
  ps = ps || emptyPage();
  const meta = [];

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
      n.id = `${p}:${n.name}`;
      const o = ps.over[n.id] || {};
      out.push({ kind: 'layer', id: n.id, name: n.name, type: n.type, hidden: !!o.hidden });
      if (o.hidden) return;
      applyOver(n, o);
      kept.push(n);
    });
    return kept;
  };

  const children = walk(pg.children, '', meta);
  const customMeta = [];
  ps.custom.forEach((c) => {
    customMeta.push({ kind: 'layer', id: c.id, name: customName(c), type: c.type, hidden: !!c.hidden, custom: true });
    if (c.hidden) return;
    const n = customToNode(c, imgs);
    if (n) children.push(n);
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
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return n;
  }
  return null;
}
