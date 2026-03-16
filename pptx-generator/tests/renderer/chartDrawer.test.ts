import { describe, it, expect } from 'vitest';
import { buildSeriesXml, buildCategoryXml, buildValueXml, buildLegendXml, buildCatAxisXml, buildValAxisXml } from '../../src/renderer/charts/chartXmlHelpers.js';
import { buildChartStyleXml, buildChartColorsXml, buildChartRelsXml } from '../../src/renderer/charts/chartStyleBuilder.js';
import { buildBarChartXml } from '../../src/renderer/charts/barChartBuilder.js';
import { buildLineChartXml } from '../../src/renderer/charts/lineChartBuilder.js';
import { buildPieChartXml } from '../../src/renderer/charts/pieChartBuilder.js';
import { buildChart } from '../../src/renderer/chartDrawer.js';
import type { Element } from '../../src/schema/presentation.js';

describe('chartXmlHelpers', () => {
  describe('buildCategoryXml', () => {
    it('generates strCache XML for labels', () => {
      const xml = buildCategoryXml(['Q1', 'Q2', 'Q3']);
      expect(xml).toContain('<c:ptCount val="3"/>');
      expect(xml).toContain('<c:pt idx="0"><c:v>Q1</c:v></c:pt>');
      expect(xml).toContain('<c:pt idx="2"><c:v>Q3</c:v></c:pt>');
    });
  });
  describe('buildValueXml', () => {
    it('generates numCache XML for values', () => {
      const xml = buildValueXml([100, 200, 150]);
      expect(xml).toContain('<c:ptCount val="3"/>');
      expect(xml).toContain('<c:pt idx="0"><c:v>100</c:v></c:pt>');
    });
    it('supports percent format code', () => {
      const xml = buildValueXml([0.5, 0.3], 'percent');
      expect(xml).toContain('<c:formatCode>0%</c:formatCode>');
    });
    it('supports currency format code', () => {
      const xml = buildValueXml([1000], 'currency', '$');
      expect(xml).toContain('<c:formatCode>$#,##0</c:formatCode>');
    });
  });
  describe('buildSeriesXml', () => {
    it('generates a complete series element', () => {
      const xml = buildSeriesXml(0, 'Revenue', ['Q1', 'Q2'], [100, 200]);
      expect(xml).toContain('<c:idx val="0"/>');
      expect(xml).toContain('Revenue');
      expect(xml).toContain('<c:v>100</c:v>');
    });
    it('applies custom color to series', () => {
      const xml = buildSeriesXml(0, 'Rev', ['A'], [1], { color: 'FF0000' });
      expect(xml).toContain('<a:srgbClr val="FF0000"/>');
    });
    it('escapes XML special characters in labels and names', () => {
      const xml = buildSeriesXml(0, 'R&D', ['Q1 < Q2', 'AT&T'], [100, 200]);
      expect(xml).toContain('R&amp;D');
      expect(xml).toContain('Q1 &lt; Q2');
      expect(xml).toContain('AT&amp;T');
      expect(xml).not.toContain('R&D</');
    });
  });
  describe('buildLegendXml', () => {
    it('maps position names to OOXML codes', () => {
      expect(buildLegendXml('right')).toContain('<c:legendPos val="r"/>');
      expect(buildLegendXml('top')).toContain('<c:legendPos val="t"/>');
      expect(buildLegendXml('left')).toContain('<c:legendPos val="l"/>');
    });
    it('defaults to bottom for unknown position', () => {
      expect(buildLegendXml('unknown')).toContain('<c:legendPos val="b"/>');
    });
  });
  describe('buildCatAxisXml', () => {
    it('includes title when label is provided', () => {
      const xml = buildCatAxisXml(111, 222, 'Quarters');
      expect(xml).toContain('Quarters');
      expect(xml).toContain('<c:title>');
    });
  });
  describe('buildValAxisXml', () => {
    it('includes min/max scaling and hides gridlines', () => {
      const xml = buildValAxisXml(222, 111, { min: 0, max: 500, gridLines: false });
      expect(xml).toContain('<c:min val="0"/>');
      expect(xml).toContain('<c:max val="500"/>');
      expect(xml).not.toContain('<c:majorGridlines/>');
    });
    it('includes axis label', () => {
      const xml = buildValAxisXml(222, 111, { label: 'Revenue ($)' });
      expect(xml).toContain('Revenue ($)');
      expect(xml).toContain('<c:title>');
    });
  });
  describe('buildValueXml defaults', () => {
    it('uses General format for number type', () => {
      const xml = buildValueXml([42], 'number');
      expect(xml).toContain('<c:formatCode>General</c:formatCode>');
    });
    it('defaults currency symbol to $', () => {
      const xml = buildValueXml([1000], 'currency');
      expect(xml).toContain('<c:formatCode>$#,##0</c:formatCode>');
    });
  });
});

describe('chartStyleBuilder', () => {
  it('generates valid chart style XML', () => {
    const xml = buildChartStyleXml();
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('cs:chartStyle');
    expect(xml).toContain('cs:dataPoint');
  });
  it('generates valid chart colors XML', () => {
    const xml = buildChartColorsXml();
    expect(xml).toContain('cs:colorStyle');
    expect(xml).toContain('meth="cycle"');
    expect(xml).toContain('accent1');
    expect(xml).toContain('accent6');
  });
  it('generates chart rels XML with correct targets', () => {
    const xml = buildChartRelsXml(3);
    expect(xml).toContain('Target="style3.xml"');
    expect(xml).toContain('Target="colors3.xml"');
    expect(xml).toContain('chartStyle');
    expect(xml).toContain('chartColorStyle');
  });
});

describe('barChartBuilder', () => {
  const baseElement = {
    type: 'chart' as const,
    chartType: 'bar' as const,
    data: {
      labels: ['Q1', 'Q2', 'Q3'],
      series: [
        { name: 'Revenue', values: [100, 200, 150] },
      ],
    },
  };

  it('generates a bar chart with clustered grouping', () => {
    const xml = buildBarChartXml(baseElement);
    expect(xml).toContain('<c:barChart>');
    expect(xml).toContain('<c:barDir val="col"/>');
    expect(xml).toContain('<c:grouping val="clustered"/>');
    expect(xml).toContain('Revenue');
    expect(xml).toContain('<c:catAx>');
    expect(xml).toContain('<c:valAx>');
  });

  it('generates stacked grouping for stackedBar', () => {
    const xml = buildBarChartXml({ ...baseElement, chartType: 'stackedBar' });
    expect(xml).toContain('<c:grouping val="stacked"/>');
  });

  it('includes legend by default', () => {
    const xml = buildBarChartXml(baseElement);
    expect(xml).toContain('<c:legend>');
    expect(xml).toContain('<c:legendPos val="b"/>');
  });

  it('hides legend when showLegend is false', () => {
    const xml = buildBarChartXml({
      ...baseElement,
      options: { showLegend: false },
    });
    expect(xml).not.toContain('<c:legend>');
  });

  it('applies custom colors to series', () => {
    const xml = buildBarChartXml({
      ...baseElement,
      options: { colors: ['FF0000'] },
    });
    expect(xml).toContain('<a:srgbClr val="FF0000"/>');
  });

  it('includes data labels when enabled', () => {
    const xml = buildBarChartXml({
      ...baseElement,
      options: { showDataLabels: true },
    });
    expect(xml).toContain('<c:dLbls>');
    expect(xml).toContain('<c:showVal val="1"/>');
  });

  it('includes chart title when provided', () => {
    const xml = buildBarChartXml({
      ...baseElement,
      options: { title: 'Quarterly Revenue' },
    });
    expect(xml).toContain('Quarterly Revenue');
    expect(xml).toContain('<c:autoTitleDeleted val="0"/>');
  });
});

describe('lineChartBuilder', () => {
  const baseElement = {
    type: 'chart' as const,
    chartType: 'line' as const,
    data: {
      labels: ['Jan', 'Feb', 'Mar'],
      series: [
        { name: 'Users', values: [100, 150, 200] },
      ],
    },
  };

  it('generates a line chart with standard grouping', () => {
    const xml = buildLineChartXml(baseElement);
    expect(xml).toContain('<c:lineChart>');
    expect(xml).toContain('<c:grouping val="standard"/>');
    expect(xml).toContain('Users');
    expect(xml).toContain('<c:catAx>');
    expect(xml).toContain('<c:valAx>');
  });

  it('includes circle markers per series', () => {
    const xml = buildLineChartXml(baseElement);
    expect(xml).toContain('<c:marker>');
    expect(xml).toContain('<c:symbol val="circle"/>');
    expect(xml).toContain('<c:size val="5"/>');
  });

  it('applies custom colors to series', () => {
    const xml = buildLineChartXml({
      ...baseElement,
      options: { colors: ['00FF00'] },
    });
    expect(xml).toContain('<a:srgbClr val="00FF00"/>');
  });

  it('includes legend by default', () => {
    const xml = buildLineChartXml(baseElement);
    expect(xml).toContain('<c:legend>');
  });

  it('includes data labels when enabled', () => {
    const xml = buildLineChartXml({
      ...baseElement,
      options: { showDataLabels: true },
    });
    expect(xml).toContain('<c:dLbls>');
    expect(xml).toContain('<c:showVal val="1"/>');
  });

  it('includes chart title when provided', () => {
    const xml = buildLineChartXml({
      ...baseElement,
      options: { title: 'User Growth' },
    });
    expect(xml).toContain('User Growth');
    expect(xml).toContain('<c:autoTitleDeleted val="0"/>');
  });
});

describe('pieChartBuilder', () => {
  const basePieElement = {
    type: 'chart' as const,
    chartType: 'pie' as const,
    data: {
      labels: ['Desktop', 'Mobile', 'Tablet'],
      series: [
        { name: 'Traffic', values: [60, 30, 10] },
      ],
    },
  };

  it('generates a pie chart with varyColors', () => {
    const xml = buildPieChartXml(basePieElement);
    expect(xml).toContain('<c:pieChart>');
    expect(xml).toContain('<c:varyColors val="1"/>');
    expect(xml).toContain('Traffic');
  });

  it('does not include axes for pie charts', () => {
    const xml = buildPieChartXml(basePieElement);
    expect(xml).not.toContain('<c:catAx>');
    expect(xml).not.toContain('<c:valAx>');
  });

  it('shows percent and category data labels by default', () => {
    const xml = buildPieChartXml(basePieElement);
    expect(xml).toContain('<c:showPercent val="1"/>');
    expect(xml).toContain('<c:showCatName val="1"/>');
  });

  it('hides data labels when showDataLabels is false', () => {
    const xml = buildPieChartXml({
      ...basePieElement,
      options: { showDataLabels: false },
    });
    expect(xml).not.toContain('<c:dLbls>');
  });

  it('applies custom colors as data point overrides', () => {
    const xml = buildPieChartXml({
      ...basePieElement,
      options: { colors: ['FF0000', '00FF00', '0000FF'] },
    });
    expect(xml).toContain('<c:dPt><c:idx val="0"/>');
    expect(xml).toContain('<a:srgbClr val="FF0000"/>');
    expect(xml).toContain('<c:dPt><c:idx val="2"/>');
    expect(xml).toContain('<a:srgbClr val="0000FF"/>');
  });

  it('generates a donut chart with holeSize', () => {
    const xml = buildPieChartXml({
      ...basePieElement,
      chartType: 'donut',
    });
    expect(xml).toContain('<c:doughnutChart>');
    expect(xml).toContain('<c:holeSize val="50"/>');
    expect(xml).not.toContain('<c:pieChart>');
  });

  it('includes legend by default', () => {
    const xml = buildPieChartXml(basePieElement);
    expect(xml).toContain('<c:legend>');
  });

  it('includes chart title when provided', () => {
    const xml = buildPieChartXml({
      ...basePieElement,
      options: { title: 'Traffic Sources' },
    });
    expect(xml).toContain('Traffic Sources');
    expect(xml).toContain('<c:autoTitleDeleted val="0"/>');
  });
});

describe('chartDrawer', () => {
  it('dispatches bar chart and returns BuildChartResult', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart', chartType: 'bar',
      data: { labels: ['A', 'B'], series: [{ name: 'S', values: [1, 2] }] },
    };
    const result = buildChart(chart, 100);
    expect(typeof result.buildAnchorShape).toBe('function');
    const anchorShape = result.buildAnchorShape('rIdChart1');
    expect(anchorShape).toContain('<p:graphicFrame>');
    expect(anchorShape).toContain('r:id="rIdChart1"');
    expect(anchorShape).not.toContain('__CHART_RELID__');
    expect(result.nextId).toBe(101);
    expect(result.chartRequest.chartXml).toContain('<c:barChart>');
    expect(result.chartRequest.styleXml).toContain('cs:chartStyle');
    expect(result.chartRequest.colorsXml).toContain('cs:colorStyle');
  });

  it('dispatches pie chart', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart', chartType: 'pie',
      data: { labels: ['A', 'B'], series: [{ name: 'S', values: [60, 40] }] },
    };
    const result = buildChart(chart, 200);
    expect(result.chartRequest.chartXml).toContain('<c:pieChart>');
  });

  it('dispatches donut chart', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart', chartType: 'donut',
      data: { labels: ['A', 'B'], series: [{ name: 'S', values: [60, 40] }] },
    };
    const result = buildChart(chart, 200);
    expect(result.chartRequest.chartXml).toContain('<c:doughnutChart>');
  });

  it('dispatches line chart', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart', chartType: 'line',
      data: { labels: ['A', 'B'], series: [{ name: 'S', values: [1, 2] }] },
    };
    const result = buildChart(chart, 200);
    expect(result.chartRequest.chartXml).toContain('<c:lineChart>');
  });

  it('dispatches stackedBar chart', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart', chartType: 'stackedBar',
      data: { labels: ['A'], series: [{ name: 'S', values: [1] }] },
    };
    const result = buildChart(chart, 200);
    expect(result.chartRequest.chartXml).toContain('<c:grouping val="stacked"/>');
  });

  it('anchor shape has correct EMU positioning', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart', chartType: 'bar',
      data: { labels: ['A'], series: [{ name: 'S', values: [1] }] },
    };
    const result = buildChart(chart, 100);
    const anchorShape = result.buildAnchorShape('rIdTest');
    expect(anchorShape).toContain(`x="${Math.round(0.8 * 914400)}"`);
    expect(anchorShape).toContain(`y="${Math.round(1.6 * 914400)}"`);
  });
});
