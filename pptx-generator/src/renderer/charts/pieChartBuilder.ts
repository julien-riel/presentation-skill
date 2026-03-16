import type { z } from 'zod';
import type { ChartElementSchema } from '../../schema/presentation.js';
import {
  buildCategoryXml,
  buildValueXml,
  buildLegendXml,
  wrapChartXml,
  escapeXml,
} from './chartXmlHelpers.js';

type ChartElement = z.infer<typeof ChartElementSchema>;

/**
 * Builds data point color overrides (<c:dPt>) for pie/donut slices.
 */
function buildDataPointColors(colors: string[]): string {
  return colors.map((color, i) =>
    `<c:dPt><c:idx val="${i}"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr></c:dPt>`
  ).join('');
}

/**
 * Builds pie-specific data labels showing percent and category name.
 */
function buildPieDataLabelsXml(show: boolean): string {
  if (!show) return '';
  return `<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="1"/><c:showSerName val="0"/><c:showPercent val="1"/></c:dLbls>`;
}

/**
 * Builds a complete pie or donut chart XML document.
 * Uses <c:pieChart> or <c:doughnutChart> (with holeSize="50").
 * Single series only. varyColors="1" for distinct slice colors.
 * No axes needed for pie/donut charts.
 */
export function buildPieChartXml(element: ChartElement): string {
  const opts = element.options;
  const { labels, series } = element.data;
  const isDonut = element.chartType === 'donut';

  // Pie/donut uses only the first series
  const firstSeries = series[0];

  const colorOverrides = opts?.colors
    ? buildDataPointColors(opts.colors)
    : '';

  const dataLabelsXml = buildPieDataLabelsXml(opts?.showDataLabels !== false);

  const seriesXml = `<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(firstSeries.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>${colorOverrides}${buildCategoryXml(labels)}${buildValueXml(firstSeries.values, opts?.valueFormat, opts?.currencySymbol)}</c:ser>`;

  let chartXml: string;
  if (isDonut) {
    chartXml = `<c:doughnutChart><c:varyColors val="1"/>${seriesXml}${dataLabelsXml}<c:holeSize val="50"/></c:doughnutChart>`;
  } else {
    chartXml = `<c:pieChart><c:varyColors val="1"/>${seriesXml}${dataLabelsXml}</c:pieChart>`;
  }

  const legendXml = opts?.showLegend !== false
    ? buildLegendXml(opts?.legendPosition ?? 'bottom')
    : '';

  return wrapChartXml(chartXml, legendXml, opts?.title);
}
