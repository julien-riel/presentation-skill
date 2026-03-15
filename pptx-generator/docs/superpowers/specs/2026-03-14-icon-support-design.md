# Icon Support for PPTX Generator

## Summary

Add SVG icon support across all presentation element types using the Lucide icon library, with SVG-to-PNG conversion at render time via `@resvg/resvg-js`. Icons are embedded as PNG images in the PPTX ZIP archive with proper OOXML relationships.

## Dependencies

| Package | Purpose | Justification |
|---|---|---|
| `lucide-static` | SVG icon files (1500+ icons, MIT) | Semantic names match existing `style.icon` field; lightweight (SVG files only) |
| `@resvg/resvg-js` | SVG-to-PNG conversion (Rust/napi-rs) | High-quality SVG spec compliance, fast, pre-built binaries for all major platforms. Preferred over `sharp` (heavier, not in current deps) and pure-JS alternatives (lower quality). |

## Schema Changes

All additions are optional fields — zero breaking changes.

### `BulletsElementSchema`

```typescript
// Parallel array of icon names. When shorter than items, missing entries have no icon.
// When longer, extras are ignored.
icons: z.array(z.string()).optional()
```

### `TimelineEventSchema`

```typescript
icon: z.string().optional()
```

### `KpiIndicator` (within `KpiElementSchema`)

```typescript
icon: z.string().optional()
```

### `QuoteElementSchema`

```typescript
icon: z.string().optional()
```

### `DiagramNodeSchema`

No change — `style.icon` already exists.

## Architecture

### New Module: `src/renderer/iconResolver.ts`

Single responsibility: icon name + color + size -> PNG buffer.

```typescript
interface ResolvedIcon {
  pngBuffer: Buffer;
  widthPx: number;
  heightPx: number;
}

/**
 * Resolves a Lucide icon name to a colorized PNG buffer.
 * Returns null if the icon name is not found in Lucide.
 *
 * @param name - Lucide icon name (e.g., "database", "server")
 * @param color - Hex color without # (e.g., "2D7DD2")
 * @param sizePx - Output size in pixels (square)
 */
async function resolveIcon(
  name: string,
  color: string,
  sizePx: number
): Promise<ResolvedIcon | null>
```

**Process:**
1. Read SVG from `lucide-static` package (`icons/{name}.svg`)
2. Replace `stroke="currentColor"` with requested color
3. Inject `width` and `height` attributes into `<svg>` tag
4. Convert to PNG via `@resvg/resvg-js`
5. Return buffer or `null` if icon not found

**Caching:** Per-render `Map<string, ResolvedIcon>` keyed by `{name}-{color}-{size}`, passed into the resolver from `renderToBuffer()`. This avoids redundant conversions within a single render and ensures no stale state between renders.

**Color convention:** All callers strip `#` before passing to `resolveIcon()`. Theme accent colors in `templateInfo` come with `#` prefix — stripping happens at the call site (consistent with existing pattern in `architectureDrawer.ts`).

### New Helper: `xmlHelpers.ts` — `pictureShape()`

```typescript
function pictureShape(
  id: number,
  relId: string,
  x: number, y: number,
  cx: number, cy: number,
): string
```

Generates this OOXML:

```xml
<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="{id}" name="Icon {id}"/>
    <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
    <p:nvPr/>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="{relId}"/>
    <a:stretch><a:fillRect/></a:stretch>
  </p:blipFill>
  <p:spPr>
    <a:xfrm><a:off x="{x}" y="{y}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
</p:pic>
```

### Pixel-to-EMU Conversion

Icon sizes are specified in pixels for readability. Conversion assumes 96 DPI:

- 1 px = 914400 / 96 = 9525 EMU
- 20px = 190500 EMU (~0.21 inches)
- 24px = 228600 EMU (~0.25 inches)
- 32px = 304800 EMU (~0.33 inches)
- 48px = 457200 EMU (~0.50 inches)

Helper: `emuFromPx(px: number): number` added to `xmlHelpers.ts`.

### Lazy Icon Resolution Strategy

To minimize async surface area, drawer functions (`buildArchitectureShapes`, `buildTimelineShapes`) and `buildSlideShapes` **remain synchronous**. Instead:

1. Drawers collect icon requests as `IconRequest[]` alongside shapes:
   ```typescript
   interface IconRequest {
     name: string;
     color: string;
     sizePx: number;
     x: number;    // EMU position where the icon should appear
     y: number;
     cx: number;   // EMU dimensions
     cy: number;
   }
   ```
2. `buildSlideShapes` returns `{ shapes: string; nextId: number; iconRequests: IconRequest[] }`
3. `renderToBuffer()` (already async) resolves all icon requests in batch, generates `pictureShape()` XML, and appends it to the slide shapes

This keeps all drawer APIs synchronous and concentrates async logic in the renderer.

### Modified Return Type: `buildSlideShapes()`

```typescript
interface SlideShapeResult {
  shapes: string;
  nextId: number;
  iconRequests: IconRequest[];
}
```

### Modified: `pptxRenderer.ts` — `renderToBuffer()`

Additional responsibilities:
1. For each slide, resolve `iconRequests[]` via `resolveIcon()` (batched, uses per-render cache)
2. Generate `pictureShape()` XML for each resolved icon, append to slide shapes
3. Write PNG files to `ppt/media/imageN.png` in the ZIP (global counter across all slides)
4. Add image relationships to each slide's `.rels` file
5. Add `<Default Extension="png" ContentType="image/png"/>` to `[Content_Types].xml` (only if at least one icon was resolved, and only if the entry doesn't already exist)

### Relationship ID Scheme

Slide `.rels` currently use:
- `rId1` — slideLayout reference
- `rId2` — notesSlide reference (when present)

Image relationships use the `rIdImg{N}` naming convention (e.g., `rIdImg1`, `rIdImg2`) to avoid collision with numeric `rId1`/`rId2`. The global image counter ensures unique media paths; per-slide `rIdImg` counters ensure unique relationship IDs within each slide's `.rels`.

### Two-Column Bullets with Icons

When `twoColumns` layout has bullets with `icons`, each column's bullets are rendered as manual shapes (icon + textBox pairs) positioned within the left or right half of the body area. The same logic as single-column icon bullets applies, but with adjusted x-offset and width.

## Rendering Per Element Type

### 1. Architecture Diagrams (`DiagramNode.style.icon`)

- Icon rendered centered inside the node rectangle, above the label
- Size: 32px, color: white (`FFFFFF`) on the colored node background
- Label text shifts down slightly to accommodate the icon
- Falls back to current behavior (label only) when no icon specified

### 2. Timeline Events (`TimelineEvent.icon`)

- Icon replaces the colored status ellipse at the same position
- Size: 24px, color: matches status color (done=green, in-progress=amber, planned=gray)
- Falls back to ellipse when no icon specified

### 3. Bullets with Icons (`BulletsElement.icons`)

- When `icons` array is present, placeholder-based rendering is replaced by manual layout
- Each bullet line becomes: `pictureShape` (icon, 20px) + `textBoxShape` (text)
- Positioned within the body placeholder zone (calculated from template layout)
- Color: accent1 from theme
- Falls back to normal placeholder bullets when no icons specified
- When `icons` array is shorter than `items`, missing entries render without icon (text only, slightly indented)

### 4. Quote (`QuoteElement.icon`)

- Decorative icon positioned top-left of the quote text area
- Size: 48px, color: accent1 with visual weight
- Falls back to no decoration when no icon specified

### 5. KPI (`KpiIndicator.icon`)

- Deferred: KPI currently degrades to bullets layout
- When native KPI rendering is implemented, icon will appear above the value
- No regression — icon field is stored in AST but ignored in fallback rendering

## Error Handling

- Unknown icon name: log warning to stderr, skip icon (no crash, no broken image)
- `lucide-static` not installed: fail fast at import time with clear error message
- `@resvg/resvg-js` conversion failure: log warning, skip icon
- Invalid color value: fall back to theme accent1
- `icons` array length mismatch with `items`: render available icons, skip missing ones

## Testing Strategy

- `iconResolver.ts`: unit tests for known icon, unknown icon, color substitution, caching behavior
- `xmlHelpers.ts`: unit test for `pictureShape()` XML output, `emuFromPx()` conversion
- `placeholderFiller.ts`: test that `iconRequests` array is populated when icons present, test two-column icon bullets
- `pptxRenderer.ts`: integration test — generate PPTX with icons, verify `ppt/media/` contains PNGs, verify `.rels` contain image relationships with `rIdImg` prefix, verify `[Content_Types].xml` has PNG default
- `schema/presentation.ts`: test that new optional fields validate correctly, test icons array with various lengths

## Implementation Order

1. Schema updates (add optional icon fields) — trivially additive, enables all subsequent work
2. Install `lucide-static` + `@resvg/resvg-js`
3. `iconResolver.ts` + `emuFromPx()` in `xmlHelpers.ts` — the foundation
4. `pictureShape()` in `xmlHelpers.ts`
5. Update `buildSlideShapes` return type (add `iconRequests`) + `pptxRenderer.ts` image embedding pipeline
6. Architecture diagram icon rendering
7. Timeline icon rendering
8. Bullets with icons rendering (single column + two columns)
9. Quote icon rendering
10. Tests for all of the above
