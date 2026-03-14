import type { Slide, Element } from '../schema/presentation.js';

const MIN_FONT_SIZE = 12;
const FONT_REDUCTION = 2;

/**
 * Applies font sizing adjustments for slides with 4-5 bullets.
 * Reduces body font by 2pt (never below 12pt).
 * Annotates slide with `_fontSizeOverride`.
 */
export function applyFontSizing(slide: Slide): Slide {
  const bulletsElement = slide.elements.find(
    (el): el is Extract<Element, { type: 'bullets' }> => el.type === 'bullets',
  );

  if (!bulletsElement) return slide;

  const count = bulletsElement.items.length;
  if (count >= 4 && count <= 5) {
    // Default body font is typically 18pt; reduce by 2pt
    // The renderer will use _fontSizeOverride if present
    const defaultSize = slide._fontSizeOverride ?? 18;
    const newSize = Math.max(MIN_FONT_SIZE, defaultSize - FONT_REDUCTION);
    return { ...slide, _fontSizeOverride: newSize };
  }

  return slide;
}

/**
 * Handles overflow for all slides — applies font sizing adjustments.
 */
export function handleOverflow(slides: Slide[]): Slide[] {
  return slides.map(applyFontSizing);
}
