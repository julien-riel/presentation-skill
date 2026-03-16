import { escapeXml } from '../xmlHelpers.js';

/** Generates <c:cat> XML with a string cache for category labels. */
export function buildCategoryXml(labels: string[]): string {
  const pts = labels.map((label, i) =>
    `<c:pt idx="${i}"><c:v>${escapeXml(label)}</c:v></c:pt>`
  ).join('');
  return `<c:cat><c:strRef><c:strCache><c:ptCount val="${labels.length}"/>${pts}</c:strCache></c:strRef></c:cat>`;
}

/** Generates <c:val> XML with a numeric cache. */
export function buildValueXml(
  values: number[],
  valueFormat?: 'number' | 'percent' | 'currency',
  currencySymbol?: string,
): string {
  let formatCode = 'General';
  if (valueFormat === 'percent') formatCode = '0%';
  else if (valueFormat === 'currency') formatCode = `${escapeXml(currencySymbol ?? '$')}#,##0`;

  const pts = values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('');
  return `<c:val><c:numRef><c:numCache><c:formatCode>${formatCode}</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache></c:numRef></c:val>`;
}

/** Generates a <c:ser> element for a data series. */
export function buildSeriesXml(
  index: number, name: string, labels: string[], values: number[],
  opts?: { color?: string; valueFormat?: 'number' | 'percent' | 'currency'; currencySymbol?: string },
): string {
  const colorXml = opts?.color
    ? `<c:spPr><a:solidFill><a:srgbClr val="${opts.color}"/></a:solidFill></c:spPr>`
    : '';
  return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>${colorXml}${buildCategoryXml(labels)}${buildValueXml(values, opts?.valueFormat, opts?.currencySymbol)}</c:ser>`;
}

/** Generates <c:legend> XML. */
export function buildLegendXml(position: string = 'b'): string {
  const posMap: Record<string, string> = { top: 't', bottom: 'b', left: 'l', right: 'r' };
  const pos = posMap[position] ?? 'b';
  return `<c:legend><c:legendPos val="${pos}"/><c:overlay val="0"/></c:legend>`;
}

/** Generates category axis <c:catAx> XML. */
export function buildCatAxisXml(axId: number, crossAxId: number, label?: string): string {
  const titleXml = label
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeXml(label)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    : '';
  return `<c:catAx><c:axId val="${axId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>${titleXml}<c:crossAx val="${crossAxId}"/></c:catAx>`;
}

/** Generates value axis <c:valAx> XML. */
export function buildValAxisXml(
  axId: number, crossAxId: number,
  opts?: { label?: string; min?: number; max?: number; gridLines?: boolean },
): string {
  const titleXml = opts?.label
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeXml(opts.label)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    : '';
  const scaling = ['<c:orientation val="minMax"/>',
    opts?.min !== undefined ? `<c:min val="${opts.min}"/>` : '',
    opts?.max !== undefined ? `<c:max val="${opts.max}"/>` : '',
  ].filter(Boolean).join('');
  const gridXml = opts?.gridLines !== false ? '<c:majorGridlines/>' : '';
  return `<c:valAx><c:axId val="${axId}"/><c:scaling>${scaling}</c:scaling><c:delete val="0"/><c:axPos val="l"/>${gridXml}${titleXml}<c:crossAx val="${crossAxId}"/></c:valAx>`;
}

/** Generates <c:dLbls> (data labels) XML. */
export function buildDataLabelsXml(show: boolean): string {
  if (!show) return '';
  return `<c:dLbls><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/></c:dLbls>`;
}

/** Wraps chart content in a complete chartSpace XML document. */
export function wrapChartXml(plotAreaContent: string, extras: string = '', chartTitle?: string): string {
  const titleXml = chartTitle
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeXml(chartTitle)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    : '<c:autoTitleDeleted val="1"/>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:chart>${titleXml}<c:plotArea><c:layout/>${plotAreaContent}</c:plotArea>${extras}<c:plotVisOnly val="1"/></c:chart></c:chartSpace>`;
}

/** Re-export escapeXml for use by chart builders. */
export { escapeXml } from '../xmlHelpers.js';
