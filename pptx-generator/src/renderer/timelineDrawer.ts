import type PptxGenJS from 'pptxgenjs';
import type { Slide, Element } from '../schema/presentation.js';

/** Status-to-color mapping for timeline events. */
const STATUS_COLORS: Record<string, string> = {
  done: '2E7D32',        // green
  'in-progress': 'F57C00', // orange
  planned: '9E9E9E',     // grey
};

const DEFAULT_STATUS = 'planned';

const LINE_Y = 3.2;       // inches from top — middle of canvas area
const CIRCLE_RADIUS = 0.2; // inches
const LABEL_WIDTH = 1.2;
const LABEL_HEIGHT = 0.5;
const DATE_FONT_SIZE = 9;
const LABEL_FONT_SIZE = 10;

/**
 * Draws a timeline on a PptxGenJS slide.
 * - Horizontal line across the canvas area
 * - Colored circles per event (done=green, in-progress=orange, planned=grey)
 * - Labels alternating above/below the line
 */
export function drawTimeline(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const timelineEl = slide.elements.find(
    (el): el is Extract<Element, { type: 'timeline' }> => el.type === 'timeline',
  );
  if (!timelineEl || timelineEl.events.length === 0) return;

  const events = timelineEl.events;
  const count = events.length;

  // Canvas area: x from 0.8 to 9.2 inches (on 10-inch slide)
  const canvasLeft = 0.8;
  const canvasRight = 9.2;
  const lineWidth = canvasRight - canvasLeft;

  // Draw the horizontal line
  pptxSlide.addShape('line' as PptxGenJS.ShapeType, {
    x: canvasLeft,
    y: LINE_Y,
    w: lineWidth,
    h: 0,
    line: { color: '666666', width: 2 },
  });

  // Compute spacing
  const spacing = count > 1 ? lineWidth / (count - 1) : 0;

  for (let i = 0; i < count; i++) {
    const event = events[i];
    const cx = count > 1 ? canvasLeft + i * spacing : canvasLeft + lineWidth / 2;
    const status = event.status ?? DEFAULT_STATUS;
    const color = STATUS_COLORS[status] ?? STATUS_COLORS[DEFAULT_STATUS];

    // Draw circle
    pptxSlide.addShape('ellipse' as PptxGenJS.ShapeType, {
      x: cx - CIRCLE_RADIUS,
      y: LINE_Y - CIRCLE_RADIUS,
      w: CIRCLE_RADIUS * 2,
      h: CIRCLE_RADIUS * 2,
      fill: { color },
    });

    // Alternate labels above/below
    const isAbove = i % 2 === 0;
    const labelY = isAbove ? LINE_Y - 0.9 : LINE_Y + 0.4;
    const dateY = isAbove ? LINE_Y - 0.5 : LINE_Y + 0.8;

    // Event label
    pptxSlide.addText(event.label, {
      x: cx - LABEL_WIDTH / 2,
      y: labelY,
      w: LABEL_WIDTH,
      h: LABEL_HEIGHT,
      fontSize: LABEL_FONT_SIZE,
      align: 'center',
      valign: 'middle',
      bold: true,
    });

    // Date label
    pptxSlide.addText(event.date, {
      x: cx - LABEL_WIDTH / 2,
      y: dateY,
      w: LABEL_WIDTH,
      h: 0.3,
      fontSize: DATE_FONT_SIZE,
      align: 'center',
      valign: 'middle',
      color: '666666',
    });
  }
}
