import type { Slide } from '../schema/presentation.js';
import type { DrawerResult, IconRequest } from './types.js';
import { emu, rectShape, textBoxShape, emuFromPx } from './xmlHelpers.js';
import { CANVAS, GAP, HEIGHT, makeIconRequest } from './layoutConstants.js';
import { findElement } from './drawerUtils.js';

const TREND_ICONS: Record<string, string> = {
  up: 'trending-up',
  down: 'trending-down',
  stable: 'minus',
};

/**
 * Builds KPI card shapes for a slide.
 * Renders each indicator as a colored card with value, label, unit, and optional trend/icon.
 * Layout: up to 3 per row, max 2 rows (6 indicators).
 */
export function buildKpiShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): DrawerResult {
  const kpiEl = findElement(slide.elements, 'kpi');
  if (!kpiEl || kpiEl.indicators.length === 0) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  let id = startId;
  let shapes = '';
  const iconRequests: IconRequest[] = [];

  const indicators = kpiEl.indicators.slice(0, 6);
  const count = indicators.length;
  const cols = count <= 3 ? count : Math.ceil(count / 2);
  const rows = count <= 3 ? 1 : 2;

  const canvasLeft = CANVAS.LEFT;
  const canvasRight = CANVAS.RIGHT_WIDE;
  const canvasTop = CANVAS.TOP;
  const canvasBottom = CANVAS.BOTTOM_TALL;
  const canvasW = canvasRight - canvasLeft;
  const canvasH = canvasBottom - canvasTop;
  const gap = GAP.STANDARD;

  const cardW = Math.round((canvasW - (cols - 1) * gap) / cols);
  const cardH = Math.round((canvasH - (rows - 1) * gap) / rows);

  for (let i = 0; i < count; i++) {
    const indicator = indicators[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = canvasLeft + col * (cardW + gap);
    const y = canvasTop + row * (cardH + gap);
    const color = accentColors[i % accentColors.length] ?? '2D7DD2';

    shapes += rectShape(id++, {
      x, y, cx: cardW, cy: cardH,
      fill: color, rectRadius: 0.06,
    });

    const valueH = emu(0.8);
    const valueY = y + Math.round(cardH * 0.15);
    shapes += textBoxShape(id++, x, valueY, cardW, valueH,
      indicator.value, { size: 36, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    if (indicator.unit) {
      const unitH = GAP.LARGE;
      const unitY = valueY + valueH - GAP.SMALL;
      shapes += textBoxShape(id++, x, unitY, cardW, unitH,
        indicator.unit, { size: 11, color: 'EEEEEE', align: 'ctr', valign: 't' });
    }

    const labelH = HEIGHT.ROW;
    const labelY = y + cardH - labelH - GAP.SMALL;
    shapes += textBoxShape(id++, x, labelY, cardW, labelH,
      indicator.label, { size: 14, color: 'FFFFFF', align: 'ctr', valign: 'b' });

    if (indicator.trend) {
      const trendIconName = TREND_ICONS[indicator.trend];
      if (trendIconName) {
        const trendEmu = emuFromPx(20);
        iconRequests.push(makeIconRequest(
          trendIconName, 'FFFFFF', 20,
          x + cardW - trendEmu - GAP.MEDIUM,
          y + GAP.MEDIUM,
        ));
      }
    }

    if (indicator.icon) {
      iconRequests.push(makeIconRequest(
        indicator.icon, 'FFFFFF', 24,
        x + GAP.MEDIUM,
        y + GAP.MEDIUM,
      ));
    }
  }

  return { shapes, nextId: id, iconRequests };
}
