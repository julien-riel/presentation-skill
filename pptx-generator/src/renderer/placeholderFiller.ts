import type { Slide, Element } from '../schema/presentation.js';
import type { TemplateInfo } from '../validator/types.js';
import type { IconRequest, SlideShapeResult } from './types.js';
import { placeholderShape, bulletPlaceholderShape, textBoxShape, hyperlinkTextBoxShape, emuFromPx, emu } from './xmlHelpers.js';
import { DEFAULT_ACCENT_COLOR, makeIconRequest } from './layoutConstants.js';
import { findElement } from './drawerUtils.js';
import { buildTimelineShapes } from './timelineDrawer.js';
import { buildArchitectureShapes } from './architectureDrawer.js';
import { buildKpiShapes } from './kpiDrawer.js';
import { buildTableShapes } from './tableDrawer.js';
import { buildRoadmapShapes } from './roadmapDrawer.js';
import { buildProcessShapes } from './processDrawer.js';
import { buildComparisonShapes } from './comparisonDrawer.js';
import { buildQuoteShapes } from './quoteDrawer.js';
import { buildImageTextShapes } from './imageTextDrawer.js';
import { buildChart } from './chartDrawer.js';

// Re-export types and findElement for external consumers
export type { IconRequest, DrawerResult, PendingChart, ImageRequest, HyperlinkRequest, SlideShapeResult } from './types.js';
export { findElement } from './drawerUtils.js';

function getTitleText(slide: Slide): string {
  return findElement(slide.elements, 'title')?.text ?? '';
}

/**
 * Builds icon bullet shapes for a column region.
 * Returns shapes XML and populates iconRequests array.
 */
function buildIconBulletShapes(
  bulletsEl: Extract<Element, { type: 'bullets' }>,
  id: number,
  iconRequests: IconRequest[],
  accentColor: string,
  regionLeft: number,
  regionTop: number,
  regionWidth: number,
): { shapes: string; nextId: number } {
  let shapes = '';
  const iconSizePx = 20;
  const iconEmu = emuFromPx(iconSizePx);
  const lineHeight = emu(0.55);
  const iconGap = emu(0.15);

  for (let i = 0; i < bulletsEl.items.length; i++) {
    const itemY = regionTop + i * lineHeight;
    const iconName = bulletsEl.icons?.[i];

    if (iconName) {
      iconRequests.push({
        name: iconName,
        color: accentColor,
        sizePx: iconSizePx,
        x: regionLeft,
        y: itemY + Math.round((lineHeight - iconEmu) / 2),
        cx: iconEmu,
        cy: iconEmu,
      });
    }

    const textX = regionLeft + iconEmu + iconGap;
    const textW = regionWidth - iconEmu - iconGap;
    shapes += textBoxShape(id++, textX, itemY, textW, lineHeight,
      bulletsEl.items[i], { size: 14, align: 'l', valign: 'ctr' });
  }

  return { shapes, nextId: id };
}

/**
 * Builds all shape XML fragments for a slide.
 * Returns the concatenated shapes XML and the next available shape ID.
 *
 * Placeholder shapes use <p:ph idx="N"/> to inherit formatting
 * from the template's slideLayout. Canvas shapes (timeline, architecture)
 * use explicit positioning and theme colors from the template.
 */
export function buildSlideShapes(
  slide: Slide,
  startId: number,
  templateInfo: TemplateInfo,
  locale?: string,
): SlideShapeResult {
  const layout = slide._resolvedLayout ?? slide.layout;
  let id = startId;
  let shapes = '';
  const iconRequests: IconRequest[] = [];
  const pendingCharts: PendingChart[] = [];
  const imageRequests: ImageRequest[] = [];
  const hyperlinkRequests: HyperlinkRequest[] = [];
  const accentColors = templateInfo.theme.accentColors.map(c => c.replace('#', ''));

  switch (layout) {
    case 'title':
    case 'section': {
      const title = getTitleText(slide);
      const subtitleEl = findElement(slide.elements, 'subtitle');
      const textEl = findElement(slide.elements, 'text');
      const subtitle = subtitleEl?.text ?? textEl?.text ?? '';

      // Placeholder idx 0 = title (type ctrTitle for title layout, title for section)
      const phType = layout === 'title' ? 'ctrTitle' : 'title';
      shapes += placeholderShape(id++, phType, 0, [title]);

      if (subtitle) {
        if (textEl?.url) {
          const shapeId = id++;
          hyperlinkRequests.push({
            url: textEl.url,
            shapeXmlBuilder: (relId) => hyperlinkTextBoxShape(
              shapeId, emu(1.0), emu(4.0), emu(8.0), emu(0.5),
              textEl.text, textEl.url!, relId, { size: 14, align: 'ctr' },
            ),
          });
        } else {
          const subType = layout === 'title' ? 'subTitle' : 'body';
          shapes += placeholderShape(id++, subType, 1, [subtitle]);
        }
      }
      break;
    }

    case 'bullets':
    case 'generic': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);

      const bulletsEl = findElement(slide.elements, 'bullets');
      if (bulletsEl && bulletsEl.icons && bulletsEl.icons.length > 0) {
        const accentColor = accentColors[0] ?? DEFAULT_ACCENT_COLOR;
        const result = buildIconBulletShapes(bulletsEl, id, iconRequests, accentColor, emu(0.8), emu(1.8), emu(8.4));
        shapes += result.shapes;
        id = result.nextId;
      } else if (bulletsEl) {
        shapes += bulletPlaceholderShape(id++, 1, bulletsEl.items);
      } else {
        const quoteEl = findElement(slide.elements, 'quote');
        const textEl = findElement(slide.elements, 'text');
        if (quoteEl) {
          const quoteText = quoteEl.author
            ? `\u201C${quoteEl.text}\u201D \u2014 ${quoteEl.author}`
            : `\u201C${quoteEl.text}\u201D`;
          shapes += placeholderShape(id++, 'body', 1, [quoteText]);
        } else if (textEl) {
          if (textEl.url) {
            const shapeId = id++;
            hyperlinkRequests.push({
              url: textEl.url,
              shapeXmlBuilder: (relId) => hyperlinkTextBoxShape(
                shapeId, emu(0.8), emu(1.8), emu(8.4), emu(0.5),
                textEl.text, textEl.url!, relId, { size: 14, align: 'l' },
              ),
            });
          } else {
            shapes += placeholderShape(id++, 'body', 1, [textEl.text]);
          }
        }
      }
      break;
    }

    case 'twoColumns': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);

      const bulletElements = slide.elements.filter(
        (el): el is Extract<Element, { type: 'bullets' }> => el.type === 'bullets',
      );
      const leftBullets = bulletElements.find((el) => el.column === 'left') ?? bulletElements[0];
      const rightBullets = bulletElements.find((el) => el.column === 'right') ?? bulletElements[1];

      const hasAnyIcons = (leftBullets?.icons?.length ?? 0) > 0 || (rightBullets?.icons?.length ?? 0) > 0;

      if (hasAnyIcons) {
        const accentColor = accentColors[0] ?? DEFAULT_ACCENT_COLOR;
        const bodyTop = emu(1.8);
        const leftStart = emu(0.8);
        const colWidth = emu(4.0);
        const rightStart = emu(5.2);

        if (leftBullets) {
          const result = buildIconBulletShapes(leftBullets, id, iconRequests, accentColor, leftStart, bodyTop, colWidth);
          shapes += result.shapes;
          id = result.nextId;
        }
        if (rightBullets) {
          const result = buildIconBulletShapes(rightBullets, id, iconRequests, accentColor, rightStart, bodyTop, colWidth);
          shapes += result.shapes;
          id = result.nextId;
        }
      } else {
        if (leftBullets) {
          shapes += bulletPlaceholderShape(id++, 1, leftBullets.items);
        }
        if (rightBullets) {
          shapes += bulletPlaceholderShape(id++, 2, rightBullets.items);
        }
      }
      break;
    }

    case 'timeline':
    case 'architecture': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);

      // Canvas shapes drawn with explicit position using theme colors
      if (layout === 'timeline') {
        const result = buildTimelineShapes(slide, id, accentColors);
        shapes += result.shapes;
        id = result.nextId;
        iconRequests.push(...result.iconRequests);
      } else {
        const result = buildArchitectureShapes(slide, id, accentColors);
        shapes += result.shapes;
        id = result.nextId;
        iconRequests.push(...result.iconRequests);
      }
      break;
    }

    case 'kpi': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);
      const result = buildKpiShapes(slide, id, accentColors);
      shapes += result.shapes;
      id = result.nextId;
      iconRequests.push(...result.iconRequests);
      break;
    }

    case 'table': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);
      const result = buildTableShapes(slide, id, accentColors);
      shapes += result.shapes;
      id = result.nextId;
      break;
    }

    case 'quote': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);
      const result = buildQuoteShapes(slide, id, accentColors);
      shapes += result.shapes;
      id = result.nextId;
      iconRequests.push(...result.iconRequests);
      break;
    }

    case 'roadmap':
    case 'process': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);
      const result = layout === 'roadmap'
        ? buildRoadmapShapes(slide, id, accentColors)
        : buildProcessShapes(slide, id, accentColors);
      shapes += result.shapes;
      id = result.nextId;
      iconRequests.push(...result.iconRequests);
      break;
    }

    case 'comparison': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);
      const result = buildComparisonShapes(slide, id, accentColors);
      shapes += result.shapes;
      id = result.nextId;
      break;
    }

    case 'imageText': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);
      const result = buildImageTextShapes(slide, id);
      shapes += result.shapes;
      id = result.nextId;
      iconRequests.push(...result.iconRequests);
      imageRequests.push(...result.imageRequests);
      hyperlinkRequests.push(...result.hyperlinkRequests);
      break;
    }

    case 'chart': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);
      const chartEl = findElement(slide.elements, 'chart');
      if (chartEl) {
        const result = buildChart(chartEl, id, locale);
        id = result.nextId;
        pendingCharts.push({ buildAnchorShape: result.buildAnchorShape, chartRequest: result.chartRequest });
      }
      break;
    }

    default: {
      // Fallback: render as bullets
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);
      const bulletsEl = findElement(slide.elements, 'bullets');
      if (bulletsEl) {
        shapes += bulletPlaceholderShape(id++, 1, bulletsEl.items);
      }
      break;
    }
  }

  // Check for quote element with decorative icon (only on layouts that render quote text)
  if (layout === 'quote' || layout === 'bullets' || layout === 'generic') {
    const quoteEl = findElement(slide.elements, 'quote');
    if (quoteEl?.icon) {
      const accentColor = accentColors[0] ?? DEFAULT_ACCENT_COLOR;
      iconRequests.push(makeIconRequest(quoteEl.icon, accentColor, 48, emu(0.5), emu(1.5)));
    }
  }

  // Handle standalone image elements on non-imageText layouts
  if (layout !== 'imageText') {
    const imageEl = findElement(slide.elements, 'image');
    if (imageEl) {
      imageRequests.push({
        filePath: imageEl.path,
        altText: imageEl.altText,
        x: emu(0.8),
        y: emu(1.6),
        cx: emu(10.6),
        cy: emu(5.0),
      });
    }
  }

  return { shapes, nextId: id, iconRequests, pendingCharts, imageRequests, hyperlinkRequests };
}
