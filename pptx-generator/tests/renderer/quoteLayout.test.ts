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

describe('quoteLayout', () => {
  it('renders quote text with decorative formatting', async () => {
    const presentation: Presentation = {
      title: 'Quote Test',
      slides: [
        {
          layout: 'quote',
          _resolvedLayout: 'quote',
          elements: [
            { type: 'title', text: 'Inspiration' },
            {
              type: 'quote',
              text: 'The only way to do great work is to love what you do.',
              author: 'Steve Jobs',
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Inspiration');
    // Quote text is wrapped in Unicode curly quotes
    expect(slideXml).toContain('\u201C');
    expect(slideXml).toContain('The only way to do great work is to love what you do.');
    expect(slideXml).toContain('\u201D');
    // Author is prefixed with em dash
    expect(slideXml).toContain('\u2014 Steve Jobs');
    // Uses textbox shapes
    expect(slideXml).toContain('txBox="1"');
  });

  it('renders quote without author', async () => {
    const presentation: Presentation = {
      title: 'Quote No Author Test',
      slides: [
        {
          layout: 'quote',
          _resolvedLayout: 'quote',
          elements: [
            { type: 'title', text: 'Thought' },
            {
              type: 'quote',
              text: 'Less is more.',
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Thought');
    expect(slideXml).toContain('Less is more.');
    // No em dash without author
    expect(slideXml).not.toContain('\u2014');
  });

  it('emits icon request for quote with icon', async () => {
    const presentation: Presentation = {
      title: 'Quote Icon Test',
      slides: [
        {
          layout: 'quote',
          _resolvedLayout: 'quote',
          elements: [
            { type: 'title', text: 'With Icon' },
            {
              type: 'quote',
              text: 'Innovation distinguishes between a leader and a follower.',
              author: 'Steve Jobs',
              icon: 'quote',
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    // Should contain p:pic element for quote icon
    expect(slideXml).toContain('<p:pic>');

    // Should have an image file in ppt/media/
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
    expect(mediaFiles.length).toBeGreaterThan(0);
  });
});
