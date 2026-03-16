import { describe, it, expect } from 'vitest';
import type { Slide } from '../../src/schema/presentation.js';
import { degradeElements } from '../../src/transform/elementDegrader.js';

describe('degradeElements', () => {
  it('converts chart to table when _resolvedLayout is table', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      _resolvedLayout: 'table',
      elements: [
        { type: 'title', text: 'Revenue' },
        {
          type: 'chart', chartType: 'bar',
          data: {
            labels: ['Q1', 'Q2', 'Q3'],
            series: [
              { name: 'Sales', values: [100, 200, 150] },
              { name: 'Costs', values: [80, 120, 110] },
            ],
          },
        },
      ],
    }];
    const result = degradeElements(slides);
    const tableEl = result[0].elements.find(el => el.type === 'table');
    expect(tableEl).toBeDefined();
    if (tableEl?.type === 'table') {
      expect(tableEl.headers).toEqual(['', 'Sales', 'Costs']);
      expect(tableEl.rows).toEqual([['Q1', '100', '80'], ['Q2', '200', '120'], ['Q3', '150', '110']]);
    }
    expect(result[0].elements.find(el => el.type === 'title')).toBeDefined();
    expect(result[0].elements.find(el => el.type === 'chart')).toBeUndefined();
  });

  it('converts chart to bullets when _resolvedLayout is bullets', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      _resolvedLayout: 'bullets',
      elements: [
        { type: 'title', text: 'Revenue' },
        {
          type: 'chart', chartType: 'bar',
          data: {
            labels: ['Q1', 'Q2'],
            series: [
              { name: 'Sales', values: [100, 200] },
              { name: 'Costs', values: [80, 120] },
            ],
          },
        },
      ],
    }];
    const result = degradeElements(slides);
    const bulletsEl = result[0].elements.find(el => el.type === 'bullets');
    expect(bulletsEl).toBeDefined();
    if (bulletsEl?.type === 'bullets') {
      expect(bulletsEl.items).toEqual(['Q1 — Sales: 100, Costs: 80', 'Q2 — Sales: 200, Costs: 120']);
    }
    expect(result[0].elements.find(el => el.type === 'chart')).toBeUndefined();
  });

  it('does not modify slides where resolved is chart', () => {
    const slides: Slide[] = [{
      layout: 'chart', _resolvedLayout: 'chart',
      elements: [
        { type: 'title', text: 'Revenue' },
        { type: 'chart', chartType: 'bar', data: { labels: ['Q1'], series: [{ name: 'S', values: [1] }] } },
      ],
    }];
    const result = degradeElements(slides);
    expect(result[0].elements.find(el => el.type === 'chart')).toBeDefined();
  });

  it('does not modify non-chart slides', () => {
    const slides: Slide[] = [{
      layout: 'bullets', _resolvedLayout: 'bullets',
      elements: [{ type: 'title', text: 'Test' }, { type: 'bullets', items: ['A', 'B'] }],
    }];
    const result = degradeElements(slides);
    expect(result).toEqual(slides);
  });
});
