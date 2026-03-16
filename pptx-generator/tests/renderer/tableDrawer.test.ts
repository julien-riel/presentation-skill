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

describe('tableDrawer', () => {
  it('renders table headers and data rows', async () => {
    const presentation: Presentation = {
      title: 'Table Test',
      slides: [
        {
          layout: 'table',
          _resolvedLayout: 'table',
          elements: [
            { type: 'title', text: 'Sales Data' },
            {
              type: 'table',
              headers: ['Product', 'Q1', 'Q2'],
              rows: [
                ['Widget A', '100', '150'],
                ['Widget B', '200', '250'],
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

    expect(slideXml).toContain('Sales Data');
    // Headers
    expect(slideXml).toContain('Product');
    expect(slideXml).toContain('Q1');
    expect(slideXml).toContain('Q2');
    // Data rows
    expect(slideXml).toContain('Widget A');
    expect(slideXml).toContain('100');
    expect(slideXml).toContain('150');
    expect(slideXml).toContain('Widget B');
    expect(slideXml).toContain('200');
    expect(slideXml).toContain('250');
    // Uses rect shapes for cells
    expect(slideXml).toContain('<p:sp>');
    expect(slideXml).toContain('solidFill');
  });

  it('handles single-column table', async () => {
    const presentation: Presentation = {
      title: 'Single Col Test',
      slides: [
        {
          layout: 'table',
          _resolvedLayout: 'table',
          elements: [
            { type: 'title', text: 'One Column' },
            {
              type: 'table',
              headers: ['Name'],
              rows: [['Alice'], ['Bob']],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Name');
    expect(slideXml).toContain('Alice');
    expect(slideXml).toContain('Bob');
  });

  it('handles empty table gracefully (headers still render)', async () => {
    const presentation: Presentation = {
      title: 'Empty Table Test',
      slides: [
        {
          layout: 'table',
          _resolvedLayout: 'table',
          elements: [
            { type: 'title', text: 'Empty Table' },
            {
              type: 'table',
              headers: ['Col A', 'Col B'],
              rows: [],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Empty Table');
    expect(slideXml).toContain('Col A');
    expect(slideXml).toContain('Col B');
  });

  it('renders many columns correctly', async () => {
    const presentation: Presentation = {
      title: 'Wide Table Test',
      slides: [
        {
          layout: 'table',
          _resolvedLayout: 'table',
          elements: [
            { type: 'title', text: 'Wide Table' },
            {
              type: 'table',
              headers: ['A', 'B', 'C', 'D', 'E'],
              rows: [
                ['1', '2', '3', '4', '5'],
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

    expect(slideXml).toContain('Wide Table');
    for (const h of ['A', 'B', 'C', 'D', 'E']) {
      expect(slideXml).toContain(h);
    }
    for (const v of ['1', '2', '3', '4', '5']) {
      expect(slideXml).toContain(v);
    }
  });
});
