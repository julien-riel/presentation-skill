import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { Presentation } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
beforeAll(async () => {
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

describe('timelineDrawer', () => {
  it('draws timeline shapes (line + circles) in the PPTX XML', async () => {
    const presentation: Presentation = {
      title: 'Timeline Test',
      slides: [
        {
          layout: 'timeline',
          _resolvedLayout: 'timeline',
          elements: [
            { type: 'title', text: 'Project Timeline' },
            {
              type: 'timeline',
              events: [
                { date: '2026-Q1', label: 'Planning', status: 'done' },
                { date: '2026-Q2', label: 'Dev', status: 'in-progress' },
                { date: '2026-Q3', label: 'Launch', status: 'planned' },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    // Should contain the title
    expect(slideXml).toContain('Project Timeline');

    // Should contain shapes
    expect(slideXml).toContain('<p:sp>');

    // Should contain event labels
    expect(slideXml).toContain('Planning');
    expect(slideXml).toContain('Dev');
    expect(slideXml).toContain('Launch');

    // Should contain date labels
    expect(slideXml).toContain('2026-Q1');
    expect(slideXml).toContain('2026-Q2');
    expect(slideXml).toContain('2026-Q3');

    // Should contain colored ellipse shapes (from template accent colors)
    expect(slideXml).toContain('prstGeom prst="ellipse"');
  });

  it('emits icon requests for events with icon, replacing ellipse', async () => {
    const presentation: Presentation = {
      title: 'Icon Timeline Test',
      slides: [
        {
          layout: 'timeline',
          _resolvedLayout: 'timeline',
          elements: [
            { type: 'title', text: 'Timeline With Icons' },
            {
              type: 'timeline',
              events: [
                { date: '2026-Q1', label: 'Planning', status: 'done', icon: 'clipboard-check' },
                { date: '2026-Q2', label: 'Dev', status: 'in-progress' },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    // Should contain a p:pic element for the first event's icon
    expect(slideXml).toContain('<p:pic>');

    // Second event (no icon) should still have an ellipse
    expect(slideXml).toContain('prstGeom prst="ellipse"');

    // Should have an image file in ppt/media/
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
    expect(mediaFiles.length).toBeGreaterThan(0);
  });

  it('handles a single event timeline', async () => {
    const presentation: Presentation = {
      title: 'Single Event',
      slides: [
        {
          layout: 'timeline',
          _resolvedLayout: 'timeline',
          elements: [
            { type: 'title', text: 'One Event' },
            {
              type: 'timeline',
              events: [{ date: '2026-01', label: 'Only Event', status: 'done' }],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('Only Event');
    expect(slideXml).toContain('2026-01');
  });
});
