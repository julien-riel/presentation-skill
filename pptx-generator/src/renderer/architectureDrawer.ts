import type PptxGenJS from 'pptxgenjs';
import type { Slide, Element } from '../schema/presentation.js';

const NODE_HEIGHT = 0.6;   // inches
const NODE_MIN_WIDTH = 1.4;
const NODE_H_GAP = 0.3;
const LAYER_V_GAP = 0.25;
const CANVAS_LEFT = 0.6;
const CANVAS_RIGHT = 9.4;
const CANVAS_TOP = 1.6;
const CANVAS_BOTTOM = 6.5;
const NODE_FONT_SIZE = 10;
const ARROW_COLOR = '666666';

interface NodePosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Draws an architecture diagram on a PptxGenJS slide.
 * - Groups nodes by layer
 * - Draws rounded rectangles for each node
 * - Draws arrow connectors for edges
 */
export function drawArchitecture(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const diagramEl = slide.elements.find(
    (el): el is Extract<Element, { type: 'diagram' }> => el.type === 'diagram',
  );
  if (!diagramEl || diagramEl.nodes.length === 0) return;

  const { nodes, edges } = diagramEl;

  // Group nodes by layer
  const layerMap = new Map<string, typeof nodes>();
  for (const node of nodes) {
    const layer = node.layer ?? 'default';
    if (!layerMap.has(layer)) layerMap.set(layer, []);
    layerMap.get(layer)!.push(node);
  }
  const layers = Array.from(layerMap.entries());

  // Calculate vertical spacing
  const availableHeight = CANVAS_BOTTOM - CANVAS_TOP;
  const totalLayerHeight = layers.length * NODE_HEIGHT + (layers.length - 1) * LAYER_V_GAP;
  const startY = CANVAS_TOP + Math.max(0, (availableHeight - totalLayerHeight) / 2);

  const canvasWidth = CANVAS_RIGHT - CANVAS_LEFT;
  const positions = new Map<string, NodePosition>();

  // Draw nodes layer by layer
  for (let li = 0; li < layers.length; li++) {
    const [, layerNodes] = layers[li];
    const y = startY + li * (NODE_HEIGHT + LAYER_V_GAP);

    // Calculate node width
    const totalGaps = (layerNodes.length - 1) * NODE_H_GAP;
    const nodeWidth = Math.max(
      NODE_MIN_WIDTH,
      Math.min(2.5, (canvasWidth - totalGaps) / layerNodes.length),
    );
    const rowWidth = layerNodes.length * nodeWidth + totalGaps;
    const startX = CANVAS_LEFT + (canvasWidth - rowWidth) / 2;

    for (let ni = 0; ni < layerNodes.length; ni++) {
      const node = layerNodes[ni];
      const x = startX + ni * (nodeWidth + NODE_H_GAP);

      positions.set(node.id, { id: node.id, x, y, w: nodeWidth, h: NODE_HEIGHT });

      const fillColor = node.style?.fill?.replace('#', '') ?? '4472C4';
      const borderColor = node.style?.border?.replace('#', '') ?? '2F5496';

      // Rounded rectangle
      pptxSlide.addShape('roundRect' as PptxGenJS.ShapeType, {
        x,
        y,
        w: nodeWidth,
        h: NODE_HEIGHT,
        fill: { color: fillColor },
        line: { color: borderColor, width: 1.5 },
        rectRadius: 0.1,
      });

      // Node label
      pptxSlide.addText(node.label, {
        x,
        y,
        w: nodeWidth,
        h: NODE_HEIGHT,
        fontSize: NODE_FONT_SIZE,
        align: 'center',
        valign: 'middle',
        color: 'FFFFFF',
        bold: true,
      });
    }
  }

  // Draw edges as arrow lines
  for (const edge of edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;

    // Connect from bottom-center of source to top-center of target
    const fromX = from.x + from.w / 2;
    const fromY = from.y + from.h;
    const toX = to.x + to.w / 2;
    const toY = to.y;

    const dx = toX - fromX;
    const dy = toY - fromY;

    if (Math.abs(dy) < 0.01 && Math.abs(dx) < 0.01) continue;

    // Use a line shape for the connector
    pptxSlide.addShape('line' as PptxGenJS.ShapeType, {
      x: Math.min(fromX, toX),
      y: Math.min(fromY, toY),
      w: Math.abs(dx) || 0.01,
      h: Math.abs(dy) || 0.01,
      line: { color: ARROW_COLOR, width: 1.5, endArrowType: 'triangle' },
      flipH: dx < 0,
    });
  }
}
