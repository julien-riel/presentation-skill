# Quality Recommendations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the 10 quality recommendations identified during codebase evaluation to improve infrastructure, reduce duplication, fix doc/code misalignments, and add missing tests.

**Architecture:** Changes span infrastructure (CI, build), shared utilities extraction, content validation, renderer refactoring, documentation fixes, and new tests. No new dependencies required.

**Tech Stack:** TypeScript, Vitest, GitHub Actions, tsc

---

## Wave 1: Independent foundational changes (parallel)

### Task 1: CI Pipeline
- Create: `.github/workflows/ci.yml`
- GitHub Actions workflow: run `npx vitest run` on push and PR to main

### Task 2: Content validation for diagrams/timelines
- Modify: `src/transform/contentValidator.ts`
- Add `MAX_DIAGRAM_NODES = 8` and `MAX_TIMELINE_EVENTS = 6`
- Add validation + truncation logic in `validateSlideContent`
- Test: `tests/transform/transform.test.ts`

### Task 4: Extract shared drawer utilities
- Create: `src/renderer/drawerHelpers.ts` (statusColor, findElement)
- Modify: `timelineDrawer.ts`, `roadmapDrawer.ts` (import statusColor)
- Modify: `placeholderFiller.ts` (export findElement, compute accentColors once)
- Move `CAT_AX_ID`/`VAL_AX_ID` to `chartXmlHelpers.ts`
- Modify: `barChartBuilder.ts`, `lineChartBuilder.ts` (import from chartXmlHelpers)

### Task 7: Replace __CHART_RELID__ sentinel
- Modify: `chartDrawer.ts` (graphicFrameShape takes relId param)
- Modify: `pptxRenderer.ts` (pass relId instead of string replace)

### Task 8: Centralize version lookup
- Create: `src/version.ts`
- Modify: `cli.ts`, `index.ts`, `manifestGenerator.ts` (import from version.ts)

### Task 10: Dynamic comparison headers
- Modify: `src/schema/presentation.ts` (add label to BulletsElementSchema)
- Modify: `src/renderer/comparisonDrawer.ts` (use label ?? defaults)

## Wave 2: Dependent changes

### Task 6: Refactor pptxRenderer.ts
- Extract: `embedSlideImages()` and `embedSlideCharts()` helper functions
- Depends on: Task 7 (__CHART_RELID__ removal)

### Task 9: Build script + dist/
- Modify: `package.json` (add build script, update main)
- Modify: `tsconfig.json` (moduleResolution: node16)

## Wave 3: Tests + Docs (after all code changes)

### Task 5: Add missing tests
- Add: trend validation test in dataParser
- Add: --strict CLI flag test
- Add: parseJSONData fallback bullets test
- Add: content validation tests for diagram/timeline limits

### Task 3: Fix documentation
- Modify: `README.md` (add --template to generate commands)
- Modify: `SKILL.md` (recommend generateFromData in Mode 3 Option B)
