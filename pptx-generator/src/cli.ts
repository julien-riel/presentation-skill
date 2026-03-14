#!/usr/bin/env node
import { Command } from 'commander';
import { formatText, formatJson } from './validator/formatter.js';
import {
  validateTemplate,
  generateFromAST,
  generateFromData,
  getDefaultTemplatePath,
} from './index.js';
import { validateAST } from './parser/astValidator.js';
import * as fs from 'fs/promises';
import * as path from 'path';

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
      const report = await validateTemplate(templatePath, { demo: options.demo });

      if (options.json) {
        console.log(formatJson(report.results));
      } else {
        console.log(formatText(report.results));
      }

      if (options.output) {
        await fs.writeFile(options.output, JSON.stringify(report.manifest, null, 2));
        console.log(`\nManifest written to ${options.output}`);
      }

      if (options.demo && report.demoBuffer) {
        const demoPath = templatePath.replace(/\.pptx$/i, '-demo.pptx');
        await fs.writeFile(demoPath, report.demoBuffer);
        console.log(`\nDemo PPTX written to ${demoPath}`);
      }

      if (report.hasErrors || (options.strict && report.hasWarnings)) {
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

      const templatePath = options.template ?? getDefaultTemplatePath();
      let buffer: Buffer;

      if (options.ast) {
        const raw = await fs.readFile(options.ast, 'utf-8');
        const result = validateAST(raw);
        if (!result.success) {
          console.error('AST validation errors:');
          result.errors.forEach(e => console.error(`  - ${e}`));
          process.exit(1);
        }
        buffer = await generateFromAST(result.data, templatePath);
      } else {
        const raw = await fs.readFile(options.data!, 'utf-8');
        const ext = path.extname(options.data!).toLowerCase();
        const format = ext === '.csv' ? 'csv' : 'json';
        const data = format === 'json' ? JSON.parse(raw) : raw;
        buffer = await generateFromData(data, format, options.title, templatePath);
      }

      await fs.writeFile(options.output, buffer);
      console.log(`Presentation written to ${options.output}`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse();
