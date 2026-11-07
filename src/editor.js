// Photoshop-style editing on top of the preview canvas:
// select / move / resize / delete any layer, add text, images and rectangles,
// change fonts, sizes and colours, reorder, duplicate, undo / redo.
import { FONTS, pageCount } from './layout.js';
import { applyEdits, boundsOf, hitTest, emptyPage, uid, TEXT_Y_OFF } from './edits.js';

const PT_PER_MM = 72 / 25.4;

export function createEditor({ canvas, getPage, getCfg, redraw, setStatus, h, toolsEl, inspEl, layersEl }) {
  const state = { pages: {} }; // pageIdx -> { over, custom }
  const imgs = new Map(); // imgId -> { img, url, name }
  let sel = null; // selected layer id
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
  let panId = null; // layer id whose picture is being slid inside its frame (plain drag)
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  /** canvas pixels per on-screen CSS pixel (changes with the zoom bar) */
  const pxPerCss = () => {
    const r = canvas.getBoundingClientRect();
    return r.width ? canvas.width / r.width : 1;
  };
  const panning = () => !!panId && panId === sel;
  const flags = { layers: true, inspector: true };
  const openGroups = new Set();
  const btn = {};

  const pageState = (i = getPage()) => (state.pages[i] ||= emptyPage());
  const findFinal = (id) => (cur && id ? cur.flat.find((n) => n.id === id) : null);
  const getCustom = (id) => pageState().custom.find((c) => c.id === id);
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
    if (sel === id) return;
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
    const n = findFinal(sel);
    if (!n) return;
    const st = startState(n);
    mutate(() => setBox(sel, { ...st.b, x: st.b.x + dx, y: st.b.y + dy }, st, false), 'nudge:' + sel);
  }

  function deleteSelected() {
    if (!sel) return;
    const id = sel;
    const c = getCustom(id);
    mutate(() => {
      if (c) {
        const ps = pageState();
        ps.custom = ps.custom.filter((x) => x.id !== id);
      } else {
        setProp(id, 'hidden', true);
      }
    });
    sel = null;
    flags.inspector = true;
    setStatus(c ? 'Layer deleted (Ctrl+Z to undo).' : 'Template layer removed. Bring it back with the ○ icon in the Layers panel, or Ctrl+Z.');
  }

  /** Delete the selected layer from EVERY calendar page (template layers are matched by id, added layers by type + position + content). */
  function deleteSelectedEverywhere() {
    if (!sel) {
      setStatus('Select a layer first, then use “Delete on all pages”.');
      return;
    }
    const id = sel;
    const c = getCustom(id);
    const total = pageCount(getCfg());
    mutate(() => {
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
    sel = null;
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

  function reorder(dir) {
    const ps = pageState();
    const i = ps.custom.findIndex((c) => c.id === sel);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= ps.custom.length) return;
    mutate(() => {
      const [c] = ps.custom.splice(i, 1);
      ps.custom.splice(j, 0, c);
    });
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
    mk('▲', 'Bring forward', () => reorder(1));
    mk('▼', 'Send backward', () => reorder(-1));
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

  function renderInspector() {
    flags.inspector = false;
    inspEl.innerHTML = '';
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
      body.append(h('div', { class: 'row2' }, pan, reset));
      body.append(h('div', { class: 'hint', text: 'Tip: zoom in first — a picture that exactly fills the frame has no room to slide. Hold Alt and drag on the page to slide any selected picture.' }));
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
    const sz = inspEl.querySelector('[data-k="size"]');
    if (sz && sz !== document.activeElement && b.size) sz.value = Math.round((b.size / unitsPerPt()) * 10) / 10;
  }

  /* ---------------- layers panel ---------------- */
  const ICON = { text: 'T', image: '▣', rect: '▭', lines: '☰', moon: '☽', keyborder: '▦', goat: '🐐' };

  function layerRow(m) {
    const r = h('div', { class: 'lrow' + (m.id === sel ? ' sel' : '') + (m.hidden ? ' off' : '') });
    const eye = h('button', { class: 'eye', title: m.hidden ? 'Show layer' : 'Hide layer', text: m.hidden ? '○' : '●' });
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHidden(m.id);
    });
    const name = h('span', { class: 'lname', text: `${ICON[m.type] || '▫'}  ${m.name}` });
    r.append(eye, name);
    if (m.custom) {
      const x = h('button', { class: 'eye', title: 'Delete layer', text: '×' });
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        sel = m.id;
        deleteSelected();
      });
      r.append(x);
    }
    r.addEventListener('click', () => {
      if (!m.hidden) select(m.id);
    });
    return r;
  }

  function layerGroup(m) {
    const containsSel = (g) => g.children.some((c) => (c.kind === 'group' ? containsSel(c) : c.id === sel));
    const sum = h('summary', {}, h('span', { text: `${m.name} (${m.children.length})` }));
    const gdel = h('button', { class: 'eye', title: 'Delete this whole group (Shift-click = on all pages)', text: '🗑' });
    gdel.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteGroup(m, e.shiftKey || window.confirm(`Delete the group “${m.name}” on ALL pages?\n\nOK = all pages, Cancel = this page only.`));
    });
    sum.append(gdel);
    const d = h('details', { class: 'lgroup' }, sum);
    if (openGroups.has(m.key) || containsSel(m)) d.setAttribute('open', '');
    d.addEventListener('toggle', () => (d.open ? openGroups.add(m.key) : openGroups.delete(m.key)));
    m.children.forEach((c) => d.append(c.kind === 'group' ? layerGroup(c) : layerRow(c)));
    return d;
  }

  function renderLayers() {
    flags.layers = false;
    const keep = layersEl.scrollTop;
    layersEl.innerHTML = '';
    layersEl.append(h('h3', { text: 'Layers' }), h('div', { class: 'lh', text: 'My layers' }));
    const mine = [...cur.customMeta].reverse();
    if (!mine.length) layersEl.append(h('div', { class: 'hint', text: 'Nothing added yet.' }));
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

  function cornerAt(n, p) {
    if (!canResize(n)) return null;
    const b = boundsOf(n);
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
    const sn = findFinal(sel);
    if (sn) {
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
      if (sel !== n.id) {
        sel = n.id;
        flags.inspector = true;
        flags.layers = true;
      }
      beginDrag(e, n, p, 'move', null);
      redraw();
    } else if (sel) {
      sel = null;
      flags.inspector = true;
      flags.layers = true;
      redraw();
    }
  });

  function beginDrag(e, n, p, mode, corner) {
    canvas.setPointerCapture(e.pointerId);
    drag = { mode, corner, id: n.id, start: p, st: startState(n), moved: false, lock: lockAspect(n), px: e.clientX, py: e.clientY, fx0: n.fx ?? 0.5, fy0: n.fy ?? 0.5 };
  }

  canvas.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const p = toUnits(e);
    if (!drag) {
      if (tool === 'text') return;
      const sn = findFinal(sel);
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
    if (drag.mode === 'pan') {
      const pn = findFinal(drag.id);
      if (!pn) return;
      const iw = pn.img.naturalWidth || pn.img.width;
      const ih = pn.img.naturalHeight || pn.img.height;
      const sc = (pn.fit === 'contain' ? Math.min(pn.w / iw, pn.h / ih) : Math.max(pn.w / iw, pn.h / ih)) * (pn.zoom || 1);
      const slackX = pn.w - iw * sc;
      const slackY = pn.h - ih * sc;
      if (Math.abs(slackX) > 0.01) setProp(drag.id, 'fx', clamp01(drag.fx0 + (p.x - drag.start.x) / slackX));
      if (Math.abs(slackY) > 0.01) setProp(drag.id, 'fy', clamp01(drag.fy0 + (p.y - drag.start.y) / slackY));
      redraw();
      return;
    }
    const { st } = drag;
    const b = st.b;
    let nb;
    if (drag.mode === 'move') {
      const dn = findFinal(drag.id);
      const vOnly = dn && dn.type === 'keyborder' && dn.mode === 'strip'; // horizontal line: slides up / down only
      nb = { x: vOnly ? b.x : b.x + (p.x - drag.start.x), y: b.y + (p.y - drag.start.y), w: b.w, h: b.h };
    } else {
      const c = drag.corner;
      const ax = c.includes('l') ? b.x + b.w : b.x;
      const ay = c.includes('t') ? b.y + b.h : b.y;
      let nw = Math.max(8, Math.abs(p.x - ax));
      let nh = Math.max(8, Math.abs(p.y - ay));
      if (drag.lock || e.shiftKey) {
        const s = Math.max(nw / b.w, nh / b.h);
        nw = b.w * s;
        nh = b.h * s;
      }
      nb = { x: c.includes('l') ? ax - nw : ax, y: c.includes('t') ? ay - nh : ay, w: nw, h: nh };
    }
    setBox(drag.id, nb, st, drag.mode === 'resize');
    redraw();
  });

  const endDrag = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
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
    } else if (mod && k === 'd') {
      e.preventDefault();
      duplicateSelected();
    } else if (!mod && (k === 'delete' || k === 'backspace')) {
      if (sel) {
        e.preventDefault();
        e.shiftKey ? deleteSelectedEverywhere() : deleteSelected();
      }
    } else if (!mod && k === 'escape') {
      if (panId) {
        panId = null;
        flags.inspector = true;
        canvas.style.cursor = 'default';
        redraw();
      }
      setTool('select');
      if (sel) select(null);
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
      if (sel && !findFinal(sel)) {
        sel = null;
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
      ctx.strokeRect(b.x * k, b.y * k, b.w * k, b.h * k);
      ctx.setLineDash([]);
      if (canResize(n)) {
        const hh = 6 * u;
        [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(([x, y]) => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x * k - hh, y * k - hh, hh * 2, hh * 2);
          ctx.strokeRect(x * k - hh, y * k - hh, hh * 2, hh * 2);
        });
      }
      ctx.restore();
    },
    onPageChange() {
      sel = null;
      flags.layers = true;
      flags.inspector = true;
    },
    hasEdits: () => Object.values(state.pages).some((p) => p.custom.length || Object.keys(p.over).length),
  };
}
