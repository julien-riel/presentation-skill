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

  it('degrades KPI to bullets on Tier 1 (8 indicators → split bullets)', () => {
    const presentation: Presentation = {
      title: 'KPI Limit',
      locale: 'en-US',
      showSlideNumbers: false,
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
    // KPI degraded to bullets — 8 items > MAX_BULLETS(5) → split into 2 slides
    expect(result.slides.length).toBeGreaterThanOrEqual(2);
    const bulletsEl = result.slides[0].elements.find(el => el.type === 'bullets');
    expect(bulletsEl).toBeDefined();
    if (bulletsEl?.type === 'bullets') {
      expect(bulletsEl.items.length).toBeLessThanOrEqual(5);
    }
  });

  it('truncates KPI indicators beyond 6 when kpi layout is supported', () => {
    const presentation: Presentation = {
      title: 'KPI Limit',
      locale: 'en-US',
      showSlideNumbers: false,
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

    const manifest = makeTier1Capabilities(['kpi']);
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
      locale: 'en-US',
      showSlideNumbers: false,
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

  it('reduces donut chart to single series', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      elements: [
        { type: 'title', text: 'Donut' },
        {
          type: 'chart',
          chartType: 'donut',
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
    }
    expect(result[0]._warnings?.some(w => w.includes('donut'))).toBe(true);
  });

  it('trims values longer than labels', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      elements: [
        { type: 'title', text: 'Chart' },
        {
          type: 'chart',
          chartType: 'bar',
          data: {
            labels: ['A', 'B'],
            series: [{ name: 'S1', values: [1, 2, 3, 4] }],
          },
        },
      ],
    }];
    const result = validateContent(slides);
    const chartEl = result[0].elements.find(el => el.type === 'chart');
    if (chartEl?.type === 'chart') {
      expect(chartEl.data.series[0].values).toEqual([1, 2]);
    }
  });

  it('keeps only first chart when multiple chart elements on same slide', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      elements: [
        { type: 'title', text: 'Multi' },
        {
          type: 'chart', chartType: 'bar',
          data: { labels: ['A'], series: [{ name: 'First', values: [1] }] },
        },
        {
          type: 'chart', chartType: 'pie',
          data: { labels: ['A'], series: [{ name: 'Second', values: [2] }] },
        },
      ],
    }];
    const result = validateContent(slides);
    const charts = result[0].elements.filter(el => el.type === 'chart');
    expect(charts).toHaveLength(1);
    if (charts[0]?.type === 'chart') {
      expect(charts[0].data.series[0].name).toBe('First');
    }
    expect(result[0]._warnings?.some(w => w.includes('Multiple chart'))).toBe(true);
  });

  it('replaces NaN/Infinity values with 0', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      elements: [
        { type: 'title', text: 'Chart' },
        {
          type: 'chart',
          chartType: 'bar',
          data: {
            labels: ['A', 'B', 'C'],
            series: [{ name: 'S1', values: [NaN, Infinity, 42] }],
          },
        },
      ],
    }];
    const result = validateContent(slides);
    const chartEl = result[0].elements.find(el => el.type === 'chart');
    if (chartEl?.type === 'chart') {
      expect(chartEl.data.series[0].values).toEqual([0, 0, 42]);
    }
    expect(result[0]._warnings?.some(w => w.includes('Non-finite'))).toBe(true);
  });

  it('truncates diagram with 10 nodes to 8 and drops orphaned edges', () => {
    const nodes = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` }));
    const edges = [
      { from: 'n0', to: 'n1' },
      { from: 'n1', to: 'n5' },
      { from: 'n7', to: 'n9' },   // n9 will be removed
      { from: 'n8', to: 'n3' },   // n8 will be removed
      { from: 'n2', to: 'n4' },
    ];
    const slides: Slide[] = [{
      layout: 'architecture',
      elements: [
        { type: 'title', text: 'Diagram' },
        { type: 'diagram', nodes, edges },
      ],
    }];
    const result = validateContent(slides);
    const diagramEl = result[0].elements.find(el => el.type === 'diagram');
    expect(diagramEl).toBeDefined();
    if (diagramEl?.type === 'diagram') {
      expect(diagramEl.nodes).toHaveLength(8);
      // edges referencing n8 or n9 should be removed
      expect(diagramEl.edges).toHaveLength(3);
      expect(diagramEl.edges.every(e => !['n8', 'n9'].includes(e.from) && !['n8', 'n9'].includes(e.to))).toBe(true);
    }
    expect(result[0]._warnings?.some(w => w.includes('Diagram nodes truncated'))).toBe(true);
  });

  it('does not truncate diagram with exactly 8 nodes', () => {
    const nodes = Array.from({ length: 8 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` }));
    const edges = [{ from: 'n0', to: 'n7' }];
    const slides: Slide[] = [{
      layout: 'architecture',
      elements: [
        { type: 'title', text: 'Diagram' },
        { type: 'diagram', nodes, edges },
      ],
    }];
    const result = validateContent(slides);
    const diagramEl = result[0].elements.find(el => el.type === 'diagram');
    if (diagramEl?.type === 'diagram') {
      expect(diagramEl.nodes).toHaveLength(8);
      expect(diagramEl.edges).toHaveLength(1);
    }
    expect(result[0]._warnings?.some(w => w.includes('Diagram'))).toBeFalsy();
  });

  it('truncates timeline with 8 events to 6', () => {
    const events = Array.from({ length: 8 }, (_, i) => ({ date: `2024-0${i + 1}`, label: `Event ${i}` }));
    const slides: Slide[] = [{
      layout: 'timeline',
      elements: [
        { type: 'title', text: 'Timeline' },
        { type: 'timeline', events },
      ],
    }];
    const result = validateContent(slides);
    const timelineEl = result[0].elements.find(el => el.type === 'timeline');
    expect(timelineEl).toBeDefined();
    if (timelineEl?.type === 'timeline') {
      expect(timelineEl.events).toHaveLength(6);
    }
    expect(result[0]._warnings?.some(w => w.includes('Timeline events truncated'))).toBe(true);
  });

  it('does not truncate timeline with exactly 6 events', () => {
    const events = Array.from({ length: 6 }, (_, i) => ({ date: `2024-0${i + 1}`, label: `Event ${i}` }));
    const slides: Slide[] = [{
      layout: 'timeline',
      elements: [
        { type: 'title', text: 'Timeline' },
        { type: 'timeline', events },
      ],
    }];
    const result = validateContent(slides);
    const timelineEl = result[0].elements.find(el => el.type === 'timeline');
    if (timelineEl?.type === 'timeline') {
      expect(timelineEl.events).toHaveLength(6);
    }
    expect(result[0]._warnings?.some(w => w.includes('Timeline'))).toBeFalsy();
  });

  it('truncates table columns beyond 6', () => {
    const presentation: Presentation = {
      title: 'Wide Table',
      locale: 'en-US',
      showSlideNumbers: false,
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
      locale: 'en-US' as const,
      showSlideNumbers: false,
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
      locale: 'en-US',
      showSlideNumbers: false,
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
