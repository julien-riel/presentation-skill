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

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
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

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('App A');
    expect(slideXml).toContain('App B');
    expect(slideXml).toContain('Service');
  });

  it('emits icon requests for nodes with style.icon', async () => {
    const presentation: Presentation = {
      title: 'Icon Arch Test',
      slides: [
        {
          layout: 'architecture',
          _resolvedLayout: 'architecture',
          elements: [
            { type: 'title', text: 'With Icons' },
            {
              type: 'diagram',
              nodes: [
                { id: 'db', label: 'Database', layer: 'Data', style: { icon: 'database' } },
                { id: 'api', label: 'API', layer: 'Backend' },
              ],
              edges: [{ from: 'api', to: 'db' }],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    // Should contain a p:pic element for the database icon
    expect(slideXml).toContain('<p:pic>');
    expect(slideXml).toContain('rIdImg');

    // Should still contain the text labels
    expect(slideXml).toContain('Database');
    expect(slideXml).toContain('API');

    // Should have an image file in ppt/media/
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
    expect(mediaFiles.length).toBeGreaterThan(0);

    // Should have image relationship in slide rels
    const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('text');
    expect(rels).toContain('relationships/image');
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

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('FF5733');
  });
});
