import type { Slide } from '../schema/presentation.js';
import type { DrawerResult, IconRequest } from './types.js';
import { emu, rectShape, textBoxShape, lineShape, emuFromPx } from './xmlHelpers.js';
import { CANVAS, GAP, HEIGHT, makeIconRequest } from './layoutConstants.js';
import { findElement } from './drawerUtils.js';

/**
 * Builds process step shapes: numbered boxes connected by arrows.
 */
export function buildProcessShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): DrawerResult {
  const timelineEl = findElement(slide.elements, 'timeline');
  if (!timelineEl || timelineEl.events.length === 0) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  const events = timelineEl.events;
  const count = events.length;
  let id = startId;
  let shapes = '';
  const iconRequests: IconRequest[] = [];

  const left = CANVAS.LEFT;
  const right = CANVAS.RIGHT_WIDE;
  const canvasW = right - left;
  const boxY = emu(2.6);
  const boxH = HEIGHT.BOX;
  const arrowGap = GAP.ARROW;

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

    shapes += textBoxShape(id++, x, boxY + GAP.MEDIUM, boxW, HEIGHT.ROW,
      `${i + 1}`, { size: 22, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    shapes += textBoxShape(id++, x, boxY + emu(0.6), boxW, emu(0.7),
      event.label, { size: 12, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    shapes += textBoxShape(id++, x, boxY + boxH + GAP.SMALL, boxW, emu(0.3),
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
      const iconEmu = emuFromPx(20);
      iconRequests.push(makeIconRequest(
        event.icon, 'FFFFFF', 20,
        x + boxW - iconEmu - GAP.SMALL,
        boxY + GAP.SMALL,
      ));
    }
  }

  return { shapes, nextId: id, iconRequests };
}
