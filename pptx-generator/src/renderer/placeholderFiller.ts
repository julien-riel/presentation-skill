import type PptxGenJS from 'pptxgenjs';
import type { Slide, Element } from '../schema/presentation.js';
import { drawTimeline } from './timelineDrawer.js';
import { drawArchitecture } from './architectureDrawer.js';

const DEFAULT_BODY_FONT_SIZE = 18;
const DEFAULT_TITLE_FONT_SIZE = 36;

/**
 * Extracts the first element of a given type from a slide's elements.
 */
function findElement<T extends Element['type']>(
  elements: Element[],
  type: T,
): Extract<Element, { type: T }> | undefined {
  return elements.find((el) => el.type === type) as Extract<Element, { type: T }> | undefined;
}

/**
 * Builds the title text, appending _splitIndex if present.
 */
function getTitleText(slide: Slide): string {
  const titleEl = findElement(slide.elements, 'title');
  const base = titleEl?.text ?? '';
  // _splitIndex is already baked into the title by contentValidator for split slides,
  // but if it's not in the title text and _splitIndex exists, we don't double-add it.
  return base;
}

/**
 * Gets the effective body font size for a slide.
 */
function getBodyFontSize(slide: Slide): number {
  return slide._fontSizeOverride ?? DEFAULT_BODY_FONT_SIZE;
}

/**
 * Fills a "title" or "section" layout slide: centered TITLE + SUBTITLE.
 */
export function fillTitleLayout(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const title = getTitleText(slide);
  const subtitleEl = findElement(slide.elements, 'subtitle');
  const textEl = findElement(slide.elements, 'text');
  const subtitle = subtitleEl?.text ?? textEl?.text ?? '';

  pptxSlide.addText(title, {
    x: '10%',
    y: '30%',
    w: '80%',
    h: '20%',
    fontSize: DEFAULT_TITLE_FONT_SIZE,
    bold: true,
    align: 'center',
    valign: 'middle',
  });

  if (subtitle) {
    pptxSlide.addText(subtitle, {
      x: '10%',
      y: '55%',
      w: '80%',
      h: '15%',
      fontSize: 20,
      align: 'center',
      valign: 'middle',
    });
  }
}

/**
 * Fills a "bullets" or "generic" layout slide: TITLE (idx 0) + BODY with bullet list (idx 1).
 */
export function fillBulletsLayout(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const title = getTitleText(slide);
  const bodyFontSize = getBodyFontSize(slide);

  pptxSlide.addText(title, {
    x: '5%',
    y: '5%',
    w: '90%',
    h: '15%',
    fontSize: DEFAULT_TITLE_FONT_SIZE,
    bold: true,
    align: 'left',
    valign: 'middle',
  });

  const bulletsEl = findElement(slide.elements, 'bullets');
  if (bulletsEl) {
    const bulletRows = bulletsEl.items.map((item) => ({
      text: item,
      options: { bullet: true as const, fontSize: bodyFontSize },
    }));
    pptxSlide.addText(bulletRows, {
      x: '5%',
      y: '22%',
      w: '90%',
      h: '70%',
      valign: 'top',
    });
  } else {
    // Fallback: render any text element as body
    const textEl = findElement(slide.elements, 'text');
    if (textEl) {
      pptxSlide.addText(textEl.text, {
        x: '5%',
        y: '22%',
        w: '90%',
        h: '70%',
        fontSize: bodyFontSize,
        valign: 'top',
      });
    }
  }
}

/**
 * Fills a "twoColumns" layout slide: TITLE (idx 0), LEFT (idx 1), RIGHT (idx 2).
 */
export function fillTwoColumnsLayout(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const title = getTitleText(slide);
  const bodyFontSize = getBodyFontSize(slide);

  pptxSlide.addText(title, {
    x: '5%',
    y: '5%',
    w: '90%',
    h: '15%',
    fontSize: DEFAULT_TITLE_FONT_SIZE,
    bold: true,
    align: 'left',
    valign: 'middle',
  });

  // Find left/right bullet elements
  const bulletElements = slide.elements.filter(
    (el): el is Extract<Element, { type: 'bullets' }> => el.type === 'bullets',
  );
  const leftBullets = bulletElements.find((el) => el.column === 'left') ?? bulletElements[0];
  const rightBullets = bulletElements.find((el) => el.column === 'right') ?? bulletElements[1];

  if (leftBullets) {
    const rows = leftBullets.items.map((item) => ({
      text: item,
      options: { bullet: true as const, fontSize: bodyFontSize },
    }));
    pptxSlide.addText(rows, {
      x: '5%',
      y: '22%',
      w: '42%',
      h: '70%',
      valign: 'top',
    });
  }

  if (rightBullets) {
    const rows = rightBullets.items.map((item) => ({
      text: item,
      options: { bullet: true as const, fontSize: bodyFontSize },
    }));
    pptxSlide.addText(rows, {
      x: '53%',
      y: '22%',
      w: '42%',
      h: '70%',
      valign: 'top',
    });
  }
}

/**
 * Fills a canvas-type layout (timeline, architecture, kpi).
 * Adds the title, then dispatches to the appropriate shape drawer.
 */
export function fillCanvasLayout(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const title = getTitleText(slide);
  const layout = slide._resolvedLayout ?? slide.layout;

  pptxSlide.addText(title, {
    x: '5%',
    y: '5%',
    w: '90%',
    h: '15%',
    fontSize: DEFAULT_TITLE_FONT_SIZE,
    bold: true,
    align: 'left',
    valign: 'middle',
  });

  if (layout === 'timeline') {
    drawTimeline(pptxSlide, slide);
  } else if (layout === 'architecture') {
    drawArchitecture(pptxSlide, slide);
  } else {
    // Fallback for other canvas layouts (kpi, chart, table)
    pptxSlide.addText('[Canvas placeholder]', {
      x: '5%',
      y: '22%',
      w: '90%',
      h: '70%',
      fontSize: 14,
      color: '999999',
      align: 'center',
      valign: 'middle',
    });
  }
}

/**
 * Dispatches to the correct filler based on the resolved layout type.
 */
export function fillSlide(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const layout = slide._resolvedLayout ?? slide.layout;

  switch (layout) {
    case 'title':
    case 'section':
      fillTitleLayout(pptxSlide, slide);
      break;
    case 'bullets':
    case 'generic':
      fillBulletsLayout(pptxSlide, slide);
      break;
    case 'twoColumns':
      fillTwoColumnsLayout(pptxSlide, slide);
      break;
    case 'timeline':
    case 'architecture':
    case 'kpi':
    case 'chart':
    case 'table':
      fillCanvasLayout(pptxSlide, slide);
      break;
    default:
      // Unknown layout: fall back to bullets behavior
      fillBulletsLayout(pptxSlide, slide);
      break;
  }
}
