import { describe, it, expect } from 'vitest';
import type { Slide, Presentation } from '../../src/schema/presentation.js';
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

  it('"chart" on Tier 1 with table available → degrades to "table"', () => {
    const caps = makeTier1Capabilities(['table']);
    const slides: Slide[] = [{
      layout: 'chart',
      elements: [
        { type: 'title', text: 'Chart' },
        { type: 'chart', chartType: 'bar', data: { labels: ['A'], series: [{ name: 'S', values: [1] }] } },
      ],
    }];
    const result = resolveLayouts(slides, caps);
    expect(result[0]._resolvedLayout).toBe('table');
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

  it('truncates KPI indicators beyond 6', () => {
    const presentation: Presentation = {
      title: 'KPI Limit',
      slides: [{
        layout: 'kpi',
        elements: [
          { type: 'title', text: 'Too Many' },
          {
            type: 'kpi',
            indicators: Array.from({ length: 8 }, (_, i) => ({
              label: `M${i}`, value: `${i}`,
            })),
          },
        ],
      }],
    };

    const manifest = makeTier1Capabilities();
    const result = transformPresentation(presentation, manifest);
    const kpiEl = result.slides[0].elements.find(el => el.type === 'kpi');
    expect(kpiEl).toBeDefined();
    if (kpiEl?.type === 'kpi') {
      expect(kpiEl.indicators.length).toBeLessThanOrEqual(6);
    }
    expect(result.slides[0]._warnings?.some(w => w.includes('KPI'))).toBe(true);
  });

  it('truncates table rows beyond 8', () => {
    const presentation: Presentation = {
      title: 'Table Limit',
      slides: [{
        layout: 'table',
        elements: [
          { type: 'title', text: 'Big Table' },
          {
            type: 'table',
            headers: ['A', 'B'],
            rows: Array.from({ length: 12 }, (_, i) => [`r${i}`, `v${i}`]),
          },
        ],
      }],
    };

    const manifest = makeTier1Capabilities();
    const result = transformPresentation(presentation, manifest);
    const tableEl = result.slides[0].elements.find(el => el.type === 'table');
    expect(tableEl).toBeDefined();
    if (tableEl?.type === 'table') {
      expect(tableEl.rows.length).toBeLessThanOrEqual(8);
    }
    expect(result.slides[0]._warnings?.some(w => w.includes('Table'))).toBe(true);
  });

  it('truncates chart series beyond 4', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      elements: [
        { type: 'title', text: 'Chart' },
        {
          type: 'chart',
          chartType: 'bar',
          data: {
            labels: ['A', 'B'],
            series: [
              { name: 'S1', values: [1, 2] },
              { name: 'S2', values: [3, 4] },
              { name: 'S3', values: [5, 6] },
              { name: 'S4', values: [7, 8] },
              { name: 'S5', values: [9, 10] },
            ],
          },
        },
      ],
    }];
    const result = validateContent(slides);
    const chartEl = result[0].elements.find(el => el.type === 'chart');
    expect(chartEl).toBeDefined();
    if (chartEl?.type === 'chart') {
      expect(chartEl.data.series).toHaveLength(4);
    }
    expect(result[0]._warnings?.some(w => w.includes('series truncated'))).toBe(true);
  });

  it('truncates chart categories beyond 8', () => {
    const labels = Array.from({ length: 12 }, (_, i) => `Cat${i}`);
    const slides: Slide[] = [{
      layout: 'chart',
      elements: [
        { type: 'title', text: 'Chart' },
        {
          type: 'chart',
          chartType: 'line',
          data: {
            labels,
            series: [{ name: 'S1', values: Array.from({ length: 12 }, (_, i) => i) }],
          },
        },
      ],
    }];
    const result = validateContent(slides);
    const chartEl = result[0].elements.find(el => el.type === 'chart');
    if (chartEl?.type === 'chart') {
      expect(chartEl.data.labels).toHaveLength(8);
      expect(chartEl.data.series[0].values).toHaveLength(8);
    }
    expect(result[0]._warnings?.some(w => w.includes('categories truncated'))).toBe(true);
  });

  it('reduces pie chart to single series', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      elements: [
        { type: 'title', text: 'Pie' },
        {
          type: 'chart',
          chartType: 'pie',
          data: {
            labels: ['A', 'B'],
            series: [
              { name: 'S1', values: [60, 40] },
              { name: 'S2', values: [30, 70] },
            ],
          },
        },
      ],
    }];
    const result = validateContent(slides);
    const chartEl = result[0].elements.find(el => el.type === 'chart');
    if (chartEl?.type === 'chart') {
      expect(chartEl.data.series).toHaveLength(1);
      expect(chartEl.data.series[0].name).toBe('S1');
    }
    expect(result[0]._warnings?.some(w => w.includes('single series'))).toBe(true);
  });

  it('pads short values array with zeros', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      elements: [
        { type: 'title', text: 'Chart' },
        {
          type: 'chart',
          chartType: 'bar',
          data: {
            labels: ['A', 'B', 'C'],
            series: [{ name: 'S1', values: [1] }],
          },
        },
      ],
    }];
    const result = validateContent(slides);
    const chartEl = result[0].elements.find(el => el.type === 'chart');
    if (chartEl?.type === 'chart') {
      expect(chartEl.data.series[0].values).toEqual([1, 0, 0]);
    }
  });

  it('truncates table columns beyond 6', () => {
    const presentation: Presentation = {
      title: 'Wide Table',
      slides: [{
        layout: 'table',
        elements: [
          { type: 'title', text: 'Too Wide' },
          {
            type: 'table',
            headers: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
            rows: [['1', '2', '3', '4', '5', '6', '7', '8']],
          },
        ],
      }],
    };

    const manifest = makeTier1Capabilities();
    const result = transformPresentation(presentation, manifest);
    const tableEl = result.slides[0].elements.find(el => el.type === 'table');
    expect(tableEl).toBeDefined();
    if (tableEl?.type === 'table') {
      expect(tableEl.headers.length).toBeLessThanOrEqual(6);
      expect(tableEl.rows[0].length).toBeLessThanOrEqual(6);
    }
    expect(result.slides[0]._warnings?.some(w => w.includes('Table'))).toBe(true);
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

  it('chart → table degradation converts elements', () => {
    const caps = makeTier1Capabilities(['table']);
    const presentation: Presentation = {
      title: 'Chart Degrade Test',
      slides: [{
        layout: 'chart',
        elements: [
          { type: 'title', text: 'Revenue' },
          {
            type: 'chart', chartType: 'bar',
            data: { labels: ['Q1', 'Q2'], series: [{ name: 'Sales', values: [100, 200] }] },
          },
        ],
      }],
    };
    const result = transformPresentation(presentation, caps);
    expect(result.slides[0]._resolvedLayout).toBe('table');
    const tableEl = result.slides[0].elements.find(el => el.type === 'table');
    expect(tableEl).toBeDefined();
    if (tableEl?.type === 'table') {
      expect(tableEl.headers).toEqual(['', 'Sales']);
      expect(tableEl.rows).toEqual([['Q1', '100'], ['Q2', '200']]);
    }
  });
});
