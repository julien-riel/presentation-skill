# Fix Default Template & Implement Parser Layer

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken default template to be a valid Tier 2 template, implement the Parser layer (astValidator, promptParser, dataParser), and wire up the CLI `generate` command.

**Architecture:** A build script generates the default .pptx template from raw OOXML XML via JSZip, ensuring correct layout names and placeholder indexes. The Parser layer provides three modules: Zod-based AST validation, a system prompt builder for skill-mode generation, and an algorithmic CSV/JSON-to-AST converter. The CLI `generate` command accepts `--ast` or `--data` input and runs the full pipeline.

**Tech Stack:** TypeScript, JSZip (template building + CSV doesn't need extra deps), Zod (AST validation), Commander.js (CLI), Vitest (tests)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `scripts/buildDefaultTemplate.ts` | Generates `assets/default-template.pptx` as valid Tier 2 OOXML |
| `src/parser/astValidator.ts` | Validates raw JSON against PresentationSchema, returns typed result or errors |
| `src/parser/promptParser.ts` | Builds system prompt for Claude skill-mode AST generation |
| `src/parser/dataParser.ts` | Converts CSV/JSON data files to AST algorithmically |
| `src/parser/index.ts` | Barrel export for parser module |
| `tests/parser/astValidator.test.ts` | Tests for AST validation (valid/invalid cases) |
| `tests/parser/promptParser.test.ts` | Tests that prompt contains schema, layouts, rules |
| `tests/parser/dataParser.test.ts` | Tests CSV→KPI/timeline, JSON→architecture detection |
| `tests/validator/defaultTemplate.test.ts` | Validates rebuilt template passes all rules |

### Modified Files
| File | Change |
|------|--------|
| `src/cli.ts` | Replace generate stub with full `--ast`/`--data` implementation |
| `assets/default-template.pptx` | Rebuilt by script (binary, not hand-edited) |
| `CLAUDE.md` | Update template section to reflect build-script approach |

---

## Chunk 1: Rebuild Default Template

### Task 1: Build script to generate Tier 2 default template

**Files:**
- Create: `scripts/buildDefaultTemplate.ts`
- Overwrite: `assets/default-template.pptx`

The template must contain 6 slide layouts with correct names and placeholder indexes per the spec section 4.2:
- `LAYOUT_TITLE`: ctrTitle@0, subTitle@1
- `LAYOUT_SECTION`: title@0, body@1
- `LAYOUT_BULLETS`: title@0, body@1 (body height >= 2286000 EMU)
- `LAYOUT_GENERIC`: title@0, body@1
- `LAYOUT_TWO_COLUMNS`: title@0, body@1 (left), body@2 (right, non-overlapping)
- `LAYOUT_TIMELINE`: title@0, body@1 (canvas, >= 60% slide height)

Slide dimensions: 12192000 x 6858000 EMU (16:9).
Theme: 6 accent colors, title font "Calibri", body font "Calibri".
All placeholders at least 457200 EMU (0.5") from edges.

- [ ] **Step 1: Write the build script**

Create `scripts/buildDefaultTemplate.ts` that uses JSZip to assemble a valid .pptx with:
- `[Content_Types].xml` — declares slideLayout, slideMaster, theme, presentation content types
- `_rels/.rels` — root relationships
- `ppt/presentation.xml` — slide dimensions, slideMaster reference
- `ppt/_rels/presentation.xml.rels` — links to slideMaster, theme
- `ppt/slideMasters/slideMaster1.xml` — references all 6 slideLayouts
- `ppt/slideMasters/_rels/slideMaster1.xml.rels` — links to slideLayouts + theme
- `ppt/slideLayouts/slideLayout1.xml` through `slideLayout6.xml` — each with correct `cSld name=`, correct `p:ph` type and idx attributes, and `a:xfrm` position/extent
- `ppt/slideLayouts/_rels/slideLayout*.xml.rels` — back-reference to slideMaster
- `ppt/theme/theme1.xml` — fontScheme (Calibri major+minor), clrScheme (6 accents with sufficient contrast)

Each layout XML must have shapes (`p:sp`) with `p:nvSpPr/p:nvPr/p:ph` elements that match the expected type and idx. Position offsets (`a:off`) must be >= 457200 from edges. Canvas placeholders (TIMELINE) must have cy >= 60% of 6858000 = 4114800 EMU.

- [ ] **Step 2: Run the build script to generate the template**

```bash
cd /home/julien/src/presentation-skill/pptx-generator && npx tsx scripts/buildDefaultTemplate.ts
```

Expected: `assets/default-template.pptx` is written.

- [ ] **Step 3: Write test that validates the rebuilt template**

Create `tests/validator/defaultTemplate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readTemplate } from '../../src/validator/templateReader.ts';
import { runValidation } from '../../src/validator/engine.ts';
import { generateManifest } from '../../src/validator/manifestGenerator.ts';
import * as path from 'path';

const TEMPLATE_PATH = path.resolve(__dirname, '../../assets/default-template.pptx');

describe('default-template.pptx', () => {
  it('should pass validation with zero errors', async () => {
    const template = await readTemplate(TEMPLATE_PATH);
    const results = runValidation(template);
    const errors = results.filter(r => r.status === 'fail' && r.severity === 'ERROR');
    expect(errors).toEqual([]);
  });

  it('should be classified as Tier 2', async () => {
    const template = await readTemplate(TEMPLATE_PATH);
    const manifest = generateManifest(template, 'default-template.pptx');
    expect(manifest.tier).toBe(2);
  });

  it('should support all 6 Tier 2 layouts', async () => {
    const template = await readTemplate(TEMPLATE_PATH);
    const manifest = generateManifest(template, 'default-template.pptx');
    expect(manifest.supported_layouts).toContain('title');
    expect(manifest.supported_layouts).toContain('section');
    expect(manifest.supported_layouts).toContain('bullets');
    expect(manifest.supported_layouts).toContain('generic');
    expect(manifest.supported_layouts).toContain('twoColumns');
    expect(manifest.supported_layouts).toContain('timeline');
  });

  it('should have zero warnings for dimensions', async () => {
    const template = await readTemplate(TEMPLATE_PATH);
    const results = runValidation(template);
    const dimWarnings = results.filter(
      r => r.id.startsWith('DIM-') && r.status === 'fail'
    );
    expect(dimWarnings).toEqual([]);
  });
});
```

- [ ] **Step 4: Run tests to verify template passes**

```bash
npx vitest run tests/validator/defaultTemplate.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Update CLAUDE.md template section**

Replace the "Gabarit de test" section in `CLAUDE.md` with:

```
## Gabarit de test
assets/default-template.pptx est généré par scripts/buildDefaultTemplate.ts.
Pour le reconstruire: npx tsx scripts/buildDefaultTemplate.ts
Ne pas modifier le .pptx à la main — toujours passer par le script.
```

- [ ] **Step 7: Commit**

```bash
git add scripts/buildDefaultTemplate.ts assets/default-template.pptx tests/validator/defaultTemplate.test.ts CLAUDE.md
git commit -m "fix: rebuild default template as valid Tier 2 with correct layout names and indexes"
```

---

## Chunk 2: Parser Layer — AST Validator

### Task 2: Implement astValidator.ts

**Files:**
- Create: `src/parser/astValidator.ts`
- Create: `tests/parser/astValidator.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/parser/astValidator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateAST } from '../../src/parser/astValidator.ts';

describe('validateAST', () => {
  it('should accept a valid minimal AST', () => {
    const result = validateAST({
      title: 'Test',
      slides: [
        {
          layout: 'title',
          elements: [{ type: 'title', text: 'Hello' }],
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Test');
      expect(result.data.slides).toHaveLength(1);
    }
  });

  it('should reject AST missing required title field', () => {
    const result = validateAST({ slides: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('title');
    }
  });

  it('should reject AST with invalid layout type', () => {
    const result = validateAST({
      title: 'Test',
      slides: [{ layout: 'nonexistent', elements: [] }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject AST with invalid element type', () => {
    const result = validateAST({
      title: 'Test',
      slides: [
        {
          layout: 'bullets',
          elements: [{ type: 'invalid', text: 'x' }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('should accept a full AST with all element types', () => {
    const result = validateAST({
      title: 'Full Test',
      metadata: { author: 'Test', date: '2026-03-14' },
      slides: [
        {
          layout: 'title',
          elements: [
            { type: 'title', text: 'Title' },
            { type: 'subtitle', text: 'Sub' },
          ],
        },
        {
          layout: 'bullets',
          elements: [
            { type: 'title', text: 'Bullets' },
            { type: 'bullets', items: ['A', 'B'] },
          ],
        },
        {
          layout: 'timeline',
          elements: [
            { type: 'title', text: 'TL' },
            {
              type: 'timeline',
              events: [
                { date: '2026-Q1', label: 'Start', status: 'done' },
              ],
            },
          ],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should parse from a JSON string', () => {
    const json = JSON.stringify({
      title: 'From String',
      slides: [{ layout: 'generic', elements: [{ type: 'title', text: 'Hi' }] }],
    });
    const result = validateAST(json);
    expect(result.success).toBe(true);
  });

  it('should reject malformed JSON string', () => {
    const result = validateAST('not valid json {{{');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('JSON');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/parser/astValidator.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement astValidator.ts**

Create `src/parser/astValidator.ts`:

```typescript
import { PresentationSchema, type Presentation } from '../schema/presentation.js';

type ValidateSuccess = { success: true; data: Presentation };
type ValidateFailure = { success: false; errors: string[] };
type ValidateResult = ValidateSuccess | ValidateFailure;

/**
 * Validates input (object or JSON string) against the Presentation AST schema.
 * Returns typed success with parsed data, or failure with human-readable errors.
 */
export function validateAST(input: unknown): ValidateResult {
  let data: unknown = input;

  // If string, try to parse as JSON first
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return { success: false, errors: ['Invalid JSON: could not parse input string'] };
    }
  }

  const result = PresentationSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  return { success: false, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/parser/astValidator.test.ts
```

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/parser/astValidator.ts tests/parser/astValidator.test.ts
git commit -m "feat: add AST validator with Zod schema validation and JSON string support"
```

---

## Chunk 3: Parser Layer — Prompt Parser & Data Parser

### Task 3: Implement promptParser.ts

**Files:**
- Create: `src/parser/promptParser.ts`
- Create: `tests/parser/promptParser.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/parser/promptParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildASTPrompt } from '../../src/parser/promptParser.ts';
import type { TemplateCapabilities } from '../../src/schema/capabilities.ts';

const MOCK_CAPABILITIES: TemplateCapabilities = {
  template: 'test.pptx',
  generated_at: '2026-03-14T00:00:00Z',
  validator_version: '1.0.0',
  tier: 2,
  supported_layouts: ['title', 'section', 'bullets', 'generic', 'twoColumns', 'timeline'],
  unsupported_layouts: ['architecture', 'chart', 'table', 'kpi', 'quote', 'imageText', 'roadmap', 'process', 'comparison'],
  fallback_map: { architecture: 'bullets', kpi: 'bullets', chart: 'bullets', table: 'bullets', quote: 'bullets', imageText: 'twoColumns', roadmap: 'timeline', process: 'timeline', comparison: 'twoColumns' },
  placeholders: {},
  theme: { title_font: 'Calibri', body_font: 'Calibri', accent_colors: ['#1E3A5F', '#2C7DA0', '#E76F51'] },
  slide_dimensions: { width_emu: 12192000, height_emu: 6858000 },
};

describe('buildASTPrompt', () => {
  it('should include the AST JSON schema structure', () => {
    const prompt = buildASTPrompt(MOCK_CAPABILITIES, 'Make a presentation about AI');
    expect(prompt).toContain('"layout"');
    expect(prompt).toContain('"elements"');
    expect(prompt).toContain('"title"');
    expect(prompt).toContain('"slides"');
  });

  it('should list only supported layouts', () => {
    const prompt = buildASTPrompt(MOCK_CAPABILITIES, 'test');
    expect(prompt).toContain('title');
    expect(prompt).toContain('bullets');
    expect(prompt).toContain('twoColumns');
    expect(prompt).toContain('timeline');
    // Should NOT list unsupported layouts in the Available Layouts section
    const layoutSection = prompt.split('## Available Layouts')[1]?.split('##')[0] ?? '';
    expect(layoutSection).not.toContain('"architecture"');
    expect(layoutSection).not.toContain('"kpi"');
  });

  it('should include content rules (max bullets, max words)', () => {
    const prompt = buildASTPrompt(MOCK_CAPABILITIES, 'test');
    expect(prompt).toContain('5');   // max bullets
    expect(prompt).toContain('12');  // max words per bullet
  });

  it('should include the user brief', () => {
    const brief = 'Create a presentation about project milestones';
    const prompt = buildASTPrompt(MOCK_CAPABILITIES, brief);
    expect(prompt).toContain(brief);
  });

  it('should produce valid JSON-parseable schema example', () => {
    const prompt = buildASTPrompt(MOCK_CAPABILITIES, 'test');
    // Extract the JSON example block from the prompt
    const jsonMatch = prompt.match(/```json\n([\s\S]*?)\n```/);
    expect(jsonMatch).not.toBeNull();
    if (jsonMatch) {
      expect(() => JSON.parse(jsonMatch[1])).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/parser/promptParser.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement promptParser.ts**

Create `src/parser/promptParser.ts`:

```typescript
import type { TemplateCapabilities } from '../schema/capabilities.js';

/**
 * Builds a system prompt for Claude to generate a Presentation AST
 * from a user's free-text brief.
 *
 * This is used in skill mode (Claude-in-conversation), not via API.
 * The caller passes this prompt as context and the user brief as the request.
 */
export function buildASTPrompt(
  capabilities: TemplateCapabilities,
  userBrief: string,
): string {
  const layouts = capabilities.supported_layouts;

  const schemaExample = JSON.stringify({
    title: "Presentation Title",
    metadata: { author: "Author", date: "2026-03-14" },
    slides: [
      {
        layout: "title",
        elements: [
          { type: "title", text: "Main Title" },
          { type: "subtitle", text: "Subtitle here" }
        ],
        notes: "Speaker notes for this slide"
      },
      {
        layout: "bullets",
        elements: [
          { type: "title", text: "Slide Title" },
          { type: "bullets", items: ["Point 1", "Point 2", "Point 3"] }
        ]
      }
    ]
  }, null, 2);

  return `You are a presentation content architect. Generate a JSON AST for a PowerPoint presentation.

## Output Format

Respond with ONLY a valid JSON object matching this schema:

\`\`\`json
${schemaExample}
\`\`\`

## Available Layouts

Use ONLY these layouts: ${layouts.map(l => `"${l}"`).join(', ')}

Layout descriptions:
- "title": Title slide with title + subtitle. Use for the opening slide.
- "section": Section divider with title + subtitle. Use to separate major sections.
- "bullets": Slide with title + bullet points. The workhorse layout.
- "generic": Slide with title + free text body. Use for paragraphs or fallback.
${layouts.includes('twoColumns') ? '- "twoColumns": Two-column slide. Use bullets elements with column: "left" or "right".' : ''}
${layouts.includes('timeline') ? '- "timeline": Timeline with events. Use timeline element with date, label, status (done/in-progress/planned).' : ''}
${layouts.includes('architecture') ? '- "architecture": Architecture diagram. Use diagram element with nodes (id, label, layer) and edges (from, to).' : ''}

## Element Types

- { type: "title", text: "..." } — Slide title (required on every slide)
- { type: "subtitle", text: "..." } — Subtitle (for title/section layouts)
- { type: "text", text: "..." } — Free text body (for generic layout)
- { type: "bullets", items: [...], column?: "left"|"right" } — Bullet list
- { type: "timeline", events: [{ date, label, status? }] } — Timeline events
- { type: "diagram", nodes: [{ id, label, layer? }], edges: [{ from, to }] } — Architecture diagram

## Content Rules (STRICT)

- Maximum 5 bullet points per slide. If you need more, create multiple slides.
- Maximum 12 words per bullet point. Be concise.
- Titles must be under 60 characters.
- Every slide MUST have a title element.
- Start with a "title" layout slide and end with a closing slide.
- Aim for 5-12 slides depending on content depth.

## User Brief

${userBrief}

Generate the presentation AST now. Output ONLY the JSON, no explanations.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/parser/promptParser.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/parser/promptParser.ts tests/parser/promptParser.test.ts
git commit -m "feat: add prompt parser for skill-mode AST generation"
```

### Task 4: Implement dataParser.ts

**Files:**
- Create: `src/parser/dataParser.ts`
- Create: `tests/parser/dataParser.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/parser/dataParser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseCSV, parseJSONData, detectDataType } from '../../src/parser/dataParser.ts';
import type { Presentation } from '../../src/schema/presentation.ts';

describe('detectDataType', () => {
  it('should detect numeric columns as kpi', () => {
    const headers = ['Metric', 'Value'];
    const rows = [['Revenue', '1200000'], ['Users', '50000']];
    expect(detectDataType(headers, rows)).toBe('kpi');
  });

  it('should detect date + text columns as timeline', () => {
    const headers = ['Date', 'Milestone'];
    const rows = [['2026-Q1', 'Planning'], ['2026-Q2', 'Dev']];
    expect(detectDataType(headers, rows)).toBe('timeline');
  });

  it('should detect multi-column mixed data as table', () => {
    const headers = ['Name', 'Role', 'Department', 'Status'];
    const rows = [['Alice', 'Dev', 'Eng', 'Active'], ['Bob', 'PM', 'Product', 'Active']];
    expect(detectDataType(headers, rows)).toBe('table');
  });
});

describe('parseCSV', () => {
  it('should parse CSV with numeric data into KPI slides', () => {
    const csv = 'Metric,Value\nRevenue,1200000\nUsers,50000\nChurn,2.1';
    const result = parseCSV(csv, 'KPI Dashboard');
    expect(result.title).toBe('KPI Dashboard');
    expect(result.slides.length).toBeGreaterThanOrEqual(2); // title + content
    const kpiSlide = result.slides.find(s => s.layout === 'kpi');
    expect(kpiSlide).toBeDefined();
  });

  it('should parse CSV with dates into timeline slides', () => {
    const csv = 'Date,Milestone,Status\n2026-Q1,Planning,done\n2026-Q2,Development,in-progress\n2026-Q3,Launch,planned';
    const result = parseCSV(csv, 'Project Timeline');
    const timelineSlide = result.slides.find(s => s.layout === 'timeline');
    expect(timelineSlide).toBeDefined();
  });

  it('should parse CSV with mixed data into table slides', () => {
    const csv = 'Name,Role,Department\nAlice,Developer,Engineering\nBob,Designer,Product';
    const result = parseCSV(csv, 'Team Overview');
    const tableSlide = result.slides.find(s => s.layout === 'table');
    expect(tableSlide).toBeDefined();
  });
});

describe('parseJSONData', () => {
  it('should parse hierarchical JSON into architecture slides', () => {
    const data = {
      nodes: [
        { id: 'web', label: 'Web App', layer: 'Frontend' },
        { id: 'api', label: 'API', layer: 'Backend' },
      ],
      edges: [{ from: 'web', to: 'api' }],
    };
    const result = parseJSONData(data, 'System Architecture');
    const archSlide = result.slides.find(s => s.layout === 'architecture');
    expect(archSlide).toBeDefined();
  });

  it('should parse array of KPI objects into kpi slides', () => {
    const data = [
      { label: 'Revenue', value: '1.2M', unit: 'USD', trend: 'up' },
      { label: 'Users', value: '50K', trend: 'stable' },
    ];
    const result = parseJSONData(data, 'Dashboard');
    const kpiSlide = result.slides.find(s => s.layout === 'kpi');
    expect(kpiSlide).toBeDefined();
  });

  it('should parse array of timeline events into timeline slides', () => {
    const data = [
      { date: '2026-Q1', label: 'Start', status: 'done' },
      { date: '2026-Q2', label: 'Build', status: 'in-progress' },
    ];
    const result = parseJSONData(data, 'Roadmap');
    const timelineSlide = result.slides.find(s => s.layout === 'timeline');
    expect(timelineSlide).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/parser/dataParser.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement dataParser.ts**

Create `src/parser/dataParser.ts`:

```typescript
import type { Presentation, Slide } from '../schema/presentation.js';

const DATE_PATTERN = /^\d{4}[-/]?(Q[1-4]|[01]?\d|[A-Za-z]{3})$/;

/**
 * Detects the dominant data type from CSV headers and rows.
 * Returns: 'kpi' | 'timeline' | 'table'
 */
export function detectDataType(
  headers: string[],
  rows: string[][],
): 'kpi' | 'timeline' | 'table' {
  if (rows.length === 0) return 'table';

  // Check for date column (first column with date-like values)
  const hasDateColumn = headers.some((_, colIdx) => {
    const values = rows.map(r => r[colIdx] ?? '');
    return values.filter(v => DATE_PATTERN.test(v.trim())).length > values.length * 0.5;
  });
  if (hasDateColumn) return 'timeline';

  // Check for numeric "value" pattern: 2 columns, first is label, second is numeric
  if (headers.length === 2) {
    const secondColNumeric = rows.every(r => {
      const val = (r[1] ?? '').replace(/[,$%]/g, '');
      return !isNaN(parseFloat(val));
    });
    if (secondColNumeric) return 'kpi';
  }

  return 'table';
}

/**
 * Parses simple CSV text (no quoting) into headers + rows.
 */
function splitCSV(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));
  return { headers, rows };
}

/**
 * Converts CSV text to a Presentation AST.
 * Detects data type and generates appropriate slides.
 */
export function parseCSV(csv: string, title: string): Presentation {
  const { headers, rows } = splitCSV(csv);
  const dataType = detectDataType(headers, rows);
  const slides: Slide[] = [];

  // Title slide
  slides.push({
    layout: 'title',
    elements: [
      { type: 'title', text: title },
      { type: 'subtitle', text: `Generated from ${rows.length} data rows` },
    ],
  });

  if (dataType === 'kpi') {
    slides.push({
      layout: 'kpi',
      elements: [
        { type: 'title', text: 'Key Metrics' },
        {
          type: 'kpi',
          indicators: rows.map(row => ({
            label: row[0] ?? '',
            value: row[1] ?? '',
            unit: headers[1] ?? undefined,
          })),
        },
      ],
    });
  } else if (dataType === 'timeline') {
    // Find date and label columns
    const dateColIdx = headers.findIndex((_, idx) =>
      rows.filter(r => DATE_PATTERN.test((r[idx] ?? '').trim())).length > rows.length * 0.5
    );
    const labelColIdx = headers.findIndex((_, idx) => idx !== dateColIdx);
    const statusColIdx = headers.findIndex(h => h.toLowerCase() === 'status');

    slides.push({
      layout: 'timeline',
      elements: [
        { type: 'title', text: title },
        {
          type: 'timeline',
          events: rows.map(row => ({
            date: row[dateColIdx] ?? '',
            label: row[labelColIdx] ?? '',
            ...(statusColIdx >= 0 && row[statusColIdx]
              ? { status: row[statusColIdx] as 'done' | 'in-progress' | 'planned' }
              : {}),
          })),
        },
      ],
    });
  } else {
    // Table
    slides.push({
      layout: 'table',
      elements: [
        { type: 'title', text: title },
        {
          type: 'table',
          headers,
          rows,
        },
      ],
    });
  }

  return { title, slides };
}

/**
 * Detects if a JSON object looks like an architecture diagram.
 */
function isArchitectureData(data: unknown): data is { nodes: unknown[]; edges: unknown[] } {
  return (
    typeof data === 'object' &&
    data !== null &&
    'nodes' in data &&
    'edges' in data &&
    Array.isArray((data as Record<string, unknown>).nodes)
  );
}

/**
 * Detects if an array contains KPI-like objects (label + value).
 */
function isKPIArray(data: unknown[]): boolean {
  return data.length > 0 && data.every(
    item => typeof item === 'object' && item !== null && 'label' in item && 'value' in item
  );
}

/**
 * Detects if an array contains timeline-like objects (date + label).
 */
function isTimelineArray(data: unknown[]): boolean {
  return data.length > 0 && data.every(
    item => typeof item === 'object' && item !== null && 'date' in item && 'label' in item
  );
}

/**
 * Converts a JSON data structure to a Presentation AST.
 * Detects structure: architecture graph, KPI array, timeline array.
 */
export function parseJSONData(data: unknown, title: string): Presentation {
  const slides: Slide[] = [
    {
      layout: 'title',
      elements: [
        { type: 'title', text: title },
        { type: 'subtitle', text: 'Generated from structured data' },
      ],
    },
  ];

  if (isArchitectureData(data)) {
    slides.push({
      layout: 'architecture',
      elements: [
        { type: 'title', text: title },
        {
          type: 'diagram',
          nodes: (data.nodes as Array<Record<string, string>>).map(n => ({
            id: n.id ?? '',
            label: n.label ?? '',
            ...(n.layer ? { layer: n.layer } : {}),
          })),
          edges: (data.edges as Array<Record<string, string>>).map(e => ({
            from: e.from ?? '',
            to: e.to ?? '',
          })),
        },
      ],
    });
  } else if (Array.isArray(data)) {
    if (isTimelineArray(data)) {
      slides.push({
        layout: 'timeline',
        elements: [
          { type: 'title', text: title },
          {
            type: 'timeline',
            events: data.map((item: Record<string, string>) => ({
              date: item.date,
              label: item.label,
              ...(item.status ? { status: item.status as 'done' | 'in-progress' | 'planned' } : {}),
            })),
          },
        ],
      });
    } else if (isKPIArray(data)) {
      slides.push({
        layout: 'kpi',
        elements: [
          { type: 'title', text: 'Key Metrics' },
          {
            type: 'kpi',
            indicators: data.map((item: Record<string, string>) => ({
              label: item.label,
              value: item.value,
              ...(item.unit ? { unit: item.unit } : {}),
              ...(item.trend ? { trend: item.trend as 'up' | 'down' | 'stable' } : {}),
            })),
          },
        ],
      });
    } else {
      // Fallback: render as bullets
      slides.push({
        layout: 'bullets',
        elements: [
          { type: 'title', text: 'Data Summary' },
          {
            type: 'bullets',
            items: data.slice(0, 10).map(item => JSON.stringify(item)),
          },
        ],
      });
    }
  }

  return { title, slides };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/parser/dataParser.test.ts
```

Expected: All 9 tests pass.

- [ ] **Step 5: Create barrel export**

Create `src/parser/index.ts`:

```typescript
export { validateAST } from './astValidator.js';
export { buildASTPrompt } from './promptParser.js';
export { parseCSV, parseJSONData, detectDataType } from './dataParser.js';
```

- [ ] **Step 6: Commit**

```bash
git add src/parser/dataParser.ts src/parser/index.ts tests/parser/dataParser.test.ts
git commit -m "feat: add data parser for CSV/JSON to AST conversion"
```

---

## Chunk 4: CLI Generate Command

### Task 5: Wire up CLI generate command

**Files:**
- Modify: `src/cli.ts`

- [ ] **Step 1: Replace the generate stub in cli.ts**

Replace the current stub with:

```typescript
program
  .command('generate')
  .description('Generate a .pptx presentation from AST JSON or data file')
  .option('--ast <path>', 'Path to AST JSON file')
  .option('--data <path>', 'Path to CSV or JSON data file')
  .option('--template <path>', 'Path to .pptx template (default: built-in)')
  .option('-o, --output <path>', 'Output .pptx file path', 'output.pptx')
  .option('--title <title>', 'Presentation title (for data mode)', 'Presentation')
  .action(async (options: {
    ast?: string;
    data?: string;
    template?: string;
    output: string;
    title: string;
  }) => {
    try {
      if (!options.ast && !options.data) {
        console.error('Error: Provide --ast <file> or --data <file>');
        process.exit(1);
      }

      // Load or generate manifest
      let manifest: TemplateCapabilities;
      if (options.template) {
        const template = await readTemplate(options.template);
        manifest = generateManifest(template, path.basename(options.template));
      } else {
        const defaultPath = path.resolve(__dirname, '../assets/default-template.pptx');
        const template = await readTemplate(defaultPath);
        manifest = generateManifest(template, 'default-template.pptx');
      }

      // Parse input to AST
      let presentation: Presentation;
      if (options.ast) {
        const raw = await fs.readFile(options.ast, 'utf-8');
        const result = validateASTFn(raw);
        if (!result.success) {
          console.error('AST validation errors:');
          result.errors.forEach(e => console.error(`  - ${e}`));
          process.exit(1);
        }
        presentation = result.data;
      } else {
        const raw = await fs.readFile(options.data!, 'utf-8');
        const ext = path.extname(options.data!).toLowerCase();
        if (ext === '.csv') {
          presentation = parseCSV(raw, options.title);
        } else {
          const jsonData = JSON.parse(raw);
          presentation = parseJSONData(jsonData, options.title);
        }
        // Validate the generated AST
        const validationResult = validateASTFn(presentation);
        if (!validationResult.success) {
          console.error('Data-generated AST validation errors:');
          validationResult.errors.forEach(e => console.error(`  - ${e}`));
          process.exit(1);
        }
        presentation = validationResult.data;
      }

      // Transform + Render
      const enriched = transformPresentation(presentation, manifest);
      const buffer = await renderToBuffer(enriched);

      await fs.writeFile(options.output, buffer);
      console.log(`Presentation written to ${options.output}`);

      // Report warnings
      const allWarnings = enriched.slides.flatMap(s => s._warnings ?? []);
      if (allWarnings.length > 0) {
        console.log(`\nWarnings (${allWarnings.length}):`);
        allWarnings.forEach(w => console.log(`  - ${w}`));
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });
```

Also add imports at the top of cli.ts:

```typescript
import { validateAST as validateASTFn } from './parser/astValidator.js';
import { parseCSV, parseJSONData } from './parser/dataParser.js';
import { transformPresentation } from './transform/index.js';
import { renderToBuffer } from './renderer/pptxRenderer.js';
import type { TemplateCapabilities } from './schema/capabilities.js';
import type { Presentation } from './schema/presentation.js';
```

- [ ] **Step 2: Test CLI generate with AST input**

Create a temporary test AST file and run the CLI:

```bash
echo '{"title":"CLI Test","slides":[{"layout":"title","elements":[{"type":"title","text":"Hello CLI"},{"type":"subtitle","text":"It works"}]},{"layout":"bullets","elements":[{"type":"title","text":"Points"},{"type":"bullets","items":["One","Two","Three"]}]}]}' > /tmp/test-ast.json
npx tsx src/cli.ts generate --ast /tmp/test-ast.json -o /tmp/cli-output.pptx
```

Expected: "Presentation written to /tmp/cli-output.pptx"

- [ ] **Step 3: Test CLI generate with CSV input**

```bash
echo 'Metric,Value
Revenue,1200000
Users,50000
Churn,2.1' > /tmp/test-data.csv
npx tsx src/cli.ts generate --data /tmp/test-data.csv --title "KPI Report" -o /tmp/cli-csv-output.pptx
```

Expected: "Presentation written to /tmp/cli-csv-output.pptx"

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass (145+ existing + new).

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat: implement CLI generate command with --ast and --data support"
```

---

## Chunk 5: Final Integration

### Task 6: Run full validation and generate demo with fixed template

- [ ] **Step 1: Validate the rebuilt template passes cleanly**

```bash
npx tsx src/cli.ts validate assets/default-template.pptx --demo -o /tmp/default-capabilities.json
```

Expected: Zero errors. Tier 2 detected. Demo PPTX generated.

- [ ] **Step 2: Run the full test suite one final time**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 3: Generate a real demo presentation via CLI**

```bash
echo '{"title":"Project Alpha","metadata":{"author":"Team","date":"2026-03-14"},"slides":[{"layout":"title","elements":[{"type":"title","text":"Project Alpha"},{"type":"subtitle","text":"Q1 2026 Review"}]},{"layout":"section","elements":[{"type":"title","text":"Highlights"},{"type":"subtitle","text":"Key achievements this quarter"}]},{"layout":"bullets","elements":[{"type":"title","text":"Accomplishments"},{"type":"bullets","items":["Launched v2.0 platform","Onboarded 50 enterprise clients","Reduced latency by 40%"]}]},{"layout":"twoColumns","elements":[{"type":"title","text":"Before vs After"},{"type":"bullets","items":["Manual deployment","4h release cycles","Frequent incidents"],"column":"left"},{"type":"bullets","items":["Automated CI/CD","15min releases","99.9% uptime"],"column":"right"}]},{"layout":"timeline","elements":[{"type":"title","text":"2026 Roadmap"},{"type":"timeline","events":[{"date":"Q1","label":"Platform v2","status":"done"},{"date":"Q2","label":"API Gateway","status":"in-progress"},{"date":"Q3","label":"Mobile App","status":"planned"},{"date":"Q4","label":"Analytics","status":"planned"}]}]},{"layout":"bullets","elements":[{"type":"title","text":"Next Steps"},{"type":"bullets","items":["Finalize API documentation","Begin mobile development","Hire 3 senior engineers"]}]}]}' > /tmp/demo-ast.json
npx tsx src/cli.ts generate --ast /tmp/demo-ast.json -o /tmp/project-alpha.pptx
```

Expected: "Presentation written to /tmp/project-alpha.pptx" — 6 slides with title, section, bullets, twoColumns, timeline layouts.

- [ ] **Step 4: Final commit with any remaining adjustments**

```bash
git add -A
git commit -m "chore: final integration verification"
```
