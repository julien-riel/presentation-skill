import type { TemplateInfo } from './types.js';
import type { TemplateCapabilities } from '../schema/capabilities.js';
import type { LayoutType } from '../schema/presentation.js';
import {
  LAYOUT_PPT_NAME_TO_TYPE,
  ALL_LAYOUT_TYPES,
  TIER1_LAYOUTS,
  TIER2_LAYOUTS,
  FALLBACK_CASCADES,
} from './types.js';

/**
 * Returns layout type names supported by the template.
 */
export function getSupportedLayoutTypes(template: TemplateInfo): string[] {
  return template.layouts
    .map(l => LAYOUT_PPT_NAME_TO_TYPE[l.name])
    .filter((t): t is string => !!t);
}

/**
 * Computes the tier level of the template.
 * Tier 1: title, section, bullets, generic
 * Tier 2: Tier 1 + twoColumns, timeline
 * Tier 3: Tier 2 + architecture + all V2/V3 layouts
 */
export function computeTier(supportedTypes: string[]): number {
  const hasTier1 = TIER1_LAYOUTS.every(t => supportedTypes.includes(t));
  if (!hasTier1) return 1;

  const hasTier2 = TIER2_LAYOUTS.every(t => supportedTypes.includes(t));
  if (!hasTier2) return 1;

  const hasTier3 = ALL_LAYOUT_TYPES.every(t => supportedTypes.includes(t));
  if (hasTier3) return 3;

  return 2;
}

/**
 * Computes the fallback map for unsupported layouts.
 * Each unsupported layout is mapped to the first supported layout in its cascade.
 */
export function computeFallbackMap(supportedTypes: string[]): Record<string, string> {
  const fallbackMap: Record<string, string> = {};

  for (const [layout, cascade] of Object.entries(FALLBACK_CASCADES)) {
    if (supportedTypes.includes(layout)) continue;
    const resolved = cascade.find(t => supportedTypes.includes(t));
    if (resolved) {
      fallbackMap[layout] = resolved;
    }
  }

  return fallbackMap;
}

/**
 * Extracts placeholder map from the template for the manifest.
 */
function extractPlaceholderMap(template: TemplateInfo): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};

  for (const layout of template.layouts) {
    if (!LAYOUT_PPT_NAME_TO_TYPE[layout.name]) continue;
    const phMap: Record<string, number> = {};
    for (const ph of layout.placeholders) {
      const label = ph.type.toUpperCase();
      phMap[label] = ph.index;
    }
    if (Object.keys(phMap).length > 0) {
      map[layout.name] = phMap;
    }
  }

  return map;
}

/**
 * Generates the template-capabilities.json manifest.
 */
export function generateManifest(template: TemplateInfo, templateName: string): TemplateCapabilities {
  const supportedTypes = getSupportedLayoutTypes(template);
  const unsupportedTypes = ALL_LAYOUT_TYPES.filter(t => !supportedTypes.includes(t));
  const tier = computeTier(supportedTypes);
  const fallbackMap = computeFallbackMap(supportedTypes);
  const placeholders = extractPlaceholderMap(template);

  return {
    template: templateName,
    generated_at: new Date().toISOString(),
    validator_version: '1.0.0',
    tier,
    supported_layouts: supportedTypes as LayoutType[],
    unsupported_layouts: unsupportedTypes as LayoutType[],
    fallback_map: fallbackMap,
    placeholders,
    theme: {
      title_font: template.theme.titleFont,
      body_font: template.theme.bodyFont,
      accent_colors: [...template.theme.accentColors],
    },
    slide_dimensions: {
      width_emu: template.slideDimensions.widthEmu,
      height_emu: template.slideDimensions.heightEmu,
    },
  };
}
