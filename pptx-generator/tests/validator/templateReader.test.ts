import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import PptxGenJS from 'pptxgenjs';
import { readTemplate } from '../../src/validator/templateReader.js';

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const FIXTURE_PATH = path.join(FIXTURES_DIR, 'test-template.pptx');

/**
 * Creates a minimal .pptx fixture using PptxGenJS for testing.
 * Adds slides with specific layout names and placeholder-like content.
 */
async function createTestFixture(): Promise<void> {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });

  const pptx = new PptxGenJS();

  // Configure 16:9 dimensions
  pptx.defineLayout({ name: 'LAYOUT_16x9', width: 13.33, height: 7.5 });
  pptx.layout = 'LAYOUT_16x9';

  // Add a title slide
  const slide1 = pptx.addSlide();
  slide1.addText('Title Placeholder', { x: 1, y: 1, w: 10, h: 1.5, fontSize: 36 });
  slide1.addText('Subtitle Placeholder', { x: 1, y: 3, w: 10, h: 1, fontSize: 18 });

  // Add a bullets slide
  const slide2 = pptx.addSlide();
  slide2.addText('Bullets Title', { x: 1, y: 0.5, w: 10, h: 1, fontSize: 24 });
  slide2.addText('Bullet content area', { x: 1, y: 2, w: 10, h: 4, fontSize: 16 });

  // Write to file
  const output = await pptx.write({ outputType: 'nodebuffer' });
  await fs.writeFile(FIXTURE_PATH, output as Buffer);
}

describe('readTemplate', () => {
  beforeAll(async () => {
    await createTestFixture();
  });

  it('reads a .pptx file without throwing', async () => {
    const info = await readTemplate(FIXTURE_PATH);
    expect(info).toBeDefined();
  });

  it('extracts layouts from the template', async () => {
    const info = await readTemplate(FIXTURE_PATH);
    expect(info.layouts).toBeInstanceOf(Array);
    expect(info.layouts.length).toBeGreaterThan(0);
  });

  it('extracts layout names as strings', async () => {
    const info = await readTemplate(FIXTURE_PATH);
    for (const layout of info.layouts) {
      expect(typeof layout.name).toBe('string');
    }
  });

  it('extracts placeholders with index, type, and position', async () => {
    const info = await readTemplate(FIXTURE_PATH);
    const layoutWithPh = info.layouts.find((l) => l.placeholders.length > 0);

    if (layoutWithPh) {
      const ph = layoutWithPh.placeholders[0];
      expect(ph).toHaveProperty('index');
      expect(ph).toHaveProperty('type');
      expect(ph).toHaveProperty('position');
      expect(ph.position).toHaveProperty('x');
      expect(ph.position).toHaveProperty('y');
      expect(ph.position).toHaveProperty('cx');
      expect(ph.position).toHaveProperty('cy');
      expect(typeof ph.index).toBe('number');
    }
  });

  it('extracts theme information', async () => {
    const info = await readTemplate(FIXTURE_PATH);
    expect(info.theme).toBeDefined();
    expect(typeof info.theme.titleFont).toBe('string');
    expect(typeof info.theme.bodyFont).toBe('string');
    expect(info.theme.accentColors).toBeInstanceOf(Array);
  });

  it('extracts slide dimensions', async () => {
    const info = await readTemplate(FIXTURE_PATH);
    expect(info.slideDimensions).toBeDefined();
    expect(typeof info.slideDimensions.widthEmu).toBe('number');
    expect(typeof info.slideDimensions.heightEmu).toBe('number');
    expect(info.slideDimensions.widthEmu).toBeGreaterThan(0);
    expect(info.slideDimensions.heightEmu).toBeGreaterThan(0);
  });

  it('throws on non-existent file', async () => {
    await expect(readTemplate('/nonexistent/path.pptx')).rejects.toThrow();
  });

  it('throws on invalid (non-zip) file', async () => {
    const badPath = path.join(FIXTURES_DIR, 'bad.pptx');
    await fs.writeFile(badPath, 'not a zip file');
    await expect(readTemplate(badPath)).rejects.toThrow();
  });
});
