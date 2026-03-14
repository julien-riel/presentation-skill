import type PptxGenJS from 'pptxgenjs';
import type { Slide, Element } from '../schema/presentation.js';
import { COLORS, FONTS, FONT_SIZES } from './theme.js';

/** Status-to-color mapping for timeline events. */
const STATUS_COLORS: Record<string, string> = {
  done: COLORS.green,
  'in-progress': COLORS.amber,
  planned: COLORS.gray,
};

const DEFAULT_STATUS = 'planned';

const LINE_Y = 3.3;       // inches from top
const CIRCLE_RADIUS = 0.18;
const LABEL_WIDTH = 1.3;
const LABEL_HEIGHT = 0.45;
const DATE_FONT_SIZE = FONT_SIZES.small;
const LABEL_FONT_SIZE = 12;

/**
 * Draws a professional timeline on a PptxGenJS slide.
 * - Horizontal track line with rounded endpoints
 * - Colored circles per event with white border
 * - Labels alternating above/below with date captions
 */
export function drawTimeline(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const timelineEl = slide.elements.find(
    (el): el is Extract<Element, { type: 'timeline' }> => el.type === 'timeline',
  );
  if (!timelineEl || timelineEl.events.length === 0) return;

  const events = timelineEl.events;
  const count = events.length;

  // Canvas area
  const canvasLeft = 1.0;
  const canvasRight = 9.0;
  const lineWidth = canvasRight - canvasLeft;

  // Track line (thicker, themed color)
  pptxSlide.addShape('rect' as PptxGenJS.ShapeType, {
    x: canvasLeft,
    y: LINE_Y - 0.02,
    w: lineWidth,
    h: 0.04,
    fill: { color: COLORS.lightGray },
    line: { width: 0 },
    rectRadius: 0.02,
  });

  // Compute spacing
  const spacing = count > 1 ? lineWidth / (count - 1) : 0;

  for (let i = 0; i < count; i++) {
    const event = events[i];
    const cx = count > 1 ? canvasLeft + i * spacing : canvasLeft + lineWidth / 2;
    const status = event.status ?? DEFAULT_STATUS;
    const color = STATUS_COLORS[status] ?? STATUS_COLORS[DEFAULT_STATUS];

    // Outer ring (white border effect)
    pptxSlide.addShape('ellipse' as PptxGenJS.ShapeType, {
      x: cx - CIRCLE_RADIUS - 0.03,
      y: LINE_Y - CIRCLE_RADIUS - 0.03,
      w: (CIRCLE_RADIUS + 0.03) * 2,
      h: (CIRCLE_RADIUS + 0.03) * 2,
      fill: { color: COLORS.white },
      line: { width: 0 },
    });

    // Inner colored circle
    pptxSlide.addShape('ellipse' as PptxGenJS.ShapeType, {
      x: cx - CIRCLE_RADIUS,
      y: LINE_Y - CIRCLE_RADIUS,
      w: CIRCLE_RADIUS * 2,
      h: CIRCLE_RADIUS * 2,
      fill: { color },
      line: { width: 0 },
    });

    // Alternate labels above/below
    const isAbove = i % 2 === 0;
    const labelY = isAbove ? LINE_Y - 1.0 : LINE_Y + 0.45;
    const dateY = isAbove ? LINE_Y - 0.6 : LINE_Y + 0.85;

    // Connector dot-line from circle to label
    const connStart = isAbove ? LINE_Y - CIRCLE_RADIUS - 0.05 : LINE_Y + CIRCLE_RADIUS + 0.05;
    const connEnd = isAbove ? labelY + LABEL_HEIGHT : labelY;
    pptxSlide.addShape('line' as PptxGenJS.ShapeType, {
      x: cx,
      y: Math.min(connStart, connEnd),
      w: 0,
      h: Math.abs(connEnd - connStart),
      line: { color: COLORS.lightGray, width: 1, dashType: 'dash' },
    });

    // Event label
    pptxSlide.addText(event.label, {
      x: cx - LABEL_WIDTH / 2,
      y: labelY,
      w: LABEL_WIDTH,
      h: LABEL_HEIGHT,
      fontFace: FONTS.body,
      fontSize: LABEL_FONT_SIZE,
      align: 'center',
      valign: 'middle',
      bold: true,
      color: COLORS.text,
    });

    // Date caption
    pptxSlide.addText(event.date, {
      x: cx - LABEL_WIDTH / 2,
      y: dateY,
      w: LABEL_WIDTH,
      h: 0.3,
      fontFace: FONTS.body,
      fontSize: DATE_FONT_SIZE,
      align: 'center',
      valign: 'middle',
      color: COLORS.textSecondary,
    });
  }
}
