# Quality Pass Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all bugs, align documentation with code, and improve test quality across the pptx-generator codebase.

**Architecture:** Four independent lots executed in sequence: bugs first (since docs must reflect corrected code), then docs + tests + cleanup in parallel. All changes are within `pptx-generator/`.

**Tech Stack:** TypeScript, Vitest, Zod

---

## File Map

**Modify (bugs):**
- `src/validator/manifestGenerator.ts` — fix `computeTier` to return 0 when Tier 1 unsatisfied
- `src/schema/capabilities.ts` — update tier schema min from 1 to 0
- `src/parser/dataParser.ts` — normalize `\r\n` before CSV split
- `src/renderer/pptxRenderer.ts` — eliminate double `readFile` by accepting `TemplateInfo`
- `src/renderer/placeholderFiller.ts` — scope quote icon to layouts that render quote text

**Modify (tests):**
- `tests/validator/manifestGenerator.test.ts` — add `computeTier([]) → 0` test
- `tests/parser/dataParser.test.ts` — add `\r\n` test, replace `as any` with type guards
- `tests/validator/helpers.ts` — dynamic `filePath` per layout
- `tests/renderer/renderer.test.ts` — import shared `makeTier1Capabilities` from helpers
- `tests/transform/transform.test.ts` — import shared `makeTier1Capabilities` from helpers

**Modify (docs):**
- `skills/pptx-generator/SKILL.md` — fix Mode 1 imports, fix diagram icon path
- `README.md` — add `-o` flag to validate CLI
- `references/guide-designer.md` — clarify LAY-006 severity
- `references/ast-schema.md` — document icon-bullets behavior
- `spec-skill-pptx-generator.md` (root) — fix placeholder keys, add missing files to structure

**Create:**
- `tests/validator/capabilitiesHelpers.ts` — shared `makeTier1Capabilities` factory (extracted from renderer/transform tests)

---

## Chunk 1: Bug Fixes

### Task 1: Fix `computeTier` returning 1 for sub-Tier-1 templates

**Files:**
- Modify: `pptx-generator/src/validator/manifestGenerator.ts:35-37`
- Modify: `pptx-generator/src/schema/capabilities.ts:12`
- Test: `pptx-generator/tests/validator/manifestGenerator.test.ts`

- [ ] **Step 1: Write the failing test for computeTier with empty array**

Add to `tests/validator/manifestGenerator.test.ts` inside the `describe('computeTier')` block:

```typescript
it('returns 0 when Tier 1 is not satisfied (empty)', () => {
  expect(computeTier([])).toBe(0);
});

it('returns 0 when Tier 1 is partially satisfied', () => {
  expect(computeTier(['title', 'section'])).toBe(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pptx-generator && npx vitest run tests/validator/manifestGenerator.test.ts`
Expected: FAIL — `computeTier([])` returns 1, not 0

- [ ] **Step 3: Update the schema to allow tier 0**

In `src/schema/capabilities.ts` line 12, change:
```typescript
tier: z.number().int().min(0).max(3),
```

- [ ] **Step 4: Fix computeTier in manifestGenerator.ts**

In `src/validator/manifestGenerator.ts` lines 35-37, change:
```typescript
export function computeTier(supportedTypes: string[]): number {
  const hasTier1 = TIER1_LAYOUTS.every(t => supportedTypes.includes(t));
  if (!hasTier1) return 0;
```

- [ ] **Step 5: Update the existing test that expected 1 for incomplete Tier 1**

In `tests/validator/manifestGenerator.test.ts`, update the existing test:
```typescript
// Old:
it('returns 1 when Tier 1 is incomplete', () => {
  expect(computeTier(['title', 'section'])).toBe(1);
});
// New: remove this test — it's now covered by the "returns 0" test above
```

- [ ] **Step 6: Run all tests to verify**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
cd pptx-generator && git add src/validator/manifestGenerator.ts src/schema/capabilities.ts tests/validator/manifestGenerator.test.ts
git commit -m "fix: computeTier returns 0 when Tier 1 is not satisfied"
```

---

### Task 2: Fix CSV parser not handling `\r\n` line endings

**Files:**
- Modify: `pptx-generator/src/parser/dataParser.ts:76`
- Test: `pptx-generator/tests/parser/dataParser.test.ts`

- [ ] **Step 1: Write the failing test for `\r\n` CSV**

Add to `tests/parser/dataParser.test.ts` inside the `describe('parseCSV')` block:

```typescript
it('should handle Windows-style \\r\\n line endings', () => {
  const csv = 'Name,Role,Department\r\nAlice,Developer,Engineering\r\nBob,Designer,Product';
  const result = parseCSV(csv, 'Team');
  const tableSlide = result.slides.find(s => s.layout === 'table');
  expect(tableSlide).toBeDefined();
  const tableEl = tableSlide!.elements.find(
    (el): el is Extract<typeof el, { type: 'table' }> => el.type === 'table'
  );
  expect(tableEl).toBeDefined();
  expect(tableEl!.rows[0][0]).toBe('Alice');
  expect(tableEl!.rows[0][2]).toBe('Engineering');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd pptx-generator && npx vitest run tests/parser/dataParser.test.ts`
Expected: FAIL — `\r` corrupts field values

- [ ] **Step 3: Fix the splitCSV function**

In `src/parser/dataParser.ts` line 76, change:
```typescript
// Old:
const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean);
// New:
const lines = csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n').filter(Boolean);
```

Note: Removed `.map(l => l.trim())` because `splitCSVLine` already trims each field. Line-level trim would hide leading whitespace bugs.

- [ ] **Step 4: Run all tests to verify**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
cd pptx-generator && git add src/parser/dataParser.ts tests/parser/dataParser.test.ts
git commit -m "fix: normalize \\r\\n line endings in CSV parser"
```

---

### Task 3: Eliminate double template file read in pptxRenderer

**Files:**
- Modify: `pptx-generator/src/renderer/pptxRenderer.ts:35-45`
- Modify: `pptx-generator/src/index.ts:91,121`

The renderer currently calls `fs.readFile(templatePath)` to load the ZIP buffer AND `readTemplate(templatePath)` which reads the file again internally. Fix: pass `TemplateInfo` as a parameter since callers (`generateFromAST`, `generateFromData`) already have it or can easily obtain it.

- [ ] **Step 1: Update renderToBuffer signature to accept TemplateInfo**

In `src/renderer/pptxRenderer.ts`, change the function signature and remove the internal `readTemplate` call:

```typescript
import type { TemplateInfo, LayoutInfo } from '../validator/types.js';
// Remove: import { readTemplate } from '../validator/templateReader.js';

export async function renderToBuffer(
  presentation: Presentation,
  templatePath: string,
  templateInfo: TemplateInfo,
): Promise<Buffer> {
  // Open the template
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  // Remove the second readTemplate call — use the passed templateInfo
  const layoutFileMap = buildLayoutFileMap(templateInfo.layouts);
```

- [ ] **Step 2: Update callers in index.ts**

In `src/index.ts`, update `generateFromAST` (around line 86-91):

```typescript
export async function generateFromAST(
  ast: unknown,
  templatePath?: string,
): Promise<Buffer> {
  const result = validateAST(ast);
  if (!result.success) {
    throw new Error(`Invalid AST:\n${result.errors.join('\n')}`);
  }

  const tplPath = templatePath ?? DEFAULT_TEMPLATE;
  const templateInfo = await readTemplate(tplPath);
  const manifest = templatePath
    ? generateManifest(templateInfo, path.basename(tplPath))
    : getDefaultManifest();
  const enriched = transformPresentation(result.data, manifest);
  return renderToBuffer(enriched, tplPath, templateInfo);
}
```

Similarly update `generateFromData` (around line 116-121):

```typescript
  const tplPath = templatePath ?? DEFAULT_TEMPLATE;
  const templateInfo = await readTemplate(tplPath);
  const manifest = templatePath
    ? generateManifest(templateInfo, path.basename(tplPath))
    : getDefaultManifest();
  const enriched = transformPresentation(validationResult.data, manifest);
  return renderToBuffer(enriched, tplPath, templateInfo);
```

- [ ] **Step 3: Update demoGenerator.ts caller**

Check `src/validator/demoGenerator.ts` for calls to `renderToBuffer` and update similarly — pass the `TemplateInfo` that is already available at that point.

- [ ] **Step 4: Run all tests to verify**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass (renderer tests call `renderToBuffer` and will need updating too)

- [ ] **Step 5: Commit**

```bash
cd pptx-generator && git add src/renderer/pptxRenderer.ts src/index.ts src/validator/demoGenerator.ts
git commit -m "perf: eliminate double template file read in renderToBuffer"
```

---

### Task 4: Scope quote icon to layouts that render quote text

**Files:**
- Modify: `pptx-generator/src/renderer/placeholderFiller.ts:226-241`

The quote icon is currently emitted for **any** layout containing a quote element, but only `bullets`/`generic` layouts actually render the quote text. Other layouts (e.g. `twoColumns`, `default`) drop the quote text silently, producing a floating icon.

- [ ] **Step 1: Add a tracking variable for quote text rendering**

In `buildSlideShapes`, add a `let quoteRendered = false;` flag at the top alongside other variables. Set it to `true` in the `bullets`/`generic` case when a quote element is found and rendered (around line 141-145).

- [ ] **Step 2: Guard the quote icon emission**

Change lines 226-241 from:
```typescript
// Check for quote element with decorative icon (applies to any layout)
const quoteEl = findElement(slide.elements, 'quote');
if (quoteEl?.icon) {
```
to:
```typescript
// Check for quote element with decorative icon (only when quote text was rendered)
if (quoteRendered) {
  const quoteEl = findElement(slide.elements, 'quote');
  if (quoteEl?.icon) {
```
And close the extra brace.

- [ ] **Step 3: Run all tests to verify**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
cd pptx-generator && git add src/renderer/placeholderFiller.ts
git commit -m "fix: only emit quote icon when quote text is rendered"
```

---

## Chunk 2: Test Improvements

### Task 5: Replace `as any` casts with type guards in dataParser.test.ts

**Files:**
- Modify: `pptx-generator/tests/parser/dataParser.test.ts:53,61,69`

- [ ] **Step 1: Replace all `as any` casts**

In `tests/parser/dataParser.test.ts`, replace each occurrence of:
```typescript
const tableEl = tableSlide!.elements.find((el: any) => el.type === 'table') as any;
```
with:
```typescript
const tableEl = tableSlide!.elements.find(
  (el): el is Extract<typeof el, { type: 'table' }> => el.type === 'table'
);
```

Do the same for the `timeline` element cast at line 69:
```typescript
const timelineEl = timelineSlide!.elements.find(
  (el): el is Extract<typeof el, { type: 'timeline' }> => el.type === 'timeline'
);
```

- [ ] **Step 2: Run tests to verify**

Run: `cd pptx-generator && npx vitest run tests/parser/dataParser.test.ts`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
cd pptx-generator && git add tests/parser/dataParser.test.ts
git commit -m "refactor: replace as any with type guards in dataParser tests"
```

---

### Task 6: Fix dynamic filePath in test helpers

**Files:**
- Modify: `pptx-generator/tests/validator/helpers.ts:19`

- [ ] **Step 1: Add a layout index counter**

In `tests/validator/helpers.ts`, change the `makeLayout` function to use unique file paths. The simplest approach: accept an optional index parameter, and make the callers (`makeTier1Template`, `makeTier2Template`) pass incrementing indices.

Change `makeLayout`:
```typescript
let nextLayoutIndex = 1;

export function makeLayout(
  name: string,
  placeholders: Array<{
    index: number;
    type: string;
    x?: number;
    y?: number;
    cx?: number;
    cy?: number;
  }>,
  layoutIndex?: number
): LayoutInfo {
  const idx = layoutIndex ?? nextLayoutIndex++;
  return {
    name,
    filePath: `ppt/slideLayouts/slideLayout${idx}.xml`,
    ...
```

Update `makeTier1Template` and `makeTier2Template` to pass explicit indices:
```typescript
export function makeTier1Template(): TemplateInfo {
  return {
    layouts: [
      makeLayout('LAYOUT_TITLE', [...], 1),
      makeLayout('LAYOUT_SECTION', [...], 2),
      makeLayout('LAYOUT_BULLETS', [...], 3),
      makeLayout('LAYOUT_GENERIC', [...], 4),
    ],
    ...
  };
}

export function makeTier2Template(): TemplateInfo {
  const t1 = makeTier1Template();
  return {
    ...t1,
    layouts: [
      ...t1.layouts,
      makeLayout('LAYOUT_TWO_COLUMNS', [...], 5),
      makeLayout('LAYOUT_TIMELINE', [...], 6),
    ],
  };
}
```

- [ ] **Step 2: Run all validator tests to verify nothing breaks**

Run: `cd pptx-generator && npx vitest run tests/validator/`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
cd pptx-generator && git add tests/validator/helpers.ts
git commit -m "test: use unique filePath per layout in test helpers"
```

---

### Task 7: Deduplicate `makeTier1Capabilities` across test files

**Files:**
- Create: `pptx-generator/tests/helpers/capabilitiesHelpers.ts`
- Modify: `pptx-generator/tests/renderer/renderer.test.ts:14-38`
- Modify: `pptx-generator/tests/transform/transform.test.ts:8-35`

- [ ] **Step 1: Create shared capabilities helper**

Create `tests/helpers/capabilitiesHelpers.ts`:

```typescript
import type { TemplateCapabilities } from '../../src/schema/capabilities.js';

/**
 * Creates a minimal Tier 1 capabilities manifest for tests.
 */
export function makeTier1Capabilities(extra: string[] = []): TemplateCapabilities {
  const supported = ['title', 'section', 'bullets', 'generic', ...extra];
  return {
    template: 'test-template.pptx',
    generated_at: '2026-03-14T00:00:00Z',
    validator_version: '1.0.0',
    tier: 1,
    supported_layouts: supported as TemplateCapabilities['supported_layouts'],
    unsupported_layouts: [],
    fallback_map: {
      kpi: 'bullets',
      chart: 'bullets',
      table: 'bullets',
      quote: 'bullets',
      architecture: 'bullets',
      imageText: 'twoColumns',
      roadmap: 'timeline',
      process: 'timeline',
      comparison: 'twoColumns',
    },
    placeholders: {},
    theme: { title_font: 'Calibri Light', body_font: 'Calibri', accent_colors: ['#1B2A4A', '#2D7DD2', '#17A2B8'] },
    slide_dimensions: { width_emu: 12192000, height_emu: 6858000 },
  };
}
```

- [ ] **Step 2: Update renderer.test.ts to import from shared helper**

In `tests/renderer/renderer.test.ts`, replace the local `makeTier1Capabilities` function (lines 14-38) with:
```typescript
import { makeTier1Capabilities } from '../helpers/capabilitiesHelpers.js';
```

- [ ] **Step 3: Update transform.test.ts to import from shared helper**

In `tests/transform/transform.test.ts`, replace the local `makeTier1Capabilities` function (lines 8-35) with:
```typescript
import { makeTier1Capabilities } from '../helpers/capabilitiesHelpers.js';
```

- [ ] **Step 4: Run all tests to verify**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
cd pptx-generator && git add tests/helpers/capabilitiesHelpers.ts tests/renderer/renderer.test.ts tests/transform/transform.test.ts
git commit -m "refactor: deduplicate makeTier1Capabilities into shared test helper"
```

---

## Chunk 3: Documentation Alignment

### Task 8: Fix SKILL.md — Mode 1 imports and diagram icon path

**Files:**
- Modify: `pptx-generator/skills/pptx-generator/SKILL.md:23-29,148`

- [ ] **Step 1: Fix Mode 1 code snippet (lines 23-29)**

Replace the internal import code block with the public API:
```typescript
import { getDefaultManifest } from './src/index.js';
const manifest = getDefaultManifest();
```

- [ ] **Step 2: Fix diagram element icon path in the reference table (line 148)**

Change:
```
| `diagram` | Diagramme d'architecture | `nodes` (id, label, layer?, `icon?`), `edges` (from, to) |
```
to:
```
| `diagram` | Diagramme d'architecture | `nodes` (id, label, layer?, style?: {icon?}), `edges` (from, to) |
```

- [ ] **Step 3: Commit**

```bash
cd pptx-generator && git add skills/pptx-generator/SKILL.md
git commit -m "docs: fix SKILL.md Mode 1 imports and diagram icon path"
```

---

### Task 9: Fix README.md — add `-o` flag to validate CLI

**Files:**
- Modify: `pptx-generator/README.md:71`

- [ ] **Step 1: Add the -o flag**

Change:
```bash
npx tsx src/cli.ts validate <template.pptx> [--json] [--demo] [--strict]
```
to:
```bash
npx tsx src/cli.ts validate <template.pptx> [--json] [--demo] [--strict] [-o manifest.json]
```

- [ ] **Step 2: Commit**

```bash
cd pptx-generator && git add README.md
git commit -m "docs: add -o flag to validate CLI usage in README"
```

---

### Task 10: Fix guide-designer.md — clarify LAY-006 severity

**Files:**
- Modify: `pptx-generator/references/guide-designer.md:88-92`

- [ ] **Step 1: Clarify Tier 3 severity**

The guide says Tier 3 layout absence emits INFO, but `LAY-006` (LAYOUT_ARCHITECTURE) is WARNING. Change the Tier 3 section:

Replace:
```
Si l'un de ces layouts est absent, le validateur émet une **INFO**. Les diapositives concernées seront automatiquement dégradées via la cascade de fallback.
```
with:
```
L'absence de ces layouts n'est pas bloquante. Le validateur émet un **WARNING** pour les layouts individuels (LAY-006 pour LAYOUT_ARCHITECTURE) et une **INFO** globale via TIER-003 si le Tier 3 n'est pas complet. Les diapositives concernées seront automatiquement dégradées via la cascade de fallback.
```

- [ ] **Step 2: Commit**

```bash
cd pptx-generator && git add references/guide-designer.md
git commit -m "docs: clarify Tier 3 validation severity in guide-designer"
```

---

### Task 11: Document icon-bullets behavior in ast-schema.md

**Files:**
- Modify: `pptx-generator/references/ast-schema.md` (after the bullets section, ~line 155)

- [ ] **Step 1: Add a note about icon-bullets rendering behavior**

After the `bullets` element example (after line 155), add:

```markdown
> **Comportement avec icones** : lorsque le champ `icons` est present et non vide,
> le renderer ne remplit **pas** le placeholder de puces du gabarit. Il genere a
> la place des textboxes explicites avec les images PNG des icones a cote de chaque
> puce. Cela signifie que le style de puces du gabarit (police, taille, couleur,
> indentation) n'est **pas applique** en mode icones. Le style est fixe : 14pt,
> aligne a gauche.
```

- [ ] **Step 2: Commit**

```bash
cd pptx-generator && git add references/ast-schema.md
git commit -m "docs: document icon-bullets rendering behavior in ast-schema"
```

---

### Task 12: Fix spec placeholder keys and project structure

**Files:**
- Modify: `spec-skill-pptx-generator.md:301-307,625-638` (at project root)

- [ ] **Step 1: Fix placeholder key names in section 4.5**

Replace the `placeholders` block (lines 301-307):
```json
"placeholders": {
  "LAYOUT_TITLE": { "CTRTITLE": 0, "SUBTITLE": 1 },
  "LAYOUT_SECTION": { "TITLE": 0, "BODY": 1 },
  "LAYOUT_BULLETS": { "TITLE": 0, "BODY": 1 },
  "LAYOUT_TWO_COLUMNS": { "TITLE": 0, "BODY_1": 1, "BODY_2": 2 },
  "LAYOUT_TIMELINE": { "TITLE": 0, "BODY": 1 },
  "LAYOUT_GENERIC": { "TITLE": 0, "BODY": 1 }
}
```

Add a note: "Les cles de placeholder sont generees a partir du type OOXML en majuscules. Quand plusieurs placeholders partagent le meme type, un suffixe d'index est ajoute (ex: `BODY_1`, `BODY_2`)."

- [ ] **Step 2: Add missing files to project structure (section 10)**

Add after `iconResolver.ts`:
```
│   │   └── xmlHelpers.ts            # Utilitaires XML/OOXML (shapes, namespaces)
```

Add after `manifestRules.ts` in the rules section:
```
│       │   └── ruleHelpers.ts       # Utilitaires partagés des règles de validation
```

- [ ] **Step 3: Commit**

```bash
git add spec-skill-pptx-generator.md
git commit -m "docs: fix placeholder keys and add missing files in spec"
```

---

## Verification

### Task 13: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd pptx-generator && npx vitest run`
Expected: All 196+ tests pass (some new tests added)

- [ ] **Step 2: Verify no regressions in validation**

Run: `cd pptx-generator && npx tsx src/cli.ts validate assets/default-template.pptx --json`
Expected: No errors, tier 2

- [ ] **Step 3: Verify generation still works**

Run: `cd pptx-generator && npx tsx src/cli.ts generate --ast <(echo '{"title":"Test","slides":[{"layout":"title","elements":[{"type":"title","text":"Test"}]}]}') -o /tmp/test-quality-pass.pptx`
Expected: File generated successfully
