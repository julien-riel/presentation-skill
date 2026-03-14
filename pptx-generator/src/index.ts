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
