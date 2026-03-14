import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import type { Presentation } from '../../src/schema/presentation.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';

describe('architectureDrawer', () => {
  it('draws architecture shapes (rounded rects + connectors) in the PPTX XML', async () => {
    const presentation: Presentation = {
      title: 'Architecture Test',
      slides: [
        {
          layout: 'architecture',
          _resolvedLayout: 'architecture',
          elements: [
            { type: 'title', text: 'System Architecture' },
            {
              type: 'diagram',
              nodes: [
                { id: 'ui', label: 'Web UI', layer: 'Frontend' },
                { id: 'api', label: 'API Server', layer: 'Backend' },
                { id: 'db', label: 'Database', layer: 'Data' },
              ],
              edges: [
                { from: 'ui', to: 'api' },
                { from: 'api', to: 'db' },
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

    // Title present
    expect(slideXml).toContain('System Architecture');

    // Node labels present
    expect(slideXml).toContain('Web UI');
    expect(slideXml).toContain('API Server');
    expect(slideXml).toContain('Database');

    // Should have shapes
    expect(slideXml).toContain('<p:sp>');

    // Default fill color for nodes (4472C4)
    expect(slideXml).toContain('4472C4');
  });

  it('draws multiple nodes per layer', async () => {
    const presentation: Presentation = {
      title: 'Multi-node Layers',
      slides: [
        {
          layout: 'architecture',
          _resolvedLayout: 'architecture',
          elements: [
            { type: 'title', text: 'Complex Arch' },
            {
              type: 'diagram',
              nodes: [
                { id: 'a', label: 'App A', layer: 'Frontend' },
                { id: 'b', label: 'App B', layer: 'Frontend' },
                { id: 'c', label: 'Service', layer: 'Backend' },
              ],
              edges: [
                { from: 'a', to: 'c' },
                { from: 'b', to: 'c' },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('App A');
    expect(slideXml).toContain('App B');
    expect(slideXml).toContain('Service');
  });

  it('handles custom node colors', async () => {
    const presentation: Presentation = {
      title: 'Custom Colors',
      slides: [
        {
          layout: 'architecture',
          _resolvedLayout: 'architecture',
          elements: [
            { type: 'title', text: 'Colored Nodes' },
            {
              type: 'diagram',
              nodes: [
                { id: 'x', label: 'Node X', style: { fill: '#FF5733', border: '#C70039' } },
              ],
              edges: [],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('FF5733');
    expect(slideXml).toContain('C70039');
  });
});
