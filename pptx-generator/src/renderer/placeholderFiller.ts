import type { Slide, Element } from '../schema/presentation.js';
import type { TemplateInfo } from '../validator/types.js';
import { placeholderShape, bulletPlaceholderShape } from './xmlHelpers.js';
import { buildTimelineShapes } from './timelineDrawer.js';
import { buildArchitectureShapes } from './architectureDrawer.js';

/**
 * Describes an icon to be resolved and embedded by the renderer.
 * Drawers emit these synchronously; renderToBuffer resolves them in batch.
 */
export interface IconRequest {
  name: string;
  color: string;
  sizePx: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
}

export interface SlideShapeResult {
  shapes: string;
  nextId: number;
  iconRequests: IconRequest[];
}

/**
 * Extracts the first element of a given type from a slide's elements.
 */
function findElement<T extends Element['type']>(
  elements: Element[],
  type: T,
): Extract<Element, { type: T }> | undefined {
  return elements.find((el) => el.type === type) as Extract<Element, { type: T }> | undefined;
}

function getTitleText(slide: Slide): string {
  return findElement(slide.elements, 'title')?.text ?? '';
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
): SlideShapeResult {
  const layout = slide._resolvedLayout ?? slide.layout;
  let id = startId;
  let shapes = '';
  const iconRequests: IconRequest[] = [];

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
        const subType = layout === 'title' ? 'subTitle' : 'body';
        shapes += placeholderShape(id++, subType, 1, [subtitle]);
      }
      break;
    }

    case 'bullets':
    case 'generic': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);

      const bulletsEl = findElement(slide.elements, 'bullets');
      if (bulletsEl) {
        shapes += bulletPlaceholderShape(id++, 1, bulletsEl.items);
      } else {
        const textEl = findElement(slide.elements, 'text');
        if (textEl) {
          shapes += placeholderShape(id++, 'body', 1, [textEl.text]);
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

      if (leftBullets) {
        shapes += bulletPlaceholderShape(id++, 1, leftBullets.items);
      }
      if (rightBullets) {
        shapes += bulletPlaceholderShape(id++, 2, rightBullets.items);
      }
      break;
    }

    case 'timeline':
    case 'architecture': {
      const title = getTitleText(slide);
      shapes += placeholderShape(id++, 'title', 0, [title]);

      // Canvas shapes drawn with explicit position using theme colors
      const accentColors = templateInfo.theme.accentColors.map(c => c.replace('#', ''));
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

  return { shapes, nextId: id, iconRequests };
}
