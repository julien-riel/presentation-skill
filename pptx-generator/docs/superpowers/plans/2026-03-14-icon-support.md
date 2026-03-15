# Icon Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Lucide SVG icon support across all presentation element types, embedded as PNG images in the PPTX output.

**Architecture:** Icons are resolved lazily — drawer functions collect `IconRequest[]` synchronously, then `renderToBuffer()` batch-resolves them via `iconResolver.ts` (SVG→PNG via `@resvg/resvg-js`). PNGs are written to `ppt/media/` with OOXML relationships using `rIdImg{N}` IDs to avoid collisions.

**Tech Stack:** `lucide-static` (SVG icons), `@resvg/resvg-js` (SVG→PNG), JSZip + raw OOXML (existing).

**Spec:** `docs/superpowers/specs/2026-03-14-icon-support-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/schema/presentation.ts` | Modify | Add optional `icon`/`icons` fields to element schemas |
| `src/renderer/iconResolver.ts` | Create | Resolve Lucide icon name → colorized PNG buffer |
| `src/renderer/xmlHelpers.ts` | Modify | Add `pictureShape()`, `emuFromPx()` |
| `src/renderer/placeholderFiller.ts` | Modify | Add `IconRequest` type, return `iconRequests` from `buildSlideShapes`, icon bullet layout |
| `src/renderer/architectureDrawer.ts` | Modify | Emit `IconRequest` for nodes with `style.icon` |
| `src/renderer/timelineDrawer.ts` | Modify | Emit `IconRequest` for events with `icon` |
| `src/renderer/pptxRenderer.ts` | Modify | Batch-resolve icons, embed PNGs in ZIP, update `.rels` and `[Content_Types].xml` |
| `tests/schema/presentation.test.ts` | Modify | Test new optional icon fields |
| `tests/renderer/iconResolver.test.ts` | Create | Unit tests for icon resolution |
| `tests/renderer/xmlHelpers.test.ts` | Create | Tests for `pictureShape()` and `emuFromPx()` |
| `tests/renderer/renderer.test.ts` | Modify | Integration test: PPTX with icons has `ppt/media/` PNGs and correct `.rels` |
| `tests/renderer/architectureDrawer.test.ts` | Modify | Test icon requests emitted for diagram nodes |
| `tests/renderer/timelineDrawer.test.ts` | Modify | Test icon requests emitted for timeline events |

---

## Chunk 1: Foundation — Schema, Dependencies, Icon Resolver, XML Helpers

### Task 1: Schema Updates

**Files:**
- Modify: `src/schema/presentation.ts:34-39` (BulletsElementSchema)
- Modify: `src/schema/presentation.ts:65-69` (TimelineEventSchema)
- Modify: `src/schema/presentation.ts:94-102` (KpiElementSchema indicators)
- Modify: `src/schema/presentation.ts:104-108` (QuoteElementSchema)
- Test: `tests/schema/presentation.test.ts`

- [ ] **Step 1: Write failing tests for new icon fields**

Add to `tests/schema/presentation.test.ts`:

```typescript
it('accepts a bullets element with icons array', () => {
  const el = { type: 'bullets', items: ['a', 'b'], icons: ['check', 'clock'] };
  expect(ElementSchema.parse(el)).toEqual(el);
});

it('accepts a bullets element without icons (backward compat)', () => {
  const el = { type: 'bullets', items: ['a', 'b'] };
  expect(ElementSchema.parse(el)).toEqual(el);
});

it('accepts a timeline event with icon', () => {
  const el = {
    type: 'timeline',
    events: [{ date: '2026-01', label: 'Launch', status: 'done', icon: 'rocket' }],
  };
  expect(ElementSchema.parse(el)).toEqual(el);
});

it('accepts a kpi element with icon on indicator', () => {
  const el = {
    type: 'kpi',
    indicators: [{ label: 'Revenue', value: '1.2M', icon: 'trending-up' }],
  };
  expect(ElementSchema.parse(el)).toEqual(el);
});

it('accepts a quote element with icon', () => {
  const el = { type: 'quote', text: 'To be', icon: 'quote' };
  expect(ElementSchema.parse(el)).toEqual(el);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pptx-generator && npx vitest run tests/schema/presentation.test.ts`
Expected: FAIL — Zod strips unknown fields by default, so `parse(el)` returns an object without `icons`/`icon`, causing `toEqual` to fail.

- [ ] **Step 3: Add icon fields to schema**

In `src/schema/presentation.ts`:

```typescript
// BulletsElementSchema — add icons
export const BulletsElementSchema = z.object({
  type: z.literal('bullets'),
  items: z.array(z.string()),
  column: z.enum(['left', 'right']).optional(),
  level: z.number().optional(),
  icons: z.array(z.string()).optional(),
});

// TimelineEventSchema — add icon
export const TimelineEventSchema = z.object({
  date: z.string(),
  label: z.string(),
  status: z.enum(['done', 'in-progress', 'planned']).optional(),
  icon: z.string().optional(),
});

// KpiElementSchema — add icon to indicator
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

// QuoteElementSchema — add icon
export const QuoteElementSchema = z.object({
  type: z.literal('quote'),
  text: z.string(),
  author: z.string().optional(),
  icon: z.string().optional(),
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pptx-generator && npx vitest run tests/schema/presentation.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/schema/presentation.ts tests/schema/presentation.test.ts
git commit -m "feat: add optional icon fields to AST schema elements"
```

---

### Task 2: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install lucide-static and @resvg/resvg-js**

```bash
cd pptx-generator && npm install lucide-static @resvg/resvg-js
```

- [ ] **Step 2: Verify lucide-static contains SVG files**

```bash
ls node_modules/lucide-static/icons/ | head -20
# Expected: SVG files like "database.svg", "server.svg", etc.
```

- [ ] **Step 3: Verify @resvg/resvg-js can be imported**

```bash
cd pptx-generator && node -e "const { Resvg } = require('@resvg/resvg-js'); console.log('OK');"
```

- [ ] **Step 4: Run existing tests to ensure no regressions**

Run: `cd pptx-generator && npx vitest run`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add lucide-static and @resvg/resvg-js dependencies"
```

---

### Task 3: Icon Resolver Module

**Files:**
- Create: `src/renderer/iconResolver.ts`
- Test: `tests/renderer/iconResolver.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/renderer/iconResolver.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveIcon, createIconCache } from '../../src/renderer/iconResolver.js';

describe('resolveIcon', () => {
  it('resolves a known Lucide icon to a PNG buffer', async () => {
    const cache = createIconCache();
    const result = await resolveIcon('database', '2D7DD2', 32, cache);
    expect(result).not.toBeNull();
    expect(result!.pngBuffer).toBeInstanceOf(Buffer);
    expect(result!.pngBuffer.length).toBeGreaterThan(0);
    // PNG magic bytes
    expect(result!.pngBuffer[0]).toBe(0x89);
    expect(result!.pngBuffer[1]).toBe(0x50); // 'P'
    expect(result!.pngBuffer[2]).toBe(0x4E); // 'N'
    expect(result!.pngBuffer[3]).toBe(0x47); // 'G'
    expect(result!.widthPx).toBe(32);
    expect(result!.heightPx).toBe(32);
  });

  it('returns null for an unknown icon name', async () => {
    const cache = createIconCache();
    const result = await resolveIcon('nonexistent-icon-xyz', 'FF0000', 32, cache);
    expect(result).toBeNull();
  });

  it('applies the requested color to the SVG', async () => {
    const cache = createIconCache();
    const red = await resolveIcon('circle', 'FF0000', 32, cache);
    const blue = await resolveIcon('circle', '0000FF', 32, cache);
    expect(red).not.toBeNull();
    expect(blue).not.toBeNull();
    // Different colors should produce different PNG buffers
    expect(red!.pngBuffer.equals(blue!.pngBuffer)).toBe(false);
  });

  it('caches results for the same name+color+size', async () => {
    const cache = createIconCache();
    const first = await resolveIcon('database', '2D7DD2', 32, cache);
    const second = await resolveIcon('database', '2D7DD2', 32, cache);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    // Same buffer reference from cache
    expect(first!.pngBuffer).toBe(second!.pngBuffer);
  });

  it('produces different cache entries for different sizes', async () => {
    const cache = createIconCache();
    const small = await resolveIcon('database', '2D7DD2', 20, cache);
    const large = await resolveIcon('database', '2D7DD2', 48, cache);
    expect(small).not.toBeNull();
    expect(large).not.toBeNull();
    expect(small!.pngBuffer.equals(large!.pngBuffer)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pptx-generator && npx vitest run tests/renderer/iconResolver.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement iconResolver.ts**

Create `src/renderer/iconResolver.ts`:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { Resvg } from '@resvg/resvg-js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

/**
 * Resolved icon: a colorized PNG buffer with dimensions.
 */
export interface ResolvedIcon {
  pngBuffer: Buffer;
  widthPx: number;
  heightPx: number;
}

export type IconCache = Map<string, ResolvedIcon>;

/**
 * Creates a fresh per-render icon cache.
 * Pass this into resolveIcon() to reuse across a single renderToBuffer() call.
 */
export function createIconCache(): IconCache {
  return new Map();
}

/**
 * Resolves the filesystem path to a Lucide icon SVG.
 * Returns null if the icon does not exist.
 */
function getLucideIconPath(name: string): string | null {
  try {
    const lucideDir = path.dirname(require.resolve('lucide-static/package.json'));
    return path.join(lucideDir, 'icons', `${name}.svg`);
  } catch {
    return null;
  }
}

/**
 * Resolves a Lucide icon name to a colorized PNG buffer.
 * Returns null if the icon name is not found.
 *
 * @param name - Lucide icon name (e.g., "database", "server")
 * @param color - Hex color without # (e.g., "2D7DD2")
 * @param sizePx - Output size in pixels (square)
 * @param cache - Per-render cache to avoid redundant conversions
 */
export async function resolveIcon(
  name: string,
  color: string,
  sizePx: number,
  cache: IconCache,
): Promise<ResolvedIcon | null> {
  const cacheKey = `${name}-${color}-${sizePx}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const iconPath = getLucideIconPath(name);
  if (!iconPath) {
    console.warn(`[pptx-generator] Icon "${name}" not found in lucide-static`);
    return null;
  }

  let svgContent: string;
  try {
    svgContent = await fs.readFile(iconPath, 'utf-8');
  } catch {
    console.warn(`[pptx-generator] Could not read icon file for "${name}"`);
    return null;
  }

  // Colorize: replace stroke="currentColor" with the requested color
  svgContent = svgContent.replace(/stroke="currentColor"/g, `stroke="#${color}"`);

  // Set explicit dimensions on the <svg> tag
  svgContent = svgContent.replace(
    /<svg([^>]*)>/,
    `<svg$1 width="${sizePx}" height="${sizePx}">`,
  );

  try {
    const resvg = new Resvg(svgContent, {
      fitTo: { mode: 'width', value: sizePx },
    });
    const rendered = resvg.render();
    const pngBuffer = Buffer.from(rendered.asPng());

    const result: ResolvedIcon = { pngBuffer, widthPx: sizePx, heightPx: sizePx };
    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[pptx-generator] Failed to render icon "${name}": ${err}`);
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pptx-generator && npx vitest run tests/renderer/iconResolver.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/iconResolver.ts tests/renderer/iconResolver.test.ts
git commit -m "feat: add iconResolver module for Lucide SVG-to-PNG conversion"
```

---

### Task 4: XML Helpers — `emuFromPx()` and `pictureShape()`

**Files:**
- Modify: `src/renderer/xmlHelpers.ts`
- Test: `tests/renderer/xmlHelpers.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/renderer/xmlHelpers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { emuFromPx, pictureShape } from '../../src/renderer/xmlHelpers.js';

describe('emuFromPx', () => {
  it('converts pixels to EMU at 96 DPI', () => {
    expect(emuFromPx(1)).toBe(9525);
    expect(emuFromPx(32)).toBe(304800);
    expect(emuFromPx(96)).toBe(914400); // 1 inch
  });
});

describe('pictureShape', () => {
  it('generates valid p:pic XML with correct attributes', () => {
    const xml = pictureShape(42, 'rIdImg1', 100, 200, 300, 400);
    expect(xml).toContain('<p:pic>');
    expect(xml).toContain('id="42"');
    expect(xml).toContain('name="Icon 42"');
    expect(xml).toContain('r:embed="rIdImg1"');
    expect(xml).toContain('x="100"');
    expect(xml).toContain('y="200"');
    expect(xml).toContain('cx="300"');
    expect(xml).toContain('cy="400"');
    expect(xml).toContain('noChangeAspect="1"');
    expect(xml).toContain('</p:pic>');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pptx-generator && npx vitest run tests/renderer/xmlHelpers.test.ts`
Expected: FAIL — `emuFromPx` and `pictureShape` are not exported.

- [ ] **Step 3: Implement emuFromPx and pictureShape**

Add to `src/renderer/xmlHelpers.ts` (after the existing `emu()` function around line 14):

```typescript
/** Converts pixels to EMU assuming 96 DPI. */
export function emuFromPx(px: number): number {
  return Math.round(px * 9525);
}
```

Add at the end of `src/renderer/xmlHelpers.ts`:

```typescript
/**
 * Creates a picture shape that references an embedded image.
 * Used for icon rendering in slides.
 */
export function pictureShape(
  id: number,
  relId: string,
  x: number,
  y: number,
  cx: number,
  cy: number,
): string {
  return `<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="${id}" name="Icon ${id}"/>
    <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
    <p:nvPr/>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="${relId}"/>
    <a:stretch><a:fillRect/></a:stretch>
  </p:blipFill>
  <p:spPr>
    <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
</p:pic>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pptx-generator && npx vitest run tests/renderer/xmlHelpers.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full test suite for regressions**

Run: `cd pptx-generator && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/xmlHelpers.ts tests/renderer/xmlHelpers.test.ts
git commit -m "feat: add emuFromPx() and pictureShape() XML helpers"
```

---

## Chunk 2: Renderer Pipeline — IconRequest, Image Embedding, Architecture & Timeline Icons

### Task 5: Update `buildSlideShapes` Return Type + Renderer Image Embedding

**Files:**
- Modify: `src/renderer/placeholderFiller.ts:29-34` (return type)
- Modify: `src/renderer/architectureDrawer.ts:25-29` (return type)
- Modify: `src/renderer/timelineDrawer.ts:20-24` (return type)
- Modify: `src/renderer/pptxRenderer.ts:58-77` (icon resolution + ZIP embedding)
- Test: `tests/renderer/renderer.test.ts`

- [ ] **Step 1: Define `IconRequest` type and update return types**

Add to `src/renderer/placeholderFiller.ts` (after imports, before `findElement`):

```typescript
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

export interface SlideShapeResult {
  shapes: string;
  nextId: number;
  iconRequests: IconRequest[];
}
```

Update `buildSlideShapes` return type from `{ shapes: string; nextId: number }` to `SlideShapeResult`. Add `iconRequests: []` to all return paths initially. Specifically:

- Declare `const iconRequests: IconRequest[] = [];` at the top of the function
- Return `{ shapes, nextId: id, iconRequests }` at the end
- For the `timeline`/`architecture` cases, collect `iconRequests` from drawer results

Update `buildArchitectureShapes` in `architectureDrawer.ts` to return `{ shapes: string; nextId: number; iconRequests: IconRequest[] }` (import `IconRequest` from `placeholderFiller`). Return empty `iconRequests: []` initially.

Update `buildTimelineShapes` in `timelineDrawer.ts` to return `{ shapes: string; nextId: number; iconRequests: IconRequest[] }` similarly.

- [ ] **Step 2: Run existing tests to verify no regressions**

Run: `cd pptx-generator && npx vitest run`
Expected: ALL PASS (return type is backward-compatible; callers already destructure `{ shapes, nextId }`).

- [ ] **Step 3: Update `renderToBuffer` to handle icon requests**

In `src/renderer/pptxRenderer.ts`, add imports:

```typescript
import { resolveIcon, createIconCache } from './iconResolver.js';
import type { IconRequest } from './placeholderFiller.js';
import { pictureShape } from './xmlHelpers.js';
```

In the `renderToBuffer` function:

1. Create icon cache at the top: `const iconCache = createIconCache();`
2. Track global image counter: `let nextImageNum = 1;`
3. Track whether any images were added: `let hasImages = false;`
4. After `buildSlideShapes`, resolve icons and build the final slide XML:

```typescript
// After: const { shapes, nextId, iconRequests } = buildSlideShapes(slide, nextShapeId, templateInfo);

let allShapes = shapes;
const slideImages: Array<{ relId: string; mediaPath: string; pngBuffer: Buffer }> = [];

for (const req of iconRequests) {
  const icon = await resolveIcon(req.name, req.color, req.sizePx, iconCache);
  if (!icon) continue;

  const mediaPath = `ppt/media/image${nextImageNum}.png`;
  const relId = `rIdImg${nextImageNum}`;
  nextImageNum++;

  allShapes += pictureShape(nextShapeId++, relId, req.x, req.y, req.cx, req.cy);
  slideImages.push({ relId, mediaPath, pngBuffer: icon.pngBuffer });
  hasImages = true;
}

const slideXml = wrapSlideXml(allShapes);
```

5. Write image files to ZIP and update slide `.rels`:

After writing the slide `.rels` file, if `slideImages.length > 0`, append image relationships:

```typescript
for (const img of slideImages) {
  zip.file(img.mediaPath, img.pngBuffer);
}

// Update slide rels to include image relationships
if (slideImages.length > 0) {
  const currentRels = await zip.file(`ppt/slides/_rels/slide${entry.slideNum}.xml.rels`)!.async('text');
  const imageRels = slideImages.map(img =>
    `  <Relationship Id="${img.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${img.mediaPath.split('/').pop()}"/>`
  ).join('\n');
  const updatedRels = currentRels.replace(
    '</Relationships>',
    `${imageRels}\n</Relationships>`
  );
  zip.file(`ppt/slides/_rels/slide${entry.slideNum}.xml.rels`, updatedRels);
}
```

6. After all slides, add PNG content type if needed:

```typescript
if (hasImages) {
  // Add PNG content type if not already present
  if (!newContentTypes.includes('Extension="png"')) {
    newContentTypes = newContentTypes.replace(
      '</Types>',
      '  <Default Extension="png" ContentType="image/png"/>\n</Types>'
    );
  }
}
```

Note: The `slideImages` array must be stored per slide entry. Update the `slideEntries` type to include `images`:

```typescript
const slideEntries: Array<{
  slideNum: number;
  slideXml: string;
  layoutIndex: number;
  notes?: string;
  images: Array<{ relId: string; mediaPath: string; pngBuffer: Buffer }>;
}> = [];
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `cd pptx-generator && npx vitest run`
Expected: ALL PASS (no icon requests emitted yet, so the new code path is not exercised but the pipeline works).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/placeholderFiller.ts src/renderer/architectureDrawer.ts src/renderer/timelineDrawer.ts src/renderer/pptxRenderer.ts
git commit -m "feat: add IconRequest pipeline and image embedding in renderer"
```

---

### Task 6: Architecture Diagram Icon Rendering

**Files:**
- Modify: `src/renderer/architectureDrawer.ts:73-92`
- Test: `tests/renderer/architectureDrawer.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/renderer/architectureDrawer.test.ts`:

```typescript
it('emits icon requests for nodes with style.icon', async () => {
  const presentation: Presentation = {
    title: 'Icon Arch Test',
    slides: [
      {
        layout: 'architecture',
        _resolvedLayout: 'architecture',
        elements: [
          { type: 'title', text: 'With Icons' },
          {
            type: 'diagram',
            nodes: [
              { id: 'db', label: 'Database', layer: 'Data', style: { icon: 'database' } },
              { id: 'api', label: 'API', layer: 'Backend' },
            ],
            edges: [{ from: 'api', to: 'db' }],
          },
        ],
      },
    ],
  };

  const buffer = await renderToBuffer(presentation, TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
  expect(slideXml).toBeDefined();

  // Should contain a p:pic element for the database icon
  expect(slideXml).toContain('<p:pic>');
  expect(slideXml).toContain('rIdImg');

  // Should still contain the text labels
  expect(slideXml).toContain('Database');
  expect(slideXml).toContain('API');

  // Should have an image file in ppt/media/
  const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
  expect(mediaFiles.length).toBeGreaterThan(0);

  // Should have image relationship in slide rels
  const rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('text');
  expect(rels).toContain('relationships/image');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pptx-generator && npx vitest run tests/renderer/architectureDrawer.test.ts`
Expected: FAIL — no `<p:pic>` element in output.

- [ ] **Step 3: Implement icon requests in architectureDrawer**

In `src/renderer/architectureDrawer.ts`, import `emuFromPx` and `IconRequest`:

```typescript
import { emu, rectShape, lineShape, textBoxShape, emuFromPx } from './xmlHelpers.js';
import type { IconRequest } from './placeholderFiller.js';
```

In the node rendering loop (around line 74-92), **replace** the existing `textBoxShape` call (lines 89-91) with the following conditional block. The `rectShape` call remains unchanged; only the label rendering changes:

```typescript
const iconRequests: IconRequest[] = [];

// Inside the node loop, after rectShape:
if (node.style?.icon) {
  const iconSizePx = 32;
  const iconEmu = emuFromPx(iconSizePx);
  iconRequests.push({
    name: node.style.icon,
    color: 'FFFFFF',
    sizePx: iconSizePx,
    x: x + Math.round((nodeW - iconEmu) / 2),
    y: y + Math.round((NODE_H - iconEmu) / 4),
    cx: iconEmu,
    cy: iconEmu,
  });

  // Shift label down to make room for icon
  shapes += textBoxShape(id++, x, y + Math.round(NODE_H * 0.55), nodeW, Math.round(NODE_H * 0.45),
    node.label, { size: 9, bold: true, color: 'FFFFFF' });
} else {
  // Original label (centered vertically)
  shapes += textBoxShape(id++, x, y, nodeW, NODE_H,
    node.label, { size: 10, bold: true, color: 'FFFFFF' });
}
```

Return `iconRequests` in the result:

```typescript
return { shapes, nextId: id, iconRequests };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pptx-generator && npx vitest run tests/renderer/architectureDrawer.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full suite**

Run: `cd pptx-generator && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/architectureDrawer.ts tests/renderer/architectureDrawer.test.ts
git commit -m "feat: render Lucide icons in architecture diagram nodes"
```

---

### Task 7: Timeline Icon Rendering

**Files:**
- Modify: `src/renderer/timelineDrawer.ts:62-73`
- Test: `tests/renderer/timelineDrawer.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/renderer/timelineDrawer.test.ts`:

```typescript
it('emits icon requests for events with icon, replacing ellipse', async () => {
  const presentation: Presentation = {
    title: 'Icon Timeline Test',
    slides: [
      {
        layout: 'timeline',
        _resolvedLayout: 'timeline',
        elements: [
          { type: 'title', text: 'Timeline With Icons' },
          {
            type: 'timeline',
            events: [
              { date: '2026-Q1', label: 'Planning', status: 'done', icon: 'clipboard-check' },
              { date: '2026-Q2', label: 'Dev', status: 'in-progress' },
            ],
          },
        ],
      },
    ],
  };

  const buffer = await renderToBuffer(presentation, TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
  expect(slideXml).toBeDefined();

  // Should contain a p:pic element for the first event's icon
  expect(slideXml).toContain('<p:pic>');

  // Second event (no icon) should still have an ellipse
  expect(slideXml).toContain('prstGeom prst="ellipse"');

  // Should have an image file in ppt/media/
  const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
  expect(mediaFiles.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pptx-generator && npx vitest run tests/renderer/timelineDrawer.test.ts`
Expected: FAIL — no `<p:pic>` in output.

- [ ] **Step 3: Implement icon requests in timelineDrawer**

In `src/renderer/timelineDrawer.ts`, import `emuFromPx` and `IconRequest`:

```typescript
import { emu, ellipseShape, rectShape, lineShape, textBoxShape, emuFromPx } from './xmlHelpers.js';
import type { IconRequest } from './placeholderFiller.js';
```

In the event loop (around line 62-73), when the event has an `icon`, emit an `IconRequest` instead of drawing the ellipse:

```typescript
const iconRequests: IconRequest[] = [];

// Inside event loop:
if (event.icon) {
  const iconSizePx = 24;
  const iconEmu = emuFromPx(iconSizePx);
  iconRequests.push({
    name: event.icon,
    color: color,
    sizePx: iconSizePx,
    x: cx - Math.round(iconEmu / 2),
    y: lineY - Math.round(iconEmu / 2),
    cx: iconEmu,
    cy: iconEmu,
  });
} else {
  // Original ellipse
  shapes += ellipseShape(id++, {
    x: cx - circleR, y: lineY - circleR,
    cx: circleR * 2, cy: circleR * 2,
    fill: color,
  });
}
```

Return `iconRequests`:

```typescript
return { shapes, nextId: id, iconRequests };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pptx-generator && npx vitest run tests/renderer/timelineDrawer.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full suite**

Run: `cd pptx-generator && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/timelineDrawer.ts tests/renderer/timelineDrawer.test.ts
git commit -m "feat: render Lucide icons in timeline events"
```

---

## Chunk 3: Bullets with Icons, Quote Icon, Integration Tests

### Task 8: Bullets with Icons Rendering

**Files:**
- Modify: `src/renderer/placeholderFiller.ts:57-71` (bullets case)
- Test: `tests/renderer/renderer.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/renderer/renderer.test.ts`:

```typescript
it('renders bullets with icons as picture + textbox shapes', async () => {
  const presentation: Presentation = {
    title: 'Icon Bullets Test',
    slides: [
      {
        layout: 'bullets',
        _resolvedLayout: 'bullets',
        elements: [
          { type: 'title', text: 'Features' },
          {
            type: 'bullets',
            items: ['Fast', 'Secure', 'Simple'],
            icons: ['zap', 'shield', 'box'],
          },
        ],
      },
    ],
  };

  const buffer = await renderToBuffer(presentation, TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
  expect(slideXml).toBeDefined();

  // Should contain p:pic elements for icons
  expect(slideXml).toContain('<p:pic>');

  // Should contain text labels
  expect(slideXml).toContain('Fast');
  expect(slideXml).toContain('Secure');
  expect(slideXml).toContain('Simple');

  // Should have image files in ppt/media/
  const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
  expect(mediaFiles.length).toBe(3);
});

it('renders bullets without icons normally (backward compat)', async () => {
  const presentation: Presentation = {
    title: 'No Icon Bullets',
    slides: [
      {
        layout: 'bullets',
        _resolvedLayout: 'bullets',
        elements: [
          { type: 'title', text: 'Plain' },
          { type: 'bullets', items: ['A', 'B'] },
        ],
      },
    ],
  };

  const buffer = await renderToBuffer(presentation, TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');

  // Should NOT contain p:pic (no icons)
  expect(slideXml).not.toContain('<p:pic>');
  // Should use placeholder-based rendering
  expect(slideXml).toContain('A');
  expect(slideXml).toContain('B');
});

it('handles icons array shorter than items', async () => {
  const presentation: Presentation = {
    title: 'Partial Icons',
    slides: [
      {
        layout: 'bullets',
        _resolvedLayout: 'bullets',
        elements: [
          { type: 'title', text: 'Partial' },
          {
            type: 'bullets',
            items: ['With icon', 'No icon'],
            icons: ['check'],
          },
        ],
      },
    ],
  };

  const buffer = await renderToBuffer(presentation, TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
  expect(slideXml).toContain('With icon');
  expect(slideXml).toContain('No icon');

  // Only 1 icon
  const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
  expect(mediaFiles.length).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pptx-generator && npx vitest run tests/renderer/renderer.test.ts`
Expected: FAIL on icon-related tests.

- [ ] **Step 3: Implement icon bullets in placeholderFiller**

In `src/renderer/placeholderFiller.ts`, add imports:

```typescript
import { placeholderShape, bulletPlaceholderShape, textBoxShape, emuFromPx, emu } from './xmlHelpers.js';
```

In the `bullets` / `generic` case (around line 57-71), when `bulletsEl.icons` is present, replace placeholder rendering with manual layout:

```typescript
case 'bullets':
case 'generic': {
  const title = getTitleText(slide);
  shapes += placeholderShape(id++, 'title', 0, [title]);

  const bulletsEl = findElement(slide.elements, 'bullets');
  if (bulletsEl && bulletsEl.icons && bulletsEl.icons.length > 0) {
    // Manual layout with icons
    const accentColor = templateInfo.theme.accentColors[0]?.replace('#', '') ?? '2D7DD2';
    const iconSizePx = 20;
    const iconEmu = emuFromPx(iconSizePx);
    const bodyLeft = emu(0.8);
    const bodyTop = emu(1.8);
    const bodyWidth = emu(8.4);
    const lineHeight = emu(0.55);
    const iconGap = emu(0.15);

    for (let i = 0; i < bulletsEl.items.length; i++) {
      const itemY = bodyTop + i * lineHeight;
      const iconName = bulletsEl.icons[i];

      if (iconName) {
        iconRequests.push({
          name: iconName,
          color: accentColor,
          sizePx: iconSizePx,
          x: bodyLeft,
          y: itemY + Math.round((lineHeight - iconEmu) / 2),
          cx: iconEmu,
          cy: iconEmu,
        });
      }

      const textX = iconName ? bodyLeft + iconEmu + iconGap : bodyLeft + iconEmu + iconGap;
      const textW = bodyWidth - iconEmu - iconGap;
      shapes += textBoxShape(id++, textX, itemY, textW, lineHeight,
        bulletsEl.items[i], { size: 14, align: 'l', valign: 'ctr' });
    }
  } else if (bulletsEl) {
    shapes += bulletPlaceholderShape(id++, 1, bulletsEl.items);
  } else {
    const textEl = findElement(slide.elements, 'text');
    if (textEl) {
      shapes += placeholderShape(id++, 'body', 1, [textEl.text]);
    }
  }
  break;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pptx-generator && npx vitest run tests/renderer/renderer.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full suite**

Run: `cd pptx-generator && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/placeholderFiller.ts tests/renderer/renderer.test.ts
git commit -m "feat: render bullets with Lucide icons as picture+textbox shapes"
```

---

### Task 9: Two-Column Bullets with Icons

**Files:**
- Modify: `src/renderer/placeholderFiller.ts:74-91` (twoColumns case)
- Test: `tests/renderer/renderer.test.ts`

- [ ] **Step 1: Write failing test**

Add to `tests/renderer/renderer.test.ts`:

```typescript
it('renders two-column bullets with icons', async () => {
  const presentation: Presentation = {
    title: 'Two Col Icons',
    slides: [
      {
        layout: 'twoColumns',
        _resolvedLayout: 'twoColumns',
        elements: [
          { type: 'title', text: 'Comparison' },
          { type: 'bullets', items: ['Pro A', 'Pro B'], column: 'left', icons: ['check', 'check'] },
          { type: 'bullets', items: ['Con A'], column: 'right', icons: ['x'] },
        ],
      },
    ],
  };

  const buffer = await renderToBuffer(presentation, TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
  expect(slideXml).toContain('Pro A');
  expect(slideXml).toContain('Con A');
  expect(slideXml).toContain('<p:pic>');

  const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
  expect(mediaFiles.length).toBe(3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pptx-generator && npx vitest run tests/renderer/renderer.test.ts`
Expected: FAIL — no `<p:pic>` in two-column output.

- [ ] **Step 3: Implement two-column icon bullets**

In `src/renderer/placeholderFiller.ts`, update the `twoColumns` case. Extract a helper function for icon bullet rendering to avoid duplication:

```typescript
/**
 * Builds icon bullet shapes for a column region.
 * Returns shapes XML and populates iconRequests array.
 */
function buildIconBulletShapes(
  bulletsEl: Extract<Element, { type: 'bullets' }>,
  id: number,
  iconRequests: IconRequest[],
  accentColor: string,
  regionLeft: number,
  regionTop: number,
  regionWidth: number,
): { shapes: string; nextId: number } {
  let shapes = '';
  const iconSizePx = 20;
  const iconEmu = emuFromPx(iconSizePx);
  const lineHeight = emu(0.55);
  const iconGap = emu(0.15);

  for (let i = 0; i < bulletsEl.items.length; i++) {
    const itemY = regionTop + i * lineHeight;
    const iconName = bulletsEl.icons?.[i];

    if (iconName) {
      iconRequests.push({
        name: iconName,
        color: accentColor,
        sizePx: iconSizePx,
        x: regionLeft,
        y: itemY + Math.round((lineHeight - iconEmu) / 2),
        cx: iconEmu,
        cy: iconEmu,
      });
    }

    const textX = regionLeft + iconEmu + iconGap;
    const textW = regionWidth - iconEmu - iconGap;
    shapes += textBoxShape(id++, textX, itemY, textW, lineHeight,
      bulletsEl.items[i], { size: 14, align: 'l', valign: 'ctr' });
  }

  return { shapes, nextId: id };
}
```

Update the `twoColumns` case:

```typescript
case 'twoColumns': {
  const title = getTitleText(slide);
  shapes += placeholderShape(id++, 'title', 0, [title]);

  const bulletElements = slide.elements.filter(
    (el): el is Extract<Element, { type: 'bullets' }> => el.type === 'bullets',
  );
  const leftBullets = bulletElements.find((el) => el.column === 'left') ?? bulletElements[0];
  const rightBullets = bulletElements.find((el) => el.column === 'right') ?? bulletElements[1];

  const hasAnyIcons = (leftBullets?.icons?.length ?? 0) > 0 || (rightBullets?.icons?.length ?? 0) > 0;

  if (hasAnyIcons) {
    const accentColor = templateInfo.theme.accentColors[0]?.replace('#', '') ?? '2D7DD2';
    const bodyTop = emu(1.8);
    const leftStart = emu(0.8);
    const colWidth = emu(4.0);
    const rightStart = emu(5.2);

    if (leftBullets) {
      const result = buildIconBulletShapes(leftBullets, id, iconRequests, accentColor, leftStart, bodyTop, colWidth);
      shapes += result.shapes;
      id = result.nextId;
    }
    if (rightBullets) {
      const result = buildIconBulletShapes(rightBullets, id, iconRequests, accentColor, rightStart, bodyTop, colWidth);
      shapes += result.shapes;
      id = result.nextId;
    }
  } else {
    if (leftBullets) {
      shapes += bulletPlaceholderShape(id++, 1, leftBullets.items);
    }
    if (rightBullets) {
      shapes += bulletPlaceholderShape(id++, 2, rightBullets.items);
    }
  }
  break;
}
```

Also refactor the `bullets`/`generic` case to use `buildIconBulletShapes`:

```typescript
case 'bullets':
case 'generic': {
  const title = getTitleText(slide);
  shapes += placeholderShape(id++, 'title', 0, [title]);

  const bulletsEl = findElement(slide.elements, 'bullets');
  if (bulletsEl && bulletsEl.icons && bulletsEl.icons.length > 0) {
    const accentColor = templateInfo.theme.accentColors[0]?.replace('#', '') ?? '2D7DD2';
    const result = buildIconBulletShapes(bulletsEl, id, iconRequests, accentColor, emu(0.8), emu(1.8), emu(8.4));
    shapes += result.shapes;
    id = result.nextId;
  } else if (bulletsEl) {
    shapes += bulletPlaceholderShape(id++, 1, bulletsEl.items);
  } else {
    const textEl = findElement(slide.elements, 'text');
    if (textEl) {
      shapes += placeholderShape(id++, 'body', 1, [textEl.text]);
    }
  }
  break;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pptx-generator && npx vitest run tests/renderer/renderer.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full suite**

Run: `cd pptx-generator && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/placeholderFiller.ts tests/renderer/renderer.test.ts
git commit -m "feat: render two-column bullets with icons, extract shared helper"
```

---

### Task 10: Quote Icon Rendering

**Files:**
- Modify: `src/renderer/placeholderFiller.ts` (section/title case or default case for quote layout)
- Test: `tests/renderer/renderer.test.ts`

Note: Quote currently degrades to bullets/generic. The icon is rendered as a decorative element in the top-left of the slide when a quote element has an `icon` field, regardless of the layout used.

- [ ] **Step 1: Write failing test**

Add to `tests/renderer/renderer.test.ts`:

```typescript
it('renders quote with decorative icon', async () => {
  const presentation: Presentation = {
    title: 'Quote Icon Test',
    slides: [
      {
        layout: 'generic',
        _resolvedLayout: 'generic',
        elements: [
          { type: 'title', text: 'Inspiration' },
          { type: 'quote', text: 'Be the change', author: 'Gandhi', icon: 'quote' },
        ],
      },
    ],
  };

  const buffer = await renderToBuffer(presentation, TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
  expect(slideXml).toBeDefined();

  // Should contain a p:pic element for the decorative quote icon
  expect(slideXml).toContain('<p:pic>');

  // Should contain the quote text
  expect(slideXml).toContain('Be the change');

  const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
  expect(mediaFiles.length).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd pptx-generator && npx vitest run tests/renderer/renderer.test.ts`
Expected: FAIL — no `<p:pic>` for quote icon.

- [ ] **Step 3: Implement quote icon in placeholderFiller**

In `src/renderer/placeholderFiller.ts`, add a helper at the end of `buildSlideShapes` (before the return), that checks for any quote element with an icon:

```typescript
// Check for quote element with decorative icon (applies to any layout)
const quoteEl = findElement(slide.elements, 'quote');
if (quoteEl?.icon) {
  const accentColor = templateInfo.theme.accentColors[0]?.replace('#', '') ?? '2D7DD2';
  const iconSizePx = 48;
  const iconEmu = emuFromPx(iconSizePx);
  iconRequests.push({
    name: quoteEl.icon,
    color: accentColor,
    sizePx: iconSizePx,
    x: emu(0.5),
    y: emu(1.5),
    cx: iconEmu,
    cy: iconEmu,
  });
}
```

Also, in the `generic` case, check if the slide has a quote element and render it as text if no text element is present:

```typescript
// In bullets/generic case, after bullets check:
if (!bulletsEl) {
  const quoteEl = findElement(slide.elements, 'quote');
  const textEl = findElement(slide.elements, 'text');
  if (quoteEl) {
    const quoteText = quoteEl.author
      ? `"${quoteEl.text}" — ${quoteEl.author}`
      : `"${quoteEl.text}"`;
    shapes += placeholderShape(id++, 'body', 1, [quoteText]);
  } else if (textEl) {
    shapes += placeholderShape(id++, 'body', 1, [textEl.text]);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd pptx-generator && npx vitest run tests/renderer/renderer.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Run full suite**

Run: `cd pptx-generator && npx vitest run`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add src/renderer/placeholderFiller.ts tests/renderer/renderer.test.ts
git commit -m "feat: render decorative Lucide icon on quote elements"
```

---

### Task 11: Integration Test — Full Pipeline with Icons

**Files:**
- Modify: `tests/renderer/renderer.test.ts`

- [ ] **Step 1: Write integration test**

Add to the `E2E` describe block in `tests/renderer/renderer.test.ts`:

```typescript
it('produces a valid PPTX with icons across multiple element types', async () => {
  const caps = makeTier1Capabilities(['twoColumns', 'timeline', 'architecture']);
  const ast: Presentation = {
    title: 'Icon Integration Test',
    slides: [
      {
        layout: 'architecture',
        elements: [
          { type: 'title', text: 'System' },
          {
            type: 'diagram',
            nodes: [
              { id: 'web', label: 'Web', layer: 'Frontend', style: { icon: 'globe' } },
              { id: 'api', label: 'API', layer: 'Backend', style: { icon: 'server' } },
              { id: 'db', label: 'DB', layer: 'Data', style: { icon: 'database' } },
            ],
            edges: [{ from: 'web', to: 'api' }, { from: 'api', to: 'db' }],
          },
        ],
      },
      {
        layout: 'bullets',
        elements: [
          { type: 'title', text: 'Features' },
          { type: 'bullets', items: ['Fast', 'Secure'], icons: ['zap', 'shield'] },
        ],
      },
      {
        layout: 'timeline',
        elements: [
          { type: 'title', text: 'Roadmap' },
          {
            type: 'timeline',
            events: [
              { date: 'Q1', label: 'Plan', status: 'done', icon: 'clipboard-check' },
              { date: 'Q2', label: 'Build', status: 'in-progress', icon: 'hammer' },
            ],
          },
        ],
      },
    ],
  };

  const enriched = transformPresentation(ast, caps);
  const buffer = await renderToBuffer(enriched, TEMPLATE_PATH);
  expect(buffer).toBeInstanceOf(Buffer);

  const zip = await JSZip.loadAsync(buffer);

  // Should have 3 slides
  const slideFiles = Object.keys(zip.files).filter(
    name => name.match(/^ppt\/slides\/slide\d+\.xml$/),
  );
  expect(slideFiles).toHaveLength(3);

  // Should have image files in ppt/media/
  const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
  expect(mediaFiles.length).toBeGreaterThanOrEqual(5); // 3 arch + 2 bullets + 2 timeline icons (some may cache)

  // Content types should include PNG
  const contentTypes = await zip.file('[Content_Types].xml')?.async('text');
  expect(contentTypes).toContain('Extension="png"');

  // Each slide's rels should have image relationships where applicable
  const slide1Rels = await zip.file('ppt/slides/_rels/slide1.xml.rels')?.async('text');
  expect(slide1Rels).toContain('rIdImg');
});
```

- [ ] **Step 2: Write graceful degradation test for unknown icons**

Add to the same describe block:

```typescript
it('gracefully skips unknown icon names without crashing', async () => {
  const presentation: Presentation = {
    title: 'Unknown Icon Test',
    slides: [
      {
        layout: 'bullets',
        _resolvedLayout: 'bullets',
        elements: [
          { type: 'title', text: 'Test' },
          {
            type: 'bullets',
            items: ['Valid', 'Invalid'],
            icons: ['check', 'totally-fake-icon-xyz'],
          },
        ],
      },
    ],
  };

  const buffer = await renderToBuffer(presentation, TEMPLATE_PATH);
  expect(buffer).toBeInstanceOf(Buffer);

  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml')?.async('text');
  expect(slideXml).toContain('Valid');
  expect(slideXml).toContain('Invalid');

  // Only 1 media file (the valid icon)
  const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
  expect(mediaFiles.length).toBe(1);
});
```

- [ ] **Step 3: Run integration tests**

Run: `cd pptx-generator && npx vitest run tests/renderer/renderer.test.ts`
Expected: ALL PASS

- [ ] **Step 4: Run full test suite one final time**

Run: `cd pptx-generator && npx vitest run`
Expected: ALL PASS — zero failures, zero skipped.

- [ ] **Step 5: Commit**

```bash
git add tests/renderer/renderer.test.ts
git commit -m "test: add integration test for icons across all element types"
```
