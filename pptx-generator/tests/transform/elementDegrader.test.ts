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

  // --- kpiToBullets ---

  it('converts kpi to bullets when _resolvedLayout is bullets', () => {
    const slides: Slide[] = [{
      layout: 'kpi',
      _resolvedLayout: 'bullets',
      elements: [
        { type: 'title', text: 'Key Metrics' },
        {
          type: 'kpi',
          indicators: [
            { label: 'Revenue', value: '1.2M', unit: 'USD', trend: 'up' },
            { label: 'Users', value: '50K' },
          ],
        },
      ],
    }];
    const result = degradeElements(slides);
    const bulletsEl = result[0].elements.find(el => el.type === 'bullets');
    expect(bulletsEl).toBeDefined();
    if (bulletsEl?.type === 'bullets') {
      expect(bulletsEl.items).toEqual([
        'Revenue — 1.2M — USD — (up)',
        'Users — 50K',
      ]);
    }
    expect(result[0].elements.find(el => el.type === 'kpi')).toBeUndefined();
    expect(result[0].elements.find(el => el.type === 'title')).toBeDefined();
  });

  it('converts kpi to bullets with unit only (no trend)', () => {
    const slides: Slide[] = [{
      layout: 'kpi',
      _resolvedLayout: 'bullets',
      elements: [
        {
          type: 'kpi',
          indicators: [
            { label: 'Latency', value: '120', unit: 'ms' },
          ],
        },
      ],
    }];
    const result = degradeElements(slides);
    const bulletsEl = result[0].elements.find(el => el.type === 'bullets');
    expect(bulletsEl).toBeDefined();
    if (bulletsEl?.type === 'bullets') {
      expect(bulletsEl.items).toEqual(['Latency — 120 — ms']);
    }
  });

  it('converts kpi to bullets with trend only (no unit)', () => {
    const slides: Slide[] = [{
      layout: 'kpi',
      _resolvedLayout: 'bullets',
      elements: [
        {
          type: 'kpi',
          indicators: [
            { label: 'Score', value: '95', trend: 'stable' },
          ],
        },
      ],
    }];
    const result = degradeElements(slides);
    const bulletsEl = result[0].elements.find(el => el.type === 'bullets');
    expect(bulletsEl).toBeDefined();
    if (bulletsEl?.type === 'bullets') {
      expect(bulletsEl.items).toEqual(['Score — 95 — (stable)']);
    }
  });

  it('does not degrade kpi when _resolvedLayout is kpi', () => {
    const slides: Slide[] = [{
      layout: 'kpi',
      _resolvedLayout: 'kpi',
      elements: [
        {
          type: 'kpi',
          indicators: [{ label: 'Revenue', value: '1M' }],
        },
      ],
    }];
    const result = degradeElements(slides);
    expect(result[0].elements.find(el => el.type === 'kpi')).toBeDefined();
    expect(result[0].elements.find(el => el.type === 'bullets')).toBeUndefined();
  });

  // --- diagramToBullets ---

  it('converts diagram to bullets when _resolvedLayout is bullets', () => {
    const slides: Slide[] = [{
      layout: 'architecture',
      _resolvedLayout: 'bullets',
      elements: [
        { type: 'title', text: 'System Architecture' },
        {
          type: 'diagram',
          nodes: [
            { id: '1', label: 'API Gateway', layer: 'frontend' },
            { id: '2', label: 'Auth Service', layer: 'backend' },
            { id: '3', label: 'Database' },
          ],
          edges: [
            { from: '1', to: '2' },
            { from: '2', to: '3' },
          ],
        },
      ],
    }];
    const result = degradeElements(slides);
    const bulletsEl = result[0].elements.find(el => el.type === 'bullets');
    expect(bulletsEl).toBeDefined();
    if (bulletsEl?.type === 'bullets') {
      expect(bulletsEl.items).toEqual([
        '[frontend] API Gateway',
        '[backend] Auth Service',
        'Database',
      ]);
    }
    expect(result[0].elements.find(el => el.type === 'diagram')).toBeUndefined();
    expect(result[0].elements.find(el => el.type === 'title')).toBeDefined();
  });

  it('converts diagram nodes without layers to plain labels', () => {
    const slides: Slide[] = [{
      layout: 'architecture',
      _resolvedLayout: 'bullets',
      elements: [
        {
          type: 'diagram',
          nodes: [
            { id: 'a', label: 'Service A' },
            { id: 'b', label: 'Service B' },
          ],
          edges: [],
        },
      ],
    }];
    const result = degradeElements(slides);
    const bulletsEl = result[0].elements.find(el => el.type === 'bullets');
    expect(bulletsEl).toBeDefined();
    if (bulletsEl?.type === 'bullets') {
      expect(bulletsEl.items).toEqual(['Service A', 'Service B']);
    }
  });

  it('does not degrade diagram when _resolvedLayout is architecture', () => {
    const slides: Slide[] = [{
      layout: 'architecture',
      _resolvedLayout: 'architecture',
      elements: [
        {
          type: 'diagram',
          nodes: [{ id: '1', label: 'Node' }],
          edges: [],
        },
      ],
    }];
    const result = degradeElements(slides);
    expect(result[0].elements.find(el => el.type === 'diagram')).toBeDefined();
    expect(result[0].elements.find(el => el.type === 'bullets')).toBeUndefined();
  });

  // --- timelineToBullets ---

  it('converts timeline to bullets when layout is timeline and _resolvedLayout is bullets', () => {
    const slides: Slide[] = [{
      layout: 'timeline',
      _resolvedLayout: 'bullets',
      elements: [
        { type: 'title', text: 'Project Timeline' },
        {
          type: 'timeline',
          events: [
            { date: 'Q1 2025', label: 'Design phase', status: 'done' },
            { date: 'Q2 2025', label: 'Development', status: 'in-progress' },
            { date: 'Q3 2025', label: 'Launch' },
          ],
        },
      ],
    }];
    const result = degradeElements(slides);
    const bulletsEl = result[0].elements.find(el => el.type === 'bullets');
    expect(bulletsEl).toBeDefined();
    if (bulletsEl?.type === 'bullets') {
      expect(bulletsEl.items).toEqual([
        'Q1 2025 — Design phase (done)',
        'Q2 2025 — Development (in-progress)',
        'Q3 2025 — Launch',
      ]);
    }
    expect(result[0].elements.find(el => el.type === 'timeline')).toBeUndefined();
    expect(result[0].elements.find(el => el.type === 'title')).toBeDefined();
  });

  it('converts timeline to bullets when layout is roadmap and _resolvedLayout is bullets', () => {
    const slides: Slide[] = [{
      layout: 'roadmap',
      _resolvedLayout: 'bullets',
      elements: [
        {
          type: 'timeline',
          events: [
            { date: '2025', label: 'v1.0', status: 'done' },
            { date: '2026', label: 'v2.0', status: 'planned' },
          ],
        },
      ],
    }];
    const result = degradeElements(slides);
    const bulletsEl = result[0].elements.find(el => el.type === 'bullets');
    expect(bulletsEl).toBeDefined();
    if (bulletsEl?.type === 'bullets') {
      expect(bulletsEl.items).toEqual([
        '2025 — v1.0 (done)',
        '2026 — v2.0 (planned)',
      ]);
    }
    expect(result[0].elements.find(el => el.type === 'timeline')).toBeUndefined();
  });

  it('converts timeline to bullets when layout is process and _resolvedLayout is bullets', () => {
    const slides: Slide[] = [{
      layout: 'process',
      _resolvedLayout: 'bullets',
      elements: [
        {
          type: 'timeline',
          events: [
            { date: 'Step 1', label: 'Gather requirements' },
            { date: 'Step 2', label: 'Build prototype' },
          ],
        },
      ],
    }];
    const result = degradeElements(slides);
    const bulletsEl = result[0].elements.find(el => el.type === 'bullets');
    expect(bulletsEl).toBeDefined();
    if (bulletsEl?.type === 'bullets') {
      expect(bulletsEl.items).toEqual([
        'Step 1 — Gather requirements',
        'Step 2 — Build prototype',
      ]);
    }
    expect(result[0].elements.find(el => el.type === 'timeline')).toBeUndefined();
  });

  it('does not degrade timeline when _resolvedLayout matches original layout', () => {
    const slides: Slide[] = [{
      layout: 'timeline',
      _resolvedLayout: 'timeline',
      elements: [
        {
          type: 'timeline',
          events: [{ date: 'Q1', label: 'Kickoff' }],
        },
      ],
    }];
    const result = degradeElements(slides);
    expect(result[0].elements.find(el => el.type === 'timeline')).toBeDefined();
    expect(result[0].elements.find(el => el.type === 'bullets')).toBeUndefined();
  });
});
