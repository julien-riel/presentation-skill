# Native OOXML Chart Support

## Summary

Add native PowerPoint chart rendering (bar, stackedBar, line, pie, donut) to the PPTX generator. Charts are real OOXML `<c:chartSpace>` objects — editable and interactive in PowerPoint — not drawn shapes or images.

## Context

The AST schema already defines a `ChartElement` with `bar | line | pie | donut` types, but the renderer currently degrades charts to bullets. This spec covers:

1. Extending the schema with `stackedBar` and formatting options
2. Generating native OOXML chart files in the ZIP
3. Content validation limits
4. Automatic chart detection in the dataParser
5. Graceful degradation to tables (instead of bullets)

## Schema Changes

### ChartElement (extended)

```typescript
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
  options: z.object({
    title: z.string().optional(),
    // Axes
    xAxisLabel: z.string().optional(),
    yAxisLabel: z.string().optional(),
    yAxisMin: z.number().optional(),
    yAxisMax: z.number().optional(),
    // Formatting
    valueFormat: z.enum(['number', 'percent', 'currency']).optional(),
    currencySymbol: z.string().optional(),
    showDataLabels: z.boolean().optional(),
    // Legend
    showLegend: z.boolean().optional(),
    legendPosition: z.enum(['top', 'bottom', 'right', 'left']).optional(),
    // Styling — 6-char hex without # prefix (consistent with codebase convention)
    colors: z.array(z.string().regex(/^[0-9A-Fa-f]{6}$/)).optional(),
    // Layout
    gridLines: z.boolean().optional(),
  }).optional(),
});
```

All `options` fields are optional. Without options, the chart uses theme colors and sensible defaults.

**Backward compatibility:** Adding `stackedBar` to the enum and the optional `options` field are additive changes. Existing ASTs with `chart` elements remain valid — `options` defaults to `undefined`, and existing `chartType` values are still in the enum.

### PromptParser Update

In `promptParser.ts`, the chart layout description (line 48) and element type (line 65) must be updated:

```typescript
// Layout description
'- "chart": Chart slide. Use chart element with chartType (bar/line/pie/donut/stackedBar) and data series. Options: valueFormat, showDataLabels, legendPosition, colors, gridLines, axis labels/limits.'

// Element type
'- { type: "chart", chartType: "bar"|"line"|"pie"|"donut"|"stackedBar", data: { labels: [...], series: [{ name, values }] }, options?: { valueFormat?, showDataLabels?, legendPosition?, colors?, ... } } — Chart'
```

## Content Validation

### Limits

```typescript
export const MAX_CHART_CATEGORIES = 8;
export const MAX_CHART_SERIES = 4;
```

### Rules

**Constraint: max 1 chart element per slide.** The layout system supports a single chart per slide. If multiple chart elements appear, only the first is kept. This simplifies the placeholder token mechanism (single `__CHART_RELID__` per slide).

Added as a new block in `validateSlideContent()` in `contentValidator.ts`, following the same pattern as the KPI and table validation blocks (lines 69-98):

```typescript
// --- Chart category/series limit ---
elements = elements.map((el) => {
  if (el.type !== 'chart') return el;
  let { labels, series } = el.data;

  // Truncate series
  if (series.length > MAX_CHART_SERIES) {
    warnings.push(`Chart series truncated from ${series.length} to ${MAX_CHART_SERIES}`);
    series = series.slice(0, MAX_CHART_SERIES);
  }

  // Pie/donut: single series only
  if ((el.chartType === 'pie' || el.chartType === 'donut') && series.length > 1) {
    warnings.push(`${el.chartType} chart reduced to single series`);
    series = [series[0]];
  }

  // Truncate categories
  if (labels.length > MAX_CHART_CATEGORIES) {
    warnings.push(`Chart categories truncated from ${labels.length} to ${MAX_CHART_CATEGORIES}`);
    labels = labels.slice(0, MAX_CHART_CATEGORIES);
    series = series.map(s => ({ ...s, values: s.values.slice(0, MAX_CHART_CATEGORIES) }));
  }

  // Align values to labels length
  series = series.map(s => {
    if (s.values.length < labels.length) {
      return { ...s, values: [...s.values, ...Array(labels.length - s.values.length).fill(0)] };
    }
    if (s.values.length > labels.length) {
      return { ...s, values: s.values.slice(0, labels.length) };
    }
    return s;
  });

  return { ...el, data: { labels, series } };
});
```

### Degradation Cascade

Update `FALLBACK_CASCADES` in `src/validator/constants.ts`:

```typescript
export const FALLBACK_CASCADES: Record<string, LayoutType[]> = {
  kpi: ['bullets', 'generic'],
  chart: ['table', 'bullets', 'generic'],  // changed: was ['bullets', 'generic']
  table: ['bullets', 'generic'],
  quote: ['bullets', 'generic'],
  architecture: ['bullets', 'generic'],
  imageText: ['twoColumns', 'bullets', 'generic'],
  roadmap: ['timeline', 'bullets', 'generic'],
  process: ['timeline', 'bullets', 'generic'],
  comparison: ['twoColumns', 'bullets', 'generic'],
};
```

### Chart-to-Table Element Transformation

When chart degrades to table, the slide's `ChartElement` must be replaced with a `TableElement`. This transformation happens in a **new transform step** `elementDegrader.ts`, executed after `layoutResolver` (which sets `_resolvedLayout`) and before `contentValidator`:

```typescript
// src/transform/elementDegrader.ts

/**
 * Transforms elements when their layout has been degraded.
 * Called after layoutResolver, before contentValidator.
 *
 * When chart → table: converts ChartElement data to TableElement.
 * When chart → bullets/generic: converts ChartElement data to BulletsElement.
 */
export function degradeElements(slides: Slide[]): Slide[] {
  return slides.map((slide) => {
    if (slide.layout !== 'chart' || slide._resolvedLayout === 'chart') return slide;

    const chartEl = slide.elements.find(el => el.type === 'chart');
    if (!chartEl || chartEl.type !== 'chart') return slide;

    if (slide._resolvedLayout === 'table') {
      // Chart → table: preserve data in tabular form
      const tableEl = {
        type: 'table' as const,
        headers: ['', ...chartEl.data.series.map(s => s.name)],
        rows: chartEl.data.labels.map((label, i) =>
          [label, ...chartEl.data.series.map(s => String(s.values[i] ?? 0))]
        ),
      };
      const elements = slide.elements.map(el => el.type === 'chart' ? tableEl : el);
      return { ...slide, elements };
    }

    // Chart → bullets/generic: convert data to text bullets
    const items = chartEl.data.labels.map((label, i) => {
      const values = chartEl.data.series.map(s => `${s.name}: ${s.values[i] ?? 0}`).join(', ');
      return `${label} — ${values}`;
    });
    const bulletsEl = { type: 'bullets' as const, items };
    const elements = slide.elements.map(el => el.type === 'chart' ? bulletsEl : el);
    return { ...slide, elements };
  });
}
```

**Pipeline order:** parse → layoutResolver → **elementDegrader** → contentValidator → render

## Renderer Architecture

### Files Generated Per Chart

Each chart produces four files in the PPTX ZIP:

| File | Content |
|------|---------|
| `ppt/charts/chart{N}.xml` | Chart definition (`<c:chartSpace>`) |
| `ppt/charts/style{N}.xml` | Visual style |
| `ppt/charts/colors{N}.xml` | Color palette |
| `ppt/charts/_rels/chart{N}.xml.rels` | Internal relationships (chart → style, colors) |

Plus relationships in `slide{M}.xml.rels` and overrides in `[Content_Types].xml`.

`{N}` is a **global counter** across all slides (not per-slide). Multiple chart slides produce chart1, chart2, chart3, etc.

### Content Types

```xml
<Override PartName="/ppt/charts/chart1.xml"
  ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
<Override PartName="/ppt/charts/style1.xml"
  ContentType="application/vnd.ms-office.chartstyle+xml"/>
<Override PartName="/ppt/charts/colors1.xml"
  ContentType="application/vnd.ms-office.chartcolorstyle+xml"/>
```

### Chart Internal Relationships

Each chart needs `ppt/charts/_rels/chart{N}.xml.rels`:

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/office/2011/relationships/chartStyle" Target="style{N}.xml"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/office/2011/relationships/chartColorStyle" Target="colors{N}.xml"/>
</Relationships>
```

### Slide XML: graphicFrame Embedding

A chart is embedded in the slide via a `<p:graphicFrame>`, not a `<p:sp>`. This is the anchor shape:

```xml
<p:graphicFrame>
  <p:nvGraphicFramePr>
    <p:cNvPr id="{id}" name="Chart {N}"/>
    <p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>
    <p:nvPr/>
  </p:nvGraphicFramePr>
  <p:xfrm>
    <a:off x="{x}" y="{y}"/>
    <a:ext cx="{cx}" cy="{cy}"/>
  </p:xfrm>
  <a:graphic>
    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
      <c:chart r:id="{chartRelId}"/>
    </a:graphicData>
  </a:graphic>
</p:graphicFrame>
```

The `c:` namespace prefix is declared on `<p:sld>` (see below), not on the `<c:chart>` element itself. The `r:` prefix is also inherited from `<p:sld>`.

### Slide XML Namespace

`wrapSlideXml()` in `xmlHelpers.ts` currently declares `a:`, `r:`, and `p:` namespaces. Always add the `c:` namespace — it is harmless on slides without charts and avoids conditional logic:

```xml
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
```

### Module Structure

```
src/renderer/
  chartDrawer.ts              — orchestrator: dispatches to the right builder
  charts/
    barChartBuilder.ts        — bar + stackedBar (grouping "clustered" vs "stacked")
    lineChartBuilder.ts       — line chart
    pieChartBuilder.ts        — pie + donut (holeSize 0% vs 50%)
    chartXmlHelpers.ts        — shared functions (axes, legend, data labels, series)
    chartStyleBuilder.ts      — generates style{N}.xml and colors{N}.xml (static boilerplate)
```

### Style and Colors XML

`style{N}.xml` and `colors{N}.xml` are **static boilerplate** — they define PowerPoint's default chart appearance. Their content is reverse-engineered from a real PowerPoint file. `chartStyleBuilder.ts` generates these as hardcoded templates:

- `style{N}.xml`: Contains `<cs:chartStyle>` with default entries for `dataPoint`, `dataPointLine`, `dataPointMarker`, `dataPointWireframe`, `gridlineMajor`, etc. Uses theme references (`<a:schemeClr>`) so the chart inherits the template's color scheme.
- `colors{N}.xml`: Contains `<cs:colorStyle meth="cycle">` with a sequence of `<a:schemeClr val="accent1"/>` through `accent6` — PowerPoint cycles these across data series.

These files are the same for every chart type. The actual visual differences come from the chart XML itself.

### ChartRequest Interface

```typescript
export interface ChartRequest {
  chartXml: string;      // content of chart{N}.xml
  styleXml: string;      // content of style{N}.xml
  colorsXml: string;     // content of colors{N}.xml
  chartRelsXml: string;  // content of chart{N}.xml.rels
}
```

Note: `anchorShape` is NOT part of `ChartRequest`. It is returned separately by `buildChart()` (see below).

### BuildChartResult Interface

```typescript
export interface BuildChartResult {
  anchorShape: string;   // <p:graphicFrame> XML with placeholder relId token
  nextId: number;
  chartRequest: ChartRequest;
}
```

### SlideShapeResult (extended)

```typescript
export interface SlideShapeResult {
  shapes: string;
  nextId: number;
  iconRequests: IconRequest[];
  chartRequests: ChartRequest[];  // new — initialized empty at top of buildSlideShapes
}
```

The `chartRequests` array is initialized as `const chartRequests: ChartRequest[] = []` at the top of `buildSlideShapes()`, alongside the existing `const iconRequests: IconRequest[] = []`. It is returned in the result object for all code paths.

### placeholderFiller.ts Integration

New `case 'chart'` in the `buildSlideShapes` switch. **This replaces the current behavior** where `chart` falls through to the `default` branch (rendered as title + bullets).

```typescript
case 'chart': {
  const title = getTitleText(slide);
  shapes += placeholderShape(id++, 'title', 0, [title]);
  const chartEl = findElement(slide.elements, 'chart');
  if (chartEl) {
    const accentColors = templateInfo.theme.accentColors.map(c => c.replace('#', ''));
    const result = buildChart(chartEl, id, accentColors);
    shapes += result.anchorShape;
    id = result.nextId;
    chartRequests.push(result.chartRequest);
  }
  break;
}
```

### Anchor Shape relId Resolution

The `anchorShape` XML contains a **placeholder token** `__CHART_RELID__` in the `r:id` attribute:

```xml
<c:chart r:id="__CHART_RELID__"/>
```

The renderer resolves this token when assigning the real `chartRelId`:

```typescript
// In pptxRenderer.ts, after determining chartRelId:
const resolvedShape = chartReq.anchorShape.replace('__CHART_RELID__', chartRelId);
```

This allows `buildChart()` to run synchronously in `placeholderFiller` without knowing the final relId, which is determined later by `pptxRenderer`'s global counter. The placeholder token is replaced **before** writing the slide XML.

### Chart Type to OOXML Mapping

| chartType | OOXML element | Notes |
|-----------|---------------|-------|
| bar | `<c:barChart>` | `grouping="clustered"`, `barDir="col"` |
| stackedBar | `<c:barChart>` | `grouping="stacked"`, `barDir="col"` |
| line | `<c:lineChart>` | `grouping="standard"` |
| pie | `<c:pieChart>` | Single series only |
| donut | `<c:doughnutChart>` | `holeSize="50"`, single series |

### Chart Positioning

- Title rendered via placeholder (same as other canvas layouts)
- Chart frame position (consistent with existing layout grid):
  - `x = emu(0.8)` (same left margin as other canvas layouts)
  - `y = emu(1.6)` (below title, same as table/kpi top)
  - `cx = emu(10.6)` (width: 10.6 inches, matches slide content area)
  - `cy = emu(4.8)` (height: fills remaining slide space)

### pptxRenderer.ts Integration

**Destructuring update:** In the slide loop, `buildSlideShapes` is called at line 73. Update the destructuring to include `chartRequests`:

```typescript
const { shapes, nextId, iconRequests, chartRequests } = buildSlideShapes(slide, nextShapeId, templateInfo);
```

**Counter initialization:** Add alongside `nextImageNum` (line 61):

```typescript
let nextChartNum = 1;
```

The `slideEntries` type is extended:

```typescript
const slideEntries: Array<{
  slideNum: number;
  slideXml: string;
  layoutIndex: number;
  notes?: string;
  images: Array<{ relId: string; mediaPath: string; pngBuffer: Buffer }>;
  charts: Array<{                    // new
    chartNum: number;
    relId: string;
    chartXml: string;
    styleXml: string;
    colorsXml: string;
    chartRelsXml: string;
  }>;
}> = [];
```

A global `nextChartNum` counter (starting at 1) is tracked alongside `nextImageNum`. For each chart in `chartRequests`:

```typescript
// In the slide loop — resolve placeholder tokens and assign relIds:
for (const chartReq of chartRequests) {
  const chartNum = nextChartNum++;
  const chartRelId = `rIdChart${chartNum}`;
  // Resolve the __CHART_RELID__ placeholder in the slide XML
  slideXml = slideXml.replace('__CHART_RELID__', chartRelId);
  slideCharts.push({
    chartNum,
    relId: chartRelId,
    chartXml: chartReq.chartXml,
    styleXml: chartReq.styleXml,
    colorsXml: chartReq.colorsXml,
    chartRelsXml: chartReq.chartRelsXml,
  });
}
```

After the slide loop, write chart files and update rels:

```typescript
// Write chart files to ZIP:
zip.file(`ppt/charts/chart${chart.chartNum}.xml`, chart.chartXml);
zip.file(`ppt/charts/style${chart.chartNum}.xml`, chart.styleXml);
zip.file(`ppt/charts/colors${chart.chartNum}.xml`, chart.colorsXml);
zip.file(`ppt/charts/_rels/chart${chart.chartNum}.xml.rels`, chart.chartRelsXml);
```

### Slide Relationship Append Strategy

The existing renderer appends notes and image relationships to slide rels via separate `replace('</Relationships>', ...)` calls. Charts use the same pattern. All appends (notes, images, charts) are applied sequentially — each `replace` appends before `</Relationships>`, and the next `replace` finds the new `</Relationships>` at the end.

Chart relationship type in `slide{M}.xml.rels`:

```xml
<Relationship Id="rIdChart1"
  Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart"
  Target="../charts/chart1.xml"/>
```

The relId format `rIdChart{N}` avoids collisions with `rId1` (slideLayout), `rId2` (notes), and `rIdImg{N}` (images).

**Content-type overrides** (3 per chart) are appended to `[Content_Types].xml` using the same `newContentTypes += ...` pattern as images and notes:

```typescript
// For each chart, append 3 overrides:
newContentTypes += `\n  <Override PartName="/ppt/charts/chart${chart.chartNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;
newContentTypes += `\n  <Override PartName="/ppt/charts/style${chart.chartNum}.xml" ContentType="application/vnd.ms-office.chartstyle+xml"/>`;
newContentTypes += `\n  <Override PartName="/ppt/charts/colors${chart.chartNum}.xml" ContentType="application/vnd.ms-office.chartcolorstyle+xml"/>`;
```

## DataParser Auto-Detection

### Heuristic

When the dataParser receives CSV/JSON with numeric columns:

1. Extract the first column as `labels` (categories)
2. Remaining numeric columns become `series`
3. Emit a `chart` element with a `_dataHint` annotation
4. The promptParser (LLM) decides the final `chartType` based on narrative context

### Data Hint Annotation

```typescript
{
  _dataHint: 'chart-candidate',
  _detectedColumns: { categorical: ['Trimestre'], numeric: ['Ventes', 'Coûts'] },
  _suggestedChartTypes: ['bar', 'line'],
}
```

### Suggestion Heuristics

| Condition | Suggested chartType |
|-----------|-------------------|
| 1 series + ≤ 5 categories | `pie` |
| Temporal data (dates, Q1/Q2, months) | `line` |
| Multiple comparative series | `bar` |
| Percentages summing to ~100% | `pie` or `donut` |

The LLM has final say — it can override or ignore suggestions.

## Test Strategy

### Schema Tests (`tests/schema/`)

- ChartElement with valid/invalid options
- `stackedBar` accepted, unknown types rejected
- `options` absent = valid
- Invalid hex in `colors` rejected by regex (`/^[0-9A-Fa-f]{6}$/`)
- Valid 6-char hex without `#` accepted

### Transform Tests (`tests/transform/`)

- Truncation to 8 categories / 4 series with warnings
- Pie/donut with 2+ series reduced to 1
- Values/labels alignment (pad with 0, truncate)
- `elementDegrader`: chart → table conversion produces correct headers/rows
- `elementDegrader`: chart → bullets conversion produces readable text items (`"Q1 — Ventes: 150, Coûts: 120"`)
- Chart → table → bullets cascade if table also unsupported

### Renderer Tests (`tests/renderer/`)

- `chartDrawer.test.ts`: each type (bar, stackedBar, line, pie, donut) produces valid XML
- Correct `<c:chartSpace>` structure with proper nodes (`<c:barChart>`, `<c:pieChart>`, etc.)
- `<p:graphicFrame>` anchor shape has `__CHART_RELID__` placeholder token
- Theme colors used by default, custom colors when `options.colors` provided
- Data labels present/absent per `showDataLabels`
- Legend positioned correctly
- Style and colors XML contain expected boilerplate

### Integration Tests (`tests/renderer/pptxRenderer.test.ts`)

- Chart slide produces `ppt/charts/chart1.xml`, `style1.xml`, `colors1.xml`, `_rels/chart1.xml.rels` in ZIP
- Slide rels contain chart relationship with type `http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart`
- `__CHART_RELID__` placeholder resolved to actual relId in final slide XML
- `[Content_Types].xml` contains 3 overrides per chart
- Multiple chart slides → correct global numbering (chart1, chart2, ...)
- `wrapSlideXml` includes `xmlns:c` namespace

### Parser Tests (`tests/parser/`)

- CSV with numeric columns → `chart-candidate` hint emitted
- Suggestion heuristics (temporal → line, few categories → pie, etc.)
- promptParser includes `stackedBar` in chart description
