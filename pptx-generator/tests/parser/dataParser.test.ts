import { describe, it, expect } from 'vitest';
import { parseCSV, parseJSONData, detectDataType } from '../../src/parser/dataParser.ts';

describe('detectDataType', () => {
  it('should detect numeric columns as kpi', () => {
    const headers = ['Metric', 'Value'];
    const rows = [['Revenue', '1200000'], ['Users', '50000']];
    expect(detectDataType(headers, rows)).toBe('kpi');
  });

  it('should detect date + text columns as timeline', () => {
    const headers = ['Date', 'Milestone'];
    const rows = [['2026-Q1', 'Planning'], ['2026-Q2', 'Dev']];
    expect(detectDataType(headers, rows)).toBe('timeline');
  });

  it('should detect multi-column mixed data as table', () => {
    const headers = ['Name', 'Role', 'Department', 'Status'];
    const rows = [['Alice', 'Dev', 'Eng', 'Active'], ['Bob', 'PM', 'Product', 'Active']];
    expect(detectDataType(headers, rows)).toBe('table');
  });
});

describe('parseCSV', () => {
  it('should parse CSV with numeric data into KPI slides', () => {
    const csv = 'Metric,Value\nRevenue,1200000\nUsers,50000\nChurn,2.1';
    const result = parseCSV(csv, 'KPI Dashboard');
    expect(result.title).toBe('KPI Dashboard');
    expect(result.slides.length).toBeGreaterThanOrEqual(2);
    const kpiSlide = result.slides.find(s => s.layout === 'kpi');
    expect(kpiSlide).toBeDefined();
  });

  it('should parse CSV with dates into timeline slides', () => {
    const csv = 'Date,Milestone,Status\n2026-Q1,Planning,done\n2026-Q2,Development,in-progress\n2026-Q3,Launch,planned';
    const result = parseCSV(csv, 'Project Timeline');
    const timelineSlide = result.slides.find(s => s.layout === 'timeline');
    expect(timelineSlide).toBeDefined();
  });

  it('should parse CSV with mixed data into table slides', () => {
    const csv = 'Name,Role,Department\nAlice,Developer,Engineering\nBob,Designer,Product';
    const result = parseCSV(csv, 'Team Overview');
    const tableSlide = result.slides.find(s => s.layout === 'table');
    expect(tableSlide).toBeDefined();
  });
});

describe('parseJSONData', () => {
  it('should parse hierarchical JSON into architecture slides', () => {
    const data = {
      nodes: [
        { id: 'web', label: 'Web App', layer: 'Frontend' },
        { id: 'api', label: 'API', layer: 'Backend' },
      ],
      edges: [{ from: 'web', to: 'api' }],
    };
    const result = parseJSONData(data, 'System Architecture');
    const archSlide = result.slides.find(s => s.layout === 'architecture');
    expect(archSlide).toBeDefined();
  });

  it('should parse array of KPI objects into kpi slides', () => {
    const data = [
      { label: 'Revenue', value: '1.2M', unit: 'USD', trend: 'up' },
      { label: 'Users', value: '50K', trend: 'stable' },
    ];
    const result = parseJSONData(data, 'Dashboard');
    const kpiSlide = result.slides.find(s => s.layout === 'kpi');
    expect(kpiSlide).toBeDefined();
  });

  it('should parse array of timeline events into timeline slides', () => {
    const data = [
      { date: '2026-Q1', label: 'Start', status: 'done' },
      { date: '2026-Q2', label: 'Build', status: 'in-progress' },
    ];
    const result = parseJSONData(data, 'Roadmap');
    const timelineSlide = result.slides.find(s => s.layout === 'timeline');
    expect(timelineSlide).toBeDefined();
  });
});
