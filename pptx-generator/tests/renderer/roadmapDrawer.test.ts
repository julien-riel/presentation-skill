import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import { readFile } from 'fs/promises';
import type { Presentation } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
let templateBuffer: Buffer;
beforeAll(async () => {
  templateBuffer = await readFile(TEMPLATE_PATH);
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

describe('roadmapDrawer', () => {
  it('renders roadmap phases as horizontal bar segments', async () => {
    const presentation: Presentation = {
      title: 'Roadmap Test',
      slides: [
        {
          layout: 'roadmap',
          _resolvedLayout: 'roadmap',
          elements: [
            { type: 'title', text: 'Product Roadmap' },
            {
              type: 'timeline',
              events: [
                { date: '2026-Q1', label: 'Discovery', status: 'done' },
                { date: '2026-Q2', label: 'Development', status: 'in-progress' },
                { date: '2026-Q3', label: 'Launch', status: 'planned' },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Product Roadmap');
    // Labels
    expect(slideXml).toContain('Discovery');
    expect(slideXml).toContain('Development');
    expect(slideXml).toContain('Launch');
    // Dates
    expect(slideXml).toContain('2026-Q1');
    expect(slideXml).toContain('2026-Q2');
    expect(slideXml).toContain('2026-Q3');
    // Uses rounded rectangles for phases
    expect(slideXml).toContain('prstGeom prst="roundRect"');
  });

  it('handles empty events gracefully', async () => {
    const presentation: Presentation = {
      title: 'Empty Roadmap Test',
      slides: [
        {
          layout: 'roadmap',
          _resolvedLayout: 'roadmap',
          elements: [
            { type: 'title', text: 'Empty Roadmap' },
            {
              type: 'timeline',
              events: [],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('Empty Roadmap');
    // No rounded rects for empty roadmap
    expect(slideXml).not.toContain('prstGeom prst="roundRect"');
  });
});
