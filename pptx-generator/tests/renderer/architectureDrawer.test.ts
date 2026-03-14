import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { Presentation } from '../../src/schema/presentation.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

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

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('System Architecture');
    expect(slideXml).toContain('Web UI');
    expect(slideXml).toContain('API Server');
    expect(slideXml).toContain('Database');
    expect(slideXml).toContain('<p:sp>');
    // Uses template accent colors for node fills
    expect(slideXml).toContain('solidFill');
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

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH);
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
                { id: 'x', label: 'Node X', style: { fill: '#FF5733' } },
              ],
              edges: [],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('FF5733');
  });
});
