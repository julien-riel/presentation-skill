import type { Slide } from '../schema/presentation.js';
import type { DrawerResult } from './placeholderFiller.js';
import { emu, textBoxShape } from './xmlHelpers.js';
import { findElement } from './drawerUtils.js';

/** Default accent color when template has no accent colors defined. */
const DEFAULT_ACCENT_COLOR = '2D7DD2';

/**
 * Builds quote body shapes for a slide (excluding the title placeholder).
 * Renders the quote text in centered decorative style with optional author attribution.
 */
export function buildQuoteShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): DrawerResult {
  const quoteEl = findElement(slide.elements, 'quote');
  if (!quoteEl) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  let id = startId;
  let shapes = '';
  const accentColor = accentColors[0] ?? DEFAULT_ACCENT_COLOR;

  const quoteText = `\u201C${quoteEl.text}\u201D`;
  shapes += textBoxShape(id++, emu(1.5), emu(2.0), emu(9.2), emu(2.5),
    quoteText, { size: 24, color: '333333', align: 'ctr', valign: 'ctr' });

  if (quoteEl.author) {
    shapes += textBoxShape(id++, emu(1.5), emu(4.6), emu(9.2), emu(0.5),
      `\u2014 ${quoteEl.author}`, { size: 14, color: accentColor, align: 'ctr', valign: 't' });
  }

  return { shapes, nextId: id, iconRequests: [] };
}
