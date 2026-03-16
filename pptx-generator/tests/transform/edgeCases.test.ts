import { describe, it, expect } from 'vitest';
import type { Slide } from '../../src/schema/presentation.js';
import { validateContent } from '../../src/transform/contentValidator.js';

// ─── Edge Case Guards ────────────────────────────────────────────────────────

describe('contentValidator edge cases', () => {
  describe('empty chart data', () => {
    it('emits warning when labels array is empty', () => {
      const slides: Slide[] = [{
        layout: 'chart',
        elements: [
          { type: 'title', text: 'Empty Labels' },
          {
            type: 'chart',
            chartType: 'bar',
            data: {
              labels: [],
              series: [{ name: 'S1', values: [1, 2] }],
            },
          },
        ],
      }];
      const result = validateContent(slides);
      expect(result[0]._warnings).toContain('Chart has no data, skipping');
    });

    it('emits warning when series array is empty', () => {
      const slides: Slide[] = [{
        layout: 'chart',
        elements: [
          { type: 'title', text: 'Empty Series' },
          {
            type: 'chart',
            chartType: 'bar',
            data: {
              labels: ['A', 'B'],
              series: [],
            },
          },
        ],
      }];
      const result = validateContent(slides);
      expect(result[0]._warnings).toContain('Chart has no data, skipping');
    });

    it('returns chart element as-is when data is empty', () => {
      const slides: Slide[] = [{
        layout: 'chart',
        elements: [
          { type: 'title', text: 'Empty' },
          {
            type: 'chart',
            chartType: 'line',
            data: {
              labels: [],
              series: [],
            },
          },
        ],
      }];
      const result = validateContent(slides);
      const chartEl = result[0].elements.find(el => el.type === 'chart');
      expect(chartEl).toBeDefined();
      if (chartEl?.type === 'chart') {
        expect(chartEl.data.labels).toEqual([]);
        expect(chartEl.data.series).toEqual([]);
      }
    });
  });

  describe('negative values in pie/donut charts', () => {
    it('replaces negative values with 0 in pie chart', () => {
      const slides: Slide[] = [{
        layout: 'chart',
        elements: [
          { type: 'title', text: 'Pie Negative' },
          {
            type: 'chart',
            chartType: 'pie',
            data: {
              labels: ['A', 'B', 'C'],
              series: [{ name: 'S1', values: [10, -5, 20] }],
            },
          },
        ],
      }];
      const result = validateContent(slides);
      const chartEl = result[0].elements.find(el => el.type === 'chart');
      expect(chartEl).toBeDefined();
      if (chartEl?.type === 'chart') {
        expect(chartEl.data.series[0].values).toEqual([10, 0, 20]);
      }
      expect(result[0]._warnings).toContain('Negative value in pie/donut series replaced with 0');
    });

    it('replaces negative values with 0 in donut chart', () => {
      const slides: Slide[] = [{
        layout: 'chart',
        elements: [
          { type: 'title', text: 'Donut Negative' },
          {
            type: 'chart',
            chartType: 'donut',
            data: {
              labels: ['X', 'Y'],
              series: [{ name: 'S1', values: [-3, 7] }],
            },
          },
        ],
      }];
      const result = validateContent(slides);
      const chartEl = result[0].elements.find(el => el.type === 'chart');
      if (chartEl?.type === 'chart') {
        expect(chartEl.data.series[0].values).toEqual([0, 7]);
      }
      expect(result[0]._warnings).toContain('Negative value in pie/donut series replaced with 0');
    });

    it('does not replace negative values in bar chart', () => {
      const slides: Slide[] = [{
        layout: 'chart',
        elements: [
          { type: 'title', text: 'Bar Negative' },
          {
            type: 'chart',
            chartType: 'bar',
            data: {
              labels: ['A', 'B'],
              series: [{ name: 'S1', values: [-10, 5] }],
            },
          },
        ],
      }];
      const result = validateContent(slides);
      const chartEl = result[0].elements.find(el => el.type === 'chart');
      if (chartEl?.type === 'chart') {
        expect(chartEl.data.series[0].values).toEqual([-10, 5]);
      }
      expect(result[0]._warnings?.some(w => w.includes('Negative'))).toBeFalsy();
    });
  });

  describe('self-referencing edges in diagrams', () => {
    it('removes self-referencing edge and emits warning', () => {
      const slides: Slide[] = [{
        layout: 'architecture',
        elements: [
          { type: 'title', text: 'Diagram' },
          {
            type: 'diagram',
            nodes: [
              { id: 'a', label: 'A' },
              { id: 'b', label: 'B' },
            ],
            edges: [
              { from: 'a', to: 'b' },
              { from: 'a', to: 'a' },
            ],
          },
        ],
      }];
      const result = validateContent(slides);
      const diagramEl = result[0].elements.find(el => el.type === 'diagram');
      expect(diagramEl).toBeDefined();
      if (diagramEl?.type === 'diagram') {
        expect(diagramEl.edges).toHaveLength(1);
        expect(diagramEl.edges[0]).toEqual({ from: 'a', to: 'b' });
      }
      expect(result[0]._warnings).toContain('Self-referencing edge removed');
    });

    it('does not emit warning when no self-referencing edges exist', () => {
      const slides: Slide[] = [{
        layout: 'architecture',
        elements: [
          { type: 'title', text: 'Diagram' },
          {
            type: 'diagram',
            nodes: [
              { id: 'a', label: 'A' },
              { id: 'b', label: 'B' },
            ],
            edges: [{ from: 'a', to: 'b' }],
          },
        ],
      }];
      const result = validateContent(slides);
      expect(result[0]._warnings?.some(w => w.includes('Self-referencing'))).toBeFalsy();
    });

    it('removes multiple self-referencing edges', () => {
      const slides: Slide[] = [{
        layout: 'architecture',
        elements: [
          { type: 'title', text: 'Diagram' },
          {
            type: 'diagram',
            nodes: [
              { id: 'a', label: 'A' },
              { id: 'b', label: 'B' },
              { id: 'c', label: 'C' },
            ],
            edges: [
              { from: 'a', to: 'a' },
              { from: 'b', to: 'b' },
              { from: 'a', to: 'c' },
            ],
          },
        ],
      }];
      const result = validateContent(slides);
      const diagramEl = result[0].elements.find(el => el.type === 'diagram');
      if (diagramEl?.type === 'diagram') {
        expect(diagramEl.edges).toHaveLength(1);
        expect(diagramEl.edges[0]).toEqual({ from: 'a', to: 'c' });
      }
    });
  });

  describe('mismatched series lengths', () => {
    it('pads short series values with zeros and emits no extra warning', () => {
      const slides: Slide[] = [{
        layout: 'chart',
        elements: [
          { type: 'title', text: 'Mismatch' },
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

    it('trims long series values to match labels', () => {
      const slides: Slide[] = [{
        layout: 'chart',
        elements: [
          { type: 'title', text: 'Mismatch' },
          {
            type: 'chart',
            chartType: 'bar',
            data: {
              labels: ['A'],
              series: [{ name: 'S1', values: [1, 2, 3] }],
            },
          },
        ],
      }];
      const result = validateContent(slides);
      const chartEl = result[0].elements.find(el => el.type === 'chart');
      if (chartEl?.type === 'chart') {
        expect(chartEl.data.series[0].values).toEqual([1]);
      }
    });
  });
});
