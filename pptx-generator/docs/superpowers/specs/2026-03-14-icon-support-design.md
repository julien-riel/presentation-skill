# Icon Support for PPTX Generator

## Summary

Add SVG icon support across all presentation element types using the Lucide icon library, with SVG-to-PNG conversion at render time via `@resvg/resvg-js`. Icons are embedded as PNG images in the PPTX ZIP archive with proper OOXML relationships.

## Dependencies

| Package | Purpose | Justification |
|---|---|---|
| `lucide-static` | SVG icon files (1500+ icons, MIT) | Semantic names match existing `style.icon` field; lightweight (SVG files only) |
| `@resvg/resvg-js` | SVG-to-PNG conversion (Rust/napi-rs) | High-quality rendering, fast, pre-built binaries for all platforms |

## Schema Changes

All additions are optional fields — zero breaking changes.

### `BulletsElementSchema`

```typescript
// Add parallel array of icon names (same length as items)
icons: z.array(z.string()).optional()
```

### `TimelineEventSchema`

```typescript
// Icon replaces the status circle
icon: z.string().optional()
```

### `KpiIndicator` (within `KpiElementSchema`)

```typescript
// Icon displayed above the KPI value
icon: z.string().optional()
```

### `QuoteElementSchema`

```typescript
// Decorative icon (e.g., "quote" guillemets)
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

**Caching:** In-memory `Map<string, Buffer>` keyed by `{name}-{color}-{size}` to avoid redundant conversions within a single render call.

### New Helper: `xmlHelpers.ts` — `pictureShape()`

```typescript
function pictureShape(
  id: number,
  relId: string,
  x: number, y: number,
  cx: number, cy: number,
): string
```

Generates the `<p:pic>` OOXML element that references an embedded image via relationship ID.

### Modified: `placeholderFiller.ts` — `buildSlideShapes()`

New return type to carry image data alongside shapes:

```typescript
interface SlideImage {
  pngBuffer: Buffer;
  relId: string;      // e.g., "rIdImg1"
  mediaPath: string;  // e.g., "ppt/media/image3.png"
}

interface SlideShapeResult {
  shapes: string;
  nextId: number;
  images: SlideImage[];
}
```

The function becomes `async` since icon resolution involves file I/O.

### Modified: `pptxRenderer.ts` — `renderToBuffer()`

Additional responsibilities:
1. Collect `SlideImage[]` from each slide's shape building
2. Write PNG files to `ppt/media/imageN.png` in the ZIP
3. Add image relationships to each slide's `.rels` file
4. Add `<Default Extension="png" ContentType="image/png"/>` to `[Content_Types].xml` (once)

Global image counter ensures unique media file names across all slides.

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

### 4. Quote (`QuoteElement.icon`)

- Decorative icon positioned top-left of the quote text area
- Size: 48px, color: accent1 with visual weight
- Falls back to no decoration when no icon specified

### 5. KPI (`KpiIndicator.icon`)

- Deferred: KPI currently degrades to bullets layout
- When native KPI rendering is implemented, icon will appear above the value
- No regression — icon field is stored in AST but ignored in fallback rendering

## Error Handling

- Unknown icon name: log warning, skip icon (no crash, no broken image)
- `lucide-static` not installed: fail fast at import time with clear error message
- `@resvg/resvg-js` conversion failure: log warning, skip icon
- Invalid color value: fall back to theme accent1

## Testing Strategy

- `iconResolver.ts`: unit tests for known icon, unknown icon, color substitution, caching
- `xmlHelpers.ts`: unit test for `pictureShape()` XML output
- `placeholderFiller.ts`: test that images array is populated when icons present
- `pptxRenderer.ts`: integration test — generate PPTX with icons, verify `ppt/media/` contains PNGs, verify `.rels` contain image relationships
- `schema/presentation.ts`: test that new optional fields validate correctly

## Implementation Order

1. Install `lucide-static` + `@resvg/resvg-js`
2. `iconResolver.ts` — the foundation
3. `pictureShape()` in `xmlHelpers.ts`
4. Update `buildSlideShapes` return type + `pptxRenderer.ts` image embedding
5. Architecture diagram icon rendering
6. Timeline icon rendering
7. Bullets with icons rendering
8. Quote icon rendering
9. Schema updates (add optional icon fields)
10. Tests for all of the above

Note: schema updates (step 9) can happen at any point since all fields are optional and additive.
