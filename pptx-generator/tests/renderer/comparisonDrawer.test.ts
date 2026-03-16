import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { Presentation, Slide } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';
import { buildComparisonShapes } from '../../src/renderer/comparisonDrawer.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
beforeAll(async () => {
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

describe('comparisonDrawer', () => {
  it('renders two columns with headers and bullet items', async () => {
    const presentation: Presentation = {
      title: 'Comparison Test',
      slides: [
        {
          layout: 'comparison',
          _resolvedLayout: 'comparison',
          elements: [
            { type: 'title', text: 'Cloud vs On-Prem' },
            {
              type: 'bullets',
              items: ['Scalable', 'Pay-per-use', 'Managed'],
              column: 'left',
            },
            {
              type: 'bullets',
              items: ['Full control', 'One-time cost', 'Custom hardware'],
              column: 'right',
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Cloud vs On-Prem');
    // Column headers
    expect(slideXml).toContain('Option A');
    expect(slideXml).toContain('Option B');
    // Left column items (with bullet character)
    expect(slideXml).toContain('Scalable');
    expect(slideXml).toContain('Pay-per-use');
    expect(slideXml).toContain('Managed');
    // Right column items
    expect(slideXml).toContain('Full control');
    expect(slideXml).toContain('One-time cost');
    expect(slideXml).toContain('Custom hardware');
    // Uses rounded rectangles for column headers
    expect(slideXml).toContain('prstGeom prst="roundRect"');
    // Uses text boxes
    expect(slideXml).toContain('txBox="1"');
  });

  it('handles single column comparison', async () => {
    const presentation: Presentation = {
      title: 'Single Column Test',
      slides: [
        {
          layout: 'comparison',
          _resolvedLayout: 'comparison',
          elements: [
            { type: 'title', text: 'Pros Only' },
            {
              type: 'bullets',
              items: ['Fast', 'Reliable', 'Cheap'],
              column: 'left',
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Pros Only');
    expect(slideXml).toContain('Option A');
    expect(slideXml).toContain('Fast');
    expect(slideXml).toContain('Reliable');
    expect(slideXml).toContain('Cheap');
    // No Option B header for single column
    expect(slideXml).not.toContain('Option B');
  });
});

describe('buildComparisonShapes – dynamic labels', () => {
  const accentColors = ['2D7DD2', '27AE60', '999999'];

  it('uses custom labels when provided', () => {
    const slide: Slide = {
      layout: 'comparison',
      elements: [
        { type: 'title', text: 'Compare' },
        { type: 'bullets', items: ['Fast'], column: 'left', label: 'AWS' },
        { type: 'bullets', items: ['Cheap'], column: 'right', label: 'GCP' },
      ],
    };
    const result = buildComparisonShapes(slide, 100, accentColors);
    expect(result.shapes).toContain('AWS');
    expect(result.shapes).toContain('GCP');
    expect(result.shapes).not.toContain('Option A');
    expect(result.shapes).not.toContain('Option B');
  });

  it('falls back to Option A/B when no labels provided', () => {
    const slide: Slide = {
      layout: 'comparison',
      elements: [
        { type: 'title', text: 'Compare' },
        { type: 'bullets', items: ['Fast'], column: 'left' },
        { type: 'bullets', items: ['Cheap'], column: 'right' },
      ],
    };
    const result = buildComparisonShapes(slide, 100, accentColors);
    expect(result.shapes).toContain('Option A');
    expect(result.shapes).toContain('Option B');
  });
});
