import type { Slide, Element } from '../schema/presentation.js';

export const MAX_BULLETS = 5;
export const MAX_WORDS_PER_BULLET = 12;
export const MAX_TITLE_CHARS = 60;

/**
 * Counts words in a string (split by whitespace).
 */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Truncates a string to a maximum number of words, appending "…" if truncated.
 */
function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
}

/**
 * Truncates a string to a maximum number of characters, appending "…" if truncated.
 */
function truncateChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
}

/**
 * Validates and adjusts content for a single slide.
 * - Bullets > MAX_BULLETS → splits into multiple slides with "(1/N)" suffixes.
 * - Bullet text > MAX_WORDS_PER_BULLET → truncated with warning.
 * - Title > MAX_TITLE_CHARS → truncated with ellipsis + warning.
 *
 * Returns an array of slides (1 if no split needed, N if bullets were split).
 */
export function validateSlideContent(slide: Slide): Slide[] {
  const warnings: string[] = [...(slide._warnings ?? [])];
  let elements = [...slide.elements];

  // --- Title truncation ---
  elements = elements.map((el) => {
    if (el.type === 'title' && el.text.length > MAX_TITLE_CHARS) {
      warnings.push(`Title truncated: "${el.text.slice(0, 30)}…"`);
      return { ...el, text: truncateChars(el.text, MAX_TITLE_CHARS) };
    }
    return el;
  });

  // --- Bullet word truncation ---
  elements = elements.map((el) => {
    if (el.type !== 'bullets') return el;
    const newItems = el.items.map((item) => {
      if (wordCount(item) > MAX_WORDS_PER_BULLET) {
        warnings.push(`Bullet truncated: "${item.slice(0, 30)}…"`);
        return truncateWords(item, MAX_WORDS_PER_BULLET);
      }
      return item;
    });
    return { ...el, items: newItems };
  });

  // --- Bullet count split ---
  const bulletsElement = elements.find(
    (el): el is Extract<Element, { type: 'bullets' }> => el.type === 'bullets',
  );

  if (bulletsElement && bulletsElement.items.length > MAX_BULLETS) {
    const nonBulletElements = elements.filter((el) => el.type !== 'bullets');
    const titleElement = elements.find((el) => el.type === 'title');
    const allItems = bulletsElement.items;
    const totalSlides = Math.ceil(allItems.length / MAX_BULLETS);
    const result: Slide[] = [];

    for (let i = 0; i < totalSlides; i++) {
      const chunk = allItems.slice(i * MAX_BULLETS, (i + 1) * MAX_BULLETS);
      const splitIndex = `(${i + 1}/${totalSlides})`;

      // Build title with split index
      const slideElements: Element[] = [];
      if (titleElement && titleElement.type === 'title') {
        slideElements.push({ ...titleElement, text: `${titleElement.text} ${splitIndex}` });
      }
      // Add non-title, non-bullets elements only on first slide
      if (i === 0) {
        for (const el of nonBulletElements) {
          if (el.type !== 'title') slideElements.push(el);
        }
      }
      slideElements.push({ ...bulletsElement, items: chunk });

      result.push({
        ...slide,
        elements: slideElements,
        _splitIndex: splitIndex,
        _warnings: i === 0 ? warnings : [],
      });
    }

    return result;
  }

  return [{ ...slide, elements, _warnings: warnings }];
}

/**
 * Validates content for all slides, potentially expanding into more slides.
 */
export function validateContent(slides: Slide[]): Slide[] {
  return slides.flatMap(validateSlideContent);
}
