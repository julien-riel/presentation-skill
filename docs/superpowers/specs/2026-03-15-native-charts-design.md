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
    // Styling
    colors: z.array(z.string()).optional(),
    // Layout
    gridLines: z.boolean().optional(),
  }).optional(),
});
```

All `options` fields are optional. Without options, the chart uses theme colors and sensible defaults.

## Content Validation

### Limits

```typescript
export const MAX_CHART_CATEGORIES = 8;
export const MAX_CHART_SERIES = 4;
```

### Rules

| Condition | Action |
|-----------|--------|
| labels > 8 | Truncate to 8 + warning |
| series > 4 | Truncate to 4 + warning |
| series.values.length !== labels.length | Pad with 0 or truncate to align |
| pie/donut with > 1 series | Keep first series only + warning |

### Degradation Cascade

```typescript
// Before: chart: ['bullets', 'generic']
// After:  chart: ['table', 'bullets', 'generic']
```

When chart degrades to table, the transformer converts the data:
- `headers = ["", ...series.map(s => s.name)]`
- `rows = labels.map((label, i) => [label, ...series.map(s => String(s.values[i]))])`

## Renderer Architecture

### Files Generated Per Chart

Each chart produces three files in the PPTX ZIP:

| File | Content |
|------|---------|
| `ppt/charts/chart{N}.xml` | Chart definition (`<c:chartSpace>`) |
| `ppt/charts/style{N}.xml` | Visual style |
| `ppt/charts/colors{N}.xml` | Color palette |

Plus relationships in `slide{M}.xml.rels` and overrides in `[Content_Types].xml`.

### Content Types

```xml
<Override PartName="/ppt/charts/chart1.xml"
  ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
<Override PartName="/ppt/charts/style1.xml"
  ContentType="application/vnd.ms-office.chartstyle+xml"/>
<Override PartName="/ppt/charts/colors1.xml"
  ContentType="application/vnd.ms-office.chartcolorstyle+xml"/>
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
    chartStyleBuilder.ts      — generates style{N}.xml and colors{N}.xml
```

### ChartRequest Interface

```typescript
export interface ChartRequest {
  chartXml: string;      // content of chart{N}.xml
  styleXml: string;      // content of style{N}.xml
  colorsXml: string;     // content of colors{N}.xml
  anchorShape: string;   // shape XML with <c:chart r:id="..."/> for the slide
  width: number;         // EMU
  height: number;        // EMU
}
```

### SlideShapeResult (extended)

```typescript
export interface SlideShapeResult {
  shapes: string;
  nextId: number;
  iconRequests: IconRequest[];
  chartRequests: ChartRequest[];  // new
}
```

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
- Chart area centered below title: approximately 8.5" x 4.5"

### Renderer Integration (pptxRenderer.ts)

Charts follow the same pattern as images and notes — additional files written to the ZIP:

1. Detect `chartRequests` in `SlideShapeResult`
2. Write chart/style/colors XML files to ZIP
3. Add relationships in `slide{M}.xml.rels`
4. Add internal rels: `chart{N}.xml.rels` → style + colors
5. Add Content_Types overrides

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
- Invalid hex in `colors` rejected

### Transform Tests (`tests/transform/`)

- Truncation to 8 categories / 4 series with warnings
- Pie/donut with 2+ series reduced to 1
- Values/labels alignment (pad with 0)
- Chart → table degradation: data converted to headers/rows correctly
- Chart → table → bullets cascade if table also unsupported

### Renderer Tests (`tests/renderer/`)

- `chartDrawer.test.ts`: each type (bar, stackedBar, line, pie, donut) produces valid XML
- Correct `<c:chartSpace>` structure with proper nodes
- Theme colors used by default, custom colors when `options.colors` provided
- Data labels present/absent per `showDataLabels`
- Legend positioned correctly

### Integration Tests (`tests/renderer/pptxRenderer.test.ts`)

- Chart slide produces `ppt/charts/chart1.xml`, `style1.xml`, `colors1.xml` in ZIP
- Relationships and Content_Types are correct
- Multiple chart slides → correct numbering (chart1, chart2, ...)

### Parser Tests (`tests/parser/`)

- CSV with numeric columns → `chart-candidate` hint emitted
- Suggestion heuristics (temporal → line, few categories → pie, etc.)
