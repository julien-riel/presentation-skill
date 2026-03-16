import { z } from 'zod';

/**
 * Layout types supported by the presentation system.
 * V1: title, section, bullets, twoColumns, timeline, architecture, generic
 * V2+: chart, table, kpi, quote, imageText, roadmap, process, comparison
 */
export const LayoutTypeSchema = z.enum([
  'title', 'section', 'bullets', 'twoColumns',
  'timeline', 'architecture', 'generic',
  'chart', 'table', 'kpi', 'quote',
  'imageText', 'roadmap', 'process', 'comparison',
]);

export type LayoutType = z.infer<typeof LayoutTypeSchema>;

// --- Element schemas ---

export const TitleElementSchema = z.object({
  type: z.literal('title'),
  text: z.string(),
});

export const SubtitleElementSchema = z.object({
  type: z.literal('subtitle'),
  text: z.string(),
});

export const TextElementSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  url: z.string().url().optional(),
});

export const BulletsElementSchema = z.object({
  type: z.literal('bullets'),
  items: z.array(z.string()),
  icons: z.array(z.string()).optional(),
  column: z.enum(['left', 'right']).optional(),
  label: z.string().optional(),
  level: z.number().optional(),
});

export const DiagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  layer: z.string().optional(),
  style: z.object({
    fill: z.string().optional(),
    border: z.string().optional(),
    icon: z.string().optional(),
  }).optional(),
});

export const DiagramEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  style: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

export const DiagramElementSchema = z.object({
  type: z.literal('diagram'),
  nodes: z.array(DiagramNodeSchema),
  edges: z.array(DiagramEdgeSchema),
});

export const TimelineEventSchema = z.object({
  date: z.string(),
  label: z.string(),
  status: z.enum(['done', 'in-progress', 'planned']).optional(),
  icon: z.string().optional(),
});

export const TimelineElementSchema = z.object({
  type: z.literal('timeline'),
  events: z.array(TimelineEventSchema),
});

export const ChartOptionsSchema = z.object({
  title: z.string().optional(),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  yAxisMin: z.number().optional(),
  yAxisMax: z.number().optional(),
  valueFormat: z.enum(['number', 'percent', 'currency']).optional(),
  currencySymbol: z.string().max(5).regex(/^[^<>&"']*$/).optional(),
  showDataLabels: z.boolean().optional(),
  showLegend: z.boolean().optional(),
  legendPosition: z.enum(['top', 'bottom', 'right', 'left']).optional(),
  colors: z.array(z.string().regex(/^[0-9A-Fa-f]{6}$/)).optional(),
  gridLines: z.boolean().optional(),
});

export const ChartElementSchema = z.object({
  type: z.literal('chart'),
  chartType: z.enum(['bar', 'line', 'pie', 'donut', 'stackedBar']),
  data: z.object({
    labels: z.array(z.string()),
    series: z.array(z.object({
      name: z.string(),
      values: z.array(z.number()),
    })),
  }),
  options: ChartOptionsSchema.optional(),
});

export const TableElementSchema = z.object({
  type: z.literal('table'),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const KpiElementSchema = z.object({
  type: z.literal('kpi'),
  indicators: z.array(z.object({
    label: z.string(),
    value: z.string(),
    unit: z.string().optional(),
    trend: z.enum(['up', 'down', 'stable']).optional(),
    icon: z.string().optional(),
  })),
});

export const QuoteElementSchema = z.object({
  type: z.literal('quote'),
  text: z.string(),
  author: z.string().optional(),
  icon: z.string().optional(),
});

export const ImageElementSchema = z.object({
  type: z.literal('image'),
  path: z.string(),
  altText: z.string().optional(),
});

export const ElementSchema = z.discriminatedUnion('type', [
  TitleElementSchema,
  SubtitleElementSchema,
  TextElementSchema,
  BulletsElementSchema,
  DiagramElementSchema,
  TimelineElementSchema,
  ChartElementSchema,
  TableElementSchema,
  KpiElementSchema,
  QuoteElementSchema,
  ImageElementSchema,
]);

export type Element = z.infer<typeof ElementSchema>;

// --- Slide schema ---

export const SlideSchema = z.object({
  layout: LayoutTypeSchema,
  elements: z.array(ElementSchema),
  notes: z.string().optional(),
  // Fields added by the Transform pipeline (prefixed with _)
  _resolvedLayout: LayoutTypeSchema.optional(),
  _splitIndex: z.string().optional(),
  _warnings: z.array(z.string()).optional(),
});

export type Slide = z.infer<typeof SlideSchema>;

/**
 * Public input type for consumers — excludes internal pipeline fields.
 * Use this when building an AST to pass to generateFromAST().
 */
export type SlideInput = Omit<Slide, '_resolvedLayout' | '_splitIndex' | '_warnings'>;

// --- Presentation schema ---

export const PresentationMetadataSchema = z.object({
  author: z.string().optional(),
  date: z.string().optional(),
  version: z.string().optional(),
  audience: z.string().optional(),
});

export const PresentationSchema = z.object({
  title: z.string(),
  metadata: PresentationMetadataSchema.optional(),
  theme: z.string().optional(),
  locale: z.string().optional(),
  showSlideNumbers: z.boolean().optional(),
  footer: z.string().optional(),
  slides: z.array(SlideSchema),
});

export type Presentation = z.infer<typeof PresentationSchema>;

/**
 * Public input type for consumers — slides use SlideInput (no internal fields).
 */
export type PresentationInput = Omit<Presentation, 'slides'> & { slides: SlideInput[] };
