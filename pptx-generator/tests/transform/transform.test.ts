import { describe, it, expect } from 'vitest';
import type { Slide } from '../../src/schema/presentation.js';
import { resolveLayouts } from '../../src/transform/layoutResolver.js';
import { validateContent } from '../../src/transform/contentValidator.js';
import { transformPresentation } from '../../src/transform/index.js';
import { makeTier1Capabilities } from '../helpers/capabilitiesHelpers.js';

// ─── Layout Resolver ────────────────────────────────────────────────────────

describe('layoutResolver', () => {
  it('"kpi" on Tier 1 → degrades to "bullets"', () => {
    const caps = makeTier1Capabilities();
    const slides: Slide[] = [{
      layout: 'kpi',
      elements: [{ type: 'kpi', indicators: [{ label: 'Rev', value: '1M' }] }],
    }];

    const result = resolveLayouts(slides, caps);
    expect(result[0]._resolvedLayout).toBe('bullets');
    expect(result[0]._warnings).toContain('Layout "kpi" degraded to "bullets"');
  });

  it('"roadmap" without timeline → cascade to "bullets"', () => {
    const caps = makeTier1Capabilities(); // no timeline
    const slides: Slide[] = [{
      layout: 'roadmap',
      elements: [{ type: 'title', text: 'Roadmap' }],
    }];

    const result = resolveLayouts(slides, caps);
    expect(result[0]._resolvedLayout).toBe('bullets');
    expect(result[0]._warnings).toContain('Layout "roadmap" degraded to "bullets"');
  });

  it('"roadmap" with timeline available → degrades to "timeline"', () => {
    const caps = makeTier1Capabilities(['timeline']);
    const slides: Slide[] = [{
      layout: 'roadmap',
      elements: [{ type: 'title', text: 'Roadmap' }],
    }];

    const result = resolveLayouts(slides, caps);
    expect(result[0]._resolvedLayout).toBe('timeline');
    expect(result[0]._warnings).toContain('Layout "roadmap" degraded to "timeline"');
  });

  it('supported layout is kept as-is', () => {
    const caps = makeTier1Capabilities();
    const slides: Slide[] = [{
      layout: 'bullets',
      elements: [{ type: 'title', text: 'Test' }],
    }];

    const result = resolveLayouts(slides, caps);
    expect(result[0]._resolvedLayout).toBe('bullets');
    expect(result[0]._warnings ?? []).toHaveLength(0);
  });
});

// ─── Content Validator ──────────────────────────────────────────────────────

describe('contentValidator', () => {
  it('truncates bullet with 20 words', () => {
    const longBullet = Array.from({ length: 20 }, (_, i) => `word${i}`).join(' ');
    const slides: Slide[] = [{
      layout: 'bullets',
      elements: [
        { type: 'title', text: 'Test' },
        { type: 'bullets', items: [longBullet] },
      ],
    }];

    const result = validateContent(slides);
    const bullets = result[0].elements.find((el) => el.type === 'bullets');
    expect(bullets).toBeDefined();
    if (bullets && bullets.type === 'bullets') {
      const words = bullets.items[0].replace('…', '').trim().split(/\s+/);
      expect(words.length).toBeLessThanOrEqual(12);
      expect(bullets.items[0]).toContain('…');
    }
  });

  it('splits 8 bullets into 2 slides', () => {
    const items = Array.from({ length: 8 }, (_, i) => `Bullet ${i + 1}`);
    const slides: Slide[] = [{
      layout: 'bullets',
      elements: [
        { type: 'title', text: 'Many Bullets' },
        { type: 'bullets', items },
      ],
    }];

    const result = validateContent(slides);
    expect(result).toHaveLength(2);
    expect(result[0]._splitIndex).toBe('(1/2)');
    expect(result[1]._splitIndex).toBe('(2/2)');

    const bullets0 = result[0].elements.find((el) => el.type === 'bullets');
    const bullets1 = result[1].elements.find((el) => el.type === 'bullets');
    expect(bullets0 && bullets0.type === 'bullets' && bullets0.items.length).toBe(5);
    expect(bullets1 && bullets1.type === 'bullets' && bullets1.items.length).toBe(3);
  });

  it('truncates title exceeding 60 chars', () => {
    const longTitle = 'A'.repeat(80);
    const slides: Slide[] = [{
      layout: 'bullets',
      elements: [
        { type: 'title', text: longTitle },
        { type: 'bullets', items: ['Item 1'] },
      ],
    }];

    const result = validateContent(slides);
    const titleEl = result[0].elements.find((el) => el.type === 'title');
    expect(titleEl && titleEl.type === 'title' && titleEl.text.length).toBeLessThanOrEqual(60);
    expect(titleEl && titleEl.type === 'title' && titleEl.text).toContain('…');
  });

  it('does not modify content within limits', () => {
    const slides: Slide[] = [{
      layout: 'bullets',
      elements: [
        { type: 'title', text: 'Short' },
        { type: 'bullets', items: ['One', 'Two', 'Three'] },
      ],
    }];

    const result = validateContent(slides);
    expect(result).toHaveLength(1);
    const bullets = result[0].elements.find((el) => el.type === 'bullets');
    expect(bullets && bullets.type === 'bullets' && bullets.items).toEqual(['One', 'Two', 'Three']);
  });
});

// ─── Full Pipeline ──────────────────────────────────────────────────────────

describe('transformPresentation (full pipeline)', () => {
  it('resolves layout and validates content', () => {
    const caps = makeTier1Capabilities();
    const longBullet = Array.from({ length: 15 }, (_, i) => `word${i}`).join(' ');

    const presentation = {
      title: 'Integration Test',
      slides: [
        {
          layout: 'title' as const,
          elements: [
            { type: 'title' as const, text: 'Welcome' },
            { type: 'subtitle' as const, text: 'Test presentation' },
          ],
        },
        {
          layout: 'kpi' as const,
          elements: [
            { type: 'title' as const, text: 'KPI Slide' },
            { type: 'kpi' as const, indicators: [{ label: 'Rev', value: '1M' }] },
          ],
        },
        {
          layout: 'bullets' as const,
          elements: [
            { type: 'title' as const, text: 'Content' },
            { type: 'bullets' as const, items: [longBullet, 'Short', 'Another', 'Fourth'] },
          ],
        },
      ],
    };

    const result = transformPresentation(presentation, caps);

    // Slide 1: title stays as title
    expect(result.slides[0]._resolvedLayout).toBe('title');

    // Slide 2: kpi → bullets degradation
    expect(result.slides[1]._resolvedLayout).toBe('bullets');
    expect(result.slides[1]._warnings).toContain('Layout "kpi" degraded to "bullets"');

    // Slide 3: long bullet truncated
    const contentSlide = result.slides[2];
    const bullets = contentSlide.elements.find((el) => el.type === 'bullets');
    expect(bullets && bullets.type === 'bullets' && bullets.items[0]).toContain('…');
  });
});
