import type { z } from 'zod';
import type { ChartElementSchema } from '../../schema/presentation.js';
import {
  buildSeriesXml,
  buildCatAxisXml,
  buildValAxisXml,
  buildLegendXml,
  buildDataLabelsXml,
  wrapChartXml,
  CAT_AX_ID,
  VAL_AX_ID,
} from './chartXmlHelpers.js';

type ChartElement = z.infer<typeof ChartElementSchema>;

/**
 * Builds a complete bar/stackedBar chart XML document.
 * Uses <c:barChart> with barDir="col" and appropriate grouping.
 */
export function buildBarChartXml(element: ChartElement): string {
  const opts = element.options;
  const { labels, series } = element.data;
  const grouping = element.chartType === 'stackedBar' ? 'stacked' : 'clustered';

  const seriesXml = series.map((s, i) => {
    const color = opts?.colors?.[i];
    return buildSeriesXml(i, s.name, labels, s.values, {
      color,
      valueFormat: opts?.valueFormat,
      currencySymbol: opts?.currencySymbol,
    });
  }).join('');

  const dataLabelsXml = buildDataLabelsXml(opts?.showDataLabels ?? false);

  const barChart = `<c:barChart><c:barDir val="col"/><c:grouping val="${grouping}"/><c:varyColors val="0"/>${seriesXml}${dataLabelsXml}<c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:barChart>`;

  const catAxis = buildCatAxisXml(CAT_AX_ID, VAL_AX_ID, opts?.xAxisLabel);
  const valAxis = buildValAxisXml(VAL_AX_ID, CAT_AX_ID, {
    label: opts?.yAxisLabel,
    min: opts?.yAxisMin,
    max: opts?.yAxisMax,
    gridLines: opts?.gridLines,
  });

  const plotAreaContent = `${barChart}${catAxis}${valAxis}`;

  const legendXml = opts?.showLegend !== false
    ? buildLegendXml(opts?.legendPosition ?? 'bottom')
    : '';

  return wrapChartXml(plotAreaContent, legendXml, opts?.title);
}
