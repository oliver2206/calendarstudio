// Moon-phase cell layout ("moon style position").
// One function places the three pieces of a moon cell - phase NAME, moon FACE, DATE / time - so every template can offer
// the same position styles (see the four sample calendars: name on top / face / date below, face on top, name + date at
// the corner with the face opposite). Picked with the toolbar button "☾ Position" or Calendar -> Moon style position.

import { text } from './layout.js';

/** [key, label] - 'template' keeps whatever each template draws by default */
export const MOON_POS = [
  ['template', "Template's own"],
  ['stack', 'Name top, face, date below'],
  ['facetop', 'Face top, name + date below'],
  ['textleft', 'Name + date top-left, face right'],
  ['textright', 'Name + date top-right, face left'],
  ['none', 'No moon (client does not want moon phases)'],
];

const PHASE_KEY = ['new', 'fq', 'full', 'lq'];

/**
 * Layers (label text, moon face, date text - in that order) for one moon cell.
 * @param cfg  page config (cfg.moonPos picks the style, 'template' / empty = o.own)
 * @param mp   phase object from moonPhasesForMonth
 * @param o    { x, y, w, h  cell box,
 *               own           this template's default style key,
 *               label, date   strings,
 *               labelFont, dateFont, labelColor, dateColor, color (moon tint), light,
 *               dateName      layer-name prefix for the date ('Moon date' / 'Moon time'),
 *               pad }
 */
export function moonCellLayers(cfg, mp, o) {
  const st = MOON_POS.some(([k]) => k === cfg.moonPos) && cfg.moonPos !== 'template' && cfg.moonPos !== 'none' ? cfg.moonPos : o.own;
  const key = PHASE_KEY[mp.phase];
  const { x, y, w, h } = o;
  const pad = o.pad ?? Math.max(3, w * 0.035);
  const ls = Math.min(w * 0.115, h * 0.13); // label / date text size
  const lh = ls * 1.45; // one text line
  const labelOpts = (align, valign) => ({ font: o.labelFont, bold: true, size: ls, color: o.labelColor, align, valign, fit: true });
  const dateOpts = (align, valign) => ({ font: o.dateFont || o.labelFont, bold: true, size: ls, color: o.dateColor || o.labelColor, align, valign, fit: true });
  const dateName = `${o.dateName || 'Moon date'} ${key}`;
  const face = (fx, fy, d) => ({ type: 'moon', name: `Moon ${key}`, phase: key, color: o.color, light: o.light, x: fx, y: fy, w: d, h: d });
  const L = (str, name, bx, by, bw, bh, opts) => text(name, str, bx, by, bw, bh, opts);
  const out = [];

  if (st === 'facetop') {
    const d = Math.min(w * 0.6, h * 0.5);
    const fy = y + h * 0.06;
    const ty = fy + d + h * 0.03;
    out.push(face(x + (w - d) / 2, fy, d));
    out.push(L(o.label, `Moon label ${key}`, x + pad, ty, w - 2 * pad, lh, labelOpts('center', 'top')));
    out.push(L(o.date, dateName, x + pad, ty + lh, w - 2 * pad, lh, dateOpts('center', 'top')));
  } else if (st === 'textleft' || st === 'textright') {
    const left = st === 'textleft';
    const al = left ? 'left' : 'right';
    const d = Math.min(w * 0.5, h * 0.5);
    const ip = pad + w * 0.04; // a little extra room so text clears rounded / thick cell borders
    out.push(L(o.label, `Moon label ${key}`, x + ip, y + h * 0.06, w - 2 * ip, lh, labelOpts(al, 'top')));
    out.push(L(o.date, dateName, x + ip, y + h * 0.06 + lh, w - 2 * ip, lh, dateOpts(al, 'top')));
    const fy = Math.min(y + h * 0.4, y + h - d - ip);
    out.push(face(left ? x + w - d - ip : x + ip, fy, d));
  } else {
    // stack: name on top, face in the middle, date at the bottom
    const topEnd = y + h * 0.04 + lh;
    const botStart = y + h * 0.96 - lh;
    const d = Math.min(w * 0.6, botStart - topEnd - h * 0.02);
    out.push(L(o.label, `Moon label ${key}`, x + pad, y + h * 0.04, w - 2 * pad, lh, labelOpts('center', 'top')));
    out.push(face(x + (w - d) / 2, topEnd + (botStart - topEnd - d) / 2, d));
    out.push(L(o.date, dateName, x + pad, botStart, w - 2 * pad, lh, dateOpts('center', 'bottom')));
  }
  return out;
}
