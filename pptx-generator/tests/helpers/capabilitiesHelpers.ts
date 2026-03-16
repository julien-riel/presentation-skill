import type { TemplateCapabilities } from '../../src/schema/capabilities.js';

/**
 * Creates a minimal Tier 1 capabilities manifest for use in tests.
 */
export function makeTier1Capabilities(extra: string[] = []): TemplateCapabilities {
  const supported = ['title', 'section', 'bullets', 'generic', ...extra];
  return {
    template: 'test-template.pptx',
    generated_at: '2026-03-14T00:00:00Z',
    validator_version: '1.0.0',
    tier: 1,
    supported_layouts: supported as TemplateCapabilities['supported_layouts'],
    unsupported_layouts: [],
    fallback_map: {
      kpi: 'bullets',
      chart: 'bullets',
      table: 'bullets',
      quote: 'bullets',
      architecture: 'bullets',
      imageText: 'twoColumns',
      roadmap: 'timeline',
      process: 'timeline',
      comparison: 'twoColumns',
    },
    placeholders: {},
    theme: { title_font: 'Calibri Light', body_font: 'Calibri', accent_colors: ['#1B2A4A', '#2D7DD2', '#17A2B8'] },
    slide_dimensions: { width_emu: 12192000, height_emu: 6858000 },
  };
}

/**
 * Creates a Tier 2 capabilities manifest (Tier 1 + twoColumns + timeline).
 */
export function makeTier2Capabilities(): TemplateCapabilities {
  return {
    ...makeTier1Capabilities(['twoColumns', 'timeline']),
    tier: 2,
    unsupported_layouts: [
      'architecture', 'chart', 'table', 'kpi', 'quote',
      'imageText', 'roadmap', 'process', 'comparison',
    ] as TemplateCapabilities['unsupported_layouts'],
  };
}
