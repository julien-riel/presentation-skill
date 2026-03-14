#!/usr/bin/env node
import { Command } from 'commander';
import { readTemplate } from './validator/templateReader.js';
import { runValidation } from './validator/engine.js';
import { generateManifest } from './validator/manifestGenerator.js';
import { formatText, formatJson } from './validator/formatter.js';
import { generateDemo } from './validator/demoGenerator.js';
import { validateAST } from './parser/astValidator.js';
import { parseCSV, parseJSONData } from './parser/dataParser.js';
import { transformPresentation } from './transform/index.js';
import { renderToBuffer } from './renderer/pptxRenderer.js';
import type { TemplateCapabilities } from './schema/capabilities.js';
import type { Presentation } from './schema/presentation.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const program = new Command();

program
  .name('pptx-generator')
  .description('PPTX template validator and presentation generator')
  .version('1.0.0');

program
  .command('validate')
  .description('Validate a .pptx template')
  .argument('<template>', 'Path to the .pptx template file')
  .option('--json', 'Output results as JSON')
  .option('--strict', 'Treat warnings as errors')
  .option('--demo', 'Generate demo PPTX showcasing all layouts')
  .option('-o, --output <path>', 'Write manifest to file')
  .action(async (templatePath: string, options: { json?: boolean; strict?: boolean; demo?: boolean; output?: string }) => {
    try {
      const template = await readTemplate(templatePath);
      const results = runValidation(template);

      if (options.json) {
        console.log(formatJson(results));
      } else {
        console.log(formatText(results));
      }

      // Generate manifest
      const templateName = path.basename(templatePath);
      const manifest = generateManifest(template, templateName);

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(manifest, null, 2));
        console.log(`\nManifest written to ${options.output}`);
      }

      // Generate demo PPTX if requested
      if (options.demo) {
        const demoBuffer = await generateDemo(manifest);
        const demoPath = templatePath.replace(/\.pptx$/i, '-demo.pptx');
        await fs.writeFile(demoPath, demoBuffer);
        console.log(`\nDemo PPTX written to ${demoPath}`);
      }

      const hasErrors = results.some(r => r.status === 'fail' && r.severity === 'ERROR');
      const hasWarnings = results.some(r => r.status === 'fail' && r.severity === 'WARNING');

      if (hasErrors || (options.strict && hasWarnings)) {
        process.exit(1);
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

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
        const defaultPath = path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          '../assets/default-template.pptx'
        );
        const template = await readTemplate(defaultPath);
        manifest = generateManifest(template, 'default-template.pptx');
      }

      // Parse input to AST
      let presentation: Presentation;
      if (options.ast) {
        const raw = await fs.readFile(options.ast, 'utf-8');
        const result = validateAST(raw);
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
        const validationResult = validateAST(presentation);
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

program.parse();
