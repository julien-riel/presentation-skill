import { describe, it, expect } from 'vitest';
import { buildSeriesXml, buildCategoryXml, buildValueXml } from '../../src/renderer/charts/chartXmlHelpers.js';
import { buildChartStyleXml, buildChartColorsXml, buildChartRelsXml } from '../../src/renderer/charts/chartStyleBuilder.js';
import { buildBarChartXml } from '../../src/renderer/charts/barChartBuilder.js';
import { buildLineChartXml } from '../../src/renderer/charts/lineChartBuilder.js';

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
