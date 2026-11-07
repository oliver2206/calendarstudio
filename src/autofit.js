// Auto-fit text: makes every number / tide time / lunar character / holiday name in the day cells fit its
// cell and stay clear of its neighbours, on EVERY template.
//
// It runs once on the finished layer tree (see buildPage in layout.js), before the editor's own edits are applied,
// so the preview and the PSD export get the same corrected font sizes.
//
// 1) FIT THE BOX    text wider (or taller) than its own box is scaled down until it fits.
// 2) FIT THE CELL   text keeps a small margin from the cell borders (tide times used to touch the lines).
// 3) NO OVERLAP     every pair of overlapping texts is fixed in the cheapest way:
//                   squeeze one of them into the free space beside / above / below the other (keeps the size),
//                   or shrink it. Date numbers shrink last, tide times first. Text never gets smaller than a floor
//                   (tide 45 %, holiday 55 %, lunar 60 %, date 70 % of the original size).

const GROUPS = new Set(['Dates', 'Tide times', 'Lunar days', 'Lunar dates', 'Holiday labels', 'Moon phases']);
const CJK = /[\u2e80-\u9fff\uf900-\ufaff]/;

// rank = how important the text is (higher = shrinks last); min = smallest allowed fraction of the original size
const KINDS = {
  tide: { rank: 1, min: 0.45, weight: 1 },
  hol: { rank: 2, min: 0.55, weight: 1.1 },
  lunar: { rank: 3, min: 0.6, weight: 1.4 },
  num: { rank: 4, min: 0.7, weight: 2.2 },
  other: { rank: 0, min: 1, weight: 99 },
};
const kindOf = (n) => {
  if (/^Tide/.test(n.name)) return 'tide';
  if (/^Holiday/.test(n.name)) return 'hol';
  if (/^Lunar/.test(n.name)) return 'lunar';
  if (/^Day /.test(n.name)) return 'num';
  return 'other';
};

/** walk the tree, calling fn(node, parentGroupName) for every leaf */
function walk(nodes, parent, fn) {
  nodes.forEach((n) => {
    if (n.type === 'group') walk(n.children, n.name, fn);
    else fn(n, parent);
  });
}

export function autoFitTree(children, { measure, textGeom }) {
  /* ---------- helpers ---------- */
  const glyph = (n) => (CJK.test(n.text) ? { asc: 0.88, desc: 0.12 } : { asc: 0.78, desc: /[gjpqy,]/.test(n.text) ? 0.22 : 0.04 });

  /** ink rectangle of a text node at its current size */
  const ink = (n) => {
    const g = textGeom(n, measure);
    const w = measure(n.text, n.font, n.bold, g.size);
    const gl = glyph(n);
    const x0 = n.align === 'left' ? g.anchorX : n.align === 'right' ? g.anchorX - w : g.anchorX - w / 2;
    return { x0, x1: x0 + w, y0: g.baselineY - gl.asc * g.size, y1: g.baselineY + gl.desc * g.size, size: g.size, w };
  };

  /* ---------- 1) fit every text to its own box ---------- */
  const texts = [];
  const obstacles = []; // moon marks: fixed, only the texts move away from them
  walk(children, '', (n, parent) => {
    if (n.type === 'moon' && parent === 'Moon phases') obstacles.push(n);
    if (n.type !== 'text' || !GROUPS.has(parent) || n.rot || n.outline || !String(n.text).trim()) return;
    n._kind = kindOf(n);
    if (n._kind === 'other') return; // moon-cell captions etc. already fit themselves
    texts.push(n);
  });

  const fitBox = (n) => {
    const gl = glyph(n);
    let size = textGeom(n, measure).size;
    const w = measure(n.text, n.font, n.bold, size);
    const pad = n._kind === 'tide' || n._kind === 'hol' ? 5 : 1; // small margin from the cell borders
    if (w > n.w - pad) size = (size * (n.w - pad)) / w;
    const hMax = n.h / (gl.asc + gl.desc);
    if (size > hMax * 1.04 && n._kind !== 'num') size = hMax * 1.04; // numbers are sized by the template on purpose
    n.size = Math.max(size, 1);
  };
  texts.forEach((n) => { fitBox(n); n._size0 = n.size; });

  /* ---------- units: the characters of one lunar day move together ---------- */
  const units = [];
  const byKey = new Map();
  texts.forEach((n) => {
    const key = n._kind === 'lunar' ? n.name.replace(/ \d+$/, '') : null;
    if (key && byKey.has(key)) byKey.get(key).nodes.push(n);
    else {
      const u = { kind: n._kind, nodes: [n], key };
      if (key) byKey.set(key, u);
      units.push(u);
    }
  });
  units.forEach((u) => { u.k = KINDS[u.kind]; u.scale = 1; });

  const unitBox = (u) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    u.nodes.forEach((n) => {
      const r = ink(n);
      x0 = Math.min(x0, r.x0); y0 = Math.min(y0, r.y0); x1 = Math.max(x1, r.x1); y1 = Math.max(y1, r.y1);
    });
    return { x0, y0, x1, y1 };
  };

  const GAP = 1.6;
  const hit = (a, b, gap) => a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap;

  /** scale a unit about its own anchor (sizes of all its nodes) */
  const scaleUnit = (u, s) => {
    u.nodes.forEach((n, i) => {
      const old = n.size;
      n.size = old * s;
      if (u.kind === 'lunar') {
        // stacked characters: keep the centre of every box, pull the next character up
        const cx = n.x + n.w / 2;
        n.w *= s;
        n.x = cx - n.w / 2;
        if (u.nodes.length > 1 && i > 0) n.y = u.nodes[0].y + i * n.size * 1.12;
      }
    });
  };
  const snapshot = (u) => u.nodes.map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h, size: n.size }));
  const restore = (u, s) => u.nodes.forEach((n, i) => Object.assign(n, s[i]));

  /* ---------- candidate fixes for one unit that overlaps `other` (a rectangle) ---------- */
  function bestFix(u, other) {
    const fixes = [];
    const orig = u.nodes[0]._size0;
    const cur = u.nodes[0].size;
    const snap = snapshot(u);
    const scaleNow = () => u.nodes[0].size / orig;

    // (a) plain shrink
    for (let s = 0.97; s >= 0.4; s -= 0.03) {
      scaleUnit(u, s);
      const b = unitBox(u);
      const ok = !hit(b, other, GAP);
      const sc = scaleNow();
      restore(u, snap);
      if (ok) { fixes.push({ kind: 'shrink', s: sc, apply: () => { scaleUnit(u, s); } }); break; }
    }

    // (b) squeeze a single text into the free space beside / above / below the other one
    if (u.nodes.length === 1) {
      const n = u.nodes[0];
      const b = unitBox(u);
      const cxN = (b.x0 + b.x1) / 2;
      const cyN = (b.y0 + b.y1) / 2;
      const cxO = (other.x0 + other.x1) / 2;
      const cyO = (other.y0 + other.y1) / 2;
      // horizontal: the other text sits to one side of this one's centre
      const dx = Math.abs(cxO - cxN) / Math.max(1, (b.x1 - b.x0 + (other.x1 - other.x0)) / 2);
      const dy = Math.abs(cyO - cyN) / Math.max(1, (b.y1 - b.y0 + (other.y1 - other.y0)) / 2);
      if (dx >= dy) {
        const boxes = cxO > cxN ? { x: n.x, w: other.x0 - GAP - n.x } : { x: other.x1 + GAP, w: n.x + n.w - (other.x1 + GAP) };
        if (boxes.w > n.w * 0.35) {
          const o = { x: n.x, w: n.w, size: n.size };
          n.x = boxes.x; n.w = boxes.w;
          fitBox(n);
          const sc = n.size / orig;
          const ok = !hit(unitBox(u), other, GAP * 0.5);
          Object.assign(n, o);
          if (ok) fixes.push({ kind: 'squeezeX', s: sc, apply: () => { n.x = boxes.x; n.w = boxes.w; fitBox(n); } });
        }
      } else if (n.valign === 'middle') {
        const boxes = cyO > cyN ? { y: n.y, h: other.y0 - GAP - n.y } : { y: other.y1 + GAP, h: n.y + n.h - (other.y1 + GAP) };
        if (boxes.h > n.h * 0.35) {
          const o = { y: n.y, h: n.h, size: n.size };
          n.y = boxes.y; n.h = boxes.h;
          fitBox(n);
          const sc = n.size / orig;
          const ok = !hit(unitBox(u), other, GAP * 0.5);
          Object.assign(n, o);
          if (ok) fixes.push({ kind: 'squeezeY', s: sc, apply: () => { n.y = boxes.y; n.h = boxes.h; fitBox(n); } });
        }
      }
    }
    void cur;
    return fixes.filter((f) => f.s >= u.k.min - 1e-6).map((f) => ({ ...f, u, cost: (1 - Math.min(1, f.s)) * u.k.weight }));
  }

  /* ---------- 2) keep a margin from the cell borders: handled by the boxes; 3) resolve overlaps ---------- */
  const rectOfMoon = (m) => ({ x0: m.x, y0: m.y, x1: m.x + m.w, y1: m.y + m.h });

  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    const boxes = units.map((u) => ({ u, b: unitBox(u) })).sort((a, b) => a.b.x0 - b.b.x0);
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length && boxes[j].b.x0 < boxes[i].b.x1 + GAP; j++) {
        const A = boxes[i];
        const B = boxes[j];
        if (A.u === B.u || !hit(A.b, B.b, 0)) continue;
        const fixes = [...bestFix(A.u, B.b), ...bestFix(B.u, A.b)].sort((p, q) => p.cost - q.cost || p.u.k.rank - q.u.k.rank);
        if (fixes.length) { fixes[0].apply(); changed = true; A.b = unitBox(A.u); B.b = unitBox(B.u); }
      }
    }
    // tide / holiday / lunar texts also keep away from the moon marks
    units.forEach((u) => {
      if (u.kind === 'num') return;
      obstacles.forEach((m) => {
        const mr = rectOfMoon(m);
        if (!hit(unitBox(u), mr, 0)) return;
        const fixes = bestFix(u, mr);
        if (fixes.length) { fixes.sort((p, q) => p.cost - q.cost)[0].apply(); changed = true; }
      });
    });
    if (!changed) break;
  }

  texts.forEach((n) => { delete n._kind; delete n._size0; });
}
