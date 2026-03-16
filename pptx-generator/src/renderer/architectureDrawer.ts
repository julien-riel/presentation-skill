import type { Slide, Element } from '../schema/presentation.js';
import type { DrawerResult, IconRequest } from './placeholderFiller.js';
import { emu, rectShape, lineShape, textBoxShape, emuFromPx } from './xmlHelpers.js';

const NODE_H = emu(0.55);
const NODE_MIN_W = emu(1.5);
const NODE_H_GAP = emu(0.35);
const LAYER_V_GAP = emu(0.35);
const CANVAS_LEFT = emu(0.8);
const CANVAS_RIGHT = emu(9.2);
const CANVAS_TOP = emu(1.6);
const CANVAS_BOTTOM = emu(6.3);

interface NodePosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Builds architecture diagram shape XML fragments.
 * Uses the template's accent colors for node fills.
 */
export function buildArchitectureShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): DrawerResult {
  const diagramEl = slide.elements.find(
    (el): el is Extract<Element, { type: 'diagram' }> => el.type === 'diagram',
  );
  if (!diagramEl || diagramEl.nodes.length === 0) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  const { nodes, edges } = diagramEl;
  let id = startId;
  let shapes = '';
  const iconRequests: IconRequest[] = [];

  // Group nodes by layer
  const layerMap = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const layer = node.layer ?? 'default';
    if (!layerMap.has(layer)) layerMap.set(layer, []);
    layerMap.get(layer)!.push(node);
  }
  const layers = Array.from(layerMap.entries());

  // Calculate vertical spacing
  const availableH = CANVAS_BOTTOM - CANVAS_TOP;
  const totalH = layers.length * NODE_H + (layers.length - 1) * LAYER_V_GAP;
  const startY = CANVAS_TOP + Math.max(0, Math.round((availableH - totalH) / 2));

  const canvasW = CANVAS_RIGHT - CANVAS_LEFT;
  const positions = new Map<string, NodePosition>();

  for (let li = 0; li < layers.length; li++) {
    const [, layerNodes] = layers[li];
    const y = startY + li * (NODE_H + LAYER_V_GAP);

    // Pick color from template accent colors, cycling through them
    const fillColor = accentColors[li % accentColors.length]?.replace('#', '') ?? '4472C4';

    // Calculate node width
    const totalGaps = (layerNodes.length - 1) * NODE_H_GAP;
    const nodeW = Math.max(
      NODE_MIN_W,
      Math.min(emu(2.5), Math.round((canvasW - totalGaps) / layerNodes.length)),
    );
    const rowW = layerNodes.length * nodeW + totalGaps;
    const startX = CANVAS_LEFT + Math.round((canvasW - rowW) / 2);

    for (let ni = 0; ni < layerNodes.length; ni++) {
      const node = layerNodes[ni];
      const x = startX + ni * (nodeW + NODE_H_GAP);

      positions.set(node.id, { id: node.id, x, y, w: nodeW, h: NODE_H });

      const nodeFill = node.style?.fill?.replace('#', '') ?? fillColor;

      // Rounded rectangle node
      shapes += rectShape(id++, {
        x, y, cx: nodeW, cy: NODE_H,
        fill: nodeFill,
        rectRadius: 0.06,
      });

      // Node label (white text on colored background)
      if (node.style?.icon) {
        const iconSizePx = 32;
        const iconEmu = emuFromPx(iconSizePx);
        iconRequests.push({
          name: node.style.icon,
          color: 'FFFFFF',
          sizePx: iconSizePx,
          x: x + Math.round((nodeW - iconEmu) / 2),
          y: y + Math.round((NODE_H - iconEmu) / 4),
          cx: iconEmu,
          cy: iconEmu,
        });

        // Label shifted down to make room for icon
        shapes += textBoxShape(id++, x, y + Math.round(NODE_H * 0.55), nodeW, Math.round(NODE_H * 0.45),
          node.label, { size: 9, bold: true, color: 'FFFFFF' });
      } else {
        // Original: centered label
        shapes += textBoxShape(id++, x, y, nodeW, NODE_H,
          node.label, { size: 10, bold: true, color: 'FFFFFF' });
      }
    }
  }

  // Draw edges as arrow lines
  const connectorColor = accentColors[0]?.replace('#', '') ?? '666666';
  for (const edge of edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;

    const fromX = from.x + Math.round(from.w / 2);
    const fromY = from.y + from.h;
    const toX = to.x + Math.round(to.w / 2);
    const toY = to.y;

    const dx = toX - fromX;
    const dy = toY - fromY;
    if (Math.abs(dy) < 100 && Math.abs(dx) < 100) continue;

    shapes += lineShape(id++, {
      x: Math.min(fromX, toX),
      y: Math.min(fromY, toY),
      cx: Math.abs(dx) || 1,
      cy: Math.abs(dy) || 1,
      lineColor: connectorColor,
      lineWidth: 1.5,
      endArrow: true,
      flipH: dx < 0,
    });
  }

  return { shapes, nextId: id, iconRequests };
}
