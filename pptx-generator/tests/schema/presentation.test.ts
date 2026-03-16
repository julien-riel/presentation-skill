import { describe, it, expect } from 'vitest';
import {
  PresentationSchema,
  SlideSchema,
  ElementSchema,
  LayoutTypeSchema,
} from '../../src/schema/presentation.js';

describe('LayoutTypeSchema', () => {
  it('accepts all valid V1 layout types', () => {
    const v1Layouts = ['title', 'section', 'bullets', 'twoColumns', 'timeline', 'architecture', 'generic'];
    for (const layout of v1Layouts) {
      expect(LayoutTypeSchema.parse(layout)).toBe(layout);
    }
  });

  it('accepts V2+ layout types', () => {
    const v2Layouts = ['chart', 'table', 'kpi', 'quote', 'imageText', 'roadmap', 'process', 'comparison'];
    for (const layout of v2Layouts) {
      expect(LayoutTypeSchema.parse(layout)).toBe(layout);
    }
  });

  it('rejects unknown layout types', () => {
    expect(() => LayoutTypeSchema.parse('unknown')).toThrow();
    expect(() => LayoutTypeSchema.parse('')).toThrow();
    expect(() => LayoutTypeSchema.parse(42)).toThrow();
  });
});

describe('ElementSchema', () => {
  it('accepts a title element', () => {
    const el = { type: 'title', text: 'Hello World' };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a subtitle element', () => {
    const el = { type: 'subtitle', text: 'Sub' };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a text element', () => {
    const el = { type: 'text', text: 'Some text' };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a bullets element with items', () => {
    const el = { type: 'bullets', items: ['a', 'b', 'c'] };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a bullets element with optional column and level', () => {
    const el = { type: 'bullets', items: ['a'], column: 'left', level: 2 };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a diagram element', () => {
    const el = {
      type: 'diagram',
      nodes: [{ id: 'n1', label: 'Node 1', layer: 'frontend' }],
      edges: [{ from: 'n1', to: 'n2', style: 'dashed' }],
    };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a timeline element', () => {
    const el = {
      type: 'timeline',
      events: [
        { date: '2026-01', label: 'Launch', status: 'done' },
        { date: '2026-06', label: 'V2', status: 'planned' },
      ],
    };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a chart element', () => {
    const el = {
      type: 'chart',
      chartType: 'bar',
      data: {
        labels: ['Q1', 'Q2'],
        series: [{ name: 'Revenue', values: [100, 200] }],
      },
    };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a table element', () => {
    const el = {
      type: 'table',
      headers: ['Name', 'Score'],
      rows: [['Alice', '95'], ['Bob', '88']],
    };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a kpi element', () => {
    const el = {
      type: 'kpi',
      indicators: [
        { label: 'Revenue', value: '1.2M', unit: '$', trend: 'up' },
      ],
    };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a quote element', () => {
    const el = { type: 'quote', text: 'To be or not to be', author: 'Shakespeare' };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a bullets element with icons array', () => {
    const el = { type: 'bullets', items: ['a', 'b'], icons: ['check', 'clock'] };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a bullets element without icons (backward compat)', () => {
    const el = { type: 'bullets', items: ['a', 'b'] };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a timeline event with icon', () => {
    const el = {
      type: 'timeline',
      events: [{ date: '2026-01', label: 'Launch', status: 'done', icon: 'rocket' }],
    };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a kpi element with icon on indicator', () => {
    const el = {
      type: 'kpi',
      indicators: [{ label: 'Revenue', value: '1.2M', icon: 'trending-up' }],
    };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a quote element with icon', () => {
    const el = { type: 'quote', text: 'To be', icon: 'quote' };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('rejects an element with unknown type', () => {
    expect(() => ElementSchema.parse({ type: 'unknown', text: 'x' })).toThrow();
  });

  it('rejects a bullets element without items', () => {
    expect(() => ElementSchema.parse({ type: 'bullets' })).toThrow();
  });

  it('rejects a title element without text', () => {
    expect(() => ElementSchema.parse({ type: 'title' })).toThrow();
  });

  it('accepts a chart element with stackedBar type', () => {
    const el = {
      type: 'chart',
      chartType: 'stackedBar',
      data: {
        labels: ['Q1', 'Q2'],
        series: [{ name: 'Revenue', values: [100, 200] }],
      },
    };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a chart element with options', () => {
    const el = {
      type: 'chart',
      chartType: 'bar',
      data: {
        labels: ['Q1', 'Q2'],
        series: [{ name: 'Revenue', values: [100, 200] }],
      },
      options: {
        title: 'Revenue by Quarter',
        xAxisLabel: 'Quarter',
        yAxisLabel: 'Amount',
        yAxisMin: 0,
        yAxisMax: 300,
        valueFormat: 'currency',
        currencySymbol: '$',
        showDataLabels: true,
        showLegend: true,
        legendPosition: 'bottom',
        colors: ['1E3A5F', '2C7DA0'],
        gridLines: true,
      },
    };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts a chart element without options (backward compat)', () => {
    const el = {
      type: 'chart',
      chartType: 'pie',
      data: {
        labels: ['A', 'B'],
        series: [{ name: 'Share', values: [60, 40] }],
      },
    };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('rejects chart with invalid hex color in options', () => {
    const el = {
      type: 'chart',
      chartType: 'bar',
      data: { labels: ['A'], series: [{ name: 'X', values: [1] }] },
      options: { colors: ['#FF0000'] },
    };
    expect(() => ElementSchema.parse(el)).toThrow();
  });

  it('rejects chart with unknown chartType', () => {
    const el = {
      type: 'chart',
      chartType: 'radar',
      data: { labels: ['A'], series: [{ name: 'X', values: [1] }] },
    };
    expect(() => ElementSchema.parse(el)).toThrow();
  });
});

describe('SlideSchema', () => {
  it('accepts a valid slide with layout and elements', () => {
    const slide = {
      layout: 'title',
      elements: [
        { type: 'title', text: 'My Presentation' },
        { type: 'subtitle', text: 'A journey' },
      ],
    };
    expect(SlideSchema.parse(slide)).toEqual(slide);
  });

  it('accepts a slide with optional notes', () => {
    const slide = {
      layout: 'bullets',
      elements: [{ type: 'title', text: 'Agenda' }],
      notes: 'Speaker notes here',
    };
    expect(SlideSchema.parse(slide)).toEqual(slide);
  });

  it('accepts a slide with transform annotations', () => {
    const slide = {
      layout: 'kpi',
      elements: [{ type: 'kpi', indicators: [{ label: 'X', value: '42' }] }],
      _resolvedLayout: 'bullets',
      _splitIndex: '(1/2)',
      _warnings: ['kpi degraded to bullets'],
    };
    expect(SlideSchema.parse(slide)).toEqual(slide);
  });

  it('rejects a slide without layout', () => {
    expect(() => SlideSchema.parse({ elements: [] })).toThrow();
  });

  it('rejects a slide with invalid layout', () => {
    expect(() => SlideSchema.parse({ layout: 'invalid', elements: [] })).toThrow();
  });
});

describe('PresentationSchema', () => {
  it('accepts a minimal valid presentation', () => {
    const pres = {
      title: 'Test',
      slides: [
        {
          layout: 'title',
          elements: [{ type: 'title', text: 'Hello' }],
        },
      ],
    };
    expect(PresentationSchema.parse(pres)).toEqual(pres);
  });

  it('accepts a full presentation with metadata and theme', () => {
    const pres = {
      title: 'Quarterly Review',
      metadata: {
        author: 'Alice',
        date: '2026-03-14',
        version: '1.0',
        audience: 'Board',
      },
      theme: 'executive',
      slides: [
        {
          layout: 'title',
          elements: [
            { type: 'title', text: 'Q1 2026 Review' },
            { type: 'subtitle', text: 'Board Presentation' },
          ],
        },
        {
          layout: 'bullets',
          elements: [
            { type: 'title', text: 'Highlights' },
            { type: 'bullets', items: ['Revenue up 15%', 'New markets opened', 'Team grew by 10'] },
          ],
        },
      ],
    };
    const result = PresentationSchema.parse(pres);
    expect(result.title).toBe('Quarterly Review');
    expect(result.slides).toHaveLength(2);
    expect(result.metadata?.author).toBe('Alice');
  });

  it('rejects a presentation without title', () => {
    expect(() => PresentationSchema.parse({ slides: [] })).toThrow();
  });

  it('rejects a presentation without slides', () => {
    expect(() => PresentationSchema.parse({ title: 'No slides' })).toThrow();
  });

  it('rejects a presentation with invalid slide', () => {
    expect(() => PresentationSchema.parse({
      title: 'Bad',
      slides: [{ layout: 'nonexistent', elements: [] }],
    })).toThrow();
  });
});
