import type { Slide } from '../schema/presentation.js';
import type { DrawerResult } from './types.js';
import { emu, rectShape, textBoxShape } from './xmlHelpers.js';
import { CANVAS, HEIGHT } from './layoutConstants.js';
import { findElement } from './drawerUtils.js';

/**
 * Builds table shapes using rect + textBox primitives.
 * Header row uses accent color background with white text.
 * Data rows alternate between light gray and white.
 */
export function buildTableShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): DrawerResult {
  const tableEl = findElement(slide.elements, 'table');
  if (!tableEl) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  let id = startId;
  let shapes = '';
  const headerColor = accentColors[0] ?? '2D7DD2';

  const left = CANVAS.LEFT;
  const right = CANVAS.RIGHT_WIDE;
  const top = CANVAS.TOP;
  const canvasW = right - left;
  const cols = tableEl.headers.length;
  const rowH = HEIGHT.ROW;
  const colW = Math.round(canvasW / cols);

  for (let c = 0; c < cols; c++) {
    const x = left + c * colW;
    shapes += rectShape(id++, { x, y: top, cx: colW, cy: rowH, fill: headerColor });
    shapes += textBoxShape(id++, x, top, colW, rowH,
      tableEl.headers[c], { size: 11, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });
  }

  for (let r = 0; r < tableEl.rows.length; r++) {
    const row = tableEl.rows[r];
    const y = top + (r + 1) * rowH;
    const rowFill = r % 2 === 0 ? 'F0F0F0' : 'FFFFFF';

    for (let c = 0; c < cols; c++) {
      const x = left + c * colW;
      const cellValue = row[c] ?? '';
      shapes += rectShape(id++, { x, y, cx: colW, cy: rowH, fill: rowFill, lineColor: 'E0E0E0', lineWidth: 0.5 });
      shapes += textBoxShape(id++, x, y, colW, rowH,
        cellValue, { size: 10, color: '333333', align: 'ctr', valign: 'ctr' });
    }
  }

  return { shapes, nextId: id, iconRequests: [] };
}
