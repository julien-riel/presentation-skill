import type { Slide, Element } from '../schema/presentation.js';
import type { IconRequest } from './placeholderFiller.js';
import { emu, rectShape, textBoxShape, emuFromPx } from './xmlHelpers.js';
import { statusColor } from './drawerHelpers.js';

/**
 * Builds roadmap shapes: horizontal phase blocks with labels and dates.
 */
export function buildRoadmapShapes(
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

  const left = emu(0.8);
  const right = emu(11.4);
  const canvasW = right - left;
  const barY = emu(2.8);
  const barH = emu(1.4);
  const gap = emu(0.15);

  const blockW = Math.round((canvasW - (count - 1) * gap) / count);

  for (let i = 0; i < count; i++) {
    const event = events[i];
    const x = left + i * (blockW + gap);
    const color = statusColor(event.status ?? 'planned', accentColors);

    shapes += rectShape(id++, {
      x, y: barY, cx: blockW, cy: barH,
      fill: color, rectRadius: 0.06,
    });

    shapes += textBoxShape(id++, x, barY, blockW, barH,
      event.label, { size: 13, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    shapes += textBoxShape(id++, x, barY + barH + emu(0.1), blockW, emu(0.35),
      event.date, { size: 9, color: '888888', align: 'ctr', valign: 't' });

    if (event.icon) {
      const iconSizePx = 20;
      const iconEmu = emuFromPx(iconSizePx);
      iconRequests.push({
        name: event.icon,
        color: 'FFFFFF',
        sizePx: iconSizePx,
        x: x + blockW - iconEmu - emu(0.1),
        y: barY + emu(0.1),
        cx: iconEmu,
        cy: iconEmu,
      });
    }
  }

  return { shapes, nextId: id, iconRequests };
}
