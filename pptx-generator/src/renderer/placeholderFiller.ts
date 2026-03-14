import type PptxGenJS from 'pptxgenjs';
import type { Slide, Element } from '../schema/presentation.js';
import { drawTimeline } from './timelineDrawer.js';
import { drawArchitecture } from './architectureDrawer.js';
import { COLORS, FONTS, FONT_SIZES, LAYOUT } from './theme.js';

const DEFAULT_BODY_FONT_SIZE = FONT_SIZES.body;
const DEFAULT_TITLE_FONT_SIZE = FONT_SIZES.slideTitle;

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
  return titleEl?.text ?? '';
}

/**
 * Gets the effective body font size for a slide.
 */
function getBodyFontSize(slide: Slide): number {
  return slide._fontSizeOverride ?? DEFAULT_BODY_FONT_SIZE;
}

/**
 * Adds the standard accent bar below the title on content slides.
 */
function addAccentBar(pptxSlide: PptxGenJS.Slide): void {
  pptxSlide.addShape('rect' as PptxGenJS.ShapeType, {
    x: LAYOUT.marginX,
    y: LAYOUT.accentBarY,
    w: 1.2,
    h: 0.04,
    fill: { color: COLORS.accent1 },
    line: { width: 0 },
  });
}

/**
 * Fills a "title" layout slide — hero dark background with centered text.
 */
function fillTitleSlide(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const title = getTitleText(slide);
  const subtitleEl = findElement(slide.elements, 'subtitle');
  const textEl = findElement(slide.elements, 'text');
  const subtitle = subtitleEl?.text ?? textEl?.text ?? '';

  // Dark navy background
  pptxSlide.background = { color: COLORS.primary };

  // Accent line
  pptxSlide.addShape('rect' as PptxGenJS.ShapeType, {
    x: '10%',
    y: '52%',
    w: '80%',
    h: 0.03,
    fill: { color: COLORS.accent1 },
    line: { width: 0 },
  });

  // Title
  pptxSlide.addText(title, {
    x: '10%',
    y: '22%',
    w: '80%',
    h: '28%',
    fontFace: FONTS.title,
    fontSize: FONT_SIZES.heroTitle,
    bold: true,
    color: COLORS.white,
    align: 'center',
    valign: 'bottom',
  });

  // Subtitle
  if (subtitle) {
    pptxSlide.addText(subtitle, {
      x: '10%',
      y: '56%',
      w: '80%',
      h: '16%',
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.subtitle,
      color: COLORS.gray,
      align: 'center',
      valign: 'top',
    });
  }
}

/**
 * Fills a "section" layout slide — accent blue background.
 */
function fillSectionSlide(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const title = getTitleText(slide);
  const subtitleEl = findElement(slide.elements, 'subtitle');
  const textEl = findElement(slide.elements, 'text');
  const subtitle = subtitleEl?.text ?? textEl?.text ?? '';

  // Accent blue background
  pptxSlide.background = { color: COLORS.accent1 };

  // Left accent bar
  pptxSlide.addShape('rect' as PptxGenJS.ShapeType, {
    x: '7%',
    y: '35%',
    w: 0.05,
    h: '30%',
    fill: { color: COLORS.white },
    line: { width: 0 },
  });

  // Title
  pptxSlide.addText(title, {
    x: '10%',
    y: '28%',
    w: '80%',
    h: '24%',
    fontFace: FONTS.title,
    fontSize: 36,
    bold: true,
    color: COLORS.white,
    align: 'left',
    valign: 'bottom',
  });

  // Subtitle
  if (subtitle) {
    pptxSlide.addText(subtitle, {
      x: '10%',
      y: '54%',
      w: '80%',
      h: '14%',
      fontFace: FONTS.body,
      fontSize: FONT_SIZES.subtitle,
      color: 'D6EAF8',
      align: 'left',
      valign: 'top',
    });
  }
}

/**
 * Fills a "bullets" or "generic" layout slide: TITLE + accent bar + BODY.
 */
export function fillBulletsLayout(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const title = getTitleText(slide);
  const bodyFontSize = getBodyFontSize(slide);

  // Light background
  pptxSlide.background = { color: COLORS.bgLight };

  // Title
  pptxSlide.addText(title, {
    x: LAYOUT.marginX,
    y: LAYOUT.titleY,
    w: LAYOUT.contentW,
    h: LAYOUT.titleH,
    fontFace: FONTS.title,
    fontSize: DEFAULT_TITLE_FONT_SIZE,
    bold: true,
    color: COLORS.primary,
    align: 'left',
    valign: 'bottom',
  });

  // Accent bar
  addAccentBar(pptxSlide);

  const bulletsEl = findElement(slide.elements, 'bullets');
  if (bulletsEl) {
    const bulletRows = bulletsEl.items.map((item) => ({
      text: item,
      options: {
        bullet: { code: '25CF', color: COLORS.accent1 } as unknown as boolean,
        fontSize: bodyFontSize,
        fontFace: FONTS.body,
        color: COLORS.text,
        lineSpacingMultiple: 1.4,
        paraSpaceAfter: 6,
      },
    }));
    pptxSlide.addText(bulletRows, {
      x: LAYOUT.marginX,
      y: LAYOUT.bodyY,
      w: LAYOUT.contentW,
      h: LAYOUT.bodyH,
      valign: 'top',
    });
  } else {
    const textEl = findElement(slide.elements, 'text');
    if (textEl) {
      pptxSlide.addText(textEl.text, {
        x: LAYOUT.marginX,
        y: LAYOUT.bodyY,
        w: LAYOUT.contentW,
        h: LAYOUT.bodyH,
        fontFace: FONTS.body,
        fontSize: bodyFontSize,
        color: COLORS.text,
        lineSpacingMultiple: 1.5,
        valign: 'top',
      });
    }
  }
}

/**
 * Fills a "twoColumns" layout slide: TITLE + accent bar + LEFT/RIGHT with divider.
 */
export function fillTwoColumnsLayout(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const title = getTitleText(slide);
  const bodyFontSize = getBodyFontSize(slide);

  pptxSlide.background = { color: COLORS.bgLight };

  // Title
  pptxSlide.addText(title, {
    x: LAYOUT.marginX,
    y: LAYOUT.titleY,
    w: LAYOUT.contentW,
    h: LAYOUT.titleH,
    fontFace: FONTS.title,
    fontSize: DEFAULT_TITLE_FONT_SIZE,
    bold: true,
    color: COLORS.primary,
    align: 'left',
    valign: 'bottom',
  });

  // Accent bar
  addAccentBar(pptxSlide);

  // Vertical divider line
  pptxSlide.addShape('line' as PptxGenJS.ShapeType, {
    x: '50%',
    y: LAYOUT.bodyY,
    w: 0,
    h: '68%',
    line: { color: COLORS.lightGray, width: 1.0 },
  });

  // Find left/right bullet elements
  const bulletElements = slide.elements.filter(
    (el): el is Extract<Element, { type: 'bullets' }> => el.type === 'bullets',
  );
  const leftBullets = bulletElements.find((el) => el.column === 'left') ?? bulletElements[0];
  const rightBullets = bulletElements.find((el) => el.column === 'right') ?? bulletElements[1];

  const colOpts = {
    fontFace: FONTS.body,
    fontSize: bodyFontSize,
    color: COLORS.text,
    lineSpacingMultiple: 1.4,
    paraSpaceAfter: 6,
  };

  if (leftBullets) {
    const rows = leftBullets.items.map((item) => ({
      text: item,
      options: { bullet: { code: '25CF', color: COLORS.accent1 } as unknown as boolean, ...colOpts },
    }));
    pptxSlide.addText(rows, {
      x: LAYOUT.marginX,
      y: LAYOUT.bodyY,
      w: '40%',
      h: LAYOUT.bodyH,
      valign: 'top',
    });
  }

  if (rightBullets) {
    const rows = rightBullets.items.map((item) => ({
      text: item,
      options: { bullet: { code: '25CF', color: COLORS.accent2 } as unknown as boolean, ...colOpts },
    }));
    pptxSlide.addText(rows, {
      x: '53%',
      y: LAYOUT.bodyY,
      w: '40%',
      h: LAYOUT.bodyH,
      valign: 'top',
    });
  }
}

/**
 * Fills a canvas-type layout (timeline, architecture, kpi).
 * Adds the title + accent bar, then dispatches to the appropriate shape drawer.
 */
export function fillCanvasLayout(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const title = getTitleText(slide);
  const layout = slide._resolvedLayout ?? slide.layout;

  pptxSlide.background = { color: COLORS.bgLight };

  // Title
  pptxSlide.addText(title, {
    x: LAYOUT.marginX,
    y: LAYOUT.titleY,
    w: LAYOUT.contentW,
    h: LAYOUT.titleH,
    fontFace: FONTS.title,
    fontSize: DEFAULT_TITLE_FONT_SIZE,
    bold: true,
    color: COLORS.primary,
    align: 'left',
    valign: 'bottom',
  });

  // Accent bar
  addAccentBar(pptxSlide);

  if (layout === 'timeline') {
    drawTimeline(pptxSlide, slide);
  } else if (layout === 'architecture') {
    drawArchitecture(pptxSlide, slide);
  } else {
    // Fallback for other canvas layouts (kpi, chart, table)
    pptxSlide.addText('[Canvas placeholder]', {
      x: LAYOUT.marginX,
      y: LAYOUT.bodyY,
      w: LAYOUT.contentW,
      h: LAYOUT.bodyH,
      fontFace: FONTS.body,
      fontSize: 14,
      color: COLORS.gray,
      align: 'center',
      valign: 'middle',
    });
  }
}

/**
 * Fills a "title" layout — hero slide.
 */
export function fillTitleLayout(pptxSlide: PptxGenJS.Slide, slide: Slide): void {
  const layout = slide._resolvedLayout ?? slide.layout;
  if (layout === 'section') {
    fillSectionSlide(pptxSlide, slide);
  } else {
    fillTitleSlide(pptxSlide, slide);
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
      fillBulletsLayout(pptxSlide, slide);
      break;
  }
}
