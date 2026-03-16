import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { TemplateCapabilities } from '../../src/schema/capabilities.js';
import { buildDemoAST, generateDemo } from '../../src/validator/demoGenerator.js';
import { makeTier2Capabilities } from '../helpers/capabilitiesHelpers.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

describe('buildDemoAST', () => {
  it('produces 14+ slides for a Tier 2 template', () => {
    const caps = makeTier2Capabilities();
    const ast = buildDemoAST(caps);

    // 14 base + 2 degradation (kpi and architecture are not supported)
    expect(ast.slides.length).toBeGreaterThanOrEqual(14);
    expect(ast.slides.length).toBeLessThanOrEqual(16);
  });

  it('includes degradation slides when kpi/architecture are absent', () => {
    const caps = makeTier2Capabilities();
    const ast = buildDemoAST(caps);

    // Should have 16 slides: 14 base + kpi degradation + architecture degradation
    expect(ast.slides.length).toBe(16);

    // Last two slides are degradation demos
    const kpiSlide = ast.slides.find(s => s.layout === 'kpi');
    expect(kpiSlide).toBeDefined();
    expect(kpiSlide!.notes).toContain('Degradation');

    const archSlide = ast.slides.find(s =>
      s.layout === 'architecture' && s.notes?.includes('Degradation'),
    );
    expect(archSlide).toBeDefined();
  });

  it('omits degradation slides when layouts are supported', () => {
    const caps: TemplateCapabilities = {
      ...makeTier2Capabilities(),
      tier: 3,
      supported_layouts: [
        'title', 'section', 'bullets', 'generic', 'twoColumns', 'timeline',
        'architecture', 'chart', 'table', 'kpi', 'quote', 'imageText',
        'roadmap', 'process', 'comparison',
      ],
      unsupported_layouts: [],
    };

    const ast = buildDemoAST(caps);
    // All layouts supported → no degradation slides → exactly 14
    expect(ast.slides.length).toBe(14);
  });

  it('each slide has speaker notes', () => {
    const caps = makeTier2Capabilities();
    const ast = buildDemoAST(caps);

    for (const slide of ast.slides) {
      expect(slide.notes).toBeDefined();
      expect(slide.notes!.length).toBeGreaterThan(0);
    }
  });
});

describe('generateDemo', () => {
  it('produces a valid PPTX buffer with 14+ slides', async () => {
    const caps = makeTier2Capabilities();
    const buffer = await generateDemo(caps, TEMPLATE_PATH);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Validate it's a valid ZIP/PPTX
    const zip = await JSZip.loadAsync(buffer);
    const slideFiles = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );

    // Transform may split some slides, so count should be >= 14
    expect(slideFiles.length).toBeGreaterThanOrEqual(14);
  });

  it('contains timeline shapes in timeline slides', async () => {
    const caps = makeTier2Capabilities();
    const buffer = await generateDemo(caps, TEMPLATE_PATH);
    const zip = await JSZip.loadAsync(buffer);

    // Find all slide XMLs and check at least one has timeline colors
    const slideNames = Object.keys(zip.files).filter(
      (name) => name.match(/^ppt\/slides\/slide\d+\.xml$/),
    );

    let foundTimelineShapes = false;
    for (const name of slideNames) {
      const xml = await zip.file(name)?.async('text');
      // Timeline slides have ellipse shapes for events and line shapes for the track
      if (xml && xml.includes('prstGeom prst="ellipse"') && xml.includes('prstGeom prst="line"')) {
        foundTimelineShapes = true;
        break;
      }
    }
    expect(foundTimelineShapes).toBe(true);
  });
});
