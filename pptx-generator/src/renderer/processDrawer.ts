import type { Slide, Element } from '../schema/presentation.js';
import type { IconRequest } from './placeholderFiller.js';
import { emu, rectShape, textBoxShape, lineShape, emuFromPx } from './xmlHelpers.js';

/**
 * Builds process step shapes: numbered boxes connected by arrows.
 */
export function buildProcessShapes(
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
  const boxY = emu(2.6);
  const boxH = emu(1.6);
  const arrowGap = emu(0.4);

  const totalArrowW = (count - 1) * arrowGap;
  const boxW = Math.round((canvasW - totalArrowW) / count);
  const primaryColor = accentColors[0] ?? '2D7DD2';

  for (let i = 0; i < count; i++) {
    const event = events[i];
    const x = left + i * (boxW + arrowGap);

    shapes += rectShape(id++, {
      x, y: boxY, cx: boxW, cy: boxH,
      fill: primaryColor, rectRadius: 0.06,
    });

    shapes += textBoxShape(id++, x, boxY + emu(0.15), boxW, emu(0.45),
      `${i + 1}`, { size: 22, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    shapes += textBoxShape(id++, x, boxY + emu(0.6), boxW, emu(0.7),
      event.label, { size: 12, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    shapes += textBoxShape(id++, x, boxY + boxH + emu(0.1), boxW, emu(0.3),
      event.date, { size: 9, color: '888888', align: 'ctr', valign: 't' });

    if (i < count - 1) {
      const arrowX = x + boxW;
      const arrowY = boxY + Math.round(boxH / 2);
      shapes += lineShape(id++, {
        x: arrowX, y: arrowY, cx: arrowGap, cy: 0,
        lineColor: primaryColor, lineWidth: 2, endArrow: true,
      });
    }

    if (event.icon) {
      const iconSizePx = 20;
      const iconEmu = emuFromPx(iconSizePx);
      iconRequests.push({
        name: event.icon,
        color: 'FFFFFF',
        sizePx: iconSizePx,
        x: x + boxW - iconEmu - emu(0.1),
        y: boxY + emu(0.1),
        cx: iconEmu,
        cy: iconEmu,
      });
    }
  }

  return { shapes, nextId: id, iconRequests };
}
