import { readFile } from 'fs/promises';
import type { TemplateCapabilities } from '../schema/capabilities.js';
import { transformPresentation } from '../transform/index.js';
import { renderToBuffer } from '../renderer/pptxRenderer.js';
import { readTemplate } from './templateReader.js';
import { buildDemoAST } from './demoFixtures.js';

// Re-export for consumers that import buildDemoAST from demoGenerator
export { buildDemoAST } from './demoFixtures.js';

/**
 * Generates a demo PPTX buffer from template capabilities.
 * Runs the full pipeline: buildDemoAST -> transform -> render.
 * Opens the template file and adds demo slides to it.
 */
export async function generateDemo(capabilities: TemplateCapabilities, templatePath: string): Promise<Buffer> {
  const templateBuffer = await readFile(templatePath);
  const templateInfo = await readTemplate(templatePath);
  const ast = buildDemoAST(capabilities);
  const enriched = transformPresentation(ast, capabilities);
  return renderToBuffer(enriched, templateBuffer, templateInfo);
}
