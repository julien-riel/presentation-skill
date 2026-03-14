import type { Presentation } from '../schema/presentation.js';
import type { TemplateCapabilities } from '../schema/capabilities.js';
import { resolveLayouts } from './layoutResolver.js';
import { validateContent } from './contentValidator.js';
import { handleOverflow } from './overflowHandler.js';

/**
 * Transform pipeline: resolveLayouts → contentValidator → overflowHandler.
 * Takes a raw presentation AST and template capabilities,
 * returns an enriched AST with resolved layouts, content adjustments,
 * and overflow handling.
 */
export function transformPresentation(
  presentation: Presentation,
  capabilities: TemplateCapabilities,
): Presentation {
  let slides = presentation.slides;

  // Step 1: Resolve layouts against template capabilities
  slides = resolveLayouts(slides, capabilities);

  // Step 2: Validate and adjust content (split, truncate)
  slides = validateContent(slides);

  // Step 3: Handle overflow (font sizing)
  slides = handleOverflow(slides);

  return { ...presentation, slides };
}

export { resolveLayouts } from './layoutResolver.js';
export { validateContent } from './contentValidator.js';
export { handleOverflow } from './overflowHandler.js';
