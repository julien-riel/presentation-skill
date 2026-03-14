import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import type { Presentation } from '../../src/schema/presentation.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';

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

    const buffer = await renderToBuffer(presentation);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    // Should contain the title
    expect(slideXml).toContain('Project Timeline');

    // Should contain shapes (sp elements for line and circles)
    // PptxGenJS renders shapes as <p:sp> elements
    expect(slideXml).toContain('<p:sp>');

    // Should contain event labels
    expect(slideXml).toContain('Planning');
    expect(slideXml).toContain('Dev');
    expect(slideXml).toContain('Launch');

    // Should contain date labels
    expect(slideXml).toContain('2026-Q1');
    expect(slideXml).toContain('2026-Q2');
    expect(slideXml).toContain('2026-Q3');

    // Green circle for done status (2E7D32)
    expect(slideXml).toContain('2E7D32');
    // Orange for in-progress (F57C00)
    expect(slideXml).toContain('F57C00');
    // Grey for planned (9E9E9E)
    expect(slideXml).toContain('9E9E9E');
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

    const buffer = await renderToBuffer(presentation);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('Only Event');
    expect(slideXml).toContain('2026-01');
  });
});
