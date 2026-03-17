import type { ChartRequest } from './chartDrawer.js';

/**
 * Describes an icon to be resolved and embedded by the renderer.
 * Drawers emit these synchronously; renderToBuffer resolves them in batch.
 */
export interface IconRequest {
  name: string;
  color: string;
  sizePx: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
}

/**
 * Standard return type for all canvas drawers (timeline, architecture, kpi, etc.).
 */
export interface DrawerResult {
  shapes: string;
  nextId: number;
  iconRequests: IconRequest[];
}

/**
 * A chart whose anchor shape XML is deferred until the relationship ID is known.
 */
export interface PendingChart {
  buildAnchorShape: (relId: string) => string;
  chartRequest: ChartRequest;
}

/**
 * Describes a user-provided image to be read from disk and embedded.
 */
export interface ImageRequest {
  filePath: string;
  altText?: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
}

/**
 * Describes a hyperlink whose shape XML is deferred until the relationship ID is known.
 */
export interface HyperlinkRequest {
  url: string;
  shapeXmlBuilder: (relId: string) => string;
}

/**
 * Full result returned by buildSlideShapes.
 */
export interface SlideShapeResult {
  shapes: string;
  nextId: number;
  iconRequests: IconRequest[];
  pendingCharts: PendingChart[];
  imageRequests: ImageRequest[];
  hyperlinkRequests: HyperlinkRequest[];
}
