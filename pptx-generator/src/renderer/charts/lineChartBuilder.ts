import type { z } from 'zod';
import type { ChartElementSchema } from '../../schema/presentation.js';
import {
  buildCategoryXml,
  buildValueXml,
  buildDataLabelsXml,
  buildAxisChartXml,
  escapeXml,
  CAT_AX_ID,
  VAL_AX_ID,
} from './chartXmlHelpers.js';

type ChartElement = z.infer<typeof ChartElementSchema>;

/**
 * Builds a single <c:ser> element for a line chart series.
 * Includes a circle marker with size 5 per series.
 */
function buildLineSeriesXml(
  index: number, name: string, labels: string[], values: number[],
  opts?: { color?: string; valueFormat?: 'number' | 'percent' | 'currency'; currencySymbol?: string },
): string {
  const colorXml = opts?.color
    ? `<c:spPr><a:ln><a:solidFill><a:srgbClr val="${opts.color}"/></a:solidFill></a:ln></c:spPr>`
    : '';
  const markerFill = opts?.color
    ? `<c:spPr><a:solidFill><a:srgbClr val="${opts.color}"/></a:solidFill></c:spPr>`
    : '';
  const marker = `<c:marker><c:symbol val="circle"/><c:size val="5"/>${markerFill}</c:marker>`;
  return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>${colorXml}${marker}${buildCategoryXml(labels)}${buildValueXml(values, opts?.valueFormat, opts?.currencySymbol)}</c:ser>`;
}

/**
 * Builds a complete line chart XML document.
 * Uses <c:lineChart> with grouping="standard" and circle markers.
 */
export function buildLineChartXml(element: ChartElement): string {
  const opts = element.options;
  const { labels, series } = element.data;

  const seriesXml = series.map((s, i) => {
    const color = opts?.colors?.[i];
    return buildLineSeriesXml(i, s.name, labels, s.values, {
      color,
      valueFormat: opts?.valueFormat,
      currencySymbol: opts?.currencySymbol,
    });
  }).join('');

  const dataLabelsXml = buildDataLabelsXml(opts?.showDataLabels ?? false);

  const lineChart = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${seriesXml}${dataLabelsXml}<c:marker val="1"/><c:axId val="${CAT_AX_ID}"/><c:axId val="${VAL_AX_ID}"/></c:lineChart>`;

  return buildAxisChartXml(lineChart, opts);
}
