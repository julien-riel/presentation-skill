import { describe, it, expect } from 'vitest';
import { TemplateCapabilitiesSchema } from '../../src/schema/capabilities.js';

describe('TemplateCapabilitiesSchema', () => {
  const validManifest = {
    template: 'executive-template.pptx',
    generated_at: '2026-03-14T10:30:00Z',
    validator_version: '1.0.0',
    tier: 2,
    supported_layouts: ['title', 'section', 'bullets', 'twoColumns', 'timeline', 'generic'],
    unsupported_layouts: ['architecture', 'chart', 'table', 'kpi', 'quote', 'imageText', 'roadmap', 'process', 'comparison'],
    fallback_map: {
      architecture: 'bullets',
      kpi: 'bullets',
      chart: 'bullets',
      table: 'bullets',
      quote: 'bullets',
      imageText: 'twoColumns',
      roadmap: 'timeline',
      process: 'timeline',
      comparison: 'twoColumns',
    },
    placeholders: {
      LAYOUT_TITLE: { TITLE: 0, SUBTITLE: 1 },
      LAYOUT_SECTION: { TITLE: 0, SUBTITLE: 1 },
      LAYOUT_BULLETS: { TITLE: 0, BODY: 1 },
      LAYOUT_TWO_COLUMNS: { TITLE: 0, LEFT_BODY: 1, RIGHT_BODY: 2 },
      LAYOUT_TIMELINE: { TITLE: 0, TIMELINE_CANVAS: 1 },
      LAYOUT_GENERIC: { TITLE: 0, BODY: 1 },
    },
    theme: {
      title_font: 'Montserrat',
      body_font: 'Calibri',
      accent_colors: ['#1E3A5F', '#2C7DA0', '#E76F51'],
    },
    slide_dimensions: {
      width_emu: 12192000,
      height_emu: 6858000,
    },
  };

  it('accepts a valid Tier 2 manifest', () => {
    const result = TemplateCapabilitiesSchema.parse(validManifest);
    expect(result.tier).toBe(2);
    expect(result.supported_layouts).toContain('title');
    expect(result.template).toBe('executive-template.pptx');
  });

  it('accepts a minimal Tier 1 manifest', () => {
    const tier1 = {
      ...validManifest,
      tier: 1,
      supported_layouts: ['title', 'section', 'bullets', 'generic'],
      unsupported_layouts: ['twoColumns', 'timeline', 'architecture', 'chart', 'table', 'kpi', 'quote', 'imageText', 'roadmap', 'process', 'comparison'],
    };
    expect(TemplateCapabilitiesSchema.parse(tier1).tier).toBe(1);
  });

  it('rejects a manifest without template name', () => {
    const { template: _, ...noTemplate } = validManifest;
    expect(() => TemplateCapabilitiesSchema.parse(noTemplate)).toThrow();
  });

  it('rejects a manifest with invalid tier', () => {
    expect(() => TemplateCapabilitiesSchema.parse({ ...validManifest, tier: 0 })).toThrow();
    expect(() => TemplateCapabilitiesSchema.parse({ ...validManifest, tier: 4 })).toThrow();
  });

  it('rejects a manifest with invalid layout in supported_layouts', () => {
    expect(() => TemplateCapabilitiesSchema.parse({
      ...validManifest,
      supported_layouts: ['title', 'invalid_layout'],
    })).toThrow();
  });

  it('rejects a manifest without theme', () => {
    const { theme: _, ...noTheme } = validManifest;
    expect(() => TemplateCapabilitiesSchema.parse(noTheme)).toThrow();
  });

  it('rejects a manifest without slide_dimensions', () => {
    const { slide_dimensions: _, ...noDims } = validManifest;
    expect(() => TemplateCapabilitiesSchema.parse(noDims)).toThrow();
  });

  it('rejects a manifest with missing required fields', () => {
    expect(() => TemplateCapabilitiesSchema.parse({})).toThrow();
    expect(() => TemplateCapabilitiesSchema.parse({ template: 'x' })).toThrow();
  });
});
