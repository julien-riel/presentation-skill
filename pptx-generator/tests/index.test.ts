import { describe, it, expect, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';
import {
  generateFromAST,
  generateFromData,
  validateTemplate,
  buildPrompt,
  buildDataPrompt,
  getDefaultTemplatePath,
  getDefaultManifest,
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = path.resolve(__dirname, '../assets/default-template.pptx');
const SIDECAR_PATH = TEMPLATE_PATH.replace(/\.pptx$/i, '.capabilities.json');

afterAll(async () => {
  try { await fs.unlink(SIDECAR_PATH); } catch { /* ignore */ }
});

describe('validateTemplate', () => {
  it('returns a validation report for the default template', async () => {
    const report = await validateTemplate(TEMPLATE_PATH);
    expect(report.results).toBeDefined();
    expect(report.manifest).toBeDefined();
    expect(report.manifest.tier).toBe(2);
    expect(report.hasErrors).toBe(false);
  });

  it('reports hasWarnings for templates with warnings', async () => {
    const report = await validateTemplate(getDefaultTemplatePath());
    // The default template is well-formed, so check the type at minimum
    expect(typeof report.hasWarnings).toBe('boolean');
    expect(typeof report.hasErrors).toBe('boolean');
  });
});

describe('generateFromAST', () => {
  it('generates a .pptx buffer from a valid AST', async () => {
    const ast = {
      title: 'Test Presentation',
      slides: [
        {
          layout: 'title' as const,
          elements: [
            { type: 'title' as const, text: 'Hello World' },
            { type: 'subtitle' as const, text: 'A test' },
          ],
        },
        {
          layout: 'bullets' as const,
          elements: [
            { type: 'title' as const, text: 'Points' },
            { type: 'bullets' as const, items: ['One', 'Two', 'Three'] },
          ],
        },
      ],
    };
    const buffer = await generateFromAST(ast);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('accepts a custom template path', async () => {
    const ast = {
      title: 'Custom Template Test',
      slides: [
        {
          layout: 'title' as const,
          elements: [{ type: 'title' as const, text: 'Hello' }],
        },
      ],
    };
    const buffer = await generateFromAST(ast, TEMPLATE_PATH);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('throws on invalid AST', async () => {
    await expect(generateFromAST({ title: 123 } as any)).rejects.toThrow();
  });
});

describe('generateFromData', () => {
  it('generates a .pptx from CSV string', async () => {
    const csv = 'Metric,Value\nRevenue,1.2M\nUsers,50K';
    const buffer = await generateFromData(csv, 'csv', 'KPI Report');
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('generates a .pptx from JSON data', async () => {
    const jsonData = [
      { date: '2026-Q1', label: 'Launch', status: 'done' },
      { date: '2026-Q2', label: 'Scale', status: 'planned' },
    ];
    const buffer = await generateFromData(jsonData, 'json', 'Timeline');
    expect(buffer).toBeInstanceOf(Buffer);
  });
});

describe('buildPrompt', () => {
  it('returns a prompt string with the brief embedded', () => {
    const manifest = getDefaultManifest();
    const prompt = buildPrompt(manifest, 'A presentation about AI');
    expect(prompt).toContain('AI');
    expect(prompt).toContain('JSON');
    expect(typeof prompt).toBe('string');
  });
});

describe('getDefaultTemplatePath', () => {
  it('returns a path that exists', async () => {
    const p = getDefaultTemplatePath();
    const stat = await fs.stat(p);
    expect(stat.isFile()).toBe(true);
  });
});

describe('getDefaultManifest', () => {
  it('returns a valid manifest object', () => {
    const m = getDefaultManifest();
    expect(m.tier).toBe(2);
    expect(m.supported_layouts.length).toBeGreaterThan(0);
    expect(m.template).toBe('default-template.pptx');
  });
});

describe('buildDataPrompt', () => {
  it('returns a prompt with data summary and narration instructions', () => {
    const manifest = getDefaultManifest();
    const csv = 'Metric,Value\nRevenue,1.2M\nUsers,50K';
    const prompt = buildDataPrompt(manifest, csv, 'csv', 'KPI Report');
    expect(prompt).toContain('KPI Report');
    expect(prompt).toContain('Data to Present');
    expect(prompt).toContain('Revenue');
    expect(typeof prompt).toBe('string');
  });
});

describe('chart round-trip', () => {
  it('generates a PPTX containing native OOXML chart XML', async () => {
    // Use renderToBuffer directly with a pre-resolved chart layout
    // (the default template is Tier 2 and would degrade chart → bullets)
    const { renderToBuffer } = await import('../src/renderer/pptxRenderer.js');
    const { readTemplate } = await import('../src/validator/templateReader.js');
    const { readFile } = await import('fs/promises');

    const templatePath = getDefaultTemplatePath();
    const templateBuffer = await readFile(templatePath);
    const templateInfo = await readTemplate(templatePath);

    const ast = {
      title: 'Chart Test',
      slides: [
        {
          layout: 'chart' as const,
          _resolvedLayout: 'chart' as const,
          elements: [
            { type: 'title' as const, text: 'Revenue Chart' },
            {
              type: 'chart' as const,
              chartType: 'bar' as const,
              data: {
                labels: ['Q1', 'Q2', 'Q3'],
                series: [{ name: 'Revenue', values: [100, 200, 150] }],
              },
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(ast, templateBuffer, templateInfo);
    const zip = await JSZip.loadAsync(buffer);

    // Verify chart XML exists and contains expected OOXML structure
    const chartFile = zip.file('ppt/charts/chart1.xml');
    expect(chartFile).not.toBeNull();
    const chartXml = await chartFile!.async('text');
    expect(chartXml).toContain('<c:chartSpace');
    expect(chartXml).toContain('<c:barChart>');
    expect(chartXml).toContain('Revenue');
    expect(chartXml).toContain('<c:v>100</c:v>');

    // Verify chart style and colors exist
    expect(zip.file('ppt/charts/style1.xml')).not.toBeNull();
    expect(zip.file('ppt/charts/colors1.xml')).not.toBeNull();

    // Verify chart relationship in slide rels
    const slideRels = zip.file('ppt/slides/_rels/slide1.xml.rels');
    expect(slideRels).not.toBeNull();
    const relsXml = await slideRels!.async('text');
    expect(relsXml).toContain('chart1.xml');

    // Verify content types include chart overrides
    const contentTypes = zip.file('[Content_Types].xml');
    expect(contentTypes).not.toBeNull();
    const ctXml = await contentTypes!.async('text');
    expect(ctXml).toContain('drawingml.chart+xml');
  });

  it('generates different chart types with correct XML elements', async () => {
    const { renderToBuffer } = await import('../src/renderer/pptxRenderer.js');
    const { readTemplate } = await import('../src/validator/templateReader.js');
    const { readFile } = await import('fs/promises');

    const templatePath = getDefaultTemplatePath();
    const templateBuffer = await readFile(templatePath);
    const templateInfo = await readTemplate(templatePath);

    const makeChartPresentation = (chartType: string) => ({
      title: 'Chart Test',
      slides: [{
        layout: 'chart' as const,
        _resolvedLayout: 'chart' as const,
        elements: [
          { type: 'title' as const, text: 'Test' },
          {
            type: 'chart' as const,
            chartType: chartType as any,
            data: { labels: ['A', 'B'], series: [{ name: 'S', values: [1, 2] }] },
          },
        ],
      }],
    });

    const lineBuffer = await renderToBuffer(makeChartPresentation('line'), templateBuffer, templateInfo);
    const lineZip = await JSZip.loadAsync(lineBuffer);
    const lineXml = await lineZip.file('ppt/charts/chart1.xml')!.async('text');
    expect(lineXml).toContain('<c:lineChart>');

    const pieBuffer = await renderToBuffer(makeChartPresentation('pie'), templateBuffer, templateInfo);
    const pieZip = await JSZip.loadAsync(pieBuffer);
    const pieXml = await pieZip.file('ppt/charts/chart1.xml')!.async('text');
    expect(pieXml).toContain('<c:pieChart>');
  });
});
