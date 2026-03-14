import type { Slide, LayoutType } from '../schema/presentation.js';
import type { TemplateCapabilities } from '../schema/capabilities.js';

/**
 * Full degradation cascade per the spec section 4.4.
 * Each key maps to its ordered fallback chain ending at generic.
 */
const FALLBACK_CASCADE: Record<string, LayoutType[]> = {
  kpi: ['bullets', 'generic'],
  chart: ['bullets', 'generic'],
  table: ['bullets', 'generic'],
  quote: ['bullets', 'generic'],
  architecture: ['bullets', 'generic'],
  imageText: ['twoColumns', 'bullets', 'generic'],
  roadmap: ['timeline', 'bullets', 'generic'],
  process: ['timeline', 'bullets', 'generic'],
  comparison: ['twoColumns', 'bullets', 'generic'],
};

/**
 * Resolves the layout for a single slide against the template capabilities.
 * If the requested layout is supported, it is kept as-is.
 * Otherwise, the fallback cascade is applied using the manifest's fallback_map
 * and the full cascade table.
 */
export function resolveSlideLayout(
  slide: Slide,
  capabilities: TemplateCapabilities,
): Slide {
  const supported = new Set(capabilities.supported_layouts);
  const layout = slide.layout;

  if (supported.has(layout)) {
    return { ...slide, _resolvedLayout: layout };
  }

  // Walk the cascade
  const cascade = FALLBACK_CASCADE[layout];
  if (cascade) {
    for (const fallback of cascade) {
      if (supported.has(fallback)) {
        const warnings = [...(slide._warnings ?? [])];
        warnings.push(`Layout "${layout}" degraded to "${fallback}"`);
        return { ...slide, _resolvedLayout: fallback, _warnings: warnings };
      }
    }
  }

  // Ultimate fallback to generic (should always be supported in Tier 1)
  const warnings = [...(slide._warnings ?? [])];
  warnings.push(`Layout "${layout}" degraded to "generic"`);
  return { ...slide, _resolvedLayout: 'generic', _warnings: warnings };
}

/**
 * Resolves layouts for all slides in a presentation.
 */
export function resolveLayouts(
  slides: Slide[],
  capabilities: TemplateCapabilities,
): Slide[] {
  return slides.map((slide) => resolveSlideLayout(slide, capabilities));
}
