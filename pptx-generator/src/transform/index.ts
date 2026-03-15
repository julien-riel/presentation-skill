import type { Presentation } from '../schema/presentation.js';
import type { TemplateCapabilities } from '../schema/capabilities.js';
import { resolveLayouts } from './layoutResolver.js';
import { validateContent } from './contentValidator.js';

/**
 * Transform pipeline: resolveLayouts → contentValidator.
 * Takes a raw presentation AST and template capabilities,
 * returns an enriched AST with resolved layouts and content adjustments.
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

  return { ...presentation, slides };
}

export { resolveLayouts } from './layoutResolver.js';
export { validateContent } from './contentValidator.js';
