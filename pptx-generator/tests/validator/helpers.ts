import type { TemplateInfo, LayoutInfo, PlaceholderInfo } from '../../src/validator/types.js';

/**
 * Creates a layout with the given name and placeholders.
 */
export function makeLayout(
  name: string,
  placeholders: Array<{
    index: number;
    type: string;
    x?: number;
    y?: number;
    cx?: number;
    cy?: number;
  }>
): LayoutInfo {
  return {
    name,
    placeholders: placeholders.map(p => ({
      index: p.index,
      type: p.type,
      position: {
        x: p.x ?? 457200,
        y: p.y ?? 457200,
        cx: p.cx ?? 5000000,
        cy: p.cy ?? 3000000,
      },
    })),
  };
}

/**
 * Creates a Tier 1 template with all required layouts and valid placeholders.
 */
export function makeTier1Template(): TemplateInfo {
  return {
    layouts: [
      makeLayout('LAYOUT_TITLE', [
        { index: 0, type: 'ctrTitle' },
        { index: 1, type: 'subTitle' },
      ]),
      makeLayout('LAYOUT_SECTION', [
        { index: 0, type: 'title' },
        { index: 1, type: 'body' },
      ]),
      makeLayout('LAYOUT_BULLETS', [
        { index: 0, type: 'title' },
        { index: 1, type: 'body', cy: 2500000 },
      ]),
      makeLayout('LAYOUT_GENERIC', [
        { index: 0, type: 'title' },
        { index: 1, type: 'body' },
      ]),
    ],
    theme: {
      titleFont: 'Calibri',
      bodyFont: 'Calibri',
      accentColors: ['#1E3A5F', '#2C7DA0', '#E76F51'],
    },
    slideDimensions: { widthEmu: 12192000, heightEmu: 6858000 },
  };
}

/**
 * Creates a Tier 2 template (Tier 1 + twoColumns + timeline).
 */
export function makeTier2Template(): TemplateInfo {
  const t1 = makeTier1Template();
  return {
    ...t1,
    layouts: [
      ...t1.layouts,
      makeLayout('LAYOUT_TWO_COLUMNS', [
        { index: 0, type: 'title' },
        { index: 1, type: 'body', x: 457200, cx: 5000000 },
        { index: 2, type: 'body', x: 5800000, cx: 5000000 },
      ]),
      makeLayout('LAYOUT_TIMELINE', [
        { index: 0, type: 'title' },
        { index: 1, type: 'body', cy: 4500000 },
      ]),
    ],
  };
}

/**
 * Creates an empty (invalid) template.
 */
export function makeEmptyTemplate(): TemplateInfo {
  return {
    layouts: [],
    theme: { titleFont: '', bodyFont: '', accentColors: [] },
    slideDimensions: { widthEmu: 12192000, heightEmu: 6858000 },
  };
}
