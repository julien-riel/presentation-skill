#!/usr/bin/env node
import { Command } from 'commander';
import { readTemplate } from './validator/templateReader.js';
import { runValidation } from './validator/engine.js';
import { generateManifest } from './validator/manifestGenerator.js';
import { formatText, formatJson } from './validator/formatter.js';
import { generateDemo } from './validator/demoGenerator.js';
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
  .description('Generate a presentation (not yet implemented)')
  .action(() => {
    console.log('Generation: not yet implemented');
  });

program.parse();
