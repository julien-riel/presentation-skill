import { describe, it, expect } from 'vitest';
import { buildSeriesXml, buildCategoryXml, buildValueXml } from '../../src/renderer/charts/chartXmlHelpers.js';
import { buildChartStyleXml, buildChartColorsXml, buildChartRelsXml } from '../../src/renderer/charts/chartStyleBuilder.js';

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
