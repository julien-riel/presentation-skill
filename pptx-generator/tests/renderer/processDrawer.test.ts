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

describe('processDrawer', () => {
  it('renders process steps as numbered boxes with arrows', async () => {
    const presentation: Presentation = {
      title: 'Process Test',
      slides: [
        {
          layout: 'process',
          _resolvedLayout: 'process',
          elements: [
            { type: 'title', text: 'Onboarding Process' },
            {
              type: 'timeline',
              events: [
                { date: 'Day 1', label: 'Sign Up', status: 'done' },
                { date: 'Day 2', label: 'Verify', status: 'in-progress' },
                { date: 'Day 3', label: 'Activate', status: 'planned' },
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

    expect(slideXml).toContain('Onboarding Process');
    // Step labels
    expect(slideXml).toContain('Sign Up');
    expect(slideXml).toContain('Verify');
    expect(slideXml).toContain('Activate');
    // Dates
    expect(slideXml).toContain('Day 1');
    expect(slideXml).toContain('Day 2');
    expect(slideXml).toContain('Day 3');
    // Uses rounded rectangles for step boxes
    expect(slideXml).toContain('prstGeom prst="roundRect"');
    // Arrow connectors with triangle end
    expect(slideXml).toContain('tailEnd type="triangle"');
    // Line shapes for arrows
    expect(slideXml).toContain('prstGeom prst="line"');
  });

  it('handles single step (no arrows)', async () => {
    const presentation: Presentation = {
      title: 'Single Step Test',
      slides: [
        {
          layout: 'process',
          _resolvedLayout: 'process',
          elements: [
            { type: 'title', text: 'One Step' },
            {
              type: 'timeline',
              events: [
                { date: 'Now', label: 'Start', status: 'done' },
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

    expect(slideXml).toContain('One Step');
    expect(slideXml).toContain('Start');
    // No arrow connectors for single step
    expect(slideXml).not.toContain('tailEnd type="triangle"');
  });
});
