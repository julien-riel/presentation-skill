import type { Element } from '../schema/presentation.js';
import { emu } from './xmlHelpers.js';
import { buildBarChartXml } from './charts/barChartBuilder.js';
import { buildLineChartXml } from './charts/lineChartBuilder.js';
import { buildPieChartXml } from './charts/pieChartBuilder.js';
import { buildChartStyleXml, buildChartColorsXml } from './charts/chartStyleBuilder.js';

type ChartElement = Extract<Element, { type: 'chart' }>;

export interface ChartRequest {
  chartXml: string;
  styleXml: string;
  colorsXml: string;
}

export interface BuildChartResult {
  anchorShape: string;
  nextId: number;
  chartRequest: ChartRequest;
}

const CHART_X = emu(0.8);
const CHART_Y = emu(1.6);
const CHART_CX = emu(10.6);
const CHART_CY = emu(4.8);

function graphicFrameShape(id: number): string {
  return `<p:graphicFrame>
  <p:nvGraphicFramePr>
    <p:cNvPr id="${id}" name="Chart ${id}"/>
    <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>
    <p:nvPr/>
  </p:nvGraphicFramePr>
  <p:xfrm>
    <a:off x="${CHART_X}" y="${CHART_Y}"/>
    <a:ext cx="${CHART_CX}" cy="${CHART_CY}"/>
  </p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
      <c:chart r:id="__CHART_RELID__"/>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>`;
}

/**
 * Builds a chart graphic frame and its associated chart XML files.
 * Returns the anchor shape XML, the next available ID, and the chart request
 * containing the chart, style, and colors XML.
 */
export function buildChart(
  chart: ChartElement, startId: number, _accentColors: string[],
): BuildChartResult {
  let chartXml: string;
  switch (chart.chartType) {
    case 'bar':
    case 'stackedBar':
      chartXml = buildBarChartXml(chart);
      break;
    case 'line':
      chartXml = buildLineChartXml(chart);
      break;
    case 'pie':
    case 'donut':
      chartXml = buildPieChartXml(chart);
      break;
    default:
      chartXml = buildBarChartXml(chart);
  }
  return {
    anchorShape: graphicFrameShape(startId),
    nextId: startId + 1,
    chartRequest: {
      chartXml,
      styleXml: buildChartStyleXml(),
      colorsXml: buildChartColorsXml(),
    },
  };
}
