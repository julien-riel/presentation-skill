import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { validateTemplate } from '../src/index.js';

const TEMPLATE_PATH = path.resolve(__dirname, '../assets/default-template.pptx');
const SIDECAR_PATH = TEMPLATE_PATH.replace(/\.pptx$/i, '.capabilities.json');

beforeEach(() => {
  try { fs.unlinkSync(SIDECAR_PATH); } catch { /* ignore */ }
});

afterEach(() => {
  try { fs.unlinkSync(SIDECAR_PATH); } catch { /* ignore */ }
});

describe('manifest sidecar caching', () => {
  it('generates sidecar file on validateTemplate call', async () => {
    expect(fs.existsSync(SIDECAR_PATH)).toBe(false);

    await validateTemplate(TEMPLATE_PATH);

    expect(fs.existsSync(SIDECAR_PATH)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(SIDECAR_PATH, 'utf-8'));
    expect(manifest.template).toBeDefined();
    expect(manifest.tier).toBeGreaterThanOrEqual(0);
  });

  it('reuses sidecar when pptx is not newer', async () => {
    await validateTemplate(TEMPLATE_PATH);
    const firstContent = fs.readFileSync(SIDECAR_PATH, 'utf-8');
    const firstManifest = JSON.parse(firstContent);

    const result = await validateTemplate(TEMPLATE_PATH);
    expect(result.manifest.generated_at).toBe(firstManifest.generated_at);
  });

  it('regenerates sidecar when pptx is newer', async () => {
    await validateTemplate(TEMPLATE_PATH);
    const firstContent = fs.readFileSync(SIDECAR_PATH, 'utf-8');

    // Backdate sidecar to force regeneration
    const pastTime = new Date(Date.now() - 60_000);
    fs.utimesSync(SIDECAR_PATH, pastTime, pastTime);

    // Touch the pptx to make it newer
    const now = new Date();
    fs.utimesSync(TEMPLATE_PATH, now, now);

    const result = await validateTemplate(TEMPLATE_PATH);
    const newContent = fs.readFileSync(SIDECAR_PATH, 'utf-8');
    expect(newContent).not.toBe(firstContent);
  });
});
