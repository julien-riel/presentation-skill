# Native Renderers, Tier 3 Layouts & Manifest Cache — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native KPI, Table, Quote renderers + Tier 3 layout support (roadmap, process, comparison) + manifest sidecar caching with mtime comparison.

**Architecture:** Each new layout gets a dedicated canvas drawer following the exact pattern of `timelineDrawer.ts` / `architectureDrawer.ts` — a pure function taking `(slide, startId, accentColors)` returning `{ shapes, nextId, iconRequests }`. Content validation adds limits for KPI (max 6 indicators) and Table (max 8 rows, 6 columns). Manifest caching adds a sidecar `.capabilities.json` file next to custom templates, regenerated only when the `.pptx` is newer.

**Tech Stack:** TypeScript strict, Zod, JSZip, OOXML primitives from `xmlHelpers.ts`, Vitest

---

## Chunk 1: KPI & Table Drawers

### Task 1: KPI Drawer

**Files:**
- Create: `pptx-generator/src/renderer/kpiDrawer.ts`
- Test: `pptx-generator/tests/renderer/kpiDrawer.test.ts`
- Modify: `pptx-generator/src/renderer/placeholderFiller.ts` (add case)

- [ ] **Step 1: Write the failing test for KPI rendering**

Create `pptx-generator/tests/renderer/kpiDrawer.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { Presentation } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
beforeAll(async () => {
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

describe('kpiDrawer', () => {
  it('renders KPI indicator cards with values and labels', async () => {
    const presentation: Presentation = {
      title: 'KPI Test',
      slides: [{
        layout: 'kpi',
        _resolvedLayout: 'kpi',
        elements: [
          { type: 'title', text: 'Key Metrics' },
          {
            type: 'kpi',
            indicators: [
              { label: 'Revenue', value: '$1.2M', unit: 'USD', trend: 'up' },
              { label: 'Users', value: '45K', trend: 'up' },
              { label: 'Churn', value: '2.3%', trend: 'down' },
            ],
          },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    // Title
    expect(slideXml).toContain('Key Metrics');
    // KPI values
    expect(slideXml).toContain('$1.2M');
    expect(slideXml).toContain('45K');
    expect(slideXml).toContain('2.3%');
    // KPI labels
    expect(slideXml).toContain('Revenue');
    expect(slideXml).toContain('Users');
    expect(slideXml).toContain('Churn');
    // Colored card shapes
    expect(slideXml).toContain('prstGeom prst="roundRect"');
  });

  it('emits trend icon requests for indicators with trend', async () => {
    const presentation: Presentation = {
      title: 'Trend Icons',
      slides: [{
        layout: 'kpi',
        _resolvedLayout: 'kpi',
        elements: [
          { type: 'title', text: 'Trends' },
          {
            type: 'kpi',
            indicators: [
              { label: 'Sales', value: '100', trend: 'up' },
              { label: 'Cost', value: '50', trend: 'down' },
            ],
          },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');

    // Trend icons should produce p:pic elements
    expect(slideXml).toContain('<p:pic>');
    const mediaFiles = Object.keys(zip.files).filter(n => n.startsWith('ppt/media/'));
    expect(mediaFiles.length).toBeGreaterThanOrEqual(2);
  });

  it('renders custom indicator icons when provided', async () => {
    const presentation: Presentation = {
      title: 'Custom Icons',
      slides: [{
        layout: 'kpi',
        _resolvedLayout: 'kpi',
        elements: [
          { type: 'title', text: 'With Icons' },
          {
            type: 'kpi',
            indicators: [
              { label: 'Speed', value: '99%', icon: 'zap' },
            ],
          },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('<p:pic>');
  });

  it('handles empty indicators gracefully', async () => {
    const presentation: Presentation = {
      title: 'Empty KPI',
      slides: [{
        layout: 'kpi',
        _resolvedLayout: 'kpi',
        elements: [
          { type: 'title', text: 'No Data' },
          { type: 'kpi', indicators: [] },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('No Data');
  });

  it('renders up to 6 indicators in two rows', async () => {
    const presentation: Presentation = {
      title: 'Six KPIs',
      slides: [{
        layout: 'kpi',
        _resolvedLayout: 'kpi',
        elements: [
          { type: 'title', text: 'All KPIs' },
          {
            type: 'kpi',
            indicators: Array.from({ length: 6 }, (_, i) => ({
              label: `Metric ${i + 1}`,
              value: `${(i + 1) * 10}`,
            })),
          },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('Metric 1');
    expect(slideXml).toContain('Metric 6');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pptx-generator && npx vitest run tests/renderer/kpiDrawer.test.ts`
Expected: FAIL — kpiDrawer module not found or KPI falls through to default case

- [ ] **Step 3: Implement the KPI drawer**

Create `pptx-generator/src/renderer/kpiDrawer.ts`:

```typescript
import type { Slide, Element } from '../schema/presentation.js';
import type { IconRequest } from './placeholderFiller.js';
import { emu, rectShape, textBoxShape, emuFromPx } from './xmlHelpers.js';

const TREND_ICONS: Record<string, string> = {
  up: 'trending-up',
  down: 'trending-down',
  stable: 'minus',
};

/**
 * Builds KPI card shapes for a slide.
 * Renders each indicator as a colored card with value, label, unit, and optional trend/icon.
 * Layout: up to 3 per row, max 2 rows (6 indicators).
 */
export function buildKpiShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): { shapes: string; nextId: number; iconRequests: IconRequest[] } {
  const kpiEl = slide.elements.find(
    (el): el is Extract<Element, { type: 'kpi' }> => el.type === 'kpi',
  );
  if (!kpiEl || kpiEl.indicators.length === 0) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  let id = startId;
  let shapes = '';
  const iconRequests: IconRequest[] = [];

  const indicators = kpiEl.indicators.slice(0, 6);
  const count = indicators.length;
  const cols = count <= 3 ? count : Math.ceil(count / 2);
  const rows = count <= 3 ? 1 : 2;

  // Canvas bounds
  const canvasLeft = emu(0.8);
  const canvasRight = emu(11.4);
  const canvasTop = emu(1.6);
  const canvasBottom = emu(6.5);
  const canvasW = canvasRight - canvasLeft;
  const canvasH = canvasBottom - canvasTop;
  const gap = emu(0.2);

  const cardW = Math.round((canvasW - (cols - 1) * gap) / cols);
  const cardH = Math.round((canvasH - (rows - 1) * gap) / rows);

  for (let i = 0; i < count; i++) {
    const indicator = indicators[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = canvasLeft + col * (cardW + gap);
    const y = canvasTop + row * (cardH + gap);
    const color = accentColors[i % accentColors.length] ?? '2D7DD2';

    // Card background
    shapes += rectShape(id++, {
      x, y, cx: cardW, cy: cardH,
      fill: color,
      rectRadius: 0.06,
    });

    // Value (large, white, centered)
    const valueH = emu(0.8);
    const valueY = y + Math.round(cardH * 0.15);
    shapes += textBoxShape(id++, x, valueY, cardW, valueH,
      indicator.value, { size: 36, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    // Unit (small, below value)
    if (indicator.unit) {
      const unitH = emu(0.35);
      const unitY = valueY + valueH - emu(0.1);
      shapes += textBoxShape(id++, x, unitY, cardW, unitH,
        indicator.unit, { size: 11, color: 'FFFFFFCC'.slice(0, 6), align: 'ctr', valign: 't' });
    }

    // Label (bottom of card)
    const labelH = emu(0.45);
    const labelY = y + cardH - labelH - emu(0.1);
    shapes += textBoxShape(id++, x, labelY, cardW, labelH,
      indicator.label, { size: 14, color: 'FFFFFF', align: 'ctr', valign: 'b' });

    // Trend icon (top-right corner)
    if (indicator.trend) {
      const trendIconName = TREND_ICONS[indicator.trend];
      if (trendIconName) {
        const iconSizePx = 20;
        const iconEmu = emuFromPx(iconSizePx);
        iconRequests.push({
          name: trendIconName,
          color: 'FFFFFF',
          sizePx: iconSizePx,
          x: x + cardW - iconEmu - emu(0.15),
          y: y + emu(0.15),
          cx: iconEmu,
          cy: iconEmu,
        });
      }
    }

    // Custom icon (top-left corner)
    if (indicator.icon) {
      const iconSizePx = 24;
      const iconEmu = emuFromPx(iconSizePx);
      iconRequests.push({
        name: indicator.icon,
        color: 'FFFFFF',
        sizePx: iconSizePx,
        x: x + emu(0.15),
        y: y + emu(0.15),
        cx: iconEmu,
        cy: iconEmu,
      });
    }
  }

  return { shapes, nextId: id, iconRequests };
}
```

- [ ] **Step 4: Wire KPI into placeholderFiller.ts**

In `pptx-generator/src/renderer/placeholderFiller.ts`:

Add import at top:
```typescript
import { buildKpiShapes } from './kpiDrawer.js';
```

Add case before `default:` (after the `timeline`/`architecture` case, line 214):
```typescript
case 'kpi': {
  const title = getTitleText(slide);
  shapes += placeholderShape(id++, 'title', 0, [title]);
  const accentColors = templateInfo.theme.accentColors.map(c => c.replace('#', ''));
  const result = buildKpiShapes(slide, id, accentColors);
  shapes += result.shapes;
  id = result.nextId;
  iconRequests.push(...result.iconRequests);
  break;
}
```

- [ ] **Step 5: Run KPI tests to verify they pass**

Run: `cd pptx-generator && npx vitest run tests/renderer/kpiDrawer.test.ts`
Expected: PASS — all 5 tests green

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `cd pptx-generator && npx vitest run`
Expected: All 199+ tests pass

- [ ] **Step 7: Commit**

```bash
git add pptx-generator/src/renderer/kpiDrawer.ts pptx-generator/tests/renderer/kpiDrawer.test.ts pptx-generator/src/renderer/placeholderFiller.ts
git commit -m "feat: add native KPI renderer with indicator cards, trend icons, and custom icons"
```

---

### Task 2: Table Drawer

**Files:**
- Create: `pptx-generator/src/renderer/tableDrawer.ts`
- Test: `pptx-generator/tests/renderer/tableDrawer.test.ts`
- Modify: `pptx-generator/src/renderer/placeholderFiller.ts` (add case)

- [ ] **Step 1: Write the failing test for table rendering**

Create `pptx-generator/tests/renderer/tableDrawer.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { Presentation } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
beforeAll(async () => {
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

describe('tableDrawer', () => {
  it('renders table headers and data rows', async () => {
    const presentation: Presentation = {
      title: 'Table Test',
      slides: [{
        layout: 'table',
        _resolvedLayout: 'table',
        elements: [
          { type: 'title', text: 'Sales Report' },
          {
            type: 'table',
            headers: ['Region', 'Q1', 'Q2', 'Q3'],
            rows: [
              ['North', '100', '120', '130'],
              ['South', '80', '90', '95'],
            ],
          },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    // Title
    expect(slideXml).toContain('Sales Report');
    // Headers
    expect(slideXml).toContain('Region');
    expect(slideXml).toContain('Q1');
    expect(slideXml).toContain('Q2');
    expect(slideXml).toContain('Q3');
    // Data cells
    expect(slideXml).toContain('North');
    expect(slideXml).toContain('South');
    expect(slideXml).toContain('120');
    // Should have rectangle shapes for cells
    expect(slideXml).toContain('prstGeom prst="rect"');
  });

  it('handles single-column table', async () => {
    const presentation: Presentation = {
      title: 'Single Col',
      slides: [{
        layout: 'table',
        _resolvedLayout: 'table',
        elements: [
          { type: 'title', text: 'List' },
          {
            type: 'table',
            headers: ['Name'],
            rows: [['Alice'], ['Bob'], ['Charlie']],
          },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('Alice');
    expect(slideXml).toContain('Bob');
    expect(slideXml).toContain('Charlie');
  });

  it('handles empty table gracefully', async () => {
    const presentation: Presentation = {
      title: 'Empty Table',
      slides: [{
        layout: 'table',
        _resolvedLayout: 'table',
        elements: [
          { type: 'title', text: 'No Data' },
          { type: 'table', headers: ['A', 'B'], rows: [] },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('No Data');
    // Headers should still render
    expect(slideXml).toContain('A');
    expect(slideXml).toContain('B');
  });

  it('renders many columns correctly', async () => {
    const presentation: Presentation = {
      title: 'Wide Table',
      slides: [{
        layout: 'table',
        _resolvedLayout: 'table',
        elements: [
          { type: 'title', text: 'Wide' },
          {
            type: 'table',
            headers: ['A', 'B', 'C', 'D', 'E', 'F'],
            rows: [['1', '2', '3', '4', '5', '6']],
          },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('A');
    expect(slideXml).toContain('F');
    expect(slideXml).toContain('1');
    expect(slideXml).toContain('6');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pptx-generator && npx vitest run tests/renderer/tableDrawer.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the table drawer**

Create `pptx-generator/src/renderer/tableDrawer.ts`:

```typescript
import type { Slide, Element } from '../schema/presentation.js';
import type { IconRequest } from './placeholderFiller.js';
import { emu, rectShape, textBoxShape } from './xmlHelpers.js';

/**
 * Builds table shapes using rect + textBox primitives.
 * Header row uses accent color background with white text.
 * Data rows alternate between light gray and white.
 */
export function buildTableShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): { shapes: string; nextId: number; iconRequests: IconRequest[] } {
  const tableEl = slide.elements.find(
    (el): el is Extract<Element, { type: 'table' }> => el.type === 'table',
  );
  if (!tableEl) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  let id = startId;
  let shapes = '';
  const headerColor = accentColors[0] ?? '2D7DD2';

  // Canvas bounds
  const left = emu(0.8);
  const right = emu(11.4);
  const top = emu(1.6);
  const canvasW = right - left;

  const cols = tableEl.headers.length;
  const totalRows = 1 + tableEl.rows.length; // header + data
  const rowH = emu(0.45);
  const colW = Math.round(canvasW / cols);

  // Header row
  for (let c = 0; c < cols; c++) {
    const x = left + c * colW;
    shapes += rectShape(id++, { x, y: top, cx: colW, cy: rowH, fill: headerColor });
    shapes += textBoxShape(id++, x, top, colW, rowH,
      tableEl.headers[c], { size: 11, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });
  }

  // Data rows
  for (let r = 0; r < tableEl.rows.length; r++) {
    const row = tableEl.rows[r];
    const y = top + (r + 1) * rowH;
    const rowFill = r % 2 === 0 ? 'F0F0F0' : 'FFFFFF';

    for (let c = 0; c < cols; c++) {
      const x = left + c * colW;
      const cellValue = row[c] ?? '';
      shapes += rectShape(id++, { x, y, cx: colW, cy: rowH, fill: rowFill, lineColor: 'E0E0E0', lineWidth: 0.5 });
      shapes += textBoxShape(id++, x, y, colW, rowH,
        cellValue, { size: 10, color: '333333', align: 'ctr', valign: 'ctr' });
    }
  }

  return { shapes, nextId: id, iconRequests: [] };
}
```

- [ ] **Step 4: Wire table into placeholderFiller.ts**

Add import at top of `placeholderFiller.ts`:
```typescript
import { buildTableShapes } from './tableDrawer.js';
```

Add case after the `kpi` case:
```typescript
case 'table': {
  const title = getTitleText(slide);
  shapes += placeholderShape(id++, 'title', 0, [title]);
  const accentColors = templateInfo.theme.accentColors.map(c => c.replace('#', ''));
  const result = buildTableShapes(slide, id, accentColors);
  shapes += result.shapes;
  id = result.nextId;
  break;
}
```

- [ ] **Step 5: Run table tests to verify they pass**

Run: `cd pptx-generator && npx vitest run tests/renderer/tableDrawer.test.ts`
Expected: PASS — all 4 tests green

- [ ] **Step 6: Run full test suite**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add pptx-generator/src/renderer/tableDrawer.ts pptx-generator/tests/renderer/tableDrawer.test.ts pptx-generator/src/renderer/placeholderFiller.ts
git commit -m "feat: add native table renderer with header styling and alternating row colors"
```

---

## Chunk 2: Quote Layout & Content Validation

### Task 3: Dedicated Quote Layout

**Files:**
- Modify: `pptx-generator/src/renderer/placeholderFiller.ts` (add `'quote'` case)
- Test: `pptx-generator/tests/renderer/quoteLayout.test.ts`

- [ ] **Step 1: Write the failing test for dedicated quote layout**

Create `pptx-generator/tests/renderer/quoteLayout.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { Presentation } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
beforeAll(async () => {
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

describe('quote layout', () => {
  it('renders quote text with decorative formatting', async () => {
    const presentation: Presentation = {
      title: 'Quote Test',
      slides: [{
        layout: 'quote',
        _resolvedLayout: 'quote',
        elements: [
          { type: 'title', text: 'Inspiration' },
          { type: 'quote', text: 'The best way to predict the future is to create it.', author: 'Peter Drucker' },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Inspiration');
    // Quote text with typographic quotes
    expect(slideXml).toContain('The best way to predict the future is to create it.');
    expect(slideXml).toContain('Peter Drucker');
  });

  it('renders quote without author', async () => {
    const presentation: Presentation = {
      title: 'No Author',
      slides: [{
        layout: 'quote',
        _resolvedLayout: 'quote',
        elements: [
          { type: 'title', text: 'Words' },
          { type: 'quote', text: 'Simple is better than complex.' },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('Simple is better than complex.');
  });

  it('emits icon request for quote with icon', async () => {
    const presentation: Presentation = {
      title: 'Icon Quote',
      slides: [{
        layout: 'quote',
        _resolvedLayout: 'quote',
        elements: [
          { type: 'title', text: 'Cited' },
          { type: 'quote', text: 'Stay hungry.', author: 'Steve Jobs', icon: 'quote' },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('<p:pic>');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pptx-generator && npx vitest run tests/renderer/quoteLayout.test.ts`
Expected: FAIL — quote falls through to default (renders as bullets, no textBoxShape)

- [ ] **Step 3: Add dedicated quote case in placeholderFiller.ts**

Add case after `table` and before `default:`:

```typescript
case 'quote': {
  const title = getTitleText(slide);
  shapes += placeholderShape(id++, 'title', 0, [title]);

  const quoteEl = findElement(slide.elements, 'quote');
  if (quoteEl) {
    quoteRendered = true;
    const accentColor = templateInfo.theme.accentColors[0]?.replace('#', '') ?? DEFAULT_ACCENT_COLOR;

    // Large centered quote text
    const quoteText = `\u201C${quoteEl.text}\u201D`;
    shapes += textBoxShape(id++, emu(1.5), emu(2.0), emu(9.2), emu(2.5),
      quoteText, { size: 24, color: '333333', align: 'ctr', valign: 'ctr' });

    // Author attribution
    if (quoteEl.author) {
      shapes += textBoxShape(id++, emu(1.5), emu(4.6), emu(9.2), emu(0.5),
        `\u2014 ${quoteEl.author}`, { size: 14, color: accentColor, align: 'ctr', valign: 't' });
    }
  }
  break;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pptx-generator && npx vitest run tests/renderer/quoteLayout.test.ts`
Expected: PASS — all 3 tests green

- [ ] **Step 5: Run full test suite**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add pptx-generator/src/renderer/placeholderFiller.ts pptx-generator/tests/renderer/quoteLayout.test.ts
git commit -m "feat: add dedicated quote layout with centered text and author attribution"
```

---

### Task 4: Content Validation for KPI and Table

**Files:**
- Modify: `pptx-generator/src/transform/contentValidator.ts`
- Modify: `pptx-generator/tests/transform/transform.test.ts`

- [ ] **Step 1: Write failing tests for KPI/table content limits**

Add to `pptx-generator/tests/transform/transform.test.ts`:

```typescript
// Add within the existing describe block for content validation:

it('truncates KPI indicators beyond 6', () => {
  const presentation: Presentation = {
    title: 'KPI Limit',
    slides: [{
      layout: 'kpi',
      elements: [
        { type: 'title', text: 'Too Many' },
        {
          type: 'kpi',
          indicators: Array.from({ length: 8 }, (_, i) => ({
            label: `M${i}`, value: `${i}`,
          })),
        },
      ],
    }],
  };

  const manifest = makeTier1Capabilities();
  const result = transformPresentation(presentation, manifest);
  const kpiEl = result.slides[0].elements.find(el => el.type === 'kpi');
  expect(kpiEl).toBeDefined();
  if (kpiEl?.type === 'kpi') {
    expect(kpiEl.indicators.length).toBeLessThanOrEqual(6);
  }
  expect(result.slides[0]._warnings?.some(w => w.includes('KPI'))).toBe(true);
});

it('truncates table rows beyond 8', () => {
  const presentation: Presentation = {
    title: 'Table Limit',
    slides: [{
      layout: 'table',
      elements: [
        { type: 'title', text: 'Big Table' },
        {
          type: 'table',
          headers: ['A', 'B'],
          rows: Array.from({ length: 12 }, (_, i) => [`r${i}`, `v${i}`]),
        },
      ],
    }],
  };

  const manifest = makeTier1Capabilities();
  const result = transformPresentation(presentation, manifest);
  const tableEl = result.slides[0].elements.find(el => el.type === 'table');
  expect(tableEl).toBeDefined();
  if (tableEl?.type === 'table') {
    expect(tableEl.rows.length).toBeLessThanOrEqual(8);
  }
  expect(result.slides[0]._warnings?.some(w => w.includes('Table'))).toBe(true);
});

it('truncates table columns beyond 6', () => {
  const presentation: Presentation = {
    title: 'Wide Table',
    slides: [{
      layout: 'table',
      elements: [
        { type: 'title', text: 'Too Wide' },
        {
          type: 'table',
          headers: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
          rows: [['1', '2', '3', '4', '5', '6', '7', '8']],
        },
      ],
    }],
  };

  const manifest = makeTier1Capabilities();
  const result = transformPresentation(presentation, manifest);
  const tableEl = result.slides[0].elements.find(el => el.type === 'table');
  expect(tableEl).toBeDefined();
  if (tableEl?.type === 'table') {
    expect(tableEl.headers.length).toBeLessThanOrEqual(6);
    expect(tableEl.rows[0].length).toBeLessThanOrEqual(6);
  }
  expect(result.slides[0]._warnings?.some(w => w.includes('Table'))).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pptx-generator && npx vitest run tests/transform/transform.test.ts`
Expected: FAIL — no content limits for KPI/table yet

- [ ] **Step 3: Add content limits in contentValidator.ts**

Add constants after existing ones (line 5):
```typescript
export const MAX_KPI_INDICATORS = 6;
export const MAX_TABLE_ROWS = 8;
export const MAX_TABLE_COLS = 6;
```

Add KPI/table validation in `validateSlideContent()` after the bullet word truncation block (after line 63), before the bullet count split block:

```typescript
  // --- KPI indicator limit ---
  elements = elements.map((el) => {
    if (el.type !== 'kpi') return el;
    if (el.indicators.length > MAX_KPI_INDICATORS) {
      warnings.push(`KPI indicators truncated from ${el.indicators.length} to ${MAX_KPI_INDICATORS}`);
      return { ...el, indicators: el.indicators.slice(0, MAX_KPI_INDICATORS) };
    }
    return el;
  });

  // --- Table row/column limit ---
  elements = elements.map((el) => {
    if (el.type !== 'table') return el;
    let headers = el.headers;
    let rows = el.rows;

    if (headers.length > MAX_TABLE_COLS) {
      warnings.push(`Table columns truncated from ${headers.length} to ${MAX_TABLE_COLS}`);
      headers = headers.slice(0, MAX_TABLE_COLS);
      rows = rows.map(row => row.slice(0, MAX_TABLE_COLS));
    }
    if (rows.length > MAX_TABLE_ROWS) {
      warnings.push(`Table rows truncated from ${rows.length} to ${MAX_TABLE_ROWS}`);
      rows = rows.slice(0, MAX_TABLE_ROWS);
    }

    if (headers !== el.headers || rows !== el.rows) {
      return { ...el, headers, rows };
    }
    return el;
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pptx-generator && npx vitest run tests/transform/transform.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add pptx-generator/src/transform/contentValidator.ts pptx-generator/tests/transform/transform.test.ts
git commit -m "feat: add content validation limits for KPI (max 6) and table (max 8 rows, 6 cols)"
```

---

## Chunk 3: Tier 3 Layouts (roadmap, process, comparison)

### Task 5: Roadmap, Process, and Comparison Renderers

These layouts reuse existing element types with different visual treatment:
- `roadmap`: renders `timeline` elements as a horizontal bar with phase blocks
- `process`: renders `timeline` elements as numbered step boxes connected by arrows
- `comparison`: renders two `bullets` groups as side-by-side comparison columns with labels

**Files:**
- Create: `pptx-generator/src/renderer/roadmapDrawer.ts`
- Create: `pptx-generator/src/renderer/processDrawer.ts`
- Create: `pptx-generator/src/renderer/comparisonDrawer.ts`
- Create: `pptx-generator/tests/renderer/roadmapDrawer.test.ts`
- Create: `pptx-generator/tests/renderer/processDrawer.test.ts`
- Create: `pptx-generator/tests/renderer/comparisonDrawer.test.ts`
- Modify: `pptx-generator/src/renderer/placeholderFiller.ts` (add 3 cases)

- [ ] **Step 1: Write failing tests for roadmap drawer**

Create `pptx-generator/tests/renderer/roadmapDrawer.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { Presentation } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
beforeAll(async () => {
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

describe('roadmapDrawer', () => {
  it('renders roadmap phases as horizontal bar segments', async () => {
    const presentation: Presentation = {
      title: 'Roadmap Test',
      slides: [{
        layout: 'roadmap',
        _resolvedLayout: 'roadmap',
        elements: [
          { type: 'title', text: 'Product Roadmap' },
          {
            type: 'timeline',
            events: [
              { date: 'Q1', label: 'Research', status: 'done' },
              { date: 'Q2', label: 'Build', status: 'in-progress' },
              { date: 'Q3', label: 'Launch', status: 'planned' },
            ],
          },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Product Roadmap');
    expect(slideXml).toContain('Research');
    expect(slideXml).toContain('Build');
    expect(slideXml).toContain('Launch');
    expect(slideXml).toContain('Q1');
    // Rounded rectangles for phase blocks
    expect(slideXml).toContain('prstGeom prst="roundRect"');
  });

  it('handles empty events gracefully', async () => {
    const presentation: Presentation = {
      title: 'Empty',
      slides: [{
        layout: 'roadmap',
        _resolvedLayout: 'roadmap',
        elements: [
          { type: 'title', text: 'Empty Roadmap' },
          { type: 'timeline', events: [] },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('Empty Roadmap');
  });
});
```

- [ ] **Step 2: Implement roadmapDrawer.ts**

Create `pptx-generator/src/renderer/roadmapDrawer.ts`:

```typescript
import type { Slide, Element } from '../schema/presentation.js';
import type { IconRequest } from './placeholderFiller.js';
import { emu, rectShape, textBoxShape, emuFromPx } from './xmlHelpers.js';

function statusColor(status: string, accents: string[]): string {
  switch (status) {
    case 'done': return accents[3] ?? '27AE60';
    case 'in-progress': return accents[4] ?? 'F39C12';
    default: return accents.length > 2 ? accents[2] : '999999';
  }
}

/**
 * Builds roadmap shapes: horizontal phase blocks with labels and dates.
 * Each phase is a colored rounded rectangle proportionally spaced.
 */
export function buildRoadmapShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): { shapes: string; nextId: number; iconRequests: IconRequest[] } {
  const timelineEl = slide.elements.find(
    (el): el is Extract<Element, { type: 'timeline' }> => el.type === 'timeline',
  );
  if (!timelineEl || timelineEl.events.length === 0) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  const events = timelineEl.events;
  const count = events.length;
  let id = startId;
  let shapes = '';
  const iconRequests: IconRequest[] = [];

  const left = emu(0.8);
  const right = emu(11.4);
  const canvasW = right - left;
  const barY = emu(2.8);
  const barH = emu(1.4);
  const gap = emu(0.15);

  const blockW = Math.round((canvasW - (count - 1) * gap) / count);

  for (let i = 0; i < count; i++) {
    const event = events[i];
    const x = left + i * (blockW + gap);
    const color = statusColor(event.status ?? 'planned', accentColors);

    // Phase block
    shapes += rectShape(id++, {
      x, y: barY, cx: blockW, cy: barH,
      fill: color, rectRadius: 0.06,
    });

    // Phase label (centered in block)
    shapes += textBoxShape(id++, x, barY, blockW, barH,
      event.label, { size: 13, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    // Date below block
    shapes += textBoxShape(id++, x, barY + barH + emu(0.1), blockW, emu(0.35),
      event.date, { size: 9, color: '888888', align: 'ctr', valign: 't' });

    // Icon top-right of block
    if (event.icon) {
      const iconSizePx = 20;
      const iconEmu = emuFromPx(iconSizePx);
      iconRequests.push({
        name: event.icon,
        color: 'FFFFFF',
        sizePx: iconSizePx,
        x: x + blockW - iconEmu - emu(0.1),
        y: barY + emu(0.1),
        cx: iconEmu,
        cy: iconEmu,
      });
    }
  }

  return { shapes, nextId: id, iconRequests };
}
```

- [ ] **Step 3: Write failing tests for process drawer**

Create `pptx-generator/tests/renderer/processDrawer.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { Presentation } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
beforeAll(async () => {
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

describe('processDrawer', () => {
  it('renders process steps as numbered boxes with arrows', async () => {
    const presentation: Presentation = {
      title: 'Process Test',
      slides: [{
        layout: 'process',
        _resolvedLayout: 'process',
        elements: [
          { type: 'title', text: 'Workflow' },
          {
            type: 'timeline',
            events: [
              { date: '1', label: 'Input' },
              { date: '2', label: 'Process' },
              { date: '3', label: 'Output' },
            ],
          },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Workflow');
    expect(slideXml).toContain('Input');
    expect(slideXml).toContain('Process');
    expect(slideXml).toContain('Output');
    // Step boxes
    expect(slideXml).toContain('prstGeom prst="roundRect"');
    // Arrow connectors between steps
    expect(slideXml).toContain('prstGeom prst="line"');
  });

  it('handles single step gracefully (no arrows)', async () => {
    const presentation: Presentation = {
      title: 'Single Step',
      slides: [{
        layout: 'process',
        _resolvedLayout: 'process',
        elements: [
          { type: 'title', text: 'One Step' },
          { type: 'timeline', events: [{ date: '1', label: 'Only' }] },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('Only');
    // No arrows for single step
    expect(slideXml).not.toContain('tailEnd type="triangle"');
  });
});
```

- [ ] **Step 4: Implement processDrawer.ts**

Create `pptx-generator/src/renderer/processDrawer.ts`:

```typescript
import type { Slide, Element } from '../schema/presentation.js';
import type { IconRequest } from './placeholderFiller.js';
import { emu, rectShape, textBoxShape, lineShape, emuFromPx } from './xmlHelpers.js';

/**
 * Builds process step shapes: numbered boxes connected by arrows.
 * Steps are horizontal boxes with step number above and label inside.
 */
export function buildProcessShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): { shapes: string; nextId: number; iconRequests: IconRequest[] } {
  const timelineEl = slide.elements.find(
    (el): el is Extract<Element, { type: 'timeline' }> => el.type === 'timeline',
  );
  if (!timelineEl || timelineEl.events.length === 0) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  const events = timelineEl.events;
  const count = events.length;
  let id = startId;
  let shapes = '';
  const iconRequests: IconRequest[] = [];

  const left = emu(0.8);
  const right = emu(11.4);
  const canvasW = right - left;
  const boxY = emu(2.6);
  const boxH = emu(1.6);
  const arrowGap = emu(0.4);

  const totalArrowW = (count - 1) * arrowGap;
  const boxW = Math.round((canvasW - totalArrowW) / count);
  const primaryColor = accentColors[0] ?? '2D7DD2';

  for (let i = 0; i < count; i++) {
    const event = events[i];
    const x = left + i * (boxW + arrowGap);

    // Step box
    shapes += rectShape(id++, {
      x, y: boxY, cx: boxW, cy: boxH,
      fill: primaryColor, rectRadius: 0.06,
    });

    // Step number
    shapes += textBoxShape(id++, x, boxY + emu(0.15), boxW, emu(0.45),
      `${i + 1}`, { size: 22, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    // Step label
    shapes += textBoxShape(id++, x, boxY + emu(0.6), boxW, emu(0.7),
      event.label, { size: 12, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    // Date/subtitle below box
    shapes += textBoxShape(id++, x, boxY + boxH + emu(0.1), boxW, emu(0.3),
      event.date, { size: 9, color: '888888', align: 'ctr', valign: 't' });

    // Arrow to next step
    if (i < count - 1) {
      const arrowX = x + boxW;
      const arrowY = boxY + Math.round(boxH / 2);
      shapes += lineShape(id++, {
        x: arrowX, y: arrowY, cx: arrowGap, cy: 0,
        lineColor: primaryColor, lineWidth: 2, endArrow: true,
      });
    }

    // Icon
    if (event.icon) {
      const iconSizePx = 20;
      const iconEmu = emuFromPx(iconSizePx);
      iconRequests.push({
        name: event.icon,
        color: 'FFFFFF',
        sizePx: iconSizePx,
        x: x + boxW - iconEmu - emu(0.1),
        y: boxY + emu(0.1),
        cx: iconEmu,
        cy: iconEmu,
      });
    }
  }

  return { shapes, nextId: id, iconRequests };
}
```

- [ ] **Step 5: Write failing tests for comparison drawer**

Create `pptx-generator/tests/renderer/comparisonDrawer.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import JSZip from 'jszip';
import * as path from 'path';
import type { Presentation } from '../../src/schema/presentation.js';
import type { TemplateInfo } from '../../src/validator/types.js';
import { renderToBuffer } from '../../src/renderer/pptxRenderer.js';
import { readTemplate } from '../../src/validator/templateReader.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

let templateInfo: TemplateInfo;
beforeAll(async () => {
  templateInfo = await readTemplate(TEMPLATE_PATH);
});

describe('comparisonDrawer', () => {
  it('renders two columns with headers and bullet items', async () => {
    const presentation: Presentation = {
      title: 'Comparison Test',
      slides: [{
        layout: 'comparison',
        _resolvedLayout: 'comparison',
        elements: [
          { type: 'title', text: 'Option A vs B' },
          { type: 'bullets', items: ['Fast', 'Cheap'], column: 'left' },
          { type: 'bullets', items: ['Reliable', 'Scalable'], column: 'right' },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toBeDefined();

    expect(slideXml).toContain('Option A vs B');
    expect(slideXml).toContain('Fast');
    expect(slideXml).toContain('Cheap');
    expect(slideXml).toContain('Reliable');
    expect(slideXml).toContain('Scalable');
    // Column header backgrounds
    expect(slideXml).toContain('prstGeom prst="roundRect"');
  });

  it('handles single column comparison', async () => {
    const presentation: Presentation = {
      title: 'One Side',
      slides: [{
        layout: 'comparison',
        _resolvedLayout: 'comparison',
        elements: [
          { type: 'title', text: 'Just Left' },
          { type: 'bullets', items: ['Only option'], column: 'left' },
        ],
      }],
    };

    const buffer = await renderToBuffer(presentation, TEMPLATE_PATH, templateInfo);
    const zip = await JSZip.loadAsync(buffer);
    const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
    expect(slideXml).toContain('Only option');
  });
});
```

- [ ] **Step 6: Implement comparisonDrawer.ts**

Create `pptx-generator/src/renderer/comparisonDrawer.ts`:

```typescript
import type { Slide, Element } from '../schema/presentation.js';
import type { IconRequest } from './placeholderFiller.js';
import { emu, rectShape, textBoxShape } from './xmlHelpers.js';

/**
 * Builds comparison layout: two columns with colored headers and bullet lists.
 * Columns are labeled by extracting text elements or using "Option A" / "Option B" defaults.
 */
export function buildComparisonShapes(
  slide: Slide,
  startId: number,
  accentColors: string[],
): { shapes: string; nextId: number; iconRequests: IconRequest[] } {
  const bulletElements = slide.elements.filter(
    (el): el is Extract<Element, { type: 'bullets' }> => el.type === 'bullets',
  );

  if (bulletElements.length === 0) {
    return { shapes: '', nextId: startId, iconRequests: [] };
  }

  const leftBullets = bulletElements.find(el => el.column === 'left') ?? bulletElements[0];
  const rightBullets = bulletElements.find(el => el.column === 'right') ?? bulletElements[1];

  let id = startId;
  let shapes = '';

  const colLeft = emu(0.8);
  const colRight = emu(6.3);
  const colW = emu(5.0);
  const headerY = emu(1.6);
  const headerH = emu(0.55);
  const bodyY = headerY + headerH + emu(0.1);
  const lineH = emu(0.5);
  const leftColor = accentColors[0] ?? '2D7DD2';
  const rightColor = accentColors[1] ?? '27AE60';

  // Left column
  if (leftBullets) {
    // Header bar
    shapes += rectShape(id++, {
      x: colLeft, y: headerY, cx: colW, cy: headerH,
      fill: leftColor, rectRadius: 0.04,
    });
    shapes += textBoxShape(id++, colLeft, headerY, colW, headerH,
      'Option A', { size: 13, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    // Bullet items
    for (let i = 0; i < leftBullets.items.length; i++) {
      const y = bodyY + i * lineH;
      shapes += textBoxShape(id++, colLeft + emu(0.2), y, colW - emu(0.4), lineH,
        `\u2022 ${leftBullets.items[i]}`, { size: 12, color: '333333', align: 'l', valign: 'ctr' });
    }
  }

  // Right column
  if (rightBullets) {
    shapes += rectShape(id++, {
      x: colRight, y: headerY, cx: colW, cy: headerH,
      fill: rightColor, rectRadius: 0.04,
    });
    shapes += textBoxShape(id++, colRight, headerY, colW, headerH,
      'Option B', { size: 13, bold: true, color: 'FFFFFF', align: 'ctr', valign: 'ctr' });

    for (let i = 0; i < rightBullets.items.length; i++) {
      const y = bodyY + i * lineH;
      shapes += textBoxShape(id++, colRight + emu(0.2), y, colW - emu(0.4), lineH,
        `\u2022 ${rightBullets.items[i]}`, { size: 12, color: '333333', align: 'l', valign: 'ctr' });
    }
  }

  return { shapes, nextId: id, iconRequests: [] };
}
```

- [ ] **Step 7: Wire all 3 Tier 3 drawers into placeholderFiller.ts**

Add imports at top of `placeholderFiller.ts`:
```typescript
import { buildRoadmapShapes } from './roadmapDrawer.js';
import { buildProcessShapes } from './processDrawer.js';
import { buildComparisonShapes } from './comparisonDrawer.js';
```

Add cases before `default:`:
```typescript
case 'roadmap':
case 'process': {
  const title = getTitleText(slide);
  shapes += placeholderShape(id++, 'title', 0, [title]);
  const accentColors = templateInfo.theme.accentColors.map(c => c.replace('#', ''));
  const result = layout === 'roadmap'
    ? buildRoadmapShapes(slide, id, accentColors)
    : buildProcessShapes(slide, id, accentColors);
  shapes += result.shapes;
  id = result.nextId;
  iconRequests.push(...result.iconRequests);
  break;
}

case 'comparison': {
  const title = getTitleText(slide);
  shapes += placeholderShape(id++, 'title', 0, [title]);
  const accentColors = templateInfo.theme.accentColors.map(c => c.replace('#', ''));
  const result = buildComparisonShapes(slide, id, accentColors);
  shapes += result.shapes;
  id = result.nextId;
  break;
}
```

- [ ] **Step 8: Run all new drawer tests**

Run: `cd pptx-generator && npx vitest run tests/renderer/roadmapDrawer.test.ts tests/renderer/processDrawer.test.ts tests/renderer/comparisonDrawer.test.ts`
Expected: PASS — all tests green

- [ ] **Step 9: Run full test suite**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass

- [ ] **Step 10: Commit**

```bash
git add pptx-generator/src/renderer/roadmapDrawer.ts pptx-generator/src/renderer/processDrawer.ts pptx-generator/src/renderer/comparisonDrawer.ts pptx-generator/tests/renderer/roadmapDrawer.test.ts pptx-generator/tests/renderer/processDrawer.test.ts pptx-generator/tests/renderer/comparisonDrawer.test.ts pptx-generator/src/renderer/placeholderFiller.ts
git commit -m "feat: add Tier 3 layout renderers — roadmap, process, comparison"
```

---

## Chunk 4: Manifest Caching & Finalization

### Task 6: Manifest Sidecar Caching

**Files:**
- Modify: `pptx-generator/src/index.ts` (add `getOrGenerateManifest`)
- Create: `pptx-generator/tests/manifestCache.test.ts`

- [ ] **Step 1: Write failing tests for manifest caching**

Create `pptx-generator/tests/manifestCache.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validateTemplate } from '../src/index.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../assets/default-template.pptx');
const SIDECAR_PATH = TEMPLATE_PATH.replace(/\.pptx$/i, '.capabilities.json');

afterEach(() => {
  // Clean up sidecar if created
  try { fs.unlinkSync(SIDECAR_PATH); } catch { /* ignore */ }
});

describe('manifest sidecar caching', () => {
  it('generates sidecar file on first validateTemplate call', async () => {
    expect(fs.existsSync(SIDECAR_PATH)).toBe(false);

    await validateTemplate(TEMPLATE_PATH);

    expect(fs.existsSync(SIDECAR_PATH)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(SIDECAR_PATH, 'utf-8'));
    expect(manifest.template).toBeDefined();
    expect(manifest.tier).toBeGreaterThanOrEqual(0);
  });

  it('reuses sidecar when pptx is not newer', async () => {
    // First call generates sidecar
    await validateTemplate(TEMPLATE_PATH);
    const firstContent = fs.readFileSync(SIDECAR_PATH, 'utf-8');
    const firstManifest = JSON.parse(firstContent);

    // Second call should reuse (generated_at unchanged)
    const result = await validateTemplate(TEMPLATE_PATH);
    expect(result.manifest.generated_at).toBe(firstManifest.generated_at);
  });

  it('regenerates sidecar when pptx is newer', async () => {
    // Generate sidecar
    await validateTemplate(TEMPLATE_PATH);
    const firstContent = fs.readFileSync(SIDECAR_PATH, 'utf-8');

    // Backdate sidecar mtime to force regeneration
    const pastTime = new Date(Date.now() - 60_000);
    fs.utimesSync(SIDECAR_PATH, pastTime, pastTime);

    // Touch the pptx to make it newer
    const now = new Date();
    fs.utimesSync(TEMPLATE_PATH, now, now);

    const result = await validateTemplate(TEMPLATE_PATH);
    const newContent = fs.readFileSync(SIDECAR_PATH, 'utf-8');
    // Sidecar should have been regenerated with a new generated_at
    expect(newContent).not.toBe(firstContent);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pptx-generator && npx vitest run tests/manifestCache.test.ts`
Expected: FAIL — no sidecar is generated

- [ ] **Step 3: Implement sidecar caching in index.ts**

Add this helper function in `src/index.ts` (after the `getDefaultManifest` function, before `validateTemplate`):

```typescript
import { writeFileSync, statSync, readFileSync as readFileUtf8, existsSync } from 'fs';
```

Update the existing `readFileSync` import to be renamed to avoid conflict, or combine. The simplest approach:

Replace line 2:
```typescript
import { readFileSync, writeFileSync, statSync, existsSync, utimesSync } from 'fs';
```

Add the helper function:
```typescript
/**
 * Returns the sidecar manifest path for a template.
 * e.g. /path/to/template.pptx → /path/to/template.capabilities.json
 */
function sidecarPath(templatePath: string): string {
  return templatePath.replace(/\.pptx$/i, '.capabilities.json');
}

/**
 * Returns a cached manifest if the sidecar is newer than the template,
 * otherwise generates a fresh manifest and writes the sidecar.
 */
function getOrGenerateManifest(
  templateInfo: TemplateInfo,
  templatePath: string,
): TemplateCapabilities {
  const sidecar = sidecarPath(templatePath);

  try {
    if (existsSync(sidecar)) {
      const pptxMtime = statSync(templatePath).mtimeMs;
      const sidecarMtime = statSync(sidecar).mtimeMs;

      if (sidecarMtime >= pptxMtime) {
        const raw = readFileSync(sidecar, 'utf-8');
        return TemplateCapabilitiesSchema.parse(JSON.parse(raw));
      }
    }
  } catch {
    // On any cache read error, fall through to regeneration
  }

  const manifest = generateManifest(templateInfo, path.basename(templatePath));

  try {
    writeFileSync(sidecar, JSON.stringify(manifest, null, 2));
  } catch {
    // Non-fatal: sidecar write failure doesn't block generation
  }

  return manifest;
}
```

Also need to import `TemplateInfo`:
```typescript
import type { TemplateInfo } from './validator/types.js';
```

Update `generateFromAST` (lines 89-91) to use cache for custom templates:
```typescript
  const manifest = templatePath
    ? getOrGenerateManifest(templateInfo, tplPath)
    : getDefaultManifest();
```

Update `generateFromData` (lines 120-122) similarly:
```typescript
  const manifest = templatePath
    ? getOrGenerateManifest(templateInfo, tplPath)
    : getDefaultManifest();
```

Update `validateTemplate` (line 58) to write sidecar:
```typescript
  const manifest = generateManifest(template, path.basename(templatePath));

  // Write sidecar cache
  try {
    writeFileSync(sidecarPath(templatePath), JSON.stringify(manifest, null, 2));
  } catch {
    // Non-fatal
  }
```

- [ ] **Step 4: Run cache tests to verify they pass**

Run: `cd pptx-generator && npx vitest run tests/manifestCache.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Add sidecar to .gitignore**

Add `*.capabilities.json` to the project's `.gitignore` (but NOT the default one in assets/):

In the root `.gitignore`, add:
```
*.capabilities.json
!pptx-generator/assets/default-capabilities.json
```

- [ ] **Step 7: Commit**

```bash
git add pptx-generator/src/index.ts pptx-generator/tests/manifestCache.test.ts .gitignore
git commit -m "feat: add manifest sidecar caching with mtime-based invalidation"
```

---

### Task 7: Update TODO.md

**Files:**
- Modify: `TODO.md`

- [ ] **Step 1: Mark completed items in TODO.md**

Update the table in section 9 to mark KPI/Table renderers, Tier 3 layouts, and cache as done. Update priority order to remove completed items. Add a note about chart degradation being intentional.

- [ ] **Step 2: Commit**

```bash
git add TODO.md
git commit -m "docs: update TODO — mark native renderers, Tier 3 layouts, and manifest cache as done"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run full test suite one final time**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass (199 original + ~25 new = ~224 total)

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd pptx-generator && npx tsc --noEmit`
Expected: No errors
