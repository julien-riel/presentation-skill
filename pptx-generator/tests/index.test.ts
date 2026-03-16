import { describe, it, expect, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import { fileURLToPath } from 'url';
import {
  generateFromAST,
  generateFromData,
  validateTemplate,
  buildPrompt,
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
