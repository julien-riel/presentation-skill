import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import { readFile } from 'fs/promises';
import type { Presentation } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';
import { ElementSchema } from '../../src/schema/presentation.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');
const TEST_PNG_PATH = path.resolve(__dirname, '../fixtures/test-1x1.png');

let templateInfo: TemplateInfo;
let templateBuffer: Buffer;
beforeAll(async () => {
  templateBuffer = await readFile(TEMPLATE_PATH);
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

// ─── Schema ──────────────────────────────────────────────────────────────────

describe('ImageElementSchema', () => {
  it('accepts an image element with path', () => {
    const el = { type: 'image', path: '/tmp/photo.png' };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('accepts an image element with altText', () => {
    const el = { type: 'image', path: '/tmp/photo.png', altText: 'Team photo' };
    expect(ElementSchema.parse(el)).toEqual(el);
  });

  it('rejects an image element without path', () => {
    expect(() => ElementSchema.parse({ type: 'image' })).toThrow();
  });
});

// ─── Rendering on imageText layout ──────────────────────────────────────────

describe('image element on imageText layout', () => {
  it('embeds the image file in the ZIP', async () => {
    const presentation: Presentation = {
      title: 'Image Test',
      slides: [
        {
          layout: 'imageText',
          _resolvedLayout: 'imageText',
          elements: [
            { type: 'title', text: 'Photo Slide' },
            { type: 'image', path: TEST_PNG_PATH, altText: 'A test pixel' },
            { type: 'text', text: 'Description text' },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(buffer);

    // Should have 1 slide
    const slideFiles = Object.keys(zip.files).filter(
      name => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );
    expect(slideFiles).toHaveLength(1);

    // Image file should be embedded in ppt/media/
    const mediaFiles = Object.keys(zip.files).filter(
      name => name.startsWith('ppt/media/') && !zip.files[name].dir,
    );
    expect(mediaFiles.length).toBeGreaterThanOrEqual(1);

    // At least one media file should be a PNG with our test image
    const pngMedia = mediaFiles.filter(name => name.endsWith('.png'));
    expect(pngMedia.length).toBeGreaterThanOrEqual(1);

    // Slide XML should contain a picture shape
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();
    expect(slideXml).toContain('<p:pic>');
    expect(slideXml).toContain('Photo Slide');
    expect(slideXml).toContain('Description text');

    // Alt text should be in the picture shape
    expect(slideXml).toContain('A test pixel');

    // Slide rels should contain image relationship
    const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('text');
    expect(slideRels).toContain('rIdImg');
    expect(slideRels).toContain('relationships/image');

    // Content types should include PNG
    const contentTypes = await zip.file('[Content_Types].xml')?.async('text');
    expect(contentTypes).toContain('Extension="png"');
  });
});

// ─── Rendering on generic layout ────────────────────────────────────────────

describe('image element on generic layout', () => {
  it('embeds the image in the content area', async () => {
    const presentation: Presentation = {
      title: 'Generic Image Test',
      slides: [
        {
          layout: 'generic',
          _resolvedLayout: 'generic',
          elements: [
            { type: 'title', text: 'Full Image' },
            { type: 'image', path: TEST_PNG_PATH },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);

    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('<p:pic>');
    expect(slideXml).toContain('Full Image');

    const mediaFiles = Object.keys(zip.files).filter(
      name => name.startsWith('ppt/media/') && !zip.files[name].dir,
    );
    expect(mediaFiles.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Missing file handling ──────────────────────────────────────────────────

describe('image element with missing file', () => {
  it('gracefully skips the image without crashing', async () => {
    const presentation: Presentation = {
      title: 'Missing Image Test',
      slides: [
        {
          layout: 'generic',
          _resolvedLayout: 'generic',
          elements: [
            { type: 'title', text: 'No Image' },
            { type: 'image', path: '/nonexistent/path/missing.png' },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
    expect(buffer).toBeInstanceOf(Buffer);

    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('No Image');

    // No media files should be embedded (the image was missing)
    const mediaFiles = Object.keys(zip.files).filter(
      name => name.startsWith('ppt/media/') && !zip.files[name].dir,
    );
    expect(mediaFiles).toHaveLength(0);
  });
});

// ─── JPEG extension handling ────────────────────────────────────────────────

describe('image element with JPEG extension', () => {
  it('uses jpg extension in media path', async () => {
    // Create a temp JPEG file (actually PNG bytes, but we just test the extension logic)
    const fs = await import('fs/promises');
    const os = await import('os');
    const tmpDir = os.tmpdir();
    const jpgPath = path.join(tmpDir, 'test-image-element.jpg');
    const pngBytes = await fs.readFile(TEST_PNG_PATH);
    await fs.writeFile(jpgPath, pngBytes);

    try {
      const presentation: Presentation = {
        title: 'JPEG Test',
        slides: [
          {
            layout: 'generic',
            _resolvedLayout: 'generic',
            elements: [
              { type: 'title', text: 'JPEG Slide' },
              { type: 'image', path: jpgPath },
            ],
          },
        ],
      };

      const buffer = await renderToBuffer(presentation, templateBuffer, templateInfo);
      const zip = await JSZip.loadAsync(buffer);

      const mediaFiles = Object.keys(zip.files).filter(
        name => name.startsWith('ppt/media/') && !zip.files[name].dir,
      );
      expect(mediaFiles.length).toBe(1);
      expect(mediaFiles[0]).toMatch(/\.jpg$/);

      // Content types should include jpeg type
      const contentTypes = await zip.file('[Content_Types].xml')?.async('text');
      expect(contentTypes).toContain('Extension="jpg"');
      expect(contentTypes).toContain('image/jpeg');
    } finally {
      await fs.unlink(jpgPath).catch(() => {});
    }
  });
});
