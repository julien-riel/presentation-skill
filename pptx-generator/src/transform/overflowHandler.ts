import type { Slide } from '../schema/presentation.js';

/**
 * Handles overflow for all slides.
 *
 * Previously applied `_fontSizeOverride` annotations, but that field was
 * removed because placeholder-based rendering inherits font sizes from
 * the slide layout — an override set here had no effect.
 *
 * Kept as a pass-through so the transform pipeline call site remains stable.
 */
export function handleOverflow(slides: Slide[]): Slide[] {
  return slides;
}
