import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import { readFile } from 'fs/promises';
import type { Presentation, Slide } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';
import { transformPresentation } from '../../src/transform/index.js';
import { getDefaultManifest } from '../../src/index.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
let templateBuffer: Buffer;
beforeAll(async () => {
  templateBuffer = await readFile(TEMPLATE_PATH);
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

/**
 * Generates a presentation AST with 50 slides using various layouts.
 */
function buildLargePresentation(): Presentation {
  const slides: Slide[] = [];

  for (let i = 0; i < 50; i++) {
    const variant = i % 6;
    let slide: Slide;

    switch (variant) {
      case 0:
        slide = {
          layout: 'bullets',
          elements: [
            { type: 'title', text: `Bullets Slide ${i + 1}` },
            { type: 'bullets', items: ['Point A', 'Point B', 'Point C', 'Point D'] },
          ],
        };
        break;
      case 1:
        slide = {
          layout: 'kpi',
          elements: [
            { type: 'title', text: `KPI Slide ${i + 1}` },
            {
              type: 'kpi',
              indicators: [
                { label: 'Revenue', value: '1.2M', unit: 'USD', trend: 'up' },
                { label: 'Users', value: '50K', trend: 'stable' },
                { label: 'Churn', value: '2.1%', trend: 'down' },
              ],
            },
          ],
        };
        break;
      case 2:
        slide = {
          layout: 'chart',
          elements: [
            { type: 'title', text: `Chart Slide ${i + 1}` },
            {
              type: 'chart',
              chartType: 'bar',
              data: {
                labels: ['Q1', 'Q2', 'Q3', 'Q4'],
                series: [{ name: 'Revenue', values: [100, 200, 150, 300] }],
              },
            },
          ],
        };
        break;
      case 3:
        slide = {
          layout: 'timeline',
          elements: [
            { type: 'title', text: `Timeline Slide ${i + 1}` },
            {
              type: 'timeline',
              events: [
                { date: '2026-01', label: 'Phase 1', status: 'done' },
                { date: '2026-04', label: 'Phase 2', status: 'in-progress' },
                { date: '2026-07', label: 'Phase 3', status: 'planned' },
              ],
            },
          ],
        };
        break;
      case 4:
        slide = {
          layout: 'table',
          elements: [
            { type: 'title', text: `Table Slide ${i + 1}` },
            {
              type: 'table',
              headers: ['Name', 'Role', 'Status'],
              rows: [
                ['Alice', 'Engineer', 'Active'],
                ['Bob', 'Designer', 'Active'],
                ['Carol', 'PM', 'On leave'],
              ],
            },
          ],
        };
        break;
      case 5:
        slide = {
          layout: 'architecture',
          elements: [
            { type: 'title', text: `Architecture Slide ${i + 1}` },
            {
              type: 'diagram',
              nodes: [
                { id: 'web', label: 'Web', layer: 'Frontend' },
                { id: 'api', label: 'API', layer: 'Backend' },
                { id: 'db', label: 'DB', layer: 'Data' },
              ],
              edges: [
                { from: 'web', to: 'api' },
                { from: 'api', to: 'db' },
              ],
            },
          ],
        };
        break;
      default:
        slide = {
          layout: 'bullets',
          elements: [
            { type: 'title', text: `Fallback Slide ${i + 1}` },
            { type: 'bullets', items: ['Item'] },
          ],
        };
    }

    slides.push(slide);
  }

  return {
    title: 'Performance Test Presentation',
    metadata: { author: 'Perf Test', date: '2026-03-16' },
    slides,
  };
}

describe('Performance', () => {
  it('renders 50 slides in under 30 seconds with output under 10MB', async () => {
    const ast = buildLargePresentation();
    const manifest = getDefaultManifest();
    const enriched = transformPresentation(ast, manifest);

    const start = performance.now();
    const buffer = await renderToBuffer(enriched, templateBuffer, templateInfo);
    const elapsed = performance.now() - start;

    // Buffer is non-empty
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Valid ZIP structure
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles.length).toBeGreaterThanOrEqual(50);

    // Execution time under 30 seconds
    expect(elapsed).toBeLessThan(30_000);

    // Output size under 10MB
    const tenMB = 10 * 1024 * 1024;
    expect(buffer.length).toBeLessThan(tenMB);
  });
});
