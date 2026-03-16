import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { Presentation, Slide } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { transformPresentation } from '../../src/transform/index.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';
import { makeTier1Capabilities } from '../helpers/capabilitiesHelpers.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
beforeAll(async () => {
  templateInfo = await readTemplate(TEMPLATE_PATH);
})

// ─── Buffer Output + JSZip Validation ─────────────────────────────────────────

describe('renderToBuffer', () => {
  it('produces a valid PPTX (ZIP) with correct slide count', async () => {
    const presentation: Presentation = {
      title: 'Buffer Test',
      slides: [
        {
          layout: 'title',
          _resolvedLayout: 'title',
          elements: [
            { type: 'title', text: 'Slide 1' },
            { type: 'subtitle', text: 'Intro' },
          ],
        },
        {
          layout: 'bullets',
          _resolvedLayout: 'bullets',
          elements: [
            { type: 'title', text: 'Slide 2' },
            { type: 'bullets', items: ['A', 'B', 'C'] },
          ],
        },
        {
          layout: 'generic',
          _resolvedLayout: 'generic',
          elements: [
            { type: 'title', text: 'Slide 3' },
            { type: 'text', text: 'Some text content' },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles).toHaveLength(3);
  });

  it('handles twoColumns layout', async () => {
    const presentation: Presentation = {
      title: 'Columns Test',
      slides: [
        {
          layout: 'twoColumns',
          _resolvedLayout: 'twoColumns',
          elements: [
            { type: 'title', text: 'Two Cols' },
            { type: 'bullets', items: ['Left 1', 'Left 2'], column: 'left' },
            { type: 'bullets', items: ['Right 1', 'Right 2'], column: 'right' },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles).toHaveLength(1);
  });

  it('handles canvas layout with timeline', async () => {
    const presentation: Presentation = {
      title: 'Canvas Test',
      slides: [
        {
          layout: 'timeline',
          _resolvedLayout: 'timeline',
          elements: [
            { type: 'title', text: 'Timeline' },
            {
              type: 'timeline',
              events: [
                { date: '2026-01', label: 'Start', status: 'done' },
                { date: '2026-06', label: 'End', status: 'planned' },
              ],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles).toHaveLength(1);
  });

  it('includes speaker notes when present', async () => {
    const presentation: Presentation = {
      title: 'Notes Test',
      slides: [
        {
          layout: 'title',
          _resolvedLayout: 'title',
          elements: [{ type: 'title', text: 'With Notes' }],
          notes: 'These are speaker notes',
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const notesFiles = Object.keys(zip.files).filter(
      (name) => name.includes('notesSlide'),
    );
    expect(notesFiles.length).toBeGreaterThan(0);
  });

  it('slide XML contains the text content', async () => {
    const presentation: Presentation = {
      title: 'Content Test',
      slides: [
        {
          layout: 'bullets',
          _resolvedLayout: 'bullets',
          elements: [
            { type: 'title', text: 'My Title' },
            { type: 'bullets', items: ['Alpha', 'Beta'] },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('My Title');
    expect(slideXml).toContain('Alpha');
    expect(slideXml).toContain('Beta');
  });

  it('renders bullets with icons as picture + textbox shapes', async () => {
    const presentation: Presentation = {
      title: 'Icon Bullets Test',
      slides: [
        {
          layout: 'bullets',
          _resolvedLayout: 'bullets',
          elements: [
            { type: 'title', text: 'Features' },
            {
              type: 'bullets',
              items: ['Fast', 'Secure', 'Simple'],
              icons: ['zap', 'shield', 'box'],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('<p:pic>');
    expect(slideXml).toContain('Fast');
    expect(slideXml).toContain('Secure');
    expect(slideXml).toContain('Simple');

    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/') && !zip.files[name].dir);
    expect(mediaFiles.length).toBe(3);
  });

  it('renders bullets without icons normally (backward compat)', async () => {
    const presentation: Presentation = {
      title: 'No Icon Bullets',
      slides: [
        {
          layout: 'bullets',
          _resolvedLayout: 'bullets',
          elements: [
            { type: 'title', text: 'Plain' },
            { type: 'bullets', items: ['A', 'B'] },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');

    expect(slideXml).not.toContain('<p:pic>');
    expect(slideXml).toContain('A');
    expect(slideXml).toContain('B');
  });

  it('handles icons array shorter than items', async () => {
    const presentation: Presentation = {
      title: 'Partial Icons',
      slides: [
        {
          layout: 'bullets',
          _resolvedLayout: 'bullets',
          elements: [
            { type: 'title', text: 'Partial' },
            {
              type: 'bullets',
              items: ['With icon', 'No icon'],
              icons: ['check'],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('With icon');
    expect(slideXml).toContain('No icon');

    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/') && !zip.files[name].dir);
    expect(mediaFiles.length).toBe(1);
  });

  it('renders two-column bullets with icons', async () => {
    const presentation: Presentation = {
      title: 'Two Col Icons',
      slides: [
        {
          layout: 'twoColumns',
          _resolvedLayout: 'twoColumns',
          elements: [
            { type: 'title', text: 'Comparison' },
            { type: 'bullets', items: ['Pro A', 'Pro B'], column: 'left', icons: ['check', 'check'] },
            { type: 'bullets', items: ['Con A'], column: 'right', icons: ['x'] },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('Pro A');
    expect(slideXml).toContain('Con A');
    expect(slideXml).toContain('<p:pic>');

    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/') && !zip.files[name].dir);
    expect(mediaFiles.length).toBe(3);
  });

  it('renders quote with decorative icon', async () => {
    const presentation: Presentation = {
      title: 'Quote Icon Test',
      slides: [
        {
          layout: 'generic',
          _resolvedLayout: 'generic',
          elements: [
            { type: 'title', text: 'Inspiration' },
            { type: 'quote', text: 'Be the change', author: 'Gandhi', icon: 'quote' },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('<p:pic>');
    expect(slideXml).toContain('Be the change');

    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/') && !zip.files[name].dir);
    expect(mediaFiles.length).toBe(1);
  });

  it('gracefully skips unknown icon names without crashing', async () => {
    const presentation: Presentation = {
      title: 'Unknown Icon Test',
      slides: [
        {
          layout: 'bullets',
          _resolvedLayout: 'bullets',
          elements: [
            { type: 'title', text: 'Test' },
            {
              type: 'bullets',
              items: ['Valid', 'Invalid'],
              icons: ['check', 'totally-fake-icon-xyz'],
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    expect(buffer).toBeInstanceOf(Buffer);

    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('Valid');
    expect(slideXml).toContain('Invalid');

    // Only 1 media file (the valid icon)
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/') && !zip.files[name].dir);
    expect(mediaFiles.length).toBe(1);
  });

  it('slides reference the correct slideLayout', async () => {
    const presentation: Presentation = {
      title: 'Layout Ref Test',
      slides: [
        {
          layout: 'bullets',
          _resolvedLayout: 'bullets',
          elements: [
            { type: 'title', text: 'Bullets Slide' },
            { type: 'bullets', items: ['A'] },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('text');
    expect(rels).toBeDefined();
    // Should reference a slideLayout
    expect(rels).toContain('slideLayout');
  });
});

// ─── E2E: AST → Transform → Render ──────────────────────────────────────────

describe('E2E: AST → Transform(Tier 1) → Render', () => {
  it('produces a valid PPTX file from a full pipeline', async () => {
    const caps = makeTier1Capabilities();
    const ast: Presentation = {
      title: 'E2E Test Presentation',
      metadata: { author: 'Test Bot', date: '2026-03-14' },
      slides: [
        {
          layout: 'title',
          elements: [
            { type: 'title', text: 'Welcome' },
            { type: 'subtitle', text: 'E2E integration test' },
          ],
        },
        {
          layout: 'section',
          elements: [
            { type: 'title', text: 'Section Break' },
            { type: 'subtitle', text: 'Next topic' },
          ],
        },
        {
          layout: 'bullets',
          elements: [
            { type: 'title', text: 'Key Points' },
            { type: 'bullets', items: ['Point A', 'Point B', 'Point C'] },
          ],
        },
        {
          layout: 'kpi',
          elements: [
            { type: 'title', text: 'KPI Dashboard' },
            {
              type: 'kpi',
              indicators: [
                { label: 'Revenue', value: '1.2M', unit: 'USD', trend: 'up' },
                { label: 'Users', value: '50K', trend: 'stable' },
              ],
            },
          ],
        },
        {
          layout: 'bullets',
          elements: [
            { type: 'title', text: 'Detailed Items' },
            { type: 'bullets', items: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
          ],
        },
      ],
    };

    const enriched = transformPresentation(ast, caps);

    // kpi → bullets degradation
    expect(enriched.slides[3]._resolvedLayout).toBe('bullets');

    // 7 bullets → split into 2 slides (5 + 2)
    expect(enriched.slides.length).toBe(6);

    const buffer = await renderToBuffer(enriched, TEMPLATE_PATH, templateInfo);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles).toHaveLength(6);

    const firstSlide = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(firstSlide).toBeDefined();
    expect(firstSlide).toContain('Welcome');
  });

  it('produces a valid PPTX with icons across multiple element types', async () => {
    const caps = makeTier1Capabilities(['twoColumns', 'timeline', 'architecture']);
    const ast: Presentation = {
      title: 'Icon Integration Test',
      slides: [
        {
          layout: 'architecture',
          elements: [
            { type: 'title', text: 'System' },
            {
              type: 'diagram',
              nodes: [
                { id: 'web', label: 'Web', layer: 'Frontend', style: { icon: 'globe' } },
                { id: 'api', label: 'API', layer: 'Backend', style: { icon: 'server' } },
                { id: 'db', label: 'DB', layer: 'Data', style: { icon: 'database' } },
              ],
              edges: [{ from: 'web', to: 'api' }, { from: 'api', to: 'db' }],
            },
          ],
        },
        {
          layout: 'bullets',
          elements: [
            { type: 'title', text: 'Features' },
            { type: 'bullets', items: ['Fast', 'Secure'], icons: ['zap', 'shield'] },
          ],
        },
        {
          layout: 'timeline',
          elements: [
            { type: 'title', text: 'Roadmap' },
            {
              type: 'timeline',
              events: [
                { date: 'Q1', label: 'Plan', status: 'done', icon: 'clipboard-check' },
                { date: 'Q2', label: 'Build', status: 'in-progress', icon: 'hammer' },
              ],
            },
          ],
        },
      ],
    };

    const enriched = transformPresentation(ast, caps);
    const buffer = await renderToBuffer(enriched, TEMPLATE_PATH, templateInfo);
    expect(buffer).toBeInstanceOf(Buffer);

    const zip = await JSZip.loadAsync(buffer);

    // Should have 3 slides
    const slideFiles = Object.keys(zip.files).filter(
      name => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles).toHaveLength(3);

    // Should have image files in ppt/media/
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/') && !zip.files[name].dir);
    expect(mediaFiles.length).toBeGreaterThanOrEqual(5);

    // Content types should include PNG
    const contentTypes = await zip.file('[Content_Types].xml')?.async('text');
    expect(contentTypes).toContain('Extension="png"');

    // Slide 1 (architecture) should have image relationships
    const slide1Rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('text');
    expect(slide1Rels).toContain('rIdImg');
  });

  it('handles a presentation with _splitIndex in titles', async () => {
    const caps = makeTier1Capabilities();
    const ast: Presentation = {
      title: 'Split Test',
      slides: [
        {
          layout: 'bullets',
          elements: [
            { type: 'title', text: 'Many Items' },
            {
              type: 'bullets',
              items: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
            },
          ],
        },
      ],
    };

    const enriched = transformPresentation(ast, caps);
    expect(enriched.slides.length).toBe(3);
    expect(enriched.slides[0]._splitIndex).toBe('(1/3)');
    expect(enriched.slides[2]._splitIndex).toBe('(3/3)');

    const buffer = await renderToBuffer(enriched, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles).toHaveLength(3);
  });
});

// ─── Chart Rendering ─────────────────────────────────────────────────────────

describe('chart rendering', () => {
  it('produces chart files in the ZIP', async () => {
    const presentation: Presentation = {
      title: 'Chart Test',
      slides: [{
        layout: 'chart', _resolvedLayout: 'chart',
        elements: [
          { type: 'title', text: 'Revenue Chart' },
          {
            type: 'chart', chartType: 'bar',
            data: { labels: ['Q1', 'Q2', 'Q3'], series: [{ name: 'Revenue', values: [100, 200, 150] }] },
          },
        ],
      }],
    };
    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file('ppt/charts/chart1.xml')).not.toBeNull();
    expect(zip.file('ppt/charts/style1.xml')).not.toBeNull();
    expect(zip.file('ppt/charts/colors1.xml')).not.toBeNull();
    expect(zip.file('ppt/charts/_rels/chart1.xml.rels')).not.toBeNull();

    const chartXml = await zip.file('ppt/charts/chart1.xml')?.async('text');
    expect(chartXml).toContain('<c:barChart>');
    expect(chartXml).toContain('Revenue');

    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('<p:graphicFrame>');
    expect(slideXml).toContain('Revenue Chart');
    expect(slideXml).not.toContain('__CHART_RELID__');
    expect(slideXml).toContain('rIdChart1');

    const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('text');
    expect(slideRels).toContain('rIdChart1');
    expect(slideRels).toContain('relationships/chart');

    const contentTypes = await zip.file('[Content_Types].xml')?.async('text');
    expect(contentTypes).toContain('chart1.xml');
    expect(contentTypes).toContain('drawingml.chart+xml');
  });

  it('numbers charts globally across slides', async () => {
    const presentation: Presentation = {
      title: 'Multi Chart',
      slides: [
        {
          layout: 'chart', _resolvedLayout: 'chart',
          elements: [
            { type: 'title', text: 'Chart 1' },
            { type: 'chart', chartType: 'bar', data: { labels: ['A'], series: [{ name: 'S', values: [1] }] } },
          ],
        },
        {
          layout: 'chart', _resolvedLayout: 'chart',
          elements: [
            { type: 'title', text: 'Chart 2' },
            { type: 'chart', chartType: 'pie', data: { labels: ['A', 'B'], series: [{ name: 'S', values: [60, 40] }] } },
          ],
        },
      ],
    };
    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    expect(zip.file('ppt/charts/chart1.xml')).not.toBeNull();
    expect(zip.file('ppt/charts/chart2.xml')).not.toBeNull();
    const chart1 = await zip.file('ppt/charts/chart1.xml')?.async('text');
    const chart2 = await zip.file('ppt/charts/chart2.xml')?.async('text');
    expect(chart1).toContain('<c:barChart>');
    expect(chart2).toContain('<c:pieChart>');
  });
});
