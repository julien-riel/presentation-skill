import { describe, it, expect } from 'vitest';
import {
  generateManifest,
  computeTier,
  computeFallbackMap,
  getSupportedLayoutTypes,
} from '../../src/validator/manifestGenerator.js';
import { makeTier1Template, makeTier2Template } from './helpers.js';

describe('getSupportedLayoutTypes', () => {
  it('returns layout types for Tier 1 template', () => {
    const types = getSupportedLayoutTypes(makeTier1Template());
    expect(types).toContain('title');
    expect(types).toContain('section');
    expect(types).toContain('bullets');
    expect(types).toContain('generic');
    expect(types).not.toContain('twoColumns');
  });

  it('returns layout types for Tier 2 template', () => {
    const types = getSupportedLayoutTypes(makeTier2Template());
    expect(types).toContain('twoColumns');
    expect(types).toContain('timeline');
  });
});

describe('computeTier', () => {
  it('returns 1 for Tier 1 layouts', () => {
    expect(computeTier(['title', 'section', 'bullets', 'generic'])).toBe(1);
  });

  it('returns 2 for Tier 2 layouts', () => {
    expect(computeTier(['title', 'section', 'bullets', 'generic', 'twoColumns', 'timeline'])).toBe(2);
  });

  it('returns 3 for all layouts', () => {
    const all = [
      'title', 'section', 'bullets', 'twoColumns', 'timeline', 'architecture', 'generic',
      'chart', 'table', 'kpi', 'quote', 'imageText', 'roadmap', 'process', 'comparison',
    ];
    expect(computeTier(all)).toBe(3);
  });

  it('returns 0 when Tier 1 is incomplete', () => {
    expect(computeTier(['title', 'section'])).toBe(0);
  });

  it('returns 0 for empty layout list', () => {
    expect(computeTier([])).toBe(0);
  });

  it('returns 1 for Tier 1 + partial Tier 2', () => {
    expect(computeTier(['title', 'section', 'bullets', 'generic', 'twoColumns'])).toBe(1);
  });
});

describe('computeFallbackMap', () => {
  it('maps unsupported layouts to supported fallbacks for Tier 1', () => {
    const supported = ['title', 'section', 'bullets', 'generic'];
    const map = computeFallbackMap(supported);
    expect(map['kpi']).toBe('bullets');
    expect(map['chart']).toBe('bullets');
    expect(map['architecture']).toBe('bullets');
    expect(map['imageText']).toBe('bullets'); // twoColumns absent, falls to bullets
    expect(map['roadmap']).toBe('bullets'); // timeline absent, falls to bullets
    expect(map['comparison']).toBe('bullets'); // twoColumns absent, falls to bullets
  });

  it('maps unsupported layouts to correct fallbacks for Tier 2', () => {
    const supported = ['title', 'section', 'bullets', 'generic', 'twoColumns', 'timeline'];
    const map = computeFallbackMap(supported);
    expect(map['imageText']).toBe('twoColumns');
    expect(map['roadmap']).toBe('timeline');
    expect(map['comparison']).toBe('twoColumns');
    expect(map['kpi']).toBe('bullets');
  });

  it('does not include supported layouts in map', () => {
    const supported = ['title', 'section', 'bullets', 'generic'];
    const map = computeFallbackMap(supported);
    expect(map['title']).toBeUndefined();
    expect(map['bullets']).toBeUndefined();
  });
});

describe('generateManifest', () => {
  it('generates valid manifest for Tier 1 template', () => {
    const manifest = generateManifest(makeTier1Template(), 'test.pptx');
    expect(manifest.template).toBe('test.pptx');
    expect(manifest.tier).toBe(1);
    expect(manifest.supported_layouts).toContain('title');
    expect(manifest.supported_layouts).toContain('generic');
    expect(manifest.unsupported_layouts).toContain('twoColumns');
    expect(manifest.fallback_map).toBeDefined();
    expect(manifest.theme.title_font).toBe('Calibri');
    expect(manifest.slide_dimensions.width_emu).toBe(12192000);
  });

  it('generates valid manifest for Tier 2 template', () => {
    const manifest = generateManifest(makeTier2Template(), 'test2.pptx');
    expect(manifest.tier).toBe(2);
    expect(manifest.supported_layouts).toContain('twoColumns');
    expect(manifest.supported_layouts).toContain('timeline');
    expect(manifest.fallback_map['imageText']).toBe('twoColumns');
    expect(manifest.fallback_map['roadmap']).toBe('timeline');
  });

  it('includes generated_at and validator_version', () => {
    const manifest = generateManifest(makeTier1Template(), 'test.pptx');
    expect(manifest.generated_at).toBeDefined();
    expect(manifest.validator_version).toBe('1.0.0');
  });

  it('preserves all placeholders for TWO_COLUMNS (no key collision)', () => {
    const manifest = generateManifest(makeTier2Template(), 'test.pptx');
    const tcPh = manifest.placeholders['LAYOUT_TWO_COLUMNS'];
    expect(tcPh).toBeDefined();
    // Both body placeholders (index 1 and 2) must be present with indexed keys
    const values = Object.values(tcPh);
    expect(values).toContain(1);
    expect(values).toContain(2);
    // Title placeholder at index 0 must also be present
    expect(values).toContain(0);
  });
});
