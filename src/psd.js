// Converts a rendered layer tree into a layered Photoshop (.psd) file via ag-psd.
import { writePsd } from 'ag-psd';
import { hexToRgb } from './layout.js';

function toChild(n, opts) {
  if (n.kind === 'group') {
    return { name: n.name, opened: true, children: n.children.map((c) => toChild(c, opts)) };
  }
  const layer = {
    name: n.name,
    left: n.left,
    top: n.top,
    canvas: n.canvas,
    opacity: n.node.opacity ?? 1,
  };
  if (opts.editableText && n.node.type === 'text' && n.geom && !n.node.outline && !n.node.rot) {
    const g = n.geom;
    layer.text = {
      text: n.node.text,
      shapeType: 'point',
      transform: [1, 0, 0, 1, g.anchorX * opts.k, g.baselineY * opts.k],
      antiAlias: 'smooth',
      style: {
        font: { name: g.psFont },
        fontSize: g.size * opts.k,
        fillColor: hexToRgb(n.node.color),
      },
      paragraphStyle: { justification: n.node.align },
    };
  }
  return layer;
}

/**
 * @returns {ArrayBuffer} the .psd file contents
 */
export function makePsd(rendered, { dpi = 150, editableText = true, k }) {
  const psd = {
    width: rendered.pxW,
    height: rendered.pxH,
    canvas: rendered.composite,
    children: rendered.tree.map((n) => toChild(n, { editableText, k })),
    imageResources: {
      resolutionInfo: {
        horizontalResolution: dpi,
        horizontalResolutionUnit: 'PPI',
        widthUnit: 'Inches',
        verticalResolution: dpi,
        verticalResolutionUnit: 'PPI',
        heightUnit: 'Inches',
      },
    },
  };
  return writePsd(psd, { generateThumbnail: true });
}
