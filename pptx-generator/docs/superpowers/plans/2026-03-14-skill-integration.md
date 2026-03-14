# Skill Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform pptx-generator into a distributable Claude Code skill with clean API, documentation, and proper packaging.

**Architecture:** Extract orchestration logic from `cli.ts` into `src/index.ts` as a programmatic API. Create `SKILL.md` as the skill entry point referencing that API. Add designer guide and AST schema documentation in `references/`. Clean up `package.json` for ESM distribution. Pre-generate `assets/default-capabilities.json` during template build.

**Tech Stack:** TypeScript, Node.js ESM, Zod, JSZip, Vitest

---

## Chunk 1: Programmatic API + Manifest Pre-generation

### Task 1: Create `src/index.ts` — Programmatic API

**Files:**
- Create: `pptx-generator/src/index.ts`
- Modify: `pptx-generator/src/cli.ts` (refactor to use new API)
- Create: `pptx-generator/tests/index.test.ts`

- [ ] **Step 1: Write the failing tests for `src/index.ts`**

```typescript
// tests/index.test.ts
import { describe, it, expect } from 'vitest';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  generateFromAST,
  generateFromData,
  validateTemplate,
  buildPrompt,
  getDefaultTemplatePath,
  getDefaultManifest,
} from '../src/index.js';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = path.resolve(__dirname, '../assets/default-template.pptx');

describe('validateTemplate', () => {
  it('returns a validation report for the default template', async () => {
    const report = await validateTemplate(TEMPLATE_PATH);
    expect(report.results).toBeDefined();
    expect(report.manifest).toBeDefined();
    expect(report.manifest.tier).toBeGreaterThanOrEqual(1);
    expect(report.hasErrors).toBe(false);
  });
});

describe('generateFromAST', () => {
  it('generates a .pptx buffer from a valid AST', async () => {
    const ast = {
      title: 'Test Presentation',
      slides: [
        {
          layout: 'title' as const,
          elements: [
            { type: 'title' as const, text: 'Hello World' },
            { type: 'subtitle' as const, text: 'A test' },
          ],
        },
        {
          layout: 'bullets' as const,
          elements: [
            { type: 'title' as const, text: 'Points' },
            { type: 'bullets' as const, items: ['One', 'Two', 'Three'] },
          ],
        },
      ],
    };
    const buffer = await generateFromAST(ast);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('accepts a custom template path', async () => {
    const ast = {
      title: 'Custom Template Test',
      slides: [
        {
          layout: 'title' as const,
          elements: [{ type: 'title' as const, text: 'Hello' }],
        },
      ],
    };
    const buffer = await generateFromAST(ast, TEMPLATE_PATH);
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('throws on invalid AST', async () => {
    await expect(generateFromAST({ title: 123 } as any)).rejects.toThrow();
  });
});

describe('generateFromData', () => {
  it('generates a .pptx from CSV string', async () => {
    const csv = 'Metric,Value\nRevenue,1.2M\nUsers,50K';
    const buffer = await generateFromData(csv, 'csv', 'KPI Report');
    expect(buffer).toBeInstanceOf(Buffer);
  });

  it('generates a .pptx from JSON data', async () => {
    const jsonData = [
      { date: '2026-Q1', label: 'Launch', status: 'done' },
      { date: '2026-Q2', label: 'Scale', status: 'planned' },
    ];
    const buffer = await generateFromData(jsonData, 'json', 'Timeline');
    expect(buffer).toBeInstanceOf(Buffer);
  });
});

describe('buildPrompt', () => {
  it('returns a prompt string with the brief embedded', () => {
    const manifest = getDefaultManifest();
    const prompt = buildPrompt(manifest, 'A presentation about AI');
    expect(prompt).toContain('AI');
    expect(prompt).toContain('JSON');
    expect(typeof prompt).toBe('string');
  });
});

describe('getDefaultTemplatePath', () => {
  it('returns a path that exists', async () => {
    const p = getDefaultTemplatePath();
    const stat = await fs.stat(p);
    expect(stat.isFile()).toBe(true);
  });
});

describe('getDefaultManifest', () => {
  it('returns a valid manifest object', () => {
    const m = getDefaultManifest();
    expect(m.tier).toBeGreaterThanOrEqual(1);
    expect(m.supported_layouts.length).toBeGreaterThan(0);
    expect(m.template).toBe('default-template.pptx');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd pptx-generator && npx vitest run tests/index.test.ts`
Expected: FAIL — module `../src/index.js` does not export the functions.

- [ ] **Step 3: Implement `src/index.ts`**

```typescript
// src/index.ts
import * as path from 'path';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { readTemplate } from './validator/templateReader.js';
import { runValidation } from './validator/engine.js';
import { generateManifest } from './validator/manifestGenerator.js';
import { generateDemo } from './validator/demoGenerator.js';
import { validateAST } from './parser/astValidator.js';
import { buildASTPrompt } from './parser/promptParser.js';
import { parseCSV, parseJSONData } from './parser/dataParser.js';
import { transformPresentation } from './transform/index.js';
import { renderToBuffer } from './renderer/pptxRenderer.js';
import type { TemplateCapabilities } from './schema/capabilities.js';
import type { Presentation } from './schema/presentation.js';
import type { ValidationResult } from './validator/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE = path.resolve(__dirname, '../assets/default-template.pptx');
const DEFAULT_MANIFEST_PATH = path.resolve(__dirname, '../assets/default-capabilities.json');

let cachedDefaultManifest: TemplateCapabilities | null = null;

/**
 * Returns the absolute path to the built-in default template.
 */
export function getDefaultTemplatePath(): string {
  return DEFAULT_TEMPLATE;
}

/**
 * Returns the pre-generated manifest for the default template.
 * Loads from assets/default-capabilities.json on first call, then caches.
 */
export function getDefaultManifest(): TemplateCapabilities {
  if (cachedDefaultManifest) return cachedDefaultManifest;
  const raw = readFileSync(DEFAULT_MANIFEST_PATH, 'utf-8');
  cachedDefaultManifest = JSON.parse(raw);
  return cachedDefaultManifest!;
}

/**
 * Validates a .pptx template file.
 * Returns validation results, manifest, and optionally a demo buffer.
 */
export async function validateTemplate(
  templatePath: string,
  options?: { demo?: boolean },
): Promise<{
  results: ValidationResult[];
  manifest: TemplateCapabilities;
  hasErrors: boolean;
  hasWarnings: boolean;
  demoBuffer?: Buffer;
}> {
  const template = await readTemplate(templatePath);
  const results = runValidation(template);
  const manifest = generateManifest(template, path.basename(templatePath));

  let demoBuffer: Buffer | undefined;
  if (options?.demo) {
    demoBuffer = await generateDemo(manifest, templatePath);
  }

  return {
    results,
    manifest,
    hasErrors: results.some(r => r.status === 'fail' && r.severity === 'ERROR'),
    hasWarnings: results.some(r => r.status === 'fail' && r.severity === 'WARNING'),
    demoBuffer,
  };
}

/**
 * Generates a .pptx from a Presentation AST object.
 * Uses the default template if none provided.
 */
export async function generateFromAST(
  ast: unknown,
  templatePath?: string,
): Promise<Buffer> {
  const result = validateAST(ast);
  if (!result.success) {
    throw new Error(`Invalid AST:\n${result.errors.join('\n')}`);
  }

  const tplPath = templatePath ?? DEFAULT_TEMPLATE;
  const manifest = templatePath
    ? generateManifest(await readTemplate(tplPath), path.basename(tplPath))
    : getDefaultManifest();
  const enriched = transformPresentation(result.data, manifest);
  return renderToBuffer(enriched, tplPath);
}

/**
 * Generates a .pptx from raw data (CSV string or JSON object).
 * Uses the default template if none provided.
 */
export async function generateFromData(
  data: string | unknown,
  format: 'csv' | 'json',
  title: string,
  templatePath?: string,
): Promise<Buffer> {
  let presentation: Presentation;
  if (format === 'csv') {
    presentation = parseCSV(data as string, title);
  } else {
    presentation = parseJSONData(data, title);
  }

  const validationResult = validateAST(presentation);
  if (!validationResult.success) {
    throw new Error(`Data-generated AST errors:\n${validationResult.errors.join('\n')}`);
  }

  const tplPath = templatePath ?? DEFAULT_TEMPLATE;
  const manifest = templatePath
    ? generateManifest(await readTemplate(tplPath), path.basename(tplPath))
    : getDefaultManifest();
  const enriched = transformPresentation(validationResult.data, manifest);
  return renderToBuffer(enriched, tplPath);
}

/**
 * Builds the system prompt for Claude to generate an AST from a user brief.
 * Uses the default manifest if none provided.
 */
export function buildPrompt(
  capabilities: TemplateCapabilities,
  brief: string,
): string {
  return buildASTPrompt(capabilities, brief);
}

// Re-export types for consumers
export type { Presentation, Slide, Element, LayoutType } from './schema/presentation.js';
export type { TemplateCapabilities } from './schema/capabilities.js';
export type { ValidationResult } from './validator/types.js';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd pptx-generator && npx vitest run tests/index.test.ts`
Expected: PASS (all tests green)

- [ ] **Step 5: Refactor `cli.ts` to use the new API**

Replace the inline logic in `cli.ts` with calls to `validateTemplate()`, `generateFromAST()`, and `generateFromData()` from `./index.js`. Keep only CLI-specific concerns (argument parsing, file I/O, console output, process.exit).

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `cd pptx-generator && npx vitest run`
Expected: All existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add pptx-generator/src/index.ts pptx-generator/tests/index.test.ts pptx-generator/src/cli.ts
git commit -m "feat: add programmatic API in src/index.ts and refactor CLI to use it"
```

### Task 2: Pre-generate default manifest in `buildDefaultTemplate.ts`

**Files:**
- Modify: `pptx-generator/scripts/buildDefaultTemplate.ts`
- Verify: `pptx-generator/assets/default-capabilities.json` (created by script)

- [ ] **Step 1: Add manifest generation to `buildDefaultTemplate.ts`**

After writing the template .pptx, add code to:
1. Import `readTemplate` and `generateManifest`
2. Read the just-written template
3. Generate the manifest
4. Write it to `assets/default-capabilities.json`

Add at the end of the `main()` function:

```typescript
// Generate the pre-computed manifest
const { readTemplate } = await import('../src/validator/templateReader.js');
const { generateManifest } = await import('../src/validator/manifestGenerator.js');
const templateInfo = await readTemplate(OUTPUT_PATH);
const manifest = generateManifest(templateInfo, 'default-template.pptx');
const manifestPath = path.resolve(__dirname, '../assets/default-capabilities.json');
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Manifest written to ${manifestPath}`);
```

- [ ] **Step 2: Run the build script**

Run: `cd pptx-generator && npx tsx scripts/buildDefaultTemplate.ts`
Expected: Both `assets/default-template.pptx` and `assets/default-capabilities.json` are created.

- [ ] **Step 3: Verify manifest content**

Run: `cat pptx-generator/assets/default-capabilities.json | head -20`
Expected: Valid JSON with tier >= 2, 6 supported layouts.

- [ ] **Step 4: Run full test suite**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add pptx-generator/scripts/buildDefaultTemplate.ts pptx-generator/assets/default-capabilities.json
git commit -m "feat: pre-generate default-capabilities.json during template build"
```

---

## Chunk 2: SKILL.md

### Task 3: Create `SKILL.md` — Skill entry point

**Files:**
- Create: `pptx-generator/SKILL.md`

- [ ] **Step 1: Write `SKILL.md`**

The SKILL.md must contain:
- Skill name and one-line description
- Trigger keywords (présentation, deck, slides, PowerPoint, valider un gabarit, template)
- Instructions for **validation mode**: how to call `validateTemplate()` via CLI
- Instructions for **generation mode (prompt libre)**: use `buildPrompt()` with `getDefaultManifest()` to build the system prompt, generate JSON AST, then call `generateFromAST()`
- Instructions for **generation mode (AST/data)**: call `generateFromAST()` or `generateFromData()` directly
- Reference to default template and how user can provide their own
- Example invocations
- File path conventions (relative to skill root)

Structure:

```markdown
---
name: pptx-generator
description: Generate professional PowerPoint presentations from prompts, AST, or data, with template validation
---

# Skill: pptx-generator

[detailed instructions for Claude on how to use the skill]
```

- [ ] **Step 2: Verify SKILL.md is loadable**

Verify the file has valid YAML frontmatter and the content references actual exports from `src/index.ts`.

- [ ] **Step 3: Commit**

```bash
git add pptx-generator/SKILL.md
git commit -m "feat: add SKILL.md entry point for Claude Code skill"
```

---

## Chunk 3: Documentation

### Task 4: Create `references/guide-designer.md`

**Files:**
- Create: `pptx-generator/references/guide-designer.md`

- [ ] **Step 1: Write designer guide**

Content:
- Purpose: guide for designers creating custom .pptx templates
- Layout naming convention: `LAYOUT_TITLE`, `LAYOUT_SECTION`, `LAYOUT_BULLETS`, `LAYOUT_GENERIC`, `LAYOUT_TWO_COLUMNS`, `LAYOUT_TIMELINE`, `LAYOUT_ARCHITECTURE`
- Required placeholders per layout with type and index (reference the `LAYOUT_PPT_NAME_TO_TYPE` mapping and placeholder rules from `placeholderRules.ts`)
- Tier system explained:
  - Tier 1 (minimum): title, section, bullets, generic — 4 layouts, ERROR if missing
  - Tier 2 (recommended): + twoColumns, timeline — WARNING if missing
  - Tier 3 (full): + architecture and all advanced layouts
- How to validate: `npx tsx src/cli.ts validate my-template.pptx --demo`
- Dimension constraints: 16:9, margins >= 0.5" (457200 EMU)
- Theme best practices: WCAG AA contrast, readable fonts, 6 accent colors
- Common validation errors and how to fix them

- [ ] **Step 2: Commit**

```bash
git add pptx-generator/references/guide-designer.md
git commit -m "docs: add template designer guide"
```

### Task 5: Create `references/ast-schema.md`

**Files:**
- Create: `pptx-generator/references/ast-schema.md`

- [ ] **Step 1: Write AST schema documentation**

Content:
- Full schema description derived from `src/schema/presentation.ts`
- Every element type with all fields, types, and constraints
- Examples for each layout type showing a complete slide JSON
- Transform-added fields (`_resolvedLayout`, `_warnings`, `_fontSizeOverride`, `_splitIndex`)
- Complete multi-slide example JSON
- Content rules summary (max 5 bullets, max 12 words, max 60 chars title)

- [ ] **Step 2: Commit**

```bash
git add pptx-generator/references/ast-schema.md
git commit -m "docs: add AST schema reference"
```

---

## Chunk 4: Packaging

### Task 6: Fix `package.json` and add npm scripts

**Files:**
- Modify: `pptx-generator/package.json`
- Create: `pptx-generator/.npmignore`
- Modify: `pptx-generator/tsconfig.json` (verify outDir setting)

- [ ] **Step 1: Read current `tsconfig.json`**

Check compiler options, especially `outDir`, `module`, `target`.

- [ ] **Step 2: Clean up `package.json`**

Changes:
- Set `"type": "module"` (code already uses ESM imports with `.js` extensions)
- Set `"main": "src/index.ts"` (for tsx/ts-node consumers)
- Move dev-only dependencies out of `dependencies` into `devDependencies` (esbuild, vite, lightningcss, postcss, vitest-related packages like tinybench, tinyrainbow, etc.)
- Keep only actual runtime dependencies: `commander`, `jszip`, `xml2js`, `xmlbuilder`, `zod`
- Remove `pptxgenjs` (renderer uses JSZip directly, not pptxgenjs)
- Add scripts:
  ```json
  "scripts": {
    "test": "vitest run",
    "build:template": "tsx scripts/buildDefaultTemplate.ts",
    "validate": "tsx src/cli.ts validate",
    "generate": "tsx src/cli.ts generate"
  }
  ```

- [ ] **Step 3: Create `.npmignore`**

```
tests/
scripts/
docs/
*.test.ts
tsconfig.json
vitest.config.ts
```

- [ ] **Step 4: Delete `node_modules` and reinstall to verify**

Run: `cd pptx-generator && rm -rf node_modules && npm install`
Expected: Install succeeds, no missing dependency errors.

- [ ] **Step 5: Run tests to verify nothing broke**

Run: `cd pptx-generator && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Verify CLI still works**

Run: `cd pptx-generator && npx tsx src/cli.ts validate assets/default-template.pptx`
Expected: Validation report output, no errors.

- [ ] **Step 7: Update CLAUDE.md stack section**

Replace "PptxGenJS pour la génération PPTX" with "JSZip + raw OOXML pour la génération PPTX" in `pptx-generator/CLAUDE.md` since pptxgenjs is no longer used.

- [ ] **Step 8: Commit**

```bash
git add pptx-generator/package.json pptx-generator/.npmignore pptx-generator/CLAUDE.md
git commit -m "chore: clean up package.json, add npm scripts, remove unused deps, update CLAUDE.md"
```

---

## Chunk 5: VS Code / Cowork Integration Research

### Task 7: Research integration requirements

**Files:**
- Create: `pptx-generator/references/integration-notes.md`

No code changes — research only. Document:

- [ ] **Step 1: Research Claude Code skill loading**

Investigate how Claude Code loads skills:
- Where SKILL.md is expected (project root vs subdirectory)
- How skills reference local assets (relative paths from SKILL.md)
- How to install a skill from a git repo (`claude skill add` or similar)
- Any size/structure constraints

- [ ] **Step 2: Research VS Code Claude extension**

Investigate:
- Does the VS Code extension support custom skills?
- How does it discover SKILL.md?
- Any differences from CLI skill loading?

- [ ] **Step 3: Research Cowork**

Investigate:
- Does Cowork support custom skills?
- How does skill discovery work in Cowork?
- Any special requirements?

- [ ] **Step 4: Document findings**

Write `references/integration-notes.md` with findings, including:
- What works today
- What needs additional work
- Recommended installation instructions

- [ ] **Step 5: Commit**

```bash
git add pptx-generator/references/integration-notes.md
git commit -m "docs: add integration research notes for VS Code and Cowork"
```
