// Photoshop-style editing on top of the preview canvas:
// select / move / resize / delete any layer, add text, images and rectangles,
// change fonts, sizes and colours, reorder, duplicate, undo / redo.
import { FONTS, pageCount } from './layout.js';
import { applyEdits, boundsOf, hitTest, emptyPage, uid, TEXT_Y_OFF, unturn, turn, rotCenter } from './edits.js';
import { canRotate } from './render.js';

const PT_PER_MM = 72 / 25.4;

export function createEditor({ canvas, getPage, getCfg, redraw, setStatus, h, toolsEl, inspEl, layersEl }) {
  const state = { pages: {} }; // pageIdx -> { over, custom }
  const imgs = new Map(); // imgId -> { img, url, name }
  let sel = null; // selected layer id (the "primary" one)
  const multi = new Set(); // extra selected layer ids (Shift+click) - together with `sel` they form the selection
  let snapOn = true; // snap to page edges / centre and to other layers while dragging
  let guides = null; // {x:[...], y:[...]} guide lines (design units) shown while a drag is snapped
  let alignToPage = false; // multi-selection: align to the page instead of to the selection's own box
  let tool = 'select';
  let cur = null; // last rendered page (final nodes)
  let curK = 1;
  let undoStack = [];
  let redoStack = [];
  let lastKey = '';
  let lastT = 0;
  let selectTemplate = true;
  let focusText = false;
  let drag = null;
  let cropId = null; // layer id in crop mode (drag the frame edges, the picture stays where it is)
  let panId = null; // layer id whose picture is being slid inside its frame (plain drag)
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  /** canvas pixels per on-screen CSS pixel (changes with the zoom bar) */
  const pxPerCss = () => {
    const r = canvas.getBoundingClientRect();
    return r.width ? canvas.width / r.width : 1;
  };
  const panning = () => !!panId && panId === sel;
  const cropping = () => !!cropId && cropId === sel;
  const flags = { layers: true, inspector: true };
  const openGroups = new Set();
  const btn = {};

  const pageState = (i = getPage()) => (state.pages[i] ||= emptyPage());
  const findFinal = (id) => (cur && id ? cur.flat.find((n) => n.id === id) : null);
  const getCustom = (id) => pageState().custom.find((c) => c.id === id);
  /** every selected id, primary first */
  const selIds = () => (sel ? [sel, ...[...multi].filter((i) => i !== sel)] : []);
  const isSel = (id) => id === sel || multi.has(id);
  const unitsPerPt = () => 1 / (cur.geo.mmPerUnit * PT_PER_MM);

  /* ---------------- history ---------------- */
  const snapshot = () => JSON.stringify(state.pages);
  function checkpoint(key = '') {
    const now = performance.now();
    if (key && key === lastKey && now - lastT < 900) {
      lastT = now;
      return;
    }
    undoStack.push(snapshot());
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
    lastKey = key;
    lastT = now;
    updateButtons();
  }
  function mutate(fn, key = '') {
    checkpoint(key);
    fn();
    flags.layers = true;
    redraw();
  }
  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    state.pages = JSON.parse(undoStack.pop());
    lastKey = '';
    afterHistory();
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    state.pages = JSON.parse(redoStack.pop());
    lastKey = '';
    afterHistory();
  }
  function afterHistory() {
    flags.layers = true;
    flags.inspector = true;
    updateButtons();
    redraw();
  }

  /* ---------------- selection / properties ---------------- */
  function select(id) {
    if (sel === id && !multi.size) return;
    multi.clear();
    sel = id;
    flags.inspector = true;
    flags.layers = true;
    redraw();
  }

  function setProp(id, key, val) {
    const c = getCustom(id);
    if (c) c[key] = val;
    else (pageState().over[id] ||= {})[key] = val;
  }

  const canResize = (n) => n.type !== 'lines' && n.type !== 'keyborder';
  // pictures that fill their frame (crop) resize freely; pictures that fit inside keep their shape
  const lockAspect = (n) => (n.type === 'image' ? n.fit === 'contain' : n.type === 'text' || n.type === 'moon' || n.type === 'goat');

  /** Move / resize a layer so its visible bounds become nb. st = state captured at drag start. */
  function setBox(id, nb, st, resizing) {
    const c = getCustom(id);
    if (c) {
      if (c.type === 'text') {
        c.size = Math.max(4, st.size * (nb.w / st.b.w));
        c.x = nb.x;
        c.y = nb.y - TEXT_Y_OFF * c.size;
      } else {
        c.x = nb.x;
        c.y = nb.y;
        c.w = Math.max(6, nb.w);
        c.h = Math.max(6, nb.h);
      }
      return;
    }
    const o = (pageState().over[id] ||= {});
    const n = findFinal(id);
    if (n && n.type === 'text' && resizing) {
      o.size = Math.max(4, st.size * (nb.w / st.b.w));
      return;
    }
    o.dx = (st.over.dx || 0) + (nb.x - st.b.x);
    o.dy = (st.over.dy || 0) + (nb.y - st.b.y);
    if (resizing && n && n.type !== 'lines' && n.type !== 'text') {
      o.dw = (st.over.dw || 0) + (nb.w - st.b.w);
      o.dh = (st.over.dh || 0) + (nb.h - st.b.h);
    }
  }

  function startState(n) {
    const b = boundsOf(n);
    const o = pageState().over[n.id] || {};
    return { b, size: b.size, over: { dx: o.dx, dy: o.dy, dw: o.dw, dh: o.dh } };
  }

  function nudge(dx, dy) {
    const items = selIds().map((id) => findFinal(id)).filter(Boolean).map((n) => ({ id: n.id, st: startState(n) }));
    if (!items.length) return;
    mutate(() => items.forEach(({ id, st }) => setBox(id, { ...st.b, x: st.b.x + dx, y: st.b.y + dy }, st, false)), 'nudge:' + selIds().join(','));
  }

  /* ---------------- align / distribute (position-based combining) ----------------
     Works on any mix of text, pictures, shapes and template layers. One layer aligns to the page (inside the
     trim); two or more align to their common box (or to the page with the “to page” switch). Distribute needs 3+. */
  const movable = (n) => n && n.type !== 'keyborder' || (n && n.mode === 'strip');
  const pageBox = () => {
    const g = cur.geo;
    return { x: g.b, y: g.b, w: g.Wt - 2 * g.b, h: g.Ht - 2 * g.b };
  };
  const unionBox = (bs) => {
    const x1 = Math.min(...bs.map((b) => b.x));
    const y1 = Math.min(...bs.map((b) => b.y));
    const x2 = Math.max(...bs.map((b) => b.x + b.w));
    const y2 = Math.max(...bs.map((b) => b.y + b.h));
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
  function selectedNodes() {
    return selIds().map((id) => findFinal(id)).filter((n) => n && movable(n));
  }
  /** how: left | hcenter | right | top | vmiddle | bottom */
  function alignLayers(how) {
    const nodes = selectedNodes();
    if (!nodes.length || !cur) return;
    const items = nodes.map((n) => ({ n, st: startState(n) }));
    const ref = nodes.length === 1 || alignToPage ? pageBox() : unionBox(items.map((i) => i.st.b));
    mutate(() => {
      items.forEach(({ n, st }) => {
        const b = st.b;
        const nb = { ...b };
        if (how === 'left') nb.x = ref.x;
        if (how === 'hcenter') nb.x = ref.x + (ref.w - b.w) / 2;
        if (how === 'right') nb.x = ref.x + ref.w - b.w;
        if (how === 'top') nb.y = ref.y;
        if (how === 'vmiddle') nb.y = ref.y + (ref.h - b.h) / 2;
        if (how === 'bottom') nb.y = ref.y + ref.h - b.h;
        setBox(n.id, nb, st, false);
      });
    });
    setStatus(`Aligned ${nodes.length} layer${nodes.length > 1 ? 's' : ''} (${how}).`);
  }
  /** equal gaps between 3+ layers along an axis ('h' or 'v') */
  function distributeLayers(axis) {
    const nodes = selectedNodes();
    if (nodes.length < 3) {
      setStatus('Select three or more layers (Shift+click) to distribute them.');
      return;
    }
    const items = nodes.map((n) => ({ n, st: startState(n) })).sort((a, b) => (axis === 'h' ? a.st.b.x - b.st.b.x : a.st.b.y - b.st.b.y));
    const first = items[0].st.b;
    const last = items[items.length - 1].st.b;
    const total = axis === 'h' ? last.x + last.w - first.x : last.y + last.h - first.y;
    const used = items.reduce((s, i) => s + (axis === 'h' ? i.st.b.w : i.st.b.h), 0);
    const gap = (total - used) / (items.length - 1);
    mutate(() => {
      let pos = axis === 'h' ? first.x : first.y;
      items.forEach(({ n, st }) => {
        setBox(n.id, axis === 'h' ? { ...st.b, x: pos } : { ...st.b, y: pos }, st, false);
        pos += (axis === 'h' ? st.b.w : st.b.h) + gap;
      });
    });
    setStatus(`Distributed ${items.length} layers ${axis === 'h' ? 'horizontally' : 'vertically'}.`);
  }
  /** make every selected picture / shape as wide or tall as the primary layer (size-based combining) */
  function matchSize(dim) {
    const base = findFinal(sel);
    const others = selectedNodes().filter((n) => n.id !== sel && n.type !== 'text' && n.type !== 'lines' && n.type !== 'moon' && n.type !== 'goat');
    if (!base || !others.length) {
      setStatus('Shift+click pictures or shapes, then match them to the first one you selected.');
      return;
    }
    const bb = boundsOf(base);
    mutate(() => {
      others.forEach((n) => {
        const st = startState(n);
        setBox(n.id, { ...st.b, w: dim === 'w' || dim === 'both' ? bb.w : st.b.w, h: dim === 'h' || dim === 'both' ? bb.h : st.b.h }, st, true);
      });
    });
    setStatus(`Matched ${dim === 'both' ? 'width and height' : dim === 'w' ? 'width' : 'height'} to “${base.name}”.`);
  }

  /** selectable layers for Ctrl+A / box selection: skips grid lines, borders and page-sized backgrounds */
  function selectAll() {
    if (!cur) return;
    const { Wt, Ht } = cur.geo;
    const ids = cur.flat
      .filter((n) => (n.custom || selectTemplate) && n.type !== 'lines' && n.type !== 'keyborder' && !(n.type === 'rect' && !n.fill))
      .filter((n) => {
        const b = boundsOf(n);
        return n.custom || !(b.w >= Wt * 0.97 && b.h >= Ht * 0.97);
      })
      .map((n) => n.id);
    if (!ids.length) return;
    multi.clear();
    sel = ids[ids.length - 1];
    ids.forEach((i) => i !== sel && multi.add(i));
    flags.inspector = true;
    flags.layers = true;
    setStatus(`${ids.length} layers selected - use Align in the Properties panel, or drag to move them together.`);
    redraw();
  }
  /** Shift+click: add / remove one layer from the selection */
  function toggleInSelection(id) {
    if (!sel) {
      select(id);
      return;
    }
    if (id === sel) {
      const next = [...multi][0];
      multi.delete(next);
      sel = next ?? null;
    } else if (multi.has(id)) multi.delete(id);
    else multi.add(id);
    flags.inspector = true;
    flags.layers = true;
    redraw();
  }

  function deleteSelected() {
    if (!sel) return;
    const ids = selIds();
    const anyTemplate = ids.some((id) => !getCustom(id));
    mutate(() => {
      ids.forEach((id) => {
        if (getCustom(id)) {
          const ps = pageState();
          ps.custom = ps.custom.filter((x) => x.id !== id);
        } else {
          setProp(id, 'hidden', true);
        }
      });
    });
    sel = null;
    multi.clear();
    flags.inspector = true;
    setStatus(anyTemplate ? 'Template layer removed. Bring it back with the ○ icon in the Layers panel, or Ctrl+Z.' : 'Layer deleted (Ctrl+Z to undo).');
  }

  /** Delete the selected layer from EVERY calendar page (template layers are matched by id, added layers by type + position + content). */
  function deleteSelectedEverywhere() {
    if (!sel) {
      setStatus('Select a layer first, then use “Delete on all pages”.');
      return;
    }
    const targets = selIds().map((id) => ({ id, c: getCustom(id) }));
    const total = pageCount(getCfg());
    mutate(() => {
      targets.forEach(({ id, c }) => {
        for (let i = 0; i < total; i++) {
          const ps = pageState(i);
          if (c) {
            ps.custom = ps.custom.filter(
              (x) => !(x.id === c.id || (x.type === c.type && x.x === c.x && x.y === c.y && x.text === c.text && x.imgId === c.imgId && x.color === c.color)),
            );
          } else {
            (ps.over[id] ||= {}).hidden = true;
          }
        }
      });
    });
    sel = null;
    multi.clear();
    flags.inspector = true;
    setStatus(`Layer deleted on all ${total} pages (Ctrl+Z to undo).`);
  }

  /** Delete a whole group of template layers (e.g. “Footer”, “Photo”). all = every page. */
  function deleteGroup(m, all) {
    const ids = [];
    const collect = (g) => g.children.forEach((c) => (c.kind === 'group' ? collect(c) : ids.push(c.id)));
    collect(m);
    const pages = all ? [...Array(pageCount(getCfg())).keys()] : [getPage()];
    mutate(() => {
      pages.forEach((i) => {
        const ps = pageState(i);
        ids.forEach((id) => ((ps.over[id] ||= {}).hidden = true));
      });
    });
    sel = null;
    flags.inspector = true;
    setStatus(`Group “${m.name}” removed${all ? ' on all pages' : ''} (Ctrl+Z to undo).`);
  }

  function toggleHidden(id) {
    const c = getCustom(id);
    mutate(() => {
      if (c) c.hidden = !c.hidden;
      else {
        const o = (pageState().over[id] ||= {});
        o.hidden = !o.hidden;
      }
    });
    if (sel === id) sel = null;
    flags.inspector = true;
  }

  /* ---------------- rotate / flip ---------------- */
  function rotateBy(deg) {
    const ids = selIds().filter((id) => { const n = findFinal(id); return n && canRotate(n); });
    if (!ids.length) return;
    mutate(() => ids.forEach((id) => setProp(id, 'rot', normDeg((findFinal(id).rot || 0) + deg))), 'rot:' + ids.join(','));
    setStatus(`Rotated ${deg > 0 ? '+' : ''}${deg}°.`);
  }
  function setRot(deg, key) {
    const ids = selIds().filter((id) => { const n = findFinal(id); return n && canRotate(n); });
    mutate(() => ids.forEach((id) => setProp(id, 'rot', normDeg(deg))), key || 'rot:' + ids.join(','));
  }
  function flipSel(axis) {
    const ids = selIds().filter((id) => { const n = findFinal(id); return n && canRotate(n) && n.type !== 'text'; });
    if (!ids.length) { setStatus('Flip works on pictures, shapes and moons (not on text).'); return; }
    const key = axis === 'h' ? 'flipX' : 'flipY';
    mutate(() => ids.forEach((id) => setProp(id, key, !findFinal(id)[key])));
    flags.inspector = true;
  }

  function duplicateSelected() {
    const c = getCustom(sel);
    if (!c) {
      setStatus('Duplicate works on layers you added (Text / Image / Rectangle).');
      return;
    }
    const copy = { ...c, id: uid(), x: c.x + 20, y: c.y + 20 };
    mutate(() => pageState().custom.push(copy));
    sel = copy.id;
    flags.inspector = true;
  }

  function copyToAllPages() {
    const c = getCustom(sel);
    if (!c) {
      setStatus('Select a layer you added first (Text / Image / Rectangle).');
      return;
    }
    mutate(() => {
      for (let i = 0; i < pageCount(getCfg()); i++) {
        if (i === getPage()) continue;
        pageState(i).custom.push({ ...c, id: uid() });
      }
    });
    setStatus('Copied to all other pages at the same position.');
  }

  /* ---------------- stacking order ----------------
     Layers you add can sit anywhere in the template's paint order (not only above it), so a picture can go
     BEHIND template text such as “YOUR PHOTO HERE”. Each added layer stores pos = 'before:<id>' / 'after:<id>'
     of a template layer; no pos = on top of everything. */
  const dropPos = (c) => {
    if (!c.pos) delete c.pos;
  };
  function needCustom() {
    const c = getCustom(sel);
    if (!c) setStatus('Select a layer you added (Text / Image / Rectangle) to change its stacking order.');
    return c;
  }
  /** one step forward (+1) or backward (-1) through EVERY visible layer, template ones included */
  let seqN = 0;
  const nextSeq = () => Date.now() * 1000 + (seqN++ % 1000);
  /** template layer: stack it right before / after another template layer (stored as an override, replayed by applyEdits) */
  function setTplPos(id, where, anchor) {
    const o = (pageState().over[id] ||= {});
    o.pos = `${where}:${anchor}`;
    o.seq = nextSeq();
  }
  /** nearest template layer in paint order next to id (added layers are skipped) */
  function tplNeighbor(id, dir) {
    const flat = cur.flat;
    for (let i = flat.findIndex((n) => n.id === id) + dir; flat[i]; i += dir) if (!flat[i].custom) return flat[i];
    return null;
  }
  function reorder(dir) {
    if (!sel || !cur) return;
    if (!getCustom(sel)) {
      const nb = tplNeighbor(sel, dir);
      if (!nb) {
        setStatus(dir > 0 ? 'Already on top.' : 'Already at the very back.');
        return;
      }
      mutate(() => setTplPos(sel, dir > 0 ? 'after' : 'before', nb.id));
      setStatus(dir > 0 ? 'Brought forward one layer.' : 'Sent backward one layer.');
      return;
    }
    const c = getCustom(sel);
    const flat = cur.flat;
    const i = flat.findIndex((n) => n.id === c.id);
    if (i < 0) return;
    const nb = flat[i + dir];
    if (!nb) {
      setStatus(dir > 0 ? 'Already on top.' : 'Already at the very back.');
      return;
    }
    const arr = pageState().custom;
    mutate(() => {
      arr.splice(arr.indexOf(c), 1);
      const nc = nb.custom ? arr.find((x) => x.id === nb.id) : null;
      if (nc) {
        c.pos = nc.pos;
        arr.splice(arr.indexOf(nc) + (dir > 0 ? 1 : 0), 0, c);
      } else if (dir < 0) {
        c.pos = `before:${nb.id}`;
        arr.push(c);
      } else {
        c.pos = `after:${nb.id}`;
        arr.unshift(c);
      }
      dropPos(c);
    });
    setStatus(dir > 0 ? 'Brought forward one layer.' : 'Sent backward one layer.');
  }
  function toFront() {
    if (sel && !getCustom(sel) && cur) {
      const last = [...cur.flat].reverse().find((n) => !n.custom && n.id !== sel);
      if (last) mutate(() => setTplPos(sel, 'after', last.id));
      setStatus('Brought to front of the template layers.');
      return;
    }
    const c = needCustom();
    if (!c) return;
    const arr = pageState().custom;
    mutate(() => {
      arr.splice(arr.indexOf(c), 1);
      delete c.pos;
      arr.push(c);
    });
    setStatus('Brought to front.');
  }
  function toBack() {
    if (sel && !getCustom(sel) && cur) {
      const first = cur.flat.find((n) => !n.custom && n.id !== sel);
      if (first) mutate(() => setTplPos(sel, 'before', first.id));
      setStatus('Sent to the very back of the template layers.');
      return;
    }
    const c = needCustom();
    if (!c || !cur) return;
    const first = cur.flat.find((n) => !n.custom);
    if (!first) return;
    const arr = pageState().custom;
    mutate(() => {
      arr.splice(arr.indexOf(c), 1);
      c.pos = `before:${first.id}`;
      arr.unshift(c);
    });
    setStatus('Sent to the very back.');
  }
  /** just under the lowest template text layer: above backgrounds / shades, below every piece of text */
  function behindText() {
    const c = needCustom();
    if (!c || !cur) return;
    const t = cur.flat.find((n) => !n.custom && n.type === 'text');
    if (!t) {
      setStatus('This page has no template text to go behind.');
      return;
    }
    const arr = pageState().custom;
    mutate(() => {
      arr.splice(arr.indexOf(c), 1);
      c.pos = `before:${t.id}`;
      arr.push(c);
    });
    setStatus('Placed behind the template text - text now shows on top of this layer.');
  }

  /** Drag-and-drop in the Layers panel: put layer `srcId` directly behind ('before') or in front of ('after') layer `tgtId`. */
  function placeLayer(srcId, tgtId, where) {
    if (!srcId || srcId === tgtId) return;
    const sc = getCustom(srcId);
    const tc = getCustom(tgtId);
    const arr = pageState().custom;
    if (!sc && tc) {
      setStatus('A template layer can only be dropped onto another template layer.');
      return;
    }
    mutate(() => {
      if (sc) {
        arr.splice(arr.indexOf(sc), 1);
        if (tc) {
          sc.pos = tc.pos;
          arr.splice(arr.indexOf(tc) + (where === 'after' ? 1 : 0), 0, sc);
        } else {
          sc.pos = `${where}:${tgtId}`;
          if (where === 'before') arr.push(sc);
          else arr.unshift(sc);
        }
        dropPos(sc);
      } else setTplPos(srcId, where, tgtId);
    });
    multi.clear();
    sel = srcId;
    flags.inspector = true;
    setStatus(`Moved ${where === 'before' ? 'behind' : 'in front of'} the other layer.`);
  }

  /* ---------------- adding layers ---------------- */
  function addCustom(c) {
    c.id = uid();
    mutate(() => pageState().custom.push(c));
    sel = c.id;
    flags.inspector = true;
    flags.layers = true;
  }

  function addText(x, y) {
    const cfg = getCfg();
    const size = 36 * unitsPerPt();
    addCustom({
      type: 'text', text: 'Your text', font: cfg.headingFont || 'Arial', bold: false,
      size, color: cfg.text || '#1c1c1c', opacity: 1,
      x, y: y - size * 0.65,
    });
    focusText = true;
  }

  function addRect() {
    const { Wt, Ht } = cur.geo;
    addCustom({ type: 'rect', w: 300, h: 150, x: Wt / 2 - 150, y: Ht / 2 - 75, color: getCfg().accent || '#f2a900', opacity: 1, radius: 0 });
  }

  function addImage(file, at) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const id = uid();
      imgs.set(id, { img, url, name: file.name });
      const { Wt, Ht } = cur.geo;
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const s = Math.min((Wt * 0.45) / iw, (Ht * 0.45) / ih);
      const w = iw * s;
      const hh = ih * s;
      const cx = at ? at.x : Wt / 2;
      const cy = at ? at.y : Ht / 2;
      addCustom({ type: 'image', imgId: id, name: file.name, x: cx - w / 2, y: cy - hh / 2, w, h: hh, opacity: 1 });
    };
    img.onerror = () => setStatus(`Could not read "${file.name}" as an image.`);
    img.src = url;
  }

  /* ---------------- custom fonts ---------------- */
  function registerFont(name, ps) {
    FONTS[name] = { css: `"${name}", sans-serif`, ps: ps || name.replace(/\s+/g, ''), psBold: `${ps || name.replace(/\s+/g, '')}-Bold` };
  }
  async function uploadFont(file) {
    if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    try {
      const face = new FontFace(name, await file.arrayBuffer());
      await face.load();
      document.fonts.add(face);
      registerFont(name);
      if (sel) mutate(() => setProp(sel, 'font', name));
      flags.inspector = true;
      redraw();
      setStatus(`Font "${name}" loaded. It lives in this browser tab only — re-upload it next time. (Photoshop needs the same font installed to keep the text live.)`);
    } catch (e) {
      setStatus(`Could not load that font file: ${e.message}`);
    }
  }
  function useInstalledFont() {
    const name = (window.prompt('Exact name of a font installed on this computer (e.g. Montserrat):') || '').trim();
    if (!name) return;
    registerFont(name);
    if (sel) mutate(() => setProp(sel, 'font', name));
    flags.inspector = true;
    redraw();
  }

  /* ---------------- toolbar ---------------- */
  function setTool(t) {
    tool = t;
    btn.select.classList.toggle('on', t === 'select');
    btn.text.classList.toggle('on', t === 'text');
    canvas.style.cursor = t === 'text' ? 'text' : 'default';
    if (t === 'text') setStatus('Text tool: click on the page where you want the text.');
  }

  function updateButtons() {
    if (btn.undo) {
      btn.undo.disabled = !undoStack.length;
      btn.redo.disabled = !redoStack.length;
    }
  }

  function buildToolbar() {
    const mk = (label, title, fn, key) => {
      const b = h('button', { class: 'tool', title, text: label });
      b.addEventListener('click', fn);
      if (key) btn[key] = b;
      toolsEl.append(b);
      return b;
    };
    const sep = () => toolsEl.append(h('span', { class: 'sep' }));

    mk('↖ Select', 'Select / move / resize (V)', () => setTool('select'), 'select');
    mk('T Text', 'Click the page to drop text (T)', () => setTool(tool === 'text' ? 'select' : 'text'), 'text');
    const fileIn = h('input', { type: 'file', accept: 'image/*', multiple: '', hidden: '' });
    fileIn.addEventListener('change', () => {
      [...fileIn.files].forEach((f) => addImage(f));
      fileIn.value = '';
    });
    mk('🖼 Image', 'Add an image / logo layer (or drag a file onto the page, or paste)', () => fileIn.click());
    mk('▭ Rectangle', 'Add a rectangle', () => cur && addRect());
    toolsEl.append(fileIn);
    sep();
    mk('⧉ Duplicate', 'Duplicate (Ctrl+D)', duplicateSelected);
    mk('Copy to all pages', 'Put this layer on every page', copyToAllPages);
    mk('▲', 'Bring forward one layer (Ctrl+])', () => reorder(1));
    mk('▼', 'Send backward one layer (Ctrl+[)', () => reorder(-1));
    mk('⇩ Behind text', 'Put the selected layer behind all the template text (so text shows on top of it)', behindText);
    mk('⤒ Front', 'Bring the selected layer to the very front (Ctrl+Shift+])', toFront);
    sep();
    mk('🗑 Delete', 'Delete selected layer (Delete key)', deleteSelected);
    mk('🗑 Delete on all pages', 'Delete this layer on every calendar page (Shift+Delete)', deleteSelectedEverywhere);
    sep();
    mk('↶ Undo', 'Undo (Ctrl+Z)', undo, 'undo');
    mk('↷ Redo', 'Redo (Ctrl+Shift+Z)', redo, 'redo');
    sep();
    const lbl = h('label', { class: 'tool-check' });
    const cb = h('input', { type: 'checkbox' });
    cb.checked = selectTemplate;
    cb.addEventListener('change', () => (selectTemplate = cb.checked));
    lbl.append(cb, h('span', { text: 'Pick template layers' }));
    toolsEl.append(lbl);
    const snapLbl = h('label', { class: 'tool-check', title: 'Snap to the page edges / centre and to other layers while dragging (hold Ctrl to move freely)' });
    const snapCb = h('input', { type: 'checkbox' });
    snapCb.checked = snapOn;
    snapCb.addEventListener('change', () => (snapOn = snapCb.checked));
    snapLbl.append(snapCb, h('span', { text: 'Snap' }));
    toolsEl.append(snapLbl);
    setTool('select');
    updateButtons();
  }

  /* ---------------- inspector ---------------- */
  const toHex = (c) => {
    if (typeof c !== 'string') return '#000000';
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + [...c.slice(1)].map((x) => x + x).join('');
    const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    return m ? '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('') : '#000000';
  };

  /** Align / distribute / match-size buttons (used for one layer = “to page”, and for a multi-selection) */
  function alignSection(many) {
    const ab = (label, title, fn) => {
      const b = h('button', { class: 'tool', type: 'button', title, text: label });
      b.addEventListener('click', fn);
      return b;
    };
    const out = [
      h('h4', { class: 'sub', text: many && !alignToPage ? 'Align to each other' : 'Align to the page' }),
      h('div', { class: 'qrow' },
        ab('⇤ Left', 'Align left edges', () => alignLayers('left')),
        ab('⇔ Centre', 'Centre horizontally', () => alignLayers('hcenter')),
        ab('⇥ Right', 'Align right edges', () => alignLayers('right')),
        ab('⤒ Top', 'Align top edges', () => alignLayers('top')),
        ab('⇕ Middle', 'Centre vertically', () => alignLayers('vmiddle')),
        ab('⤓ Bottom', 'Align bottom edges', () => alignLayers('bottom'))),
    ];
    if (many) {
      const cb = h('input', { type: 'checkbox' });
      cb.checked = alignToPage;
      cb.addEventListener('change', () => {
        alignToPage = cb.checked;
        flags.inspector = true;
        redraw();
      });
      out.push(
        h('label', { class: 'field check' }, cb, h('span', { text: 'Align to the page instead' })),
        h('h4', { class: 'sub', text: 'Spread & match' }),
        h('div', { class: 'qrow qrow2' },
          ab('↔ Space evenly', 'Equal gaps left to right (3 or more layers)', () => distributeLayers('h')),
          ab('↕ Space evenly', 'Equal gaps top to bottom (3 or more layers)', () => distributeLayers('v')),
          ab('Same width', 'Make pictures / shapes as wide as the first layer you selected', () => matchSize('w')),
          ab('Same height', 'Make pictures / shapes as tall as the first layer you selected', () => matchSize('h'))),
        ab('Same width + height', 'Make pictures / shapes the same size as the first layer you selected', () => matchSize('both')),
      );
    }
    return out;
  }

  function renderMultiInspector() {
    const names = selIds().map((id) => findFinal(id)).filter(Boolean);
    const body = h('div', { class: 'section-body' });
    inspEl.append(
      h('h3', { text: `${names.length} layers selected` }),
      h('div', { class: 'hint', text: 'Drag any selected layer to move them together (they snap to the page and to each other). Arrow keys nudge; Shift+click adds or removes a layer; Esc clears.' }),
      body,
    );
    body.append(...alignSection(true));
    const del = h('button', { class: 'tool danger', text: '🗑 Delete selected' });
    del.addEventListener('click', deleteSelected);
    const delAll = h('button', { class: 'tool danger', text: '🗑 Delete on all pages' });
    delAll.addEventListener('click', deleteSelectedEverywhere);
    body.append(h('div', { class: 'row2' }, del, delAll));
  }

  function renderInspector() {
    flags.inspector = false;
    inspEl.innerHTML = '';
    if (multi.size && sel) {
      renderMultiInspector();
      return;
    }
    const n = findFinal(sel);
    if (!n) {
      inspEl.append(
        h('h3', { text: 'Properties' }),
        h('p', { class: 'hint', text: 'Click anything on the page to edit it. Drag to move, drag a corner handle to resize, press Delete to remove. Use “T Text” to drop new text, or 🖼 Image / drag a picture onto the page.' }),
      );
      return;
    }
    const custom = getCustom(sel);
    const ov = () => (custom ? null : pageState().over[sel]);
    const geo = cur.geo;
    const field = (label, input) => h('label', { class: 'field' }, h('span', { text: label }), input);
    const row = (...kids) => h('div', { class: 'row2' }, ...kids);
    const body = h('div', { class: 'section-body' });

    inspEl.append(h('h3', { text: n.name }), h('div', { class: 'hint', text: custom ? 'Layer you added' : 'Template layer' }), body);

    {
      const ab = (label, title, fn) => {
        const b = h('button', { class: 'tool', type: 'button', title, text: label });
        b.addEventListener('click', fn);
        return b;
      };
      body.append(
        h('h4', { class: 'sub', text: 'Arrange' }),
        h('div', { class: 'qrow qrow2' },
          ab('▲ Forward', 'Bring forward one layer (Ctrl+])', () => reorder(1)),
          ab('▼ Backward', 'Send backward one layer (Ctrl+[)', () => reorder(-1)),
          ab('⤒ To front', 'Bring to the very front (Ctrl+Shift+])', toFront),
          ab('⤓ To back', 'Send to the very back (Ctrl+Shift+[)', toBack),
        ),
        ...(custom
          ? [ab('⇩ Behind the text', 'Put this layer behind all the template text so the text shows on top', behindText)]
          : [h('div', { class: 'hint', text: 'Tip: or drag the layer up / down inside the Layers panel to put it above or below another layer (e.g. the Background).' })]),
      );
    }

    if (n.type === 'text') {
      const t = h('input', { type: 'text', 'data-k': 'text' });
      t.value = n.text;
      t.addEventListener('input', () => mutate(() => setProp(sel, 'text', t.value), 'text:' + sel));
      body.append(field('Text', t));

      const fs = h('select', {}, ...Object.keys(FONTS).map((f) => h('option', { value: f, text: f })));
      fs.value = FONTS[n.font] ? n.font : 'Arial';
      fs.addEventListener('change', () => mutate(() => setProp(sel, 'font', fs.value)));
      body.append(field('Font', fs));

      const fontFile = h('input', { type: 'file', accept: '.ttf,.otf,.woff,.woff2', hidden: '' });
      fontFile.addEventListener('change', () => uploadFont(fontFile.files[0]));
      const up = h('button', { class: 'link', text: 'Upload a font file…' });
      up.addEventListener('click', () => fontFile.click());
      const inst = h('button', { class: 'link', text: 'Use an installed font by name…' });
      inst.addEventListener('click', useInstalledFont);
      body.append(h('div', { class: 'linkrow' }, up, inst, fontFile));

      const size = h('input', { type: 'number', min: 4, max: 600, step: 1 });
      size.value = Math.round(boundsOf(n).size / unitsPerPt() * 10) / 10;
      size.setAttribute('data-k', 'size');
      size.addEventListener('input', () => {
        const pt = Number(size.value);
        if (pt > 0) mutate(() => setProp(sel, 'size', pt * unitsPerPt()), 'size:' + sel);
      });
      const bold = h('input', { type: 'checkbox' });
      bold.checked = !!n.bold;
      bold.addEventListener('change', () => mutate(() => setProp(sel, 'bold', bold.checked)));
      body.append(row(field('Size (pt)', size), h('label', { class: 'field check' }, bold, h('span', { text: 'Bold' }))));

      if (!custom) {
        const al = h('select', {}, ...[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']].map(([v, l]) => h('option', { value: v, text: l })));
        al.value = n.align;
        al.addEventListener('change', () => mutate(() => setProp(sel, 'align', al.value)));
        body.append(field('Alignment', al));
      }
    }

    if (n.type === 'text' || n.type === 'rect' || n.type === 'lines' || n.type === 'moon' || n.type === 'keyborder' || n.type === 'goat') {
      const col = h('input', { type: 'color' });
      col.value = toHex(n.type === 'rect' ? n.fill : n.color);
      col.addEventListener('input', () => mutate(() => setProp(sel, 'color', col.value), 'color:' + sel));
      body.append(h('label', { class: 'field color' }, h('span', { text: 'Colour' }), col));
    }

    if (n.type === 'image') {
      const fitContain = n.fit === 'contain';
      const setImg = (patch, key) => mutate(() => Object.entries(patch).forEach(([k, v]) => setProp(sel, k, v)), key);
      const range = (k, min, max, step) => {
        const r = h('input', { type: 'range', min, max, step, 'data-img': k });
        r.value = n[k] ?? (k === 'zoom' ? 1 : 0.5);
        r.addEventListener('input', () => setImg({ [k]: Number(r.value) }, 'img:' + k + sel));
        return r;
      };
      const quick = (label, patch, title) => {
        const b = h('button', { class: 'tool', text: label, title });
        b.addEventListener('click', () => setImg(patch));
        return b;
      };

      const fs = h('select', {}, h('option', { value: 'cover', text: 'Fill frame (crop the picture)' }), h('option', { value: 'contain', text: 'Fit inside frame (no crop)' }));
      fs.value = fitContain ? 'contain' : 'cover';
      fs.addEventListener('change', () => {
        flags.inspector = true;
        setImg({ fit: fs.value, zoom: 1, fx: 0.5, fy: 0.5 });
      });
      body.append(h('h4', { class: 'sub', text: 'Picture inside the frame' }), field('Fit', fs));
      body.append(field('Zoom picture', range('zoom', fitContain ? 0.25 : 1, 4, 0.01)));
      body.append(field('Top part ↕ Bottom part', range('fy', 0, 1, 0.01)));
      body.append(h('div', { class: 'qrow' },
        quick('⬆ Top', { fy: 0 }, 'Show the top of the picture'),
        quick('◎ Middle', { fy: 0.5 }, 'Centre vertically'),
        quick('⬇ Bottom', { fy: 1 }, 'Show the bottom of the picture')));
      body.append(field('Left part ↔ Right part', range('fx', 0, 1, 0.01)));
      body.append(h('div', { class: 'qrow' },
        quick('⬅ Left', { fx: 0 }, 'Show the left of the picture'),
        quick('◎ Centre', { fx: 0.5 }, 'Centre horizontally'),
        quick('➡ Right', { fx: 1 }, 'Show the right of the picture')));

      const pan = h('button', { class: 'tool' + (panning() ? ' on' : ''), text: panning() ? '✋ Sliding picture… (click to stop)' : '✋ Slide picture on the page', title: 'Drag on the page to move the picture inside its frame (or hold Alt and drag)' });
      pan.addEventListener('click', () => {
        panId = panning() ? null : sel;
        flags.inspector = true;
        canvas.style.cursor = panning() ? 'grab' : 'default';
        setStatus(panning() ? 'Drag the picture on the page to slide it inside its frame. Esc or the button again to stop.' : 'Slide mode off.');
        redraw();
      });
      const reset = h('button', { class: 'tool', text: 'Reset picture', title: 'Zoom 1×, centred' });
      reset.addEventListener('click', () => setImg({ zoom: 1, fx: 0.5, fy: 0.5 }));
      const crop = h('button', { class: 'tool' + (cropping() ? ' on' : ''), text: cropping() ? '✂ Cropping… (click to finish)' : '✂ Crop picture', title: 'Drag the edges or corners of the frame to cut the picture; it does not move or resize' });
      crop.addEventListener('click', () => {
        cropId = cropping() ? null : sel;
        panId = null;
        flags.inspector = true;
        setStatus(cropping() ? 'Crop: drag the orange handles on the edges / corners. The picture stays in place. Esc or the button again to finish.' : 'Crop finished.');
        redraw();
      });
      const uncrop = h('button', { class: 'tool', text: 'Show whole picture', title: 'Undo the crop: the frame grows to the whole picture' });
      uncrop.addEventListener('click', () => {
        const pp = picPlace(n);
        const cx = n.x + n.w / 2;
        const cy = n.y + n.h / 2;
        const nw = pp.dw;
        const nh = pp.dh;
        // frame = the whole picture, same place on the page (turned layers: keep the centre of the picture)
        const visL = n.flipX ? 2 * cx - pp.left - pp.dw : pp.left;
        const visT = n.flipY ? 2 * cy - pp.top - pp.dh : pp.top;
        const ncx = visL + nw / 2;
        const ncy = visT + nh / 2;
        const bb = boundsOf(n);
        const cw = turn(n, bb, ncx, ncy);
        const st = startState(n);
        mutate(() => {
          setBox(n.id, { x: cw.x - nw / 2, y: cw.y - nh / 2, w: nw, h: nh }, st, true);
          setProp(n.id, 'fit', 'cover');
          setProp(n.id, 'zoom', 1);
          setProp(n.id, 'fx', 0.5);
          setProp(n.id, 'fy', 0.5);
        });
        flags.inspector = true;
      });
      body.append(h('div', { class: 'row2' }, pan, reset));
      body.append(h('div', { class: 'row2' }, crop, uncrop));
      body.append(h('div', { class: 'hint', text: 'Tip: zoom in first — a picture that exactly fills the frame has no room to slide. Hold Alt and drag on the page to slide any selected picture.' }));
    }

    if (n.type !== 'keyborder' || n.mode === 'strip') body.append(...alignSection(false));

    if (canRotate(n)) {
      const deg = h('input', { type: 'number', min: -180, max: 180, step: 1, 'data-rot': 'num' });
      deg.value = n.rot || 0;
      deg.addEventListener('input', () => { if (deg.value !== '' && Number.isFinite(Number(deg.value))) setRot(Number(deg.value), 'rotn:' + sel); });
      const sl = h('input', { type: 'range', min: -180, max: 180, step: 1, 'data-rot': 'range' });
      sl.value = n.rot || 0;
      sl.addEventListener('input', () => setRot(Number(sl.value), 'rots:' + sel));
      const qb = (label, title, fn, on) => {
        const b = h('button', { class: 'tool' + (on ? ' on' : ''), type: 'button', text: label, title });
        b.addEventListener('click', fn);
        return b;
      };
      body.append(
        h('h4', { class: 'sub', text: 'Rotate & flip' }),
        row(field('Angle (°)', deg), field('Turn freely', sl)),
        h('div', { class: 'qrow qrow2' },
          qb('⟲ 90° left', 'Turn 90° counter-clockwise', () => rotateBy(-90)),
          qb('⟳ 90° right', 'Turn 90° clockwise', () => rotateBy(90)),
          qb('↔ Flip left/right', 'Mirror the layer horizontally', () => flipSel('h'), n.flipX),
          qb('↕ Flip up/down', 'Mirror the layer vertically', () => flipSel('v'), n.flipY)),
        qb('Reset rotation', 'Back to 0° (not flipped)', () => {
          mutate(() => { setProp(sel, 'rot', 0); setProp(sel, 'flipX', false); setProp(sel, 'flipY', false); });
          flags.inspector = true;
        }),
        h('div', { class: 'hint', text: 'On the page: drag the round knob above the selected layer to rotate (Shift = 15° steps, Ctrl = no snapping). Keys: [ and ] turn 15° (Shift = 1°).' }),
      );
    }

    const op = h('input', { type: 'range', min: 0, max: 1, step: 0.01 });
    op.value = n.opacity ?? 1;
    op.addEventListener('input', () => mutate(() => setProp(sel, 'opacity', Number(op.value)), 'op:' + sel));
    body.append(field('Opacity', op));

    // position / size in millimetres from the trim edge
    const pos = (k, label, disabled) => {
      const i = h('input', { type: 'number', step: 0.5, 'data-pos': k });
      if (disabled) i.disabled = true;
      i.addEventListener('input', () => {
        const v = Number(i.value);
        if (Number.isNaN(v)) return;
        const cn = findFinal(sel);
        if (!cn) return;
        const st = startState(cn);
        const nb = { ...st.b };
        if (k === 'x') nb.x = v / geo.mmPerUnit + geo.b;
        if (k === 'y') nb.y = v / geo.mmPerUnit + geo.b;
        if (k === 'w') nb.w = Math.max(1, v / geo.mmPerUnit);
        if (k === 'h') nb.h = Math.max(1, v / geo.mmPerUnit);
        mutate(() => setBox(sel, nb, st, k === 'w' || k === 'h'), 'pos:' + sel + k);
      });
      return field(label, i);
    };
    const sizable = n.type !== 'text' && n.type !== 'lines';
    body.append(row(pos('x', 'X (mm)'), pos('y', 'Y (mm)')), row(pos('w', 'Width (mm)', !sizable), pos('h', 'Height (mm)', !sizable)));

    const actions = h('div', { class: 'row2' });
    if (!custom && ov() && Object.keys(ov()).some((k) => k !== 'hidden')) {
      const r = h('button', { class: 'tool', text: 'Reset layer' });
      r.addEventListener('click', () => mutate(() => delete pageState().over[sel]));
      actions.append(r);
    }
    const del = h('button', { class: 'tool danger', text: custom ? '🗑 Delete layer' : '🗑 Remove layer' });
    del.addEventListener('click', deleteSelected);
    actions.append(del);
    const delAll = h('button', { class: 'tool danger', text: '🗑 Delete on all pages' });
    delAll.addEventListener('click', deleteSelectedEverywhere);
    actions.append(delAll);
    body.append(actions);

    syncFields();
    if (focusText) {
      focusText = false;
      const t = inspEl.querySelector('[data-k="text"]');
      if (t) {
        t.focus();
        t.select();
      }
    }
  }

  /** refresh the X/Y/W/H boxes after a drag without rebuilding the panel */
  function syncFields() {
    const n = findFinal(sel);
    if (!n) return;
    const b = boundsOf(n);
    const g = cur.geo;
    const vals = { x: (b.x - g.b) * g.mmPerUnit, y: (b.y - g.b) * g.mmPerUnit, w: b.w * g.mmPerUnit, h: b.h * g.mmPerUnit };
    inspEl.querySelectorAll('[data-pos]').forEach((i) => {
      if (i === document.activeElement) return;
      i.value = (Math.round(vals[i.getAttribute('data-pos')] * 10) / 10).toString();
    });
    inspEl.querySelectorAll('[data-img]').forEach((r) => {
      if (r === document.activeElement) return;
      const k = r.getAttribute('data-img');
      r.value = n[k] ?? (k === 'zoom' ? 1 : 0.5);
    });
    inspEl.querySelectorAll('[data-rot]').forEach((i) => {
      if (i !== document.activeElement) i.value = n.rot || 0;
    });
    const sz = inspEl.querySelector('[data-k="size"]');
    if (sz && sz !== document.activeElement && b.size) sz.value = Math.round((b.size / unitsPerPt()) * 10) / 10;
  }

  /* ---------------- layers panel ---------------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  /** tiny inline SVG icon from path data (stroke icons, 16x16 grid) */
  function icon(paths, cls = 'ic') {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('class', cls);
    svg.setAttribute('aria-hidden', 'true');
    paths.forEach((d) => {
      const el = document.createElementNS(SVGNS, d.startsWith('c:') ? 'circle' : 'path');
      if (d.startsWith('c:')) {
        const [cx, cy, r] = d.slice(2).split(',');
        el.setAttribute('cx', cx);
        el.setAttribute('cy', cy);
        el.setAttribute('r', r);
      } else el.setAttribute('d', d);
      svg.append(el);
    });
    return svg;
  }
  const IC = {
    eye: ['M1.5 8s2.3-4.5 6.5-4.5S14.5 8 14.5 8 12.2 12.5 8 12.5 1.5 8 1.5 8z', 'c:8,8,2'],
    eyeOff: ['M1.5 8s2.3-4.5 6.5-4.5S14.5 8 14.5 8 12.2 12.5 8 12.5 1.5 8 1.5 8z', 'c:8,8,2', 'M2.5 13.5l11-11'],
    trash: ['M3 4.5h10', 'M6.5 4.5V3h3v1.5', 'M4.5 4.5l.6 8h5.8l.6-8', 'M6.8 7v3.5', 'M9.2 7v3.5'],
    close: ['M4 4l8 8', 'M12 4l-8 8'],
    chevron: ['M6 4l4 4-4 4'],
  };
  /** what the square thumbnail tile shows for a layer that has no picture of its own */
  const TILE = {
    text: () => h('span', { class: 'tglyph', text: 'T' }),
    rect: () => h('span', { class: 'tshape' }),
    image: () => h('span', { class: 'tshape tpic' }),
    lines: () => icon(['M2 4h12', 'M2 8h12', 'M2 12h12'], 'ic tic'),
    keyborder: () => icon(['M2.5 2.5h11v11h-11z', 'M5.5 5.5h5v5h-5z'], 'ic tic'),
    moon: () => icon(['M12.5 9.5A5 5 0 0 1 6.5 3.5a5 5 0 1 0 6 6z'], 'ic tic'),
    goat: () => h('span', { class: 'tglyph', text: '🐐' }),
  };

  function layerThumb(m) {
    const t = h('span', { class: 'lthumb' + (m.thumb ? ' pic' : '') });
    if (m.thumb) {
      const im = h('img', { src: m.thumb, alt: '', draggable: 'false', loading: 'lazy' });
      im.addEventListener('error', () => {
        im.remove();
        t.classList.remove('pic');
        t.append((TILE[m.type] || TILE.rect)());
      });
      t.append(im);
    } else t.append((TILE[m.type] || TILE.rect)());
    return t;
  }

  let dragRow = null; // id of the layer row being dragged in the Layers panel
  function layerRow(m) {
    const r = h('div', { class: 'lrow' + (isSel(m.id) ? ' sel' : '') + (m.hidden ? ' off' : ''), title: m.name });
    const eye = h('button', { class: 'eye', type: 'button', title: m.hidden ? 'Show layer' : 'Hide layer', 'aria-label': m.hidden ? 'Show layer' : 'Hide layer' });
    eye.append(icon(m.hidden ? IC.eyeOff : IC.eye));
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHidden(m.id);
    });
    const name = h('span', { class: 'ltext' }, h('span', { class: 'lname', text: m.name }), m.note ? h('span', { class: 'lnote', text: m.note }) : null);
    r.append(eye, layerThumb(m), name);
    if (isSel(m.id) && !multi.size) {
      // ▲ / ▼ follow the list: "My layers" is front-first, "Template layers" is back-first
      const mv = (txt, title, dir) => {
        const b = h('button', { class: 'lmove', type: 'button', title, 'aria-label': title, text: txt });
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          sel = m.id;
          reorder(dir);
        });
        return b;
      };
      const up = m.custom ? 1 : -1;
      r.append(mv('▲', m.custom ? 'Move up (in front of the next layer)' : 'Move up (behind the layer above)', up), mv('▼', m.custom ? 'Move down (behind the next layer)' : 'Move down (in front of the layer below)', -up));
    }
    if (!m.hidden) {
      r.draggable = true;
      r.addEventListener('dragstart', (e) => {
        dragRow = m.id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', m.id);
      });
      r.addEventListener('dragend', () => {
        dragRow = null;
        layersEl.querySelectorAll('.drop-above,.drop-below').forEach((x) => x.classList.remove('drop-above', 'drop-below'));
      });
      r.addEventListener('dragover', (e) => {
        if (!dragRow || dragRow === m.id) return;
        e.preventDefault();
        const top = e.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2;
        r.classList.toggle('drop-above', top);
        r.classList.toggle('drop-below', !top);
      });
      r.addEventListener('dragleave', () => r.classList.remove('drop-above', 'drop-below'));
      r.addEventListener('drop', (e) => {
        e.preventDefault();
        const top = r.classList.contains('drop-above');
        r.classList.remove('drop-above', 'drop-below');
        // visually above a row = in front of it in "My layers" (front-first list), behind it in "Template layers"
        const where = top === !!m.custom ? 'after' : 'before';
        const src = dragRow;
        dragRow = null;
        placeLayer(src, m.id, where);
      });
    }
    if (m.custom) {
      const x = h('button', { class: 'ldel', type: 'button', title: 'Delete layer', 'aria-label': 'Delete layer' });
      x.append(icon(IC.close));
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        sel = m.id;
        deleteSelected();
      });
      r.append(x);
    }
    r.addEventListener('click', (e) => {
      if (m.hidden) return;
      if (e.shiftKey || e.ctrlKey || e.metaKey) toggleInSelection(m.id);
      else select(m.id);
    });
    return r;
  }

  function layerGroup(m) {
    const containsSel = (g) => g.children.some((c) => (c.kind === 'group' ? containsSel(c) : c.id === sel));
    const sum = h('summary', {});
    sum.append(
      icon(IC.chevron, 'ic chev'),
      h('span', { class: 'gname', text: m.name }),
      h('span', { class: 'gcount', text: `(${m.children.length})` }),
    );
    const gdel = h('button', { class: 'gdel', type: 'button', title: 'Delete this whole group (Shift-click = on all pages)', 'aria-label': 'Delete group' });
    gdel.append(icon(IC.trash));
    gdel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteGroup(m, e.shiftKey || window.confirm(`Delete the group “${m.name}” on ALL pages?\n\nOK = all pages, Cancel = this page only.`));
    });
    sum.append(gdel);
    const d = h('details', { class: 'lgroup' }, sum);
    if (openGroups.has(m.key) || containsSel(m)) d.setAttribute('open', '');
    d.addEventListener('toggle', () => (d.open ? openGroups.add(m.key) : openGroups.delete(m.key)));
    const body = h('div', { class: 'lgbody' });
    m.children.forEach((c) => body.append(c.kind === 'group' ? layerGroup(c) : layerRow(c)));
    d.append(body);
    return d;
  }

  function renderLayers() {
    flags.layers = false;
    const keep = layersEl.scrollTop;
    layersEl.innerHTML = '';
    layersEl.append(h('h3', { text: 'Layers' }), h('div', { class: 'lh', text: 'My layers' }));
    const mine = [...cur.customMeta].reverse();
    if (!mine.length) layersEl.append(h('div', { class: 'hint lempty', text: 'Nothing added yet.' }));
    mine.forEach((m) => layersEl.append(layerRow(m)));
    layersEl.append(h('div', { class: 'lh', text: 'Template layers' }));
    cur.meta.forEach((m) => layersEl.append(m.kind === 'group' ? layerGroup(m) : layerRow(m)));
    layersEl.scrollTop = keep;
  }

  /* ---------------- canvas interaction ---------------- */
  const toUnits = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * cur.geo.Wt, y: ((e.clientY - r.top) / r.height) * cur.geo.Ht };
  };

  /** the round handle above the selection box (drag it to rotate) */
  const ROT_ARM = 30; // css px above the top edge
  function rotateHandle(n) {
    const b = boundsOf(n);
    const arm = (ROT_ARM * pxPerCss()) / curK;
    const q = turn(n, b, b.x + b.w / 2, b.y - arm);
    return { x: q.x, y: q.y, arm };
  }
  function onRotateHandle(n, p) {
    if (!canRotate(n)) return false;
    const r = rotateHandle(n);
    return Math.hypot(p.x - r.x, p.y - r.y) <= (11 * pxPerCss()) / curK;
  }
  const normDeg = (d) => {
    let v = ((d + 180) % 360 + 360) % 360 - 180;
    if (v === -180) v = 180;
    return Math.round(v * 10) / 10;
  };

  /** where the picture sits on the page for an image layer (before its own rotation / flip are applied) */
  function picPlace(n) {
    const iw = n.img.naturalWidth || n.img.width;
    const ih = n.img.naturalHeight || n.img.height;
    const sc = (n.fit === 'contain' ? Math.min(n.w / iw, n.h / ih) : Math.max(n.w / iw, n.h / ih)) * (n.zoom || 1);
    const dw = iw * sc;
    const dh = ih * sc;
    return { iw, ih, sc, dw, dh, left: n.x + (n.w - dw) * (n.fx ?? 0.5), top: n.y + (n.h - dh) * (n.fy ?? 0.5) };
  }
  const CROP_KEYS = { tl: [0, 0], t: [0.5, 0], tr: [1, 0], r: [1, 0.5], br: [1, 1], b: [0.5, 1], bl: [0, 1], l: [0, 0.5] };
  function cropHandleAt(n, p0) {
    const b = boundsOf(n);
    const p = unturn(n, b, p0.x, p0.y);
    const hs = (11 * pxPerCss()) / curK;
    for (const [k, [fx, fy]] of Object.entries(CROP_KEYS)) {
      if (Math.abs(p.x - (b.x + b.w * fx)) <= hs && Math.abs(p.y - (b.y + b.h * fy)) <= hs) return k;
    }
    return null;
  }
  const cropCursor = (k) => ({ t: 'ns-resize', b: 'ns-resize', l: 'ew-resize', r: 'ew-resize', tl: 'nwse-resize', br: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize' }[k]);

  function cornerAt(n, p0) {
    if (!canResize(n)) return null;
    const b = boundsOf(n);
    const p = unturn(n, b, p0.x, p0.y);
    const hs = (11 * pxPerCss()) / curK;
    const pts = { tl: [b.x, b.y], tr: [b.x + b.w, b.y], bl: [b.x, b.y + b.h], br: [b.x + b.w, b.y + b.h] };
    for (const [k, [cx, cy]] of Object.entries(pts)) {
      if (Math.abs(p.x - cx) <= hs && Math.abs(p.y - cy) <= hs) return k;
    }
    return null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !cur) return;
    const p = toUnits(e);
    if (tool === 'text') {
      addText(p.x, p.y);
      setTool('select');
      return;
    }
    const sn = multi.size ? null : findFinal(sel); // resize handles / picture sliding are for a single layer
    if (sn) {
      if (onRotateHandle(sn, p)) {
        e.preventDefault();
        beginDrag(e, sn, p, 'rotate', null);
        canvas.style.cursor = 'grabbing';
        return;
      }
      if (sn.type === 'image' && cropping()) {
        const hk = cropHandleAt(sn, p);
        if (hk) {
          e.preventDefault();
          beginDrag(e, sn, p, 'crop', hk);
          return;
        }
      }
      const corner = cornerAt(sn, p);
      if (corner) {
        beginDrag(e, sn, p, 'resize', corner);
        return;
      }
      if (sn.type === 'image' && (panning() || e.altKey)) {
        const b = boundsOf(sn);
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
          e.preventDefault();
          beginDrag(e, sn, p, 'pan', null);
          canvas.style.cursor = 'grabbing';
          return;
        }
      }
    }
    const n = hitTest(cur, p.x, p.y, selectTemplate);
    if (n) {
      if (e.shiftKey) {
        // Shift+click: add / remove from the selection (and drag the group if it stayed selected)
        toggleInSelection(n.id);
        if (isSel(n.id)) beginDrag(e, n, p, 'move', null);
        return;
      }
      if (!isSel(n.id)) {
        multi.clear();
        sel = n.id;
        flags.inspector = true;
        flags.layers = true;
      }
      beginDrag(e, n, p, 'move', null);
      redraw();
    } else if (sel) {
      sel = null;
      multi.clear();
      flags.inspector = true;
      flags.layers = true;
      redraw();
    }
  });

  /* ---------------- snapping ---------------- */
  /** x / y lines a moving box can snap to: page edges + centre (inside the trim) and the edges / centres of the other layers */
  function snapTargets(skip) {
    const g = cur.geo;
    const xs = [g.b, g.Wt / 2, g.Wt - g.b];
    const ys = [g.b, g.Ht / 2, g.Ht - g.b];
    cur.flat.forEach((n) => {
      if (skip.has(n.id) || n.type === 'lines' || (n.type === 'keyborder' && n.mode !== 'strip')) return;
      const b = boundsOf(n);
      if (!n.custom && b.w >= g.Wt * 0.97 && b.h >= g.Ht * 0.97) return;
      xs.push(b.x, b.x + b.w / 2, b.x + b.w);
      ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    });
    return { xs, ys };
  }
  /** pull (dx, dy) so the moving box's edges / centre land on a target line; returns the adjusted move + the guides hit */
  function snapMove(d, dx, dy, off) {
    if (!snapOn || off) {
      guides = null;
      return { dx, dy };
    }
    const th = (6 * pxPerCss()) / curK;
    const best = (mine, targets) => {
      let r = null;
      mine.forEach((m) => targets.forEach((t) => {
        const diff = t - m;
        if (Math.abs(diff) <= th && (!r || Math.abs(diff) < Math.abs(r))) r = diff;
      }));
      return r;
    };
    const b = d.gb;
    const sx = best([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], d.targets.xs);
    const sy = best([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], d.targets.ys);
    if (sx != null) dx += sx;
    if (sy != null) dy += sy;
    const near = (mine, targets) => [...new Set(targets.filter((t) => mine.some((m) => Math.abs(t - m) < 0.5)))];
    guides = {
      x: sx != null ? near([b.x + dx, b.x + dx + b.w / 2, b.x + dx + b.w], d.targets.xs) : [],
      y: sy != null ? near([b.y + dy, b.y + dy + b.h / 2, b.y + dy + b.h], d.targets.ys) : [],
    };
    return { dx, dy };
  }

  function beginDrag(e, n, p, mode, corner) {
    canvas.setPointerCapture(e.pointerId);
    let group = null;
    let gb = null;
    let targets = null;
    if (mode === 'move') {
      group = selIds().map((id) => findFinal(id)).filter((x) => x && movable(x)).map((x) => ({ id: x.id, st: startState(x) }));
      if (group.length) {
        gb = unionBox(group.map((i) => i.st.b));
        targets = snapTargets(new Set(group.map((i) => i.id)));
      }
    }
    const cs = mode === 'crop' ? { ...picPlace(n), fit: n.fit, rot: n.rot || 0, flipX: !!n.flipX, flipY: !!n.flipY } : null;
    drag = { cs, mode, corner, id: n.id, group, gb, targets, start: p, st: startState(n), moved: false, rot0: n.rot || 0, lock: lockAspect(n), px: e.clientX, py: e.clientY, fx0: n.fx ?? 0.5, fy0: n.fy ?? 0.5 };
  }

  canvas.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const p = toUnits(e);
    if (!drag) {
      if (tool === 'text') return;
      const sn = multi.size ? null : findFinal(sel);
      if (sn && onRotateHandle(sn, p)) {
        canvas.style.cursor = 'grab';
        return;
      }
      if (sn && sn.type === 'image' && cropping()) {
        const hk = cropHandleAt(sn, p);
        if (hk) { canvas.style.cursor = cropCursor(hk); return; }
      }
      const c = sn && cornerAt(sn, p);
      const onPic = sn && sn.type === 'image' && (panning() || e.altKey) && (() => { const b = boundsOf(sn); return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; })();
      if (c) canvas.style.cursor = c === 'tl' || c === 'br' ? 'nwse-resize' : 'nesw-resize';
      else if (onPic) canvas.style.cursor = 'grab';
      else canvas.style.cursor = hitTest(cur, p.x, p.y, selectTemplate) ? 'move' : 'default';
      return;
    }
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.px, e.clientY - drag.py) < 3) return;
      drag.moved = true;
      checkpoint();
    }
    if (drag.mode === 'crop') {
      const cs = drag.cs;
      const b = drag.st.b;
      const dn = findFinal(drag.id);
      if (!dn || !cs) return;
      const frame = { type: 'image', rot: cs.rot };
      const pl = cs.rot ? unturn(frame, b, p.x, p.y) : p;
      const k = drag.corner;
      let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
      if (k.includes('l')) x0 = Math.min(pl.x, x1 - 8);
      if (k.includes('r')) x1 = Math.max(pl.x, x0 + 8);
      if (k.includes('t')) y0 = Math.min(pl.y, y1 - 8);
      if (k.includes('b')) y1 = Math.max(pl.y, y0 + 8);
      const nb = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      // keep the picture exactly where it is on the page: work out the new zoom / position inside the smaller (or larger) frame
      const c0 = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      const cl = { x: nb.x + nb.w / 2, y: nb.y + nb.h / 2 };
      const off0 = { x: cs.left + cs.dw / 2 - c0.x, y: cs.top + cs.dh / 2 - c0.y };
      const vis = { x: c0.x + (cs.flipX ? -off0.x : off0.x) - cl.x, y: c0.y + (cs.flipY ? -off0.y : off0.y) - cl.y };
      const off = { x: cs.flipX ? -vis.x : vis.x, y: cs.flipY ? -vis.y : vis.y };
      const slackX = nb.w - cs.dw;
      const slackY = nb.h - cs.dh;
      const base = cs.fit === 'contain' ? Math.min(nb.w / cs.iw, nb.h / cs.ih) : Math.max(nb.w / cs.iw, nb.h / cs.ih);
      setProp(drag.id, 'zoom', cs.sc / base);
      setProp(drag.id, 'fx', Math.abs(slackX) > 0.01 ? (nb.w / 2 + off.x - cs.dw / 2) / slackX : 0.5);
      setProp(drag.id, 'fy', Math.abs(slackY) > 0.01 ? (nb.h / 2 + off.y - cs.dh / 2) / slackY : 0.5);
      let nw = nb;
      if (cs.rot) {
        const cw = turn(frame, b, cl.x, cl.y);
        nw = { x: cw.x - nb.w / 2, y: cw.y - nb.h / 2, w: nb.w, h: nb.h };
      }
      setBox(drag.id, nw, drag.st, true);
      setStatus('Crop: drag the edges. The picture stays where it is; Esc or ✂ again to finish.');
      redraw();
      return;
    }
    if (drag.mode === 'rotate') {
      const rn = findFinal(drag.id);
      if (!rn) return;
      const ctr = rotCenter(rn, boundsOf(rn));
      const ang = (q) => (Math.atan2(q.x - ctr.x, -(q.y - ctr.y)) * 180) / Math.PI;
      let r = drag.rot0 + (ang(p) - ang(drag.start));
      if (e.shiftKey) r = Math.round(r / 15) * 15; // Shift = steps of 15 degrees
      else if (!(e.ctrlKey || e.metaKey)) {
        // light magnet at the straight / diagonal positions (hold Ctrl to turn freely)
        const m = Math.round(r / 45) * 45;
        if (Math.abs(r - m) <= 3) r = m;
      }
      r = normDeg(r);
      setProp(drag.id, 'rot', r);
      setStatus(`Rotation ${r}° (Shift = 15° steps, Ctrl = no magnet).`);
      redraw();
      return;
    }
    if (drag.mode === 'pan') {
      const pn = findFinal(drag.id);
      if (!pn) return;
      const iw = pn.img.naturalWidth || pn.img.width;
      const ih = pn.img.naturalHeight || pn.img.height;
      const sc = (pn.fit === 'contain' ? Math.min(pn.w / iw, pn.h / ih) : Math.max(pn.w / iw, pn.h / ih)) * (pn.zoom || 1);
      const slackX = pn.w - iw * sc;
      const slackY = pn.h - ih * sc;
      // the picture is turned with its frame: express the drag in the frame's own directions (and flips)
      const th = ((pn.rot || 0) * Math.PI) / 180;
      let ddx = (p.x - drag.start.x) * Math.cos(th) + (p.y - drag.start.y) * Math.sin(th);
      let ddy = -(p.x - drag.start.x) * Math.sin(th) + (p.y - drag.start.y) * Math.cos(th);
      if (pn.flipX) ddx = -ddx;
      if (pn.flipY) ddy = -ddy;
      if (Math.abs(slackX) > 0.01) setProp(drag.id, 'fx', clamp01(drag.fx0 + ddx / slackX));
      if (Math.abs(slackY) > 0.01) setProp(drag.id, 'fy', clamp01(drag.fy0 + ddy / slackY));
      redraw();
      return;
    }
    const { st } = drag;
    const b = st.b;
    let nb;
    if (drag.mode === 'move') {
      const dn = findFinal(drag.id);
      const vOnly = dn && dn.type === 'keyborder' && dn.mode === 'strip' && drag.group.length === 1; // horizontal line: slides up / down only
      const mv = snapMove(drag, vOnly ? 0 : p.x - drag.start.x, p.y - drag.start.y, e.ctrlKey || e.metaKey);
      drag.group.forEach(({ id, st: gs }) => setBox(id, { ...gs.b, x: gs.b.x + mv.dx, y: gs.b.y + mv.dy }, gs, false));
      redraw();
      return;
    } else {
      const c = drag.corner;
      const dn0 = findFinal(drag.id);
      const turnedBox = !!(dn0 && dn0.rot);
      const pl = turnedBox ? unturn(dn0, b, p.x, p.y) : p; // pointer in the layer's own (un-rotated) frame
      const ax = c.includes('l') ? b.x + b.w : b.x;
      const ay = c.includes('t') ? b.y + b.h : b.y;
      let nw = Math.max(8, Math.abs(pl.x - ax));
      let nh = Math.max(8, Math.abs(pl.y - ay));
      if (drag.lock || e.shiftKey) {
        const s = Math.max(nw / b.w, nh / b.h);
        nw = b.w * s;
        nh = b.h * s;
      }
      nb = { x: c.includes('l') ? ax - nw : ax, y: c.includes('t') ? ay - nh : ay, w: nw, h: nh };
      if (turnedBox && dn0.type !== 'text') {
        // keep the opposite corner where it is on the page: re-centre the resized box
        const cw = turn(dn0, b, nb.x + nb.w / 2, nb.y + nb.h / 2);
        nb = { x: cw.x - nb.w / 2, y: cw.y - nb.h / 2, w: nb.w, h: nb.h };
      }
    }
    setBox(drag.id, nb, st, drag.mode === 'resize');
    redraw();
  });

  const endDrag = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    guides = null;
    if (moved) {
      flags.layers = true;
      redraw();
    }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvas.addEventListener('dblclick', (e) => {
    if (!cur) return;
    const p = toUnits(e);
    const n = hitTest(cur, p.x, p.y, selectTemplate);
    if (n && n.type === 'text') {
      sel = n.id;
      flags.inspector = true;
      focusText = true;
      redraw();
    }
  });

  // drag a picture file straight onto the page
  canvas.addEventListener('dragover', (e) => e.preventDefault());
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!cur) return;
    const p = toUnits(e);
    [...(e.dataTransfer?.files || [])].forEach((f, i) => addImage(f, { x: p.x + i * 30, y: p.y + i * 30 }));
  });
  document.addEventListener('paste', (e) => {
    if (/input|textarea/i.test(e.target.tagName)) return;
    const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f && cur) addImage(f);
  });

  document.addEventListener('keydown', (e) => {
    if (/input|textarea|select/i.test(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (e.target.type === 'range' && k.startsWith('arrow')) return; // arrows move the slider, not the layer
    if (mod && k === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (mod && k === 'y') {
      e.preventDefault();
      redo();
    } else if (mod && (e.code === 'BracketRight' || e.code === 'BracketLeft')) {
      e.preventDefault();
      const fwd = e.code === 'BracketRight';
      if (e.shiftKey) fwd ? toFront() : toBack();
      else reorder(fwd ? 1 : -1);
    } else if (mod && k === 'a') {
      e.preventDefault();
      selectAll();
    } else if (mod && k === 'd') {
      e.preventDefault();
      duplicateSelected();
    } else if (!mod && (k === 'delete' || k === 'backspace')) {
      if (sel) {
        e.preventDefault();
        e.shiftKey ? deleteSelectedEverywhere() : deleteSelected();
      }
    } else if (!mod && k === 'escape') {
      if (cropId) {
        cropId = null;
        flags.inspector = true;
        redraw();
      }
      if (panId) {
        panId = null;
        flags.inspector = true;
        canvas.style.cursor = 'default';
        redraw();
      }
      setTool('select');
      if (sel) select(null);
    } else if (!mod && sel && (k === '[' || k === ']')) {
      e.preventDefault();
      rotateBy((k === ']' ? 1 : -1) * (e.shiftKey ? 1 : 15));
    } else if (!mod && k === 'v') setTool('select');
    else if (!mod && k === 't') setTool('text');
    else if (!mod && sel && k.startsWith('arrow')) {
      e.preventDefault();
      const s = e.shiftKey ? 10 : 1;
      nudge(k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0);
    }
  });

  buildToolbar();

  /* ---------------- API for main.js ---------------- */
  return {
    /** apply edits to a freshly built page (used for preview and every export) */
    applyTo(idx, pg) {
      return applyEdits(pg, pageState(idx), imgs);
    },
    /** called after the preview was drawn */
    setCurrent(pg, k) {
      cur = pg;
      curK = k;
      [...multi].forEach((id) => {
        if (!findFinal(id)) {
          multi.delete(id);
          flags.inspector = true;
        }
      });
      if (sel && !findFinal(sel)) {
        sel = [...multi][0] ?? null;
        multi.delete(sel);
        flags.inspector = true;
      }
      if (flags.layers) renderLayers();
      if (flags.inspector) renderInspector();
      else syncFields();
    },
    drawOverlay(ctx) {
      const n = findFinal(sel);
      if (!n) return;
      const b = boundsOf(n);
      const k = curK;
      const u = pxPerCss(); // keeps the outline / handles the same on-screen size at any zoom
      ctx.save();
      ctx.lineWidth = 2 * u;
      ctx.strokeStyle = panning() ? '#ff7a2d' : '#2d8cff';
      ctx.setLineDash([7 * u, 5 * u]);
      const rc = rotCenter(n, b);
      const withRot = (fn) => {
        ctx.save();
        if (n.rot) {
          ctx.translate(rc.x * k, rc.y * k);
          ctx.rotate((n.rot * Math.PI) / 180);
          ctx.translate(-rc.x * k, -rc.y * k);
        }
        fn();
        ctx.restore();
      };
      const cropOn = n.type === 'image' && cropping() && !multi.size;
      if (cropOn) {
        // whole picture (dim dashed outline) so you can see what the frame cuts off
        const pp = picPlace(n);
        const fcx = n.x + n.w / 2;
        const fcy = n.y + n.h / 2;
        const pl = n.flipX ? 2 * fcx - pp.left - pp.dw : pp.left;
        const pt = n.flipY ? 2 * fcy - pp.top - pp.dh : pp.top;
        withRot(() => {
          ctx.save();
          ctx.strokeStyle = 'rgba(255,122,45,0.7)';
          ctx.lineWidth = 1 * u;
          ctx.setLineDash([3 * u, 4 * u]);
          ctx.strokeRect(pl * k, pt * k, pp.dw * k, pp.dh * k);
          ctx.restore();
        });
        ctx.strokeStyle = '#ff7a2d';
      }
      withRot(() => ctx.strokeRect(b.x * k, b.y * k, b.w * k, b.h * k));
      if (multi.size) {
        const bs = [b];
        multi.forEach((id) => {
          const m = findFinal(id);
          if (!m) return;
          const mb = boundsOf(m);
          bs.push(mb);
          ctx.strokeRect(mb.x * k, mb.y * k, mb.w * k, mb.h * k);
        });
        const ub = unionBox(bs);
        ctx.lineWidth = 1 * u;
        ctx.strokeStyle = '#8a5cff';
        ctx.strokeRect(ub.x * k, ub.y * k, ub.w * k, ub.h * k);
      }
      ctx.setLineDash([]);
      if (guides) {
        // snap guides (magenta): full-height / full-width lines at the snapped position
        ctx.lineWidth = 1 * u;
        ctx.strokeStyle = '#ff2dd0';
        const { Wt, Ht } = cur.geo;
        (guides.x || []).forEach((gx) => {
          ctx.beginPath();
          ctx.moveTo(gx * k, 0);
          ctx.lineTo(gx * k, Ht * k);
          ctx.stroke();
        });
        (guides.y || []).forEach((gy) => {
          ctx.beginPath();
          ctx.moveTo(0, gy * k);
          ctx.lineTo(Wt * k, gy * k);
          ctx.stroke();
        });
        ctx.lineWidth = 2 * u;
        ctx.strokeStyle = '#2d8cff';
      }
      if (cropOn) {
        const hh = 5 * u;
        withRot(() => Object.values(CROP_KEYS).forEach(([fx, fy]) => {
          ctx.fillStyle = '#ff7a2d';
          ctx.fillRect((b.x + b.w * fx) * k - hh, (b.y + b.h * fy) * k - hh, hh * 2, hh * 2);
          ctx.strokeRect((b.x + b.w * fx) * k - hh, (b.y + b.h * fy) * k - hh, hh * 2, hh * 2);
        }));
      } else if (canResize(n) && !multi.size) {
        const hh = 6 * u;
        withRot(() => [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(([x, y]) => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x * k - hh, y * k - hh, hh * 2, hh * 2);
          ctx.strokeRect(x * k - hh, y * k - hh, hh * 2, hh * 2);
        }));
      }
      if (canRotate(n) && !multi.size) {
        // rotation handle: a round knob on a short arm above the top edge
        const arm = ROT_ARM * u;
        withRot(() => {
          ctx.beginPath();
          ctx.moveTo((b.x + b.w / 2) * k, b.y * k);
          ctx.lineTo((b.x + b.w / 2) * k, b.y * k - arm);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc((b.x + b.w / 2) * k, b.y * k - arm, 7 * u, 0, Math.PI * 2);
          ctx.fillStyle = drag && drag.mode === 'rotate' ? '#2d8cff' : '#ffffff';
          ctx.fill();
          ctx.stroke();
          // small circular-arrow tick inside the knob
          ctx.beginPath();
          ctx.arc((b.x + b.w / 2) * k, b.y * k - arm, 3 * u, -2.5, 1.2);
          ctx.stroke();
        });
      }
      ctx.restore();
    },
    onPageChange() {
      sel = null;
      multi.clear();
      flags.layers = true;
      flags.inspector = true;
    },
    hasEdits: () => Object.values(state.pages).some((p) => p.custom.length || Object.keys(p.over).length),
  };
}
