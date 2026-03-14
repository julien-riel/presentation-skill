import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import type { Presentation, Slide } from '../../src/schema/presentation.js';
import type { TemplateCapabilities } from '../../src/schema/capabilities.js';
import { transformPresentation } from '../../src/transform/index.js';
import { renderPresentation, renderToBuffer } from '../../src/renderer/pptxRenderer.js';

/**
 * Helper: creates a minimal Tier 1 capabilities manifest.
 */
function makeTier1Capabilities(extra: string[] = []): TemplateCapabilities {
  const supported = ['title', 'section', 'bullets', 'generic', ...extra];
  return {
    template: 'test-template.pptx',
    generated_at: '2026-03-14T00:00:00Z',
    validator_version: '1.0.0',
    tier: 1,
    supported_layouts: supported as TemplateCapabilities['supported_layouts'],
    unsupported_layouts: [],
    fallback_map: {
      kpi: 'bullets',
      chart: 'bullets',
      table: 'bullets',
      quote: 'bullets',
      architecture: 'bullets',
      imageText: 'twoColumns',
      roadmap: 'timeline',
      process: 'timeline',
      comparison: 'twoColumns',
    },
    placeholders: {},
    theme: { title_font: 'Arial', body_font: 'Calibri', accent_colors: ['#000'] },
    slide_dimensions: { width_emu: 12192000, height_emu: 6858000 },
  };
}

// ─── Renderer Unit Tests ──────────────────────────────────────────────────────

describe('renderPresentation', () => {
  it('creates a PptxGenJS instance with correct title', () => {
    const presentation: Presentation = {
      title: 'Test Deck',
      slides: [
        {
          layout: 'title',
          _resolvedLayout: 'title',
          elements: [
            { type: 'title', text: 'Hello World' },
            { type: 'subtitle', text: 'A test' },
          ],
        },
      ],
    };

    const pptx = renderPresentation(presentation);
    expect(pptx.title).toBe('Test Deck');
  });

  it('sets author from metadata', () => {
    const presentation: Presentation = {
      title: 'Test',
      metadata: { author: 'Jane Doe' },
      slides: [
        {
          layout: 'title',
          _resolvedLayout: 'title',
          elements: [{ type: 'title', text: 'Hi' }],
        },
      ],
    };

    const pptx = renderPresentation(presentation);
    expect(pptx.author).toBe('Jane Doe');
  });
});

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

    const buffer = await renderToBuffer(presentation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify it's a valid ZIP (PPTX)
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

    const buffer = await renderToBuffer(presentation);
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles).toHaveLength(1);
  });

  it('handles canvas layout with text placeholder', async () => {
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

    const buffer = await renderToBuffer(presentation);
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles).toHaveLength(1);
  });

  it('respects _fontSizeOverride in rendered output', async () => {
    const presentation: Presentation = {
      title: 'Font Override',
      slides: [
        {
          layout: 'bullets',
          _resolvedLayout: 'bullets',
          _fontSizeOverride: 16,
          elements: [
            { type: 'title', text: 'Smaller Font' },
            { type: 'bullets', items: ['A', 'B', 'C', 'D'] },
          ],
        },
      ],
    };

    // Verify it renders without error and produces valid PPTX
    const buffer = await renderToBuffer(presentation);
    expect(buffer.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();
    // Font size 16pt → 1600 hundredths of a point in OOXML
    expect(slideXml).toContain('1600');
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

    const buffer = await renderToBuffer(presentation);
    const zip = await JSZip.loadAsync(buffer);
    // PptxGenJS stores notes in notesSlide files
    const notesFiles = Object.keys(zip.files).filter(
      (name) => name.includes('notesSlide'),
    );
    expect(notesFiles.length).toBeGreaterThan(0);
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

    // Step 1: Transform
    const enriched = transformPresentation(ast, caps);

    // kpi → bullets degradation
    expect(enriched.slides[3]._resolvedLayout).toBe('bullets');

    // 7 bullets → split into 2 slides (5 + 2)
    // Original 5 slides become 6 after split
    expect(enriched.slides.length).toBe(6);

    // Step 2: Render
    const buffer = await renderToBuffer(enriched);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Step 3: Validate PPTX structure
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles).toHaveLength(6);

    // Verify it contains actual XML content
    const firstSlide = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(firstSlide).toBeDefined();
    expect(firstSlide).toContain('Welcome');
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
    // 11 bullets → ceil(11/5) = 3 slides
    expect(enriched.slides.length).toBe(3);
    expect(enriched.slides[0]._splitIndex).toBe('(1/3)');
    expect(enriched.slides[2]._splitIndex).toBe('(3/3)');

    const buffer = await renderToBuffer(enriched);
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles).toHaveLength(3);
  });
});
