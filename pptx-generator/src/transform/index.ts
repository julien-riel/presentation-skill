import type { Presentation } from '../schema/presentation.js';
import type { TemplateCapabilities } from '../schema/capabilities.js';
import { resolveLayouts } from './layoutResolver.js';
import { degradeElements } from './elementDegrader.js';
import { validateContent } from './contentValidator.js';

/**
 * Transform pipeline: resolveLayouts → degradeElements → validateContent.
 * Takes a raw presentation AST and template capabilities,
 * returns an enriched AST with resolved layouts, degraded elements, and content adjustments.
 */
export function transformPresentation(
  presentation: Presentation,
  capabilities: TemplateCapabilities,
): Presentation {
  let slides = presentation.slides;
  slides = resolveLayouts(slides, capabilities);
  slides = degradeElements(slides);
  slides = validateContent(slides);
  return { ...presentation, slides };
}

export { resolveLayouts } from './layoutResolver.js';
export { degradeElements } from './elementDegrader.js';
export { validateContent } from './contentValidator.js';
