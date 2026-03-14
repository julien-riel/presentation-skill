import { describe, it, expect } from 'vitest';
import { readTemplate } from '../../src/validator/templateReader.ts';
import { runValidation } from '../../src/validator/engine.ts';
import { generateManifest } from '../../src/validator/manifestGenerator.ts';
import * as path from 'path';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

describe('default-template.pptx', () => {
  it('should pass validation with zero errors', async () => {
    const template = await readTemplate(TEMPLATE_PATH);
    const results = runValidation(template);
    const errors = results.filter(r => r.status === 'fail' && r.severity === 'ERROR');
    expect(errors).toEqual([]);
  });

  it('should be classified as Tier 2', async () => {
    const template = await readTemplate(TEMPLATE_PATH);
    const manifest = generateManifest(template, 'default-template.pptx');
    expect(manifest.tier).toBe(2);
  });

  it('should support all 6 Tier 2 layouts', async () => {
    const template = await readTemplate(TEMPLATE_PATH);
    const manifest = generateManifest(template, 'default-template.pptx');
    expect(manifest.supported_layouts).toContain('title');
    expect(manifest.supported_layouts).toContain('section');
    expect(manifest.supported_layouts).toContain('bullets');
    expect(manifest.supported_layouts).toContain('generic');
    expect(manifest.supported_layouts).toContain('twoColumns');
    expect(manifest.supported_layouts).toContain('timeline');
  });

  it('should have zero warnings for dimensions', async () => {
    const template = await readTemplate(TEMPLATE_PATH);
    const results = runValidation(template);
    const dimWarnings = results.filter(r => r.id.startsWith('DIM-') && r.status === 'fail');
    expect(dimWarnings).toEqual([]);
  });
});
