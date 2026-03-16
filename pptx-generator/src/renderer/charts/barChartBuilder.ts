import type { z } from 'zod';
import type { ChartElementSchema } from '../../schema/presentation.js';
import {
  buildSeriesXml,
  buildDataLabelsXml,
  buildAxisChartXml,
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

  return buildAxisChartXml(barChart, opts);
}
