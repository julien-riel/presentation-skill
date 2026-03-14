import type PptxGenJS from 'pptxgenjs';
import type { Slide, Element } from '../schema/presentation.js';
import { COLORS, FONTS } from './theme.js';

const NODE_HEIGHT = 0.55;
const NODE_MIN_WIDTH = 1.5;
const NODE_H_GAP = 0.35;
const LAYER_V_GAP = 0.35;
const CANVAS_LEFT = 0.8;
const CANVAS_RIGHT = 9.2;
const CANVAS_TOP = 1.6;
const CANVAS_BOTTOM = 6.3;
const NODE_FONT_SIZE = 10;
const LAYER_LABEL_SIZE = 9;

/** Color palette for layers — cycles if more layers than colors. */
const LAYER_COLORS = [
  { fill: COLORS.primary, border: '152238', text: COLORS.white },
  { fill: COLORS.accent1, border: '2068B0', text: COLORS.white },
  { fill: COLORS.accent2, border: '128A9B', text: COLORS.white },
  { fill: '6C5CE7', border: '5A4BD1', text: COLORS.white },
  { fill: COLORS.accent3, border: 'C94E49', text: COLORS.white },
];

interface NodePosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Draws a professional architecture diagram on a PptxGenJS slide.
 * - Groups nodes by layer with color-coded backgrounds
 * - Layer labels on the left side
 * - Rounded rectangles with subtle shadows (via double-shape trick)
 * - Arrow connectors for edges
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

  // Reserve left space for layer labels
  const labelWidth = 0.9;
  const nodeCanvasLeft = CANVAS_LEFT + labelWidth + 0.15;
  const canvasWidth = CANVAS_RIGHT - nodeCanvasLeft;
  const positions = new Map<string, NodePosition>();

  // Draw layer backgrounds + labels + nodes
  for (let li = 0; li < layers.length; li++) {
    const [layerName, layerNodes] = layers[li];
    const y = startY + li * (NODE_HEIGHT + LAYER_V_GAP);
    const colors = LAYER_COLORS[li % LAYER_COLORS.length];

    // Layer background strip (subtle)
    pptxSlide.addShape('rect' as PptxGenJS.ShapeType, {
      x: nodeCanvasLeft - 0.1,
      y: y - 0.05,
      w: canvasWidth + 0.2,
      h: NODE_HEIGHT + 0.1,
      fill: { color: COLORS.lightGray },
      line: { width: 0 },
      rectRadius: 0.06,
    });

    // Layer label
    pptxSlide.addText(layerName, {
      x: CANVAS_LEFT,
      y: y,
      w: labelWidth,
      h: NODE_HEIGHT,
      fontFace: FONTS.body,
      fontSize: LAYER_LABEL_SIZE,
      color: COLORS.textSecondary,
      align: 'right',
      valign: 'middle',
      bold: true,
    });

    // Calculate node width
    const totalGaps = (layerNodes.length - 1) * NODE_H_GAP;
    const nodeWidth = Math.max(
      NODE_MIN_WIDTH,
      Math.min(2.5, (canvasWidth - totalGaps) / layerNodes.length),
    );
    const rowWidth = layerNodes.length * nodeWidth + totalGaps;
    const startX = nodeCanvasLeft + (canvasWidth - rowWidth) / 2;

    for (let ni = 0; ni < layerNodes.length; ni++) {
      const node = layerNodes[ni];
      const x = startX + ni * (nodeWidth + NODE_H_GAP);

      positions.set(node.id, { id: node.id, x, y, w: nodeWidth, h: NODE_HEIGHT });

      const fillColor = node.style?.fill?.replace('#', '') ?? colors.fill;
      const textColor = colors.text;

      // Node rectangle
      pptxSlide.addShape('roundRect' as PptxGenJS.ShapeType, {
        x,
        y,
        w: nodeWidth,
        h: NODE_HEIGHT,
        fill: { color: fillColor },
        line: { width: 0 },
        rectRadius: 0.06,
      });

      // Node label
      pptxSlide.addText(node.label, {
        x,
        y,
        w: nodeWidth,
        h: NODE_HEIGHT,
        fontFace: FONTS.body,
        fontSize: NODE_FONT_SIZE,
        align: 'center',
        valign: 'middle',
        color: textColor,
        bold: true,
      });
    }
  }

  // Draw edges as arrow lines
  for (const edge of edges) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (!from || !to) continue;

    const fromX = from.x + from.w / 2;
    const fromY = from.y + from.h;
    const toX = to.x + to.w / 2;
    const toY = to.y;

    const dx = toX - fromX;
    const dy = toY - fromY;

    if (Math.abs(dy) < 0.01 && Math.abs(dx) < 0.01) continue;

    pptxSlide.addShape('line' as PptxGenJS.ShapeType, {
      x: Math.min(fromX, toX),
      y: Math.min(fromY, toY),
      w: Math.abs(dx) || 0.01,
      h: Math.abs(dy) || 0.01,
      line: { color: COLORS.gray, width: 1.5, endArrowType: 'triangle' },
      flipH: dx < 0,
    });
  }
}
