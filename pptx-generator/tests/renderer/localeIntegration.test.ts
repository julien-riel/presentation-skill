import { describe, it, expect } from 'vitest';
import { buildChart } from '../../src/renderer/chartDrawer.js';

describe('locale integration with chart pipeline', () => {
  const makeChart = (overrides?: Record<string, unknown>) => ({
    type: 'chart' as const,
    chartType: 'bar' as const,
    data: { labels: ['Q1'], series: [{ name: 'Rev', values: [1000] }] },
    options: { valueFormat: 'currency' as const, ...overrides },
  });

  it('uses € for French locale (fr-FR)', () => {
    const chart = makeChart();
    const result = buildChart(chart, 1, 'fr-FR');
    expect(result.chartRequest.chartXml).toContain('€#,##0');
  });

  it('uses ¥ for Japanese locale (ja-JP)', () => {
    const chart = makeChart();
    const result = buildChart(chart, 1, 'ja-JP');
    expect(result.chartRequest.chartXml).toContain('¥#,##0');
  });

  it('defaults to $ when no locale is provided', () => {
    const chart = makeChart();
    const result = buildChart(chart, 1);
    expect(result.chartRequest.chartXml).toContain('$#,##0');
  });

  it('explicit currencySymbol wins over locale', () => {
    const chart = makeChart({ currencySymbol: '£' });
    const result = buildChart(chart, 1, 'fr-FR');
    expect(result.chartRequest.chartXml).toContain('£#,##0');
    expect(result.chartRequest.chartXml).not.toContain('€#,##0');
  });
});
