# Native OOXML Chart Support — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native PowerPoint chart rendering (bar, stackedBar, line, pie, donut) as real OOXML `<c:chartSpace>` objects.

**Architecture:** Extend the existing parser → transform → render pipeline. Schema gets `stackedBar` + `options`. A new `elementDegrader` transform converts chart elements when layouts degrade. Chart builders produce OOXML XML files that the renderer writes into the ZIP alongside existing slide/image/notes files.

**Tech Stack:** TypeScript, Zod, JSZip, raw OOXML XML, Vitest

**Spec:** `docs/superpowers/specs/2026-03-15-native-charts-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|---------------|
| `src/transform/elementDegrader.ts` | Convert chart elements when layout degrades (chart→table, chart→bullets) |
| `src/renderer/chartDrawer.ts` | Orchestrator: dispatch to chart builders, produce `BuildChartResult` |
| `src/renderer/charts/chartXmlHelpers.ts` | Shared OOXML helpers: series XML, axes, legend, data labels, number format |
| `src/renderer/charts/chartStyleBuilder.ts` | Static boilerplate for `style{N}.xml` and `colors{N}.xml` |
| `src/renderer/charts/barChartBuilder.ts` | Bar + stackedBar chart XML (`<c:barChart>`) |
| `src/renderer/charts/lineChartBuilder.ts` | Line chart XML (`<c:lineChart>`) |
| `src/renderer/charts/pieChartBuilder.ts` | Pie + donut chart XML (`<c:pieChart>`, `<c:doughnutChart>`) |
| `tests/transform/elementDegrader.test.ts` | Tests for element degradation |
| `tests/renderer/chartDrawer.test.ts` | Tests for chart drawer + all builders |

### Modified files

| File | Changes |
|------|---------|
| `src/schema/presentation.ts` | Add `stackedBar` to enum, add `options` to `ChartElementSchema` |
| `src/transform/contentValidator.ts` | Add chart limits (MAX_CHART_CATEGORIES, MAX_CHART_SERIES) |
| `src/transform/index.ts` | Wire `elementDegrader` between layoutResolver and contentValidator |
| `src/validator/constants.ts` | Update `FALLBACK_CASCADES.chart` to `['table', 'bullets', 'generic']` |
| `src/renderer/xmlHelpers.ts` | Add `xmlns:c` to `wrapSlideXml`, add `graphicFrameShape` helper |
| `src/renderer/placeholderFiller.ts` | Add `chartRequests` to `SlideShapeResult`, add `case 'chart'` |
| `src/renderer/pptxRenderer.ts` | Write chart files to ZIP, resolve `__CHART_RELID__`, add rels + content types |
| `src/parser/promptParser.ts` | Update chart description with `stackedBar` and options |
| `tests/schema/presentation.test.ts` | Add chart schema tests |
| `tests/transform/transform.test.ts` | Add chart validation tests |
| `tests/renderer/renderer.test.ts` | Add chart integration tests |
| `tests/parser/promptParser.test.ts` | Test updated chart description |
| `tests/helpers/capabilitiesHelpers.ts` | Update `fallback_map.chart` to `'table'` |

---

## Chunk 1: Schema + Transform

### Task 1: Extend ChartElementSchema

**Files:**
- Modify: `src/schema/presentation.ts:78-88`
- Test: `tests/schema/presentation.test.ts`

- [ ] **Step 1: Write failing tests for extended chart schema**

Add to `tests/schema/presentation.test.ts` inside the `ElementSchema` describe block:

```typescript
it('accepts a chart element with stackedBar type', () => {
  const el = {
    type: 'chart',
    chartType: 'stackedBar',
    data: {
      labels: ['Q1', 'Q2'],
      series: [{ name: 'Revenue', values: [100, 200] }],
    },
  };
  expect(ElementSchema.parse(el)).toEqual(el);
});

it('accepts a chart element with options', () => {
  const el = {
    type: 'chart',
    chartType: 'bar',
    data: {
      labels: ['Q1', 'Q2'],
      series: [{ name: 'Revenue', values: [100, 200] }],
    },
    options: {
      title: 'Revenue by Quarter',
      xAxisLabel: 'Quarter',
      yAxisLabel: 'Amount',
      yAxisMin: 0,
      yAxisMax: 300,
      valueFormat: 'currency',
      currencySymbol: '$',
      showDataLabels: true,
      showLegend: true,
      legendPosition: 'bottom',
      colors: ['1E3A5F', '2C7DA0'],
      gridLines: true,
    },
  };
  expect(ElementSchema.parse(el)).toEqual(el);
});

it('accepts a chart element without options (backward compat)', () => {
  const el = {
    type: 'chart',
    chartType: 'pie',
    data: {
      labels: ['A', 'B'],
      series: [{ name: 'Share', values: [60, 40] }],
    },
  };
  expect(ElementSchema.parse(el)).toEqual(el);
});

it('rejects chart with invalid hex color in options', () => {
  const el = {
    type: 'chart',
    chartType: 'bar',
    data: { labels: ['A'], series: [{ name: 'X', values: [1] }] },
    options: { colors: ['#FF0000'] }, // has # prefix — invalid
  };
  expect(() => ElementSchema.parse(el)).toThrow();
});

it('rejects chart with unknown chartType', () => {
  const el = {
    type: 'chart',
    chartType: 'radar',
    data: { labels: ['A'], series: [{ name: 'X', values: [1] }] },
  };
  expect(() => ElementSchema.parse(el)).toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/schema/presentation.test.ts`
Expected: 3 failures (`stackedBar` not in enum, `options` not in schema, `#FF0000` accepted)

- [ ] **Step 3: Update ChartElementSchema**

In `src/schema/presentation.ts`, replace lines 78-88:

```typescript
export const ChartOptionsSchema = z.object({
  title: z.string().optional(),
  xAxisLabel: z.string().optional(),
  yAxisLabel: z.string().optional(),
  yAxisMin: z.number().optional(),
  yAxisMax: z.number().optional(),
  valueFormat: z.enum(['number', 'percent', 'currency']).optional(),
  currencySymbol: z.string().optional(),
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/schema/presentation.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/schema/presentation.ts tests/schema/presentation.test.ts
git commit -m "feat: extend ChartElementSchema with stackedBar and options"
```

---

### Task 2: Add chart content validation

**Files:**
- Modify: `src/transform/contentValidator.ts`
- Test: `tests/transform/transform.test.ts`

- [ ] **Step 1: Write failing tests for chart validation**

Add to `tests/transform/transform.test.ts` in the `contentValidator` describe block:

```typescript
it('truncates chart series beyond 4', () => {
  const slides: Slide[] = [{
    layout: 'chart',
    elements: [
      { type: 'title', text: 'Chart' },
      {
        type: 'chart',
        chartType: 'bar',
        data: {
          labels: ['A', 'B'],
          series: [
            { name: 'S1', values: [1, 2] },
            { name: 'S2', values: [3, 4] },
            { name: 'S3', values: [5, 6] },
            { name: 'S4', values: [7, 8] },
            { name: 'S5', values: [9, 10] },
          ],
        },
      },
    ],
  }];

  const result = validateContent(slides);
  const chartEl = result[0].elements.find(el => el.type === 'chart');
  expect(chartEl).toBeDefined();
  if (chartEl?.type === 'chart') {
    expect(chartEl.data.series).toHaveLength(4);
  }
  expect(result[0]._warnings?.some(w => w.includes('series truncated'))).toBe(true);
});

it('truncates chart categories beyond 8', () => {
  const labels = Array.from({ length: 12 }, (_, i) => `Cat${i}`);
  const slides: Slide[] = [{
    layout: 'chart',
    elements: [
      { type: 'title', text: 'Chart' },
      {
        type: 'chart',
        chartType: 'line',
        data: {
          labels,
          series: [{ name: 'S1', values: Array.from({ length: 12 }, (_, i) => i) }],
        },
      },
    ],
  }];

  const result = validateContent(slides);
  const chartEl = result[0].elements.find(el => el.type === 'chart');
  if (chartEl?.type === 'chart') {
    expect(chartEl.data.labels).toHaveLength(8);
    expect(chartEl.data.series[0].values).toHaveLength(8);
  }
  expect(result[0]._warnings?.some(w => w.includes('categories truncated'))).toBe(true);
});

it('reduces pie chart to single series', () => {
  const slides: Slide[] = [{
    layout: 'chart',
    elements: [
      { type: 'title', text: 'Pie' },
      {
        type: 'chart',
        chartType: 'pie',
        data: {
          labels: ['A', 'B'],
          series: [
            { name: 'S1', values: [60, 40] },
            { name: 'S2', values: [30, 70] },
          ],
        },
      },
    ],
  }];

  const result = validateContent(slides);
  const chartEl = result[0].elements.find(el => el.type === 'chart');
  if (chartEl?.type === 'chart') {
    expect(chartEl.data.series).toHaveLength(1);
    expect(chartEl.data.series[0].name).toBe('S1');
  }
  expect(result[0]._warnings?.some(w => w.includes('single series'))).toBe(true);
});

it('pads short values array with zeros', () => {
  const slides: Slide[] = [{
    layout: 'chart',
    elements: [
      { type: 'title', text: 'Chart' },
      {
        type: 'chart',
        chartType: 'bar',
        data: {
          labels: ['A', 'B', 'C'],
          series: [{ name: 'S1', values: [1] }],
        },
      },
    ],
  }];

  const result = validateContent(slides);
  const chartEl = result[0].elements.find(el => el.type === 'chart');
  if (chartEl?.type === 'chart') {
    expect(chartEl.data.series[0].values).toEqual([1, 0, 0]);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/transform/transform.test.ts`
Expected: 4 failures (chart validation not implemented)

- [ ] **Step 3: Add chart validation to contentValidator.ts**

In `src/transform/contentValidator.ts`, add constants and validation block. Add after line 8:

```typescript
export const MAX_CHART_CATEGORIES = 8;
export const MAX_CHART_SERIES = 4;
```

Add the chart validation block inside `validateSlideContent()`, after the table row/column limit block (after line 98):

```typescript
// --- Chart: max 1 per slide ---
const chartElements = elements.filter(el => el.type === 'chart');
if (chartElements.length > 1) {
  warnings.push(`Multiple chart elements reduced to 1`);
  let kept = false;
  elements = elements.filter(el => {
    if (el.type !== 'chart') return true;
    if (!kept) { kept = true; return true; }
    return false;
  });
}

// --- Chart category/series limit ---
elements = elements.map((el) => {
  if (el.type !== 'chart') return el;
  let { labels, series } = el.data;

  if (series.length > MAX_CHART_SERIES) {
    warnings.push(`Chart series truncated from ${series.length} to ${MAX_CHART_SERIES}`);
    series = series.slice(0, MAX_CHART_SERIES);
  }

  if ((el.chartType === 'pie' || el.chartType === 'donut') && series.length > 1) {
    warnings.push(`${el.chartType} chart reduced to single series`);
    series = [series[0]];
  }

  if (labels.length > MAX_CHART_CATEGORIES) {
    warnings.push(`Chart categories truncated from ${labels.length} to ${MAX_CHART_CATEGORIES}`);
    labels = labels.slice(0, MAX_CHART_CATEGORIES);
    series = series.map(s => ({ ...s, values: s.values.slice(0, MAX_CHART_CATEGORIES) }));
  }

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/transform/transform.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/transform/contentValidator.ts tests/transform/transform.test.ts
git commit -m "feat: add chart content validation limits"
```

---

### Task 3: Create elementDegrader

**Files:**
- Create: `src/transform/elementDegrader.ts`
- Create: `tests/transform/elementDegrader.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/transform/elementDegrader.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { Slide } from '../../src/schema/presentation.js';
import { degradeElements } from '../../src/transform/elementDegrader.js';

describe('degradeElements', () => {
  it('converts chart to table when _resolvedLayout is table', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      _resolvedLayout: 'table',
      elements: [
        { type: 'title', text: 'Revenue' },
        {
          type: 'chart',
          chartType: 'bar',
          data: {
            labels: ['Q1', 'Q2', 'Q3'],
            series: [
              { name: 'Sales', values: [100, 200, 150] },
              { name: 'Costs', values: [80, 120, 110] },
            ],
          },
        },
      ],
    }];

    const result = degradeElements(slides);
    const tableEl = result[0].elements.find(el => el.type === 'table');
    expect(tableEl).toBeDefined();
    if (tableEl?.type === 'table') {
      expect(tableEl.headers).toEqual(['', 'Sales', 'Costs']);
      expect(tableEl.rows).toEqual([
        ['Q1', '100', '80'],
        ['Q2', '200', '120'],
        ['Q3', '150', '110'],
      ]);
    }
    // Title preserved
    expect(result[0].elements.find(el => el.type === 'title')).toBeDefined();
    // No chart element remaining
    expect(result[0].elements.find(el => el.type === 'chart')).toBeUndefined();
  });

  it('converts chart to bullets when _resolvedLayout is bullets', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      _resolvedLayout: 'bullets',
      elements: [
        { type: 'title', text: 'Revenue' },
        {
          type: 'chart',
          chartType: 'bar',
          data: {
            labels: ['Q1', 'Q2'],
            series: [
              { name: 'Sales', values: [100, 200] },
              { name: 'Costs', values: [80, 120] },
            ],
          },
        },
      ],
    }];

    const result = degradeElements(slides);
    const bulletsEl = result[0].elements.find(el => el.type === 'bullets');
    expect(bulletsEl).toBeDefined();
    if (bulletsEl?.type === 'bullets') {
      expect(bulletsEl.items).toEqual([
        'Q1 — Sales: 100, Costs: 80',
        'Q2 — Sales: 200, Costs: 120',
      ]);
    }
    expect(result[0].elements.find(el => el.type === 'chart')).toBeUndefined();
  });

  it('does not modify slides where layout is chart and resolved is chart', () => {
    const slides: Slide[] = [{
      layout: 'chart',
      _resolvedLayout: 'chart',
      elements: [
        { type: 'title', text: 'Revenue' },
        {
          type: 'chart',
          chartType: 'bar',
          data: { labels: ['Q1'], series: [{ name: 'S', values: [1] }] },
        },
      ],
    }];

    const result = degradeElements(slides);
    expect(result[0].elements.find(el => el.type === 'chart')).toBeDefined();
  });

  it('does not modify non-chart slides', () => {
    const slides: Slide[] = [{
      layout: 'bullets',
      _resolvedLayout: 'bullets',
      elements: [
        { type: 'title', text: 'Test' },
        { type: 'bullets', items: ['A', 'B'] },
      ],
    }];

    const result = degradeElements(slides);
    expect(result).toEqual(slides);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/transform/elementDegrader.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement elementDegrader**

Create `src/transform/elementDegrader.ts`:

```typescript
import type { Slide } from '../schema/presentation.js';

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/transform/elementDegrader.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/transform/elementDegrader.ts tests/transform/elementDegrader.test.ts
git commit -m "feat: add elementDegrader transform for chart degradation"
```

---

### Task 4: Wire elementDegrader + update cascade

**Files:**
- Modify: `src/transform/index.ts`
- Modify: `src/validator/constants.ts:36`
- Modify: `tests/helpers/capabilitiesHelpers.ts:18`
- Test: `tests/transform/transform.test.ts`

- [ ] **Step 1: Write failing test for chart→table cascade**

Add to `tests/transform/transform.test.ts` in the `layoutResolver` describe block:

```typescript
it('"chart" on Tier 1 with table available → degrades to "table"', () => {
  const caps = makeTier1Capabilities(['table']);
  const slides: Slide[] = [{
    layout: 'chart',
    elements: [
      { type: 'title', text: 'Chart' },
      {
        type: 'chart',
        chartType: 'bar',
        data: { labels: ['A'], series: [{ name: 'S', values: [1] }] },
      },
    ],
  }];

  const result = resolveLayouts(slides, caps);
  expect(result[0]._resolvedLayout).toBe('table');
});
```

Add to the `transformPresentation (full pipeline)` describe block:

```typescript
it('chart → table degradation converts elements', () => {
  const caps = makeTier1Capabilities(['table']);
  const presentation: Presentation = {
    title: 'Chart Degrade Test',
    slides: [{
      layout: 'chart',
      elements: [
        { type: 'title', text: 'Revenue' },
        {
          type: 'chart',
          chartType: 'bar',
          data: {
            labels: ['Q1', 'Q2'],
            series: [{ name: 'Sales', values: [100, 200] }],
          },
        },
      ],
    }],
  };

  const result = transformPresentation(presentation, caps);
  expect(result.slides[0]._resolvedLayout).toBe('table');
  const tableEl = result.slides[0].elements.find(el => el.type === 'table');
  expect(tableEl).toBeDefined();
  if (tableEl?.type === 'table') {
    expect(tableEl.headers).toEqual(['', 'Sales']);
    expect(tableEl.rows).toEqual([['Q1', '100'], ['Q2', '200']]);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/transform/transform.test.ts`
Expected: 2 failures (cascade still goes to `bullets`, elementDegrader not wired)

- [ ] **Step 3: Update FALLBACK_CASCADES**

In `src/validator/constants.ts`, change line 36:

```typescript
// Before:
chart: ['bullets', 'generic'],
// After:
chart: ['table', 'bullets', 'generic'],
```

- [ ] **Step 4: Update capabilitiesHelpers fallback_map**

In `tests/helpers/capabilitiesHelpers.ts`, line 18:

```typescript
// Before:
chart: 'bullets',
// After:
chart: 'table',
```

- [ ] **Step 5: Wire elementDegrader into transform pipeline**

In `src/transform/index.ts`:

```typescript
import type { Presentation } from '../schema/presentation.js';
import type { TemplateCapabilities } from '../schema/capabilities.js';
import { resolveLayouts } from './layoutResolver.js';
import { degradeElements } from './elementDegrader.js';
import { validateContent } from './contentValidator.js';

/**
 * Transform pipeline: resolveLayouts → elementDegrader → contentValidator.
 */
export function transformPresentation(
  presentation: Presentation,
  capabilities: TemplateCapabilities,
): Presentation {
  let slides = presentation.slides;
  slides = resolveLayouts(slides, capabilities);
  slides = degradeElements(slides);
  slides = validateContent(slides);
  return { ...presentation, slides };
}

export { resolveLayouts } from './layoutResolver.js';
export { degradeElements } from './elementDegrader.js';
export { validateContent } from './contentValidator.js';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/transform/`
Expected: all PASS

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: all PASS (no regressions)

- [ ] **Step 8: Commit**

```bash
git add src/transform/index.ts src/validator/constants.ts tests/helpers/capabilitiesHelpers.ts tests/transform/transform.test.ts
git commit -m "feat: wire elementDegrader into transform pipeline, update chart cascade"
```

---

## Chunk 2: Chart OOXML Builders

### Task 5: Chart XML helpers (shared utilities)

**Files:**
- Create: `src/renderer/charts/chartXmlHelpers.ts`
- Create: `tests/renderer/chartDrawer.test.ts` (first tests)

- [ ] **Step 1: Write failing tests for series XML generation**

Create `tests/renderer/chartDrawer.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildSeriesXml, buildCategoryXml, buildValueXml } from '../../src/renderer/charts/chartXmlHelpers.js';

describe('chartXmlHelpers', () => {
  describe('buildCategoryXml', () => {
    it('generates strCache XML for labels', () => {
      const xml = buildCategoryXml(['Q1', 'Q2', 'Q3']);
      expect(xml).toContain('<c:ptCount val="3"/>');
      expect(xml).toContain('<c:pt idx="0"><c:v>Q1</c:v></c:pt>');
      expect(xml).toContain('<c:pt idx="2"><c:v>Q3</c:v></c:pt>');
    });
  });

  describe('buildValueXml', () => {
    it('generates numCache XML for values', () => {
      const xml = buildValueXml([100, 200, 150]);
      expect(xml).toContain('<c:ptCount val="3"/>');
      expect(xml).toContain('<c:pt idx="0"><c:v>100</c:v></c:pt>');
      expect(xml).toContain('<c:pt idx="2"><c:v>150</c:v></c:pt>');
    });

    it('supports percent format code', () => {
      const xml = buildValueXml([0.5, 0.3], 'percent');
      expect(xml).toContain('<c:formatCode>0%</c:formatCode>');
    });

    it('supports currency format code', () => {
      const xml = buildValueXml([1000], 'currency', '$');
      expect(xml).toContain('<c:formatCode>$#,##0</c:formatCode>');
    });
  });

  describe('buildSeriesXml', () => {
    it('generates a complete series element', () => {
      const xml = buildSeriesXml(0, 'Revenue', ['Q1', 'Q2'], [100, 200]);
      expect(xml).toContain('<c:idx val="0"/>');
      expect(xml).toContain('<c:order val="0"/>');
      expect(xml).toContain('Revenue');
      expect(xml).toContain('<c:v>100</c:v>');
      expect(xml).toContain('<c:v>200</c:v>');
    });

    it('applies custom color to series', () => {
      const xml = buildSeriesXml(0, 'Rev', ['A'], [1], { color: 'FF0000' });
      expect(xml).toContain('<a:srgbClr val="FF0000"/>');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement chartXmlHelpers**

Create `src/renderer/charts/chartXmlHelpers.ts`:

```typescript
import { escapeXml } from '../xmlHelpers.js';

/**
 * Generates <c:cat> XML with a string cache for category labels.
 */
export function buildCategoryXml(labels: string[]): string {
  const pts = labels.map((label, i) =>
    `<c:pt idx="${i}"><c:v>${escapeXml(label)}</c:v></c:pt>`
  ).join('');

  return `<c:cat>
  <c:strRef>
    <c:strCache>
      <c:ptCount val="${labels.length}"/>
      ${pts}
    </c:strCache>
  </c:strRef>
</c:cat>`;
}

/**
 * Generates <c:val> XML with a numeric cache.
 */
export function buildValueXml(
  values: number[],
  valueFormat?: 'number' | 'percent' | 'currency',
  currencySymbol?: string,
): string {
  let formatCode = 'General';
  if (valueFormat === 'percent') formatCode = '0%';
  else if (valueFormat === 'currency') formatCode = `${currencySymbol ?? '$'}#,##0`;

  const pts = values.map((v, i) =>
    `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`
  ).join('');

  return `<c:val>
  <c:numRef>
    <c:numCache>
      <c:formatCode>${formatCode}</c:formatCode>
      <c:ptCount val="${values.length}"/>
      ${pts}
    </c:numCache>
  </c:numRef>
</c:val>`;
}

/**
 * Generates a <c:ser> element for a data series.
 */
export function buildSeriesXml(
  index: number,
  name: string,
  labels: string[],
  values: number[],
  opts?: {
    color?: string;
    valueFormat?: 'number' | 'percent' | 'currency';
    currencySymbol?: string;
  },
): string {
  const colorXml = opts?.color
    ? `<c:spPr><a:solidFill><a:srgbClr val="${opts.color}"/></a:solidFill></c:spPr>`
    : '';

  return `<c:ser>
  <c:idx val="${index}"/>
  <c:order val="${index}"/>
  <c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>
  ${colorXml}
  ${buildCategoryXml(labels)}
  ${buildValueXml(values, opts?.valueFormat, opts?.currencySymbol)}
</c:ser>`;
}

/** Re-export escapeXml for use by chart builders. */
export { escapeXml } from '../xmlHelpers.js';
}

/**
 * Generates <c:legend> XML.
 */
export function buildLegendXml(position: string = 'b'): string {
  const posMap: Record<string, string> = { top: 't', bottom: 'b', left: 'l', right: 'r' };
  const pos = posMap[position] ?? 'b';
  return `<c:legend><c:legendPos val="${pos}"/><c:overlay val="0"/></c:legend>`;
}

/**
 * Generates category axis <c:catAx> XML.
 */
export function buildCatAxisXml(axId: number, crossAxId: number, label?: string): string {
  const titleXml = label
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeXml(label)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    : '';
  return `<c:catAx>
  <c:axId val="${axId}"/>
  <c:scaling><c:orientation val="minMax"/></c:scaling>
  <c:delete val="0"/>
  <c:axPos val="b"/>
  ${titleXml}
  <c:crossAx val="${crossAxId}"/>
</c:catAx>`;
}

/**
 * Generates value axis <c:valAx> XML.
 */
export function buildValAxisXml(
  axId: number,
  crossAxId: number,
  opts?: { label?: string; min?: number; max?: number; gridLines?: boolean },
): string {
  const titleXml = opts?.label
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeXml(opts.label)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`
    : '';
  const scaling = [
    '<c:orientation val="minMax"/>',
    opts?.min !== undefined ? `<c:min val="${opts.min}"/>` : '',
    opts?.max !== undefined ? `<c:max val="${opts.max}"/>` : '',
  ].filter(Boolean).join('');
  const gridXml = opts?.gridLines !== false
    ? '<c:majorGridlines/>'
    : '';

  return `<c:valAx>
  <c:axId val="${axId}"/>
  <c:scaling>${scaling}</c:scaling>
  <c:delete val="0"/>
  <c:axPos val="l"/>
  ${gridXml}
  ${titleXml}
  <c:crossAx val="${crossAxId}"/>
</c:valAx>`;
}

/**
 * Generates <c:dLbls> (data labels) XML.
 */
export function buildDataLabelsXml(show: boolean): string {
  if (!show) return '';
  return `<c:dLbls>
  <c:showLegendKey val="0"/>
  <c:showVal val="1"/>
  <c:showCatName val="0"/>
  <c:showSerName val="0"/>
  <c:showPercent val="0"/>
</c:dLbls>`;
}

/**
 * Wraps chart content in a complete chartSpace XML document.
 */
export function wrapChartXml(plotAreaContent: string, extras: string = '', chartTitle?: string): string {
  const titleXml = chartTitle
    ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${escapeXml(chartTitle)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
    <c:autoTitleDeleted val="0"/>`
    : '<c:autoTitleDeleted val="1"/>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
              xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:chart>
    ${titleXml}
    <c:plotArea>
      <c:layout/>
      ${plotAreaContent}
    </c:plotArea>
    ${extras}
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/charts/chartXmlHelpers.ts tests/renderer/chartDrawer.test.ts
git commit -m "feat: add chart XML helper functions"
```

---

### Task 6: Chart style + colors builder

**Files:**
- Create: `src/renderer/charts/chartStyleBuilder.ts`
- Test: `tests/renderer/chartDrawer.test.ts` (add tests)

- [ ] **Step 1: Write failing tests**

Add to `tests/renderer/chartDrawer.test.ts`:

```typescript
import { buildChartStyleXml, buildChartColorsXml, buildChartRelsXml } from '../../src/renderer/charts/chartStyleBuilder.js';

describe('chartStyleBuilder', () => {
  it('generates valid chart style XML', () => {
    const xml = buildChartStyleXml();
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('cs:chartStyle');
    expect(xml).toContain('cs:dataPoint');
  });

  it('generates valid chart colors XML', () => {
    const xml = buildChartColorsXml();
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('cs:colorStyle');
    expect(xml).toContain('meth="cycle"');
    expect(xml).toContain('accent1');
    expect(xml).toContain('accent6');
  });

  it('generates chart rels XML with correct relationship types', () => {
    const xml = buildChartRelsXml(3);
    expect(xml).toContain('Target="style3.xml"');
    expect(xml).toContain('Target="colors3.xml"');
    expect(xml).toContain('chartStyle');
    expect(xml).toContain('chartColorStyle');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement chartStyleBuilder**

Create `src/renderer/charts/chartStyleBuilder.ts`:

```typescript
/**
 * Generates static chart style XML (style{N}.xml).
 * Uses theme references so charts inherit the template's color scheme.
 */
export function buildChartStyleXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cs:chartStyle xmlns:cs="http://schemas.microsoft.com/office/drawing/2012/chartStyle"
               xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
               id="201">
  <cs:dataPoint>
    <cs:lnRef idx="0"/>
    <cs:fillRef idx="1"><cs:styleClr val="auto"/></cs:fillRef>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/></cs:fontRef>
  </cs:dataPoint>
  <cs:dataPointLine>
    <cs:lnRef idx="0"><cs:styleClr val="auto"/></cs:lnRef>
    <cs:fillRef idx="1"/>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/></cs:fontRef>
    <cs:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:round/></a:ln></cs:spPr>
  </cs:dataPointLine>
  <cs:dataPointMarker>
    <cs:lnRef idx="0"><cs:styleClr val="auto"/></cs:lnRef>
    <cs:fillRef idx="1"><cs:styleClr val="auto"/></cs:fillRef>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/></cs:fontRef>
    <cs:spPr><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></cs:spPr>
  </cs:dataPointMarker>
  <cs:dataPointWireframe>
    <cs:lnRef idx="0"><cs:styleClr val="auto"/></cs:lnRef>
    <cs:fillRef idx="1"/>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/></cs:fontRef>
    <cs:spPr><a:ln w="9525" cap="rnd"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:round/></a:ln></cs:spPr>
  </cs:dataPointWireframe>
  <cs:gridlineMajor>
    <cs:lnRef idx="0"/>
    <cs:fillRef idx="0"/>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/></cs:fontRef>
    <cs:spPr><a:ln w="9525" cap="flat"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="15000"/><a:lumOff val="85000"/></a:schemeClr></a:solidFill><a:round/></a:ln></cs:spPr>
  </cs:gridlineMajor>
  <cs:gridlineMinor>
    <cs:lnRef idx="0"/>
    <cs:fillRef idx="0"/>
    <cs:effectRef idx="0"/>
    <cs:fontRef idx="minor"><a:schemeClr val="tx1"/></cs:fontRef>
    <cs:spPr><a:ln w="9525" cap="flat"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="5000"/><a:lumOff val="95000"/></a:schemeClr></a:solidFill><a:round/></a:ln></cs:spPr>
  </cs:gridlineMinor>
</cs:chartStyle>`;
}

/**
 * Generates static chart colors XML (colors{N}.xml).
 * Uses accent scheme colors so charts inherit the template's palette.
 */
export function buildChartColorsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cs:colorStyle xmlns:cs="http://schemas.microsoft.com/office/drawing/2012/chartStyle"
               xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
               meth="cycle" id="10">
  <a:schemeClr val="accent1"/>
  <a:schemeClr val="accent2"/>
  <a:schemeClr val="accent3"/>
  <a:schemeClr val="accent4"/>
  <a:schemeClr val="accent5"/>
  <a:schemeClr val="accent6"/>
  <cs:variation/>
  <cs:variation><a:lumMod val="60000"/></cs:variation>
  <cs:variation><a:lumMod val="80000"/><a:lumOff val="20000"/></cs:variation>
  <cs:variation><a:lumMod val="80000"/></cs:variation>
  <cs:variation><a:lumMod val="60000"/><a:lumOff val="40000"/></cs:variation>
  <cs:variation><a:lumMod val="50000"/></cs:variation>
</cs:colorStyle>`;
}

/**
 * Generates chart internal relationships XML (chart{N}.xml.rels).
 */
export function buildChartRelsXml(chartNum: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.microsoft.com/office/2011/relationships/chartStyle" Target="style${chartNum}.xml"/>
  <Relationship Id="rId2" Type="http://schemas.microsoft.com/office/2011/relationships/chartColorStyle" Target="colors${chartNum}.xml"/>
</Relationships>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/charts/chartStyleBuilder.ts tests/renderer/chartDrawer.test.ts
git commit -m "feat: add chart style and colors boilerplate builder"
```

---

### Task 7: Bar chart builder

**Files:**
- Create: `src/renderer/charts/barChartBuilder.ts`
- Test: `tests/renderer/chartDrawer.test.ts` (add tests)

- [ ] **Step 1: Write failing tests**

Add to `tests/renderer/chartDrawer.test.ts`:

```typescript
import { buildBarChartXml } from '../../src/renderer/charts/barChartBuilder.js';
import type { Element } from '../../src/schema/presentation.js';

describe('barChartBuilder', () => {
  const barChart: Extract<Element, { type: 'chart' }> = {
    type: 'chart',
    chartType: 'bar',
    data: {
      labels: ['Q1', 'Q2', 'Q3'],
      series: [
        { name: 'Revenue', values: [100, 200, 150] },
        { name: 'Costs', values: [80, 120, 110] },
      ],
    },
  };

  it('generates valid bar chart XML', () => {
    const xml = buildBarChartXml(barChart, []);
    expect(xml).toContain('<c:barChart>');
    expect(xml).toContain('<c:barDir val="col"/>');
    expect(xml).toContain('<c:grouping val="clustered"/>');
    expect(xml).toContain('Revenue');
    expect(xml).toContain('<c:v>200</c:v>');
    expect(xml).toContain('<c:catAx>');
    expect(xml).toContain('<c:valAx>');
  });

  it('generates stacked bar chart', () => {
    const stacked = { ...barChart, chartType: 'stackedBar' as const };
    const xml = buildBarChartXml(stacked, []);
    expect(xml).toContain('<c:grouping val="stacked"/>');
  });

  it('includes legend when showLegend is true', () => {
    const withLegend = { ...barChart, options: { showLegend: true, legendPosition: 'right' as const } };
    const xml = buildBarChartXml(withLegend, []);
    expect(xml).toContain('<c:legend>');
    expect(xml).toContain('<c:legendPos val="r"/>');
  });

  it('uses custom colors when provided', () => {
    const withColors = { ...barChart, options: { colors: ['FF0000', '00FF00'] } };
    const xml = buildBarChartXml(withColors, []);
    expect(xml).toContain('<a:srgbClr val="FF0000"/>');
    expect(xml).toContain('<a:srgbClr val="00FF00"/>');
  });

  it('includes data labels when showDataLabels is true', () => {
    const withLabels = { ...barChart, options: { showDataLabels: true } };
    const xml = buildBarChartXml(withLabels, []);
    expect(xml).toContain('<c:showVal val="1"/>');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement barChartBuilder**

Create `src/renderer/charts/barChartBuilder.ts`:

```typescript
import type { Element } from '../../schema/presentation.js';
import {
  buildSeriesXml, buildCatAxisXml, buildValAxisXml,
  buildLegendXml, buildDataLabelsXml, wrapChartXml,
} from './chartXmlHelpers.js';

type ChartElement = Extract<Element, { type: 'chart' }>;

const CAT_AX_ID = 111111111;
const VAL_AX_ID = 222222222;

/**
 * Builds a complete bar chart (clustered or stacked) XML document.
 */
export function buildBarChartXml(chart: ChartElement, accentColors: string[]): string {
  const opts = chart.options;
  const grouping = chart.chartType === 'stackedBar' ? 'stacked' : 'clustered';

  const seriesXml = chart.data.series.map((s, i) =>
    buildSeriesXml(i, s.name, chart.data.labels, s.values, {
      color: opts?.colors?.[i] ?? accentColors[i],
      valueFormat: opts?.valueFormat,
      currencySymbol: opts?.currencySymbol,
    })
  ).join('');

  const dataLabels = buildDataLabelsXml(opts?.showDataLabels ?? false);

  const plotArea = `<c:barChart>
  <c:barDir val="col"/>
  <c:grouping val="${grouping}"/>
  <c:varyColors val="0"/>
  ${seriesXml}
  ${dataLabels}
  <c:axId val="${CAT_AX_ID}"/>
  <c:axId val="${VAL_AX_ID}"/>
</c:barChart>
${buildCatAxisXml(CAT_AX_ID, VAL_AX_ID, opts?.xAxisLabel)}
${buildValAxisXml(VAL_AX_ID, CAT_AX_ID, { label: opts?.yAxisLabel, min: opts?.yAxisMin, max: opts?.yAxisMax, gridLines: opts?.gridLines })}`;

  const legend = opts?.showLegend !== false
    ? buildLegendXml(opts?.legendPosition)
    : '';

  return wrapChartXml(plotArea, legend, opts?.title);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/charts/barChartBuilder.ts tests/renderer/chartDrawer.test.ts
git commit -m "feat: add bar and stackedBar chart builder"
```

---

### Task 8: Line chart builder

**Files:**
- Create: `src/renderer/charts/lineChartBuilder.ts`
- Test: `tests/renderer/chartDrawer.test.ts` (add tests)

- [ ] **Step 1: Write failing tests**

Add to `tests/renderer/chartDrawer.test.ts`:

```typescript
import { buildLineChartXml } from '../../src/renderer/charts/lineChartBuilder.js';

describe('lineChartBuilder', () => {
  const lineChart: Extract<Element, { type: 'chart' }> = {
    type: 'chart',
    chartType: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar'],
      series: [{ name: 'Visitors', values: [1000, 1500, 1200] }],
    },
  };

  it('generates valid line chart XML', () => {
    const xml = buildLineChartXml(lineChart, []);
    expect(xml).toContain('<c:lineChart>');
    expect(xml).toContain('<c:grouping val="standard"/>');
    expect(xml).toContain('Visitors');
    expect(xml).toContain('<c:v>1500</c:v>');
    expect(xml).toContain('<c:marker>');
    expect(xml).toContain('<c:catAx>');
    expect(xml).toContain('<c:valAx>');
  });

  it('includes data labels when requested', () => {
    const withLabels = { ...lineChart, options: { showDataLabels: true } };
    const xml = buildLineChartXml(withLabels, []);
    expect(xml).toContain('<c:showVal val="1"/>');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement lineChartBuilder**

Create `src/renderer/charts/lineChartBuilder.ts`:

```typescript
import type { Element } from '../../schema/presentation.js';
import {
  buildSeriesXml, buildCatAxisXml, buildValAxisXml,
  buildLegendXml, buildDataLabelsXml, wrapChartXml,
} from './chartXmlHelpers.js';

type ChartElement = Extract<Element, { type: 'chart' }>;

const CAT_AX_ID = 111111111;
const VAL_AX_ID = 222222222;

/**
 * Builds a complete line chart XML document.
 */
export function buildLineChartXml(chart: ChartElement, accentColors: string[]): string {
  const opts = chart.options;

  const seriesXml = chart.data.series.map((s, i) => {
    const base = buildSeriesXml(i, s.name, chart.data.labels, s.values, {
      color: opts?.colors?.[i] ?? accentColors[i],
      valueFormat: opts?.valueFormat,
      currencySymbol: opts?.currencySymbol,
    });
    const markerColor = opts?.colors?.[i] ?? accentColors[i] ?? '';
    const markerXml = markerColor
      ? `<c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr><a:solidFill><a:srgbClr val="${markerColor}"/></a:solidFill></c:spPr></c:marker>`
      : '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>';
    // Insert marker after </c:tx>
    return base.replace('</c:tx>', `</c:tx>\n  ${markerXml}`);
  }).join('');

  const dataLabels = buildDataLabelsXml(opts?.showDataLabels ?? false);

  const plotArea = `<c:lineChart>
  <c:grouping val="standard"/>
  <c:varyColors val="0"/>
  ${seriesXml}
  ${dataLabels}
  <c:axId val="${CAT_AX_ID}"/>
  <c:axId val="${VAL_AX_ID}"/>
</c:lineChart>
${buildCatAxisXml(CAT_AX_ID, VAL_AX_ID, opts?.xAxisLabel)}
${buildValAxisXml(VAL_AX_ID, CAT_AX_ID, { label: opts?.yAxisLabel, min: opts?.yAxisMin, max: opts?.yAxisMax, gridLines: opts?.gridLines })}`;

  const legend = opts?.showLegend !== false
    ? buildLegendXml(opts?.legendPosition)
    : '';

  return wrapChartXml(plotArea, legend, opts?.title);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/charts/lineChartBuilder.ts tests/renderer/chartDrawer.test.ts
git commit -m "feat: add line chart builder"
```

---

### Task 9: Pie + donut chart builder

**Files:**
- Create: `src/renderer/charts/pieChartBuilder.ts`
- Test: `tests/renderer/chartDrawer.test.ts` (add tests)

- [ ] **Step 1: Write failing tests**

Add to `tests/renderer/chartDrawer.test.ts`:

```typescript
import { buildPieChartXml } from '../../src/renderer/charts/pieChartBuilder.js';

describe('pieChartBuilder', () => {
  const pieChart: Extract<Element, { type: 'chart' }> = {
    type: 'chart',
    chartType: 'pie',
    data: {
      labels: ['Desktop', 'Mobile', 'Tablet'],
      series: [{ name: 'Traffic', values: [55, 35, 10] }],
    },
  };

  it('generates valid pie chart XML', () => {
    const xml = buildPieChartXml(pieChart, []);
    expect(xml).toContain('<c:pieChart>');
    expect(xml).toContain('<c:varyColors val="1"/>');
    expect(xml).toContain('Traffic');
    expect(xml).toContain('<c:v>55</c:v>');
    // No axes for pie charts
    expect(xml).not.toContain('<c:catAx>');
    expect(xml).not.toContain('<c:valAx>');
  });

  it('generates donut chart with hole size', () => {
    const donut = { ...pieChart, chartType: 'donut' as const };
    const xml = buildPieChartXml(donut, []);
    expect(xml).toContain('<c:doughnutChart>');
    expect(xml).toContain('<c:holeSize val="50"/>');
  });

  it('shows percentages in data labels for pie', () => {
    const withLabels = { ...pieChart, options: { showDataLabels: true } };
    const xml = buildPieChartXml(withLabels, []);
    expect(xml).toContain('<c:showPercent val="1"/>');
  });

  it('applies custom colors to data points', () => {
    const withColors = { ...pieChart, options: { colors: ['FF0000', '00FF00', '0000FF'] } };
    const xml = buildPieChartXml(withColors, []);
    expect(xml).toContain('<a:srgbClr val="FF0000"/>');
    expect(xml).toContain('<a:srgbClr val="00FF00"/>');
    expect(xml).toContain('<a:srgbClr val="0000FF"/>');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement pieChartBuilder**

Create `src/renderer/charts/pieChartBuilder.ts`:

```typescript
import type { Element } from '../../schema/presentation.js';
import { buildCategoryXml, buildValueXml, buildLegendXml, wrapChartXml, escapeXml } from './chartXmlHelpers.js';

type ChartElement = Extract<Element, { type: 'chart' }>;

/**
 * Builds data point color overrides for pie/donut slices.
 */
function buildDataPointColors(colors: string[]): string {
  return colors.map((color, i) =>
    `<c:dPt><c:idx val="${i}"/><c:spPr><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></c:spPr></c:dPt>`
  ).join('');
}

/**
 * Builds a pie or donut chart XML document.
 * Pie and donut only support a single series.
 */
export function buildPieChartXml(chart: ChartElement, accentColors: string[]): string {
  const opts = chart.options;
  const series = chart.data.series[0];
  if (!series) return wrapChartXml('');

  const isDonut = chart.chartType === 'donut';
  const tag = isDonut ? 'doughnutChart' : 'pieChart';

  const colors = opts?.colors ?? accentColors;
  const colorOverrides = colors.length > 0
    ? buildDataPointColors(colors.slice(0, chart.data.labels.length))
    : '';

  const dataLabelsXml = (opts?.showDataLabels ?? false)
    ? `<c:dLbls>
  <c:showLegendKey val="0"/>
  <c:showVal val="0"/>
  <c:showCatName val="1"/>
  <c:showSerName val="0"/>
  <c:showPercent val="1"/>
</c:dLbls>`
    : '';

  const seriesXml = `<c:ser>
  <c:idx val="0"/>
  <c:order val="0"/>
  <c:tx><c:strRef><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(series.name)}</c:v></c:pt></c:strCache></c:strRef></c:tx>
  ${colorOverrides}
  ${buildCategoryXml(chart.data.labels)}
  ${buildValueXml(series.values, opts?.valueFormat, opts?.currencySymbol)}
</c:ser>`;

  const holeSize = isDonut ? '<c:holeSize val="50"/>' : '';

  const plotArea = `<c:${tag}>
  <c:varyColors val="1"/>
  ${seriesXml}
  ${dataLabelsXml}
  ${holeSize}
</c:${tag}>`;

  const legend = opts?.showLegend !== false
    ? buildLegendXml(opts?.legendPosition)
    : '';

  return wrapChartXml(plotArea, legend, opts?.title);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/charts/pieChartBuilder.ts tests/renderer/chartDrawer.test.ts
git commit -m "feat: add pie and donut chart builder"
```

---

## Chunk 3: Renderer Integration

### Task 10: Chart drawer orchestrator

**Files:**
- Create: `src/renderer/chartDrawer.ts`
- Test: `tests/renderer/chartDrawer.test.ts` (add tests)

- [ ] **Step 1: Write failing tests**

Add to `tests/renderer/chartDrawer.test.ts`:

```typescript
import { buildChart, type ChartRequest, type BuildChartResult } from '../../src/renderer/chartDrawer.js';

describe('chartDrawer', () => {
  it('dispatches bar chart and returns BuildChartResult', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart',
      chartType: 'bar',
      data: { labels: ['A', 'B'], series: [{ name: 'S', values: [1, 2] }] },
    };

    const result = buildChart(chart, 100, ['1E3A5F', '2C7DA0']);
    expect(result.anchorShape).toContain('<p:graphicFrame>');
    expect(result.anchorShape).toContain('__CHART_RELID__');
    expect(result.nextId).toBe(101);
    expect(result.chartRequest.chartXml).toContain('<c:barChart>');
    expect(result.chartRequest.styleXml).toContain('cs:chartStyle');
    expect(result.chartRequest.colorsXml).toContain('cs:colorStyle');
  });

  it('dispatches pie chart', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart',
      chartType: 'pie',
      data: { labels: ['A', 'B'], series: [{ name: 'S', values: [60, 40] }] },
    };

    const result = buildChart(chart, 200, []);
    expect(result.chartRequest.chartXml).toContain('<c:pieChart>');
  });

  it('dispatches donut chart', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart',
      chartType: 'donut',
      data: { labels: ['A', 'B'], series: [{ name: 'S', values: [60, 40] }] },
    };

    const result = buildChart(chart, 200, []);
    expect(result.chartRequest.chartXml).toContain('<c:doughnutChart>');
  });

  it('dispatches line chart', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart',
      chartType: 'line',
      data: { labels: ['A', 'B'], series: [{ name: 'S', values: [1, 2] }] },
    };

    const result = buildChart(chart, 200, []);
    expect(result.chartRequest.chartXml).toContain('<c:lineChart>');
  });

  it('dispatches stackedBar chart', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart',
      chartType: 'stackedBar',
      data: { labels: ['A'], series: [{ name: 'S', values: [1] }] },
    };

    const result = buildChart(chart, 200, []);
    expect(result.chartRequest.chartXml).toContain('<c:grouping val="stacked"/>');
  });

  it('anchor shape has correct positioning', () => {
    const chart: Extract<Element, { type: 'chart' }> = {
      type: 'chart',
      chartType: 'bar',
      data: { labels: ['A'], series: [{ name: 'S', values: [1] }] },
    };

    const result = buildChart(chart, 100, []);
    // Check EMU values for x=0.8", y=1.6", cx=10.6", cy=4.8"
    expect(result.anchorShape).toContain(`x="${Math.round(0.8 * 914400)}"`);
    expect(result.anchorShape).toContain(`y="${Math.round(1.6 * 914400)}"`);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement chartDrawer**

Create `src/renderer/chartDrawer.ts`:

```typescript
import type { Element } from '../schema/presentation.js';
import { emu } from './xmlHelpers.js';
import { buildBarChartXml } from './charts/barChartBuilder.js';
import { buildLineChartXml } from './charts/lineChartBuilder.js';
import { buildPieChartXml } from './charts/pieChartBuilder.js';
import { buildChartStyleXml, buildChartColorsXml, buildChartRelsXml } from './charts/chartStyleBuilder.js';

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

/**
 * Builds a <p:graphicFrame> anchor shape for embedding a chart.
 * Uses __CHART_RELID__ as placeholder token, resolved by pptxRenderer.
 */
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
 * Builds a native OOXML chart from a ChartElement.
 * Returns the anchor shape XML, the next shape ID, and the chart file contents.
 */
export function buildChart(
  chart: ChartElement,
  startId: number,
  accentColors: string[],
): BuildChartResult {
  let chartXml: string;

  switch (chart.chartType) {
    case 'bar':
    case 'stackedBar':
      chartXml = buildBarChartXml(chart, accentColors);
      break;
    case 'line':
      chartXml = buildLineChartXml(chart, accentColors);
      break;
    case 'pie':
    case 'donut':
      chartXml = buildPieChartXml(chart, accentColors);
      break;
    default:
      chartXml = buildBarChartXml(chart, accentColors);
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/renderer/chartDrawer.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/chartDrawer.ts tests/renderer/chartDrawer.test.ts
git commit -m "feat: add chart drawer orchestrator with graphicFrame anchor"
```

---

### Task 11: Update xmlHelpers (xmlns:c)

**Files:**
- Modify: `src/renderer/xmlHelpers.ts:240-257`
- Test: `tests/renderer/xmlHelpers.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/renderer/xmlHelpers.test.ts`:

```typescript
it('wrapSlideXml includes xmlns:c namespace', () => {
  const xml = wrapSlideXml('<p:sp/>');
  expect(xml).toContain('xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer/xmlHelpers.test.ts`
Expected: FAIL

- [ ] **Step 3: Add xmlns:c to wrapSlideXml**

In `src/renderer/xmlHelpers.ts`, update `wrapSlideXml` (line 241-243):

```typescript
export function wrapSlideXml(shapes: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      ${shapes}
    </p:spTree>
  </p:cSld>
</p:sld>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/renderer/xmlHelpers.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/xmlHelpers.ts tests/renderer/xmlHelpers.test.ts
git commit -m "feat: add xmlns:c chart namespace to wrapSlideXml"
```

---

### Task 12: Update placeholderFiller (case 'chart' + chartRequests)

**Files:**
- Modify: `src/renderer/placeholderFiller.ts`
- No separate test — tested via integration in Task 13

- [ ] **Step 1: Add chartRequests to SlideShapeResult and initialize**

In `src/renderer/placeholderFiller.ts`:

1. Add import at the top:
```typescript
import { buildChart, type ChartRequest } from './chartDrawer.js';
```

2. Update `SlideShapeResult` interface:
```typescript
export interface SlideShapeResult {
  shapes: string;
  nextId: number;
  iconRequests: IconRequest[];
  chartRequests: ChartRequest[];
}
```

3. Initialize `chartRequests` at the top of `buildSlideShapes` (after line 109):
```typescript
const chartRequests: ChartRequest[] = [];
```

4. Update return statement (line 318):
```typescript
return { shapes, nextId: id, iconRequests, chartRequests };
```

- [ ] **Step 2: Add case 'chart' to the switch**

Add before the `default` case:

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

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/renderer/placeholderFiller.ts
git commit -m "feat: add chart case to placeholderFiller with chartRequests"
```

---

### Task 13: Update pptxRenderer (chart ZIP integration)

**Files:**
- Modify: `src/renderer/pptxRenderer.ts`
- Test: `tests/renderer/renderer.test.ts`

- [ ] **Step 1: Write failing integration test**

Add to `tests/renderer/renderer.test.ts`:

```typescript
describe('chart rendering', () => {
  it('produces chart files in the ZIP', async () => {
    const presentation: Presentation = {
      title: 'Chart Test',
      slides: [
        {
          layout: 'chart',
          _resolvedLayout: 'chart',
          elements: [
            { type: 'title', text: 'Revenue Chart' },
            {
              type: 'chart',
              chartType: 'bar',
              data: {
                labels: ['Q1', 'Q2', 'Q3'],
                series: [{ name: 'Revenue', values: [100, 200, 150] }],
              },
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);

    // Chart files exist
    expect(zip.file('ppt/charts/chart1.xml')).not.toBeNull();
    expect(zip.file('ppt/charts/style1.xml')).not.toBeNull();
    expect(zip.file('ppt/charts/colors1.xml')).not.toBeNull();
    expect(zip.file('ppt/charts/_rels/chart1.xml.rels')).not.toBeNull();

    // Chart XML is valid
    const chartXml = await zip.file('ppt/charts/chart1.xml')?.async('text');
    expect(chartXml).toContain('<c:barChart>');
    expect(chartXml).toContain('Revenue');

    // Slide contains graphicFrame
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('<p:graphicFrame>');
    expect(slideXml).toContain('Revenue Chart');
    // __CHART_RELID__ should be resolved
    expect(slideXml).not.toContain('__CHART_RELID__');
    expect(slideXml).toContain('rIdChart1');

    // Slide rels contain chart relationship
    const slideRels = await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('text');
    expect(slideRels).toContain('rIdChart1');
    expect(slideRels).toContain('relationships/chart');
    expect(slideRels).toContain('../charts/chart1.xml');

    // Content types contain chart overrides
    const contentTypes = await zip.file('[Content_Types].xml')?.async('text');
    expect(contentTypes).toContain('chart1.xml');
    expect(contentTypes).toContain('drawingml.chart+xml');
    expect(contentTypes).toContain('style1.xml');
    expect(contentTypes).toContain('colors1.xml');
  });

  it('numbers charts globally across slides', async () => {
    const presentation: Presentation = {
      title: 'Multi Chart',
      slides: [
        {
          layout: 'chart',
          _resolvedLayout: 'chart',
          elements: [
            { type: 'title', text: 'Chart 1' },
            {
              type: 'chart',
              chartType: 'bar',
              data: { labels: ['A'], series: [{ name: 'S', values: [1] }] },
            },
          ],
        },
        {
          layout: 'chart',
          _resolvedLayout: 'chart',
          elements: [
            { type: 'title', text: 'Chart 2' },
            {
              type: 'chart',
              chartType: 'pie',
              data: { labels: ['A', 'B'], series: [{ name: 'S', values: [60, 40] }] },
            },
          ],
        },
      ],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file('ppt/charts/chart1.xml')).not.toBeNull();
    expect(zip.file('ppt/charts/chart2.xml')).not.toBeNull();

    const chart1 = await zip.file('ppt/charts/chart1.xml')?.async('text');
    const chart2 = await zip.file('ppt/charts/chart2.xml')?.async('text');
    expect(chart1).toContain('<c:barChart>');
    expect(chart2).toContain('<c:pieChart>');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/renderer/renderer.test.ts`
Expected: FAIL (charts not written to ZIP)

- [ ] **Step 3: Update pptxRenderer to handle charts**

In `src/renderer/pptxRenderer.ts`:

1. Import `ChartRequest` and `buildChartRelsXml`:
```typescript
import type { ChartRequest } from './chartDrawer.js';
import { buildChartRelsXml } from './charts/chartStyleBuilder.js';
```

2. Add `let nextChartNum = 1;` alongside `nextImageNum` (line 61).

3. Extend `slideEntries` type to include `charts` array.

4. In the slide loop, after building shapes:
   - Destructure `chartRequests` from `buildSlideShapes`
   - For each `chartRequest`, assign `chartNum` and `chartRelId`
   - Replace `__CHART_RELID__` in the slide XML **before** pushing to `slideEntries`
   - Push to `slideCharts` array

5. After the slide loop, for each chart entry:
   - Write `ppt/charts/chart{N}.xml`, `style{N}.xml`, `colors{N}.xml`
   - Generate `ppt/charts/_rels/chart{N}.xml.rels` via `buildChartRelsXml(chartNum)`
   - Append chart relationship to slide rels
   - Append 3 content-type overrides

The implementation follows the exact same pattern as the existing image and notes handling. Key changes to `renderToBuffer`:

```typescript
// After line 61:
let nextChartNum = 1;

// Update slideEntries type to include:
charts: Array<{
  chartNum: number;
  relId: string;
  chartXml: string;
  styleXml: string;
  colorsXml: string;
}>;

// In the slide loop, after line 73:
const { shapes, nextId, iconRequests, chartRequests } = buildSlideShapes(slide, nextShapeId, templateInfo);

// After building allShapes and slideImages (after line 91), handle charts:
const slideCharts: typeof slideEntries[0]['charts'] = [];
for (const chartReq of chartRequests) {
  const chartNum = nextChartNum++;
  const chartRelId = `rIdChart${chartNum}`;
  // Resolve the __CHART_RELID__ placeholder in the slide shapes XML
  allShapes = allShapes.replace('__CHART_RELID__', chartRelId);
  slideCharts.push({
    chartNum,
    relId: chartRelId,
    chartXml: chartReq.chartXml,
    styleXml: chartReq.styleXml,
    colorsXml: chartReq.colorsXml,
  });
}

// IMPORTANT: wrapSlideXml must be called AFTER token replacement:
const slideXml = wrapSlideXml(allShapes);

// Push to slideEntries with the resolved slideXml:
slideEntries.push({
  slideNum: i + 1,
  slideXml,          // tokens already resolved
  layoutIndex,
  notes: slide.notes,
  images: slideImages,
  charts: slideCharts, // new
});

// After the slide loop, write chart files for each entry:
for (const chart of entry.charts) {
  zip.file(`ppt/charts/chart${chart.chartNum}.xml`, chart.chartXml);
  zip.file(`ppt/charts/style${chart.chartNum}.xml`, chart.styleXml);
  zip.file(`ppt/charts/colors${chart.chartNum}.xml`, chart.colorsXml);
  // Generate rels with correct chartNum (not hardcoded)
  zip.file(`ppt/charts/_rels/chart${chart.chartNum}.xml.rels`, buildChartRelsXml(chart.chartNum));
}

// Append chart rels to slide rels (same pattern as images):
if (entry.charts.length > 0) {
  const chartRelsPath = `ppt/slides/_rels/slide${entry.slideNum}.xml.rels`;
  const chartRelsEntry = zip.file(chartRelsPath);
  if (chartRelsEntry) {
    let currentRels = await chartRelsEntry.async('text');
    for (const chart of entry.charts) {
      currentRels = currentRels.replace(
        '</Relationships>',
        `  <Relationship Id="${chart.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chart.chartNum}.xml"/>\n</Relationships>`
      );
    }
    zip.file(chartRelsPath, currentRels);
  }
}

// Append content types:
for (const chart of entry.charts) {
  newContentTypes += `\n  <Override PartName="/ppt/charts/chart${chart.chartNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;
  newContentTypes += `\n  <Override PartName="/ppt/charts/style${chart.chartNum}.xml" ContentType="application/vnd.ms-office.chartstyle+xml"/>`;
  newContentTypes += `\n  <Override PartName="/ppt/charts/colors${chart.chartNum}.xml" ContentType="application/vnd.ms-office.chartcolorstyle+xml"/>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/renderer/renderer.test.ts`
Expected: all PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/pptxRenderer.ts tests/renderer/renderer.test.ts
git commit -m "feat: integrate chart files into PPTX ZIP output"
```

---

## Chunk 4: Parser Updates

### Task 14: Update promptParser

**Files:**
- Modify: `src/parser/promptParser.ts:48,65`
- Test: `tests/parser/promptParser.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/parser/promptParser.test.ts`:

```typescript
it('includes stackedBar in chart description when chart is supported', () => {
  const caps = { ...makeTier1Capabilities(['chart']), supported_layouts: ['title', 'section', 'bullets', 'generic', 'chart'] as any };
  const prompt = buildASTPrompt(caps, 'Test brief');
  expect(prompt).toContain('stackedBar');
  expect(prompt).toContain('valueFormat');
  expect(prompt).toContain('showDataLabels');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parser/promptParser.test.ts`
Expected: FAIL

- [ ] **Step 3: Update promptParser chart descriptions**

In `src/parser/promptParser.ts`, update line 48:

```typescript
layouts.includes('chart') ? '- "chart": Chart slide. Use chart element with chartType (bar/line/pie/donut/stackedBar) and data series. Options: valueFormat, showDataLabels, legendPosition, colors, gridLines, axis labels/limits.' : '',
```

Update line 65:

```typescript
layouts.includes('chart') ? '- { type: "chart", chartType: "bar"|"line"|"pie"|"donut"|"stackedBar", data: { labels: [...], series: [{ name, values }] }, options?: { valueFormat?, showDataLabels?, legendPosition?, colors?, ... } } — Chart' : '',
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/parser/promptParser.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/parser/promptParser.ts tests/parser/promptParser.test.ts
git commit -m "feat: update promptParser with stackedBar and chart options"
```

---

### Note: DataParser auto-detection (deferred)

The spec includes a "DataParser Auto-Detection" section for automatically detecting chart candidates from CSV/JSON data. This is deferred to a separate plan because it depends on the dataParser's existing heuristic system and LLM prompt integration, which are orthogonal to the chart rendering pipeline. The chart rendering implemented in this plan is fully functional without auto-detection — users and the LLM can specify chart elements directly in the AST.

---

### Task 15: Run full suite + final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: all PASS, 0 failures

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit any remaining changes**

If any files were missed:
```bash
git add -A
git commit -m "chore: final cleanup for native chart support"
```
