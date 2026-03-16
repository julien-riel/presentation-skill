import type { Slide, Element } from '../schema/presentation.js';
import type { DrawerResult } from './placeholderFiller.js';
import { emu, rectShape, textBoxShape } from './xmlHelpers.js';
import { CANVAS, GAP, HEIGHT } from './layoutConstants.js';

/**
 * Builds comparison layout: two columns with colored headers and bullet lists.
 */
export function buildComparisonShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): DrawerResult {
  const bulletElements = slide.elements.filter(
    (el): el is Extract<Element, { type: 'bullets' }> => el.type === 'bullets',
  );

  if (bulletElements.length === 0) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  const leftBullets = bulletElements.find(el => el.column === 'left') ?? bulletElements[0];
  const rightBullets = bulletElements.find(el => el.column === 'right') ?? bulletElements[1];

  let id = startId;
  let shapes = '';

  const colLeft = CANVAS.LEFT;
  const colRight = emu(6.3);
  const colW = emu(5.0);
  const headerY = CANVAS.TOP;
  const headerH = HEIGHT.HEADER;
  const bodyY = headerY + headerH + GAP.SMALL;
  const lineH = HEIGHT.LINE;
  const leftColor = accentColors[0] ?? '2D7DD2';
  const rightColor = accentColors[1] ?? '27AE60';

  if (leftBullets) {
    shapes += rectShape(id++, {
      x: colLeft, y: headerY, cx: colW, cy: headerH,
      fill: leftColor, rectRadius: 0.04,
    });
    shapes += textBoxShape(id++, colLeft, headerY, colW, headerH,
      leftBullets.label ?? 'Option A', { size: 13, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    for (let i = 0; i < leftBullets.items.length; i++) {
      const y = bodyY + i * lineH;
      shapes += textBoxShape(id++, colLeft + emu(0.2), y, colW - emu(0.4), lineH,
        `\u2022 ${leftBullets.items[i]}`, { size: 12, color: '333333', align: 'l', valign: 'ctr' });
    }
  }

  if (rightBullets) {
    shapes += rectShape(id++, {
      x: colRight, y: headerY, cx: colW, cy: headerH,
      fill: rightColor, rectRadius: 0.04,
    });
    shapes += textBoxShape(id++, colRight, headerY, colW, headerH,
      rightBullets.label ?? 'Option B', { size: 13, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    for (let i = 0; i < rightBullets.items.length; i++) {
      const y = bodyY + i * lineH;
      shapes += textBoxShape(id++, colRight + emu(0.2), y, colW - emu(0.4), lineH,
        `\u2022 ${rightBullets.items[i]}`, { size: 12, color: '333333', align: 'l', valign: 'ctr' });
    }
  }

  return { shapes, nextId: id, iconRequests: [] };
}
