import { describe, it, expect } from 'vitest';
import { buildASTPrompt, buildDataPrompt } from '../../src/parser/promptParser.js';
import type { TemplateCapabilities } from '../../src/schema/capabilities.js';
import { makeTier1Capabilities } from '../helpers/capabilitiesHelpers.js';

const MOCK_CAPABILITIES: TemplateCapabilities = {
  template: 'test.pptx',
  generated_at: '2026-03-14T00:00:00Z',
  validator_version: '1.0.0',
  tier: 2,
  supported_layouts: ['title', 'section', 'bullets', 'generic', 'twoColumns', 'timeline'],
  unsupported_layouts: ['architecture', 'chart', 'table', 'kpi', 'quote', 'imageText', 'roadmap', 'process', 'comparison'],
  fallback_map: { architecture: 'bullets', kpi: 'bullets', chart: 'bullets', table: 'bullets', quote: 'bullets', imageText: 'twoColumns', roadmap: 'timeline', process: 'timeline', comparison: 'twoColumns' },
  placeholders: {},
  theme: { title_font: 'Calibri', body_font: 'Calibri', accent_colors: ['#1E3A5F', '#2C7DA0', '#E76F51'] },
  slide_dimensions: { width_emu: 12192000, height_emu: 6858000 },
};

describe('buildASTPrompt', () => {
  it('should include the AST JSON schema structure', () => {
    const prompt = buildASTPrompt(MOCK_CAPABILITIES, 'Make a presentation about AI');
    expect(prompt).toContain('"layout"');
    expect(prompt).toContain('"elements"');
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"slides"');
  });

  it('should list only supported layouts', () => {
    const prompt = buildASTPrompt(MOCK_CAPABILITIES, 'test');
    expect(prompt).toContain('title');
    expect(prompt).toContain('bullets');
    expect(prompt).toContain('twoColumns');
    expect(prompt).toContain('timeline');
    // Should NOT list unsupported layouts in the Available Layouts section
    const layoutSection = prompt.split('## Available Layouts')[1]?.split('##')[0] ?? '';
    expect(layoutSection).not.toContain('"architecture"');
    expect(layoutSection).not.toContain('"kpi"');
  });

  it('should include content rules (max bullets, max words)', () => {
    const prompt = buildASTPrompt(MOCK_CAPABILITIES, 'test');
    expect(prompt).toContain('5');
    expect(prompt).toContain('12');
  });

  it('should include the user brief', () => {
    const brief = 'Create a presentation about project milestones';
    const prompt = buildASTPrompt(MOCK_CAPABILITIES, brief);
    expect(prompt).toContain(brief);
  });

  it('should produce valid JSON-parseable schema example', () => {
    const prompt = buildASTPrompt(MOCK_CAPABILITIES, 'test');
    const jsonMatch = prompt.match(/```json\n([\s\S]*?)\n```/);
    expect(jsonMatch).not.toBeNull();
    if (jsonMatch) {
      expect(() => JSON.parse(jsonMatch[1])).not.toThrow();
    }
  });

  it('includes stackedBar in chart description when chart is supported', () => {
    const caps = { ...makeTier1Capabilities(['chart']), supported_layouts: ['title', 'section', 'bullets', 'generic', 'chart'] as any };
    const prompt = buildASTPrompt(caps, 'Test brief');
    expect(prompt).toContain('stackedBar');
    expect(prompt).toContain('valueFormat');
    expect(prompt).toContain('showDataLabels');
  });
});

describe('buildDataPrompt', () => {
  it('includes data summary for CSV input', () => {
    const csv = 'Name,Score\nAlice,95\nBob,87\nCharlie,92';
    const prompt = buildDataPrompt(MOCK_CAPABILITIES, csv, 'csv', 'Test Scores');
    expect(prompt).toContain('Test Scores');
    expect(prompt).toContain('3 rows');
    expect(prompt).toContain('Name,Score');
    expect(prompt).toContain('Alice,95');
    expect(prompt).toContain('Data to Present');
    expect(prompt).toContain('narrative');
  });

  it('includes data summary for JSON array input', () => {
    const data = [{ label: 'Revenue', value: '1.2M' }, { label: 'Users', value: '50K' }];
    const prompt = buildDataPrompt(MOCK_CAPABILITIES, data, 'json', 'KPI Report');
    expect(prompt).toContain('KPI Report');
    expect(prompt).toContain('2 items');
    expect(prompt).toContain('Revenue');
  });

  it('includes base AST schema and content rules', () => {
    const csv = 'A,B\n1,2';
    const prompt = buildDataPrompt(MOCK_CAPABILITIES, csv, 'csv', 'Test');
    expect(prompt).toContain('## Available Layouts');
    expect(prompt).toContain('## Content Rules');
    expect(prompt).toContain('## Output Format');
  });

  it('handles empty CSV gracefully', () => {
    const prompt = buildDataPrompt(MOCK_CAPABILITIES, '', 'csv', 'Empty');
    expect(prompt).toContain('Empty');
  });

  it('includes instructions for narration', () => {
    const csv = 'X,Y\n1,2';
    const prompt = buildDataPrompt(MOCK_CAPABILITIES, csv, 'csv', 'Test');
    expect(prompt).toContain('trends');
    expect(prompt).toContain('insights');
  });
});
