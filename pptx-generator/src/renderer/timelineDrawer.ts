import type { Slide, Element } from '../schema/presentation.js';
import type { IconRequest } from './placeholderFiller.js';
import { emu, ellipseShape, lineShape, textBoxShape, emuFromPx } from './xmlHelpers.js';

/**
 * Status colors: uses template accent colors when available,
 * falls back to sensible defaults.
 */
function statusColor(status: string, accents: string[]): string {
  switch (status) {
    case 'done': return accents[3] ?? '27AE60';         // accent4 or green
    case 'in-progress': return accents[4] ?? 'F39C12';  // accent5 or amber
    default: return accents.length > 2 ? accents[2] : '999999'; // accent3 or gray
  }
}

/**
 * Builds timeline shape XML fragments.
 * Uses the template's accent colors for status indicators.
 */
export function buildTimelineShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): { shapes: string; nextId: number; iconRequests: IconRequest[] } {
  const timelineEl = slide.elements.find(
    (el): el is Extract<Element, { type: 'timeline' }> => el.type === 'timeline',
  );
  if (!timelineEl || timelineEl.events.length === 0) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  const events = timelineEl.events;
  const count = events.length;
  let id = startId;
  let shapes = '';
  const iconRequests: IconRequest[] = [];

  // Canvas area in EMU
  const left = emu(1.0);
  const right = emu(9.0);
  const lineY = emu(3.3);
  const lineWidth = right - left;
  const circleR = emu(0.18);
  const labelW = emu(1.3);
  const labelH = emu(0.45);
  const trackColor = accentColors[0] ?? '666666';

  // Horizontal track line
  shapes += lineShape(id++, {
    x: left, y: lineY, cx: lineWidth, cy: 0,
    lineColor: trackColor, lineWidth: 2,
  });

  const spacing = count > 1 ? lineWidth / (count - 1) : 0;

  for (let i = 0; i < count; i++) {
    const event = events[i];
    const cx = count > 1 ? left + i * spacing : left + lineWidth / 2;
    const status = event.status ?? 'planned';
    const color = statusColor(status, accentColors);

    // Colored circle or icon
    if (event.icon) {
      const iconSizePx = 24;
      const iconEmu = emuFromPx(iconSizePx);
      iconRequests.push({
        name: event.icon,
        color: color,
        sizePx: iconSizePx,
        x: cx - Math.round(iconEmu / 2),
        y: lineY - Math.round(iconEmu / 2),
        cx: iconEmu,
        cy: iconEmu,
      });
    } else {
      shapes += ellipseShape(id++, {
        x: cx - circleR, y: lineY - circleR,
        cx: circleR * 2, cy: circleR * 2,
        fill: color,
      });
    }

    // Alternate labels above/below
    const isAbove = i % 2 === 0;
    const labelY = isAbove ? lineY - emu(0.9) : lineY + emu(0.4);
    const dateY = isAbove ? lineY - emu(0.5) : lineY + emu(0.8);

    // Event label
    shapes += textBoxShape(id++, cx - labelW / 2, labelY, labelW, labelH,
      event.label, { size: 11, bold: true, color: accentColors[0] ?? '333333' });

    // Date caption
    shapes += textBoxShape(id++, cx - labelW / 2, dateY, labelW, emu(0.3),
      event.date, { size: 9, color: '888888' });
  }

  return { shapes, nextId: id, iconRequests };
}
