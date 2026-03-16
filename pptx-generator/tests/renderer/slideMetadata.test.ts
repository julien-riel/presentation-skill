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

// ─── Slide Numbers ──────────────────────────────────────────────────────────

describe('slide numbers', () => {
  it('adds slide number textbox when showSlideNumbers is true', async () => {
    const presentation: Presentation = {
      title: 'Numbered',
      showSlideNumbers: true,
      slides: [
        {
          layout: 'bullets',
          _resolvedLayout: 'bullets',
          elements: [
            { type: 'title', text: 'Slide One' },
            { type: 'bullets', items: ['A', 'B'] },
          ],
        },
        {
          layout: 'bullets',
          _resolvedLayout: 'bullets',
          elements: [
            { type: 'title', text: 'Slide Two' },
            { type: 'bullets', items: ['C'] },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);

    const slide1Xml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    const slide2Xml = await zip.file('ppt/slides/slide2.xml')?.async('text');
    expect(slide1Xml).toBeDefined();
    expect(slide2Xml).toBeDefined();

    // Slide 1 should have "1" and slide 2 should have "2" with gray color
    expect(slide1Xml).toContain('999999');
    expect(slide2Xml).toContain('999999');
    // Check that slide numbers appear (font size 8 = 800 hundredths)
    expect(slide1Xml).toContain('sz="800"');
    expect(slide2Xml).toContain('sz="800"');
  });

  it('does not add slide numbers when showSlideNumbers is false', async () => {
    const presentation: Presentation = {
      title: 'No Numbers',
      showSlideNumbers: false,
      slides: [
        {
          layout: 'title',
          _resolvedLayout: 'title',
          elements: [{ type: 'title', text: 'Title Only' }],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    // Should NOT contain the gray small-font marker from slide numbers
    expect(slideXml).not.toContain('sz="800"');
  });
});

// ─── Footer ─────────────────────────────────────────────────────────────────

describe('footer', () => {
  it('adds footer textbox when footer is set', async () => {
    const presentation: Presentation = {
      title: 'With Footer',
      footer: 'Confidential - Internal Use Only',
      slides: [
        {
          layout: 'bullets',
          _resolvedLayout: 'bullets',
          elements: [
            { type: 'title', text: 'First' },
            { type: 'bullets', items: ['X'] },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('Confidential - Internal Use Only');
    expect(slideXml).toContain('999999');
    expect(slideXml).toContain('sz="800"');
  });

  it('does not add footer when footer is not set', async () => {
    const presentation: Presentation = {
      title: 'No Footer',
      slides: [
        {
          layout: 'title',
          _resolvedLayout: 'title',
          elements: [{ type: 'title', text: 'Clean Slide' }],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();
    expect(slideXml).not.toContain('sz="800"');
  });
});

// ─── Hyperlinks ─────────────────────────────────────────────────────────────

describe('hyperlinks in text elements', () => {
  it('renders a text element with URL as a hyperlink shape', async () => {
    const presentation: Presentation = {
      title: 'Link Test',
      slides: [
        {
          layout: 'generic',
          _resolvedLayout: 'generic',
          elements: [
            { type: 'title', text: 'Links' },
            { type: 'text', text: 'Visit our site', url: 'https://example.com' },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('Visit our site');
    expect(slideXml).toContain('hlinkClick');
    expect(slideXml).toContain('rIdHlink1');

    // Check that the hyperlink relationship exists in slide rels
    const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('text');
    expect(slideRels).toBeDefined();
    expect(slideRels).toContain('rIdHlink1');
    expect(slideRels).toContain('https://example.com');
    expect(slideRels).toContain('TargetMode="External"');
    expect(slideRels).toContain('relationships/hyperlink');
  });

  it('renders text element without URL normally (no hyperlink)', async () => {
    const presentation: Presentation = {
      title: 'No Link',
      slides: [
        {
          layout: 'generic',
          _resolvedLayout: 'generic',
          elements: [
            { type: 'title', text: 'Plain' },
            { type: 'text', text: 'Just regular text' },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('Just regular text');
    expect(slideXml).not.toContain('hlinkClick');
  });

  it('renders hyperlink on title/section layout text element', async () => {
    const presentation: Presentation = {
      title: 'Title Link',
      slides: [
        {
          layout: 'title',
          _resolvedLayout: 'title',
          elements: [
            { type: 'title', text: 'Welcome' },
            { type: 'text', text: 'Click here', url: 'https://docs.example.com' },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('Click here');
    expect(slideXml).toContain('hlinkClick');

    const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('text');
    expect(slideRels).toContain('https://docs.example.com');
    expect(slideRels).toContain('TargetMode="External"');
  });

  it('combines slide numbers, footer, and hyperlinks on the same slide', async () => {
    const presentation: Presentation = {
      title: 'Full Featured',
      showSlideNumbers: true,
      footer: 'ACME Corp',
      slides: [
        {
          layout: 'generic',
          _resolvedLayout: 'generic',
          elements: [
            { type: 'title', text: 'Everything' },
            { type: 'text', text: 'More info', url: 'https://acme.example.com' },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    // Hyperlink
    expect(slideXml).toContain('More info');
    expect(slideXml).toContain('hlinkClick');

    // Slide number
    expect(slideXml).toContain('999999');

    // Footer
    expect(slideXml).toContain('ACME Corp');

    // Rels
    const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('text');
    expect(slideRels).toContain('https://acme.example.com');
  });
});
