import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../src/cli.ts');
const TEMPLATE_PATH = path.resolve(__dirname, '../assets/default-template.pptx');
const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');
const TMP_DIR = path.resolve(__dirname, '../.tmp-cli-test');

/**
 * Runs the CLI with tsx and returns { stdout, stderr, exitCode }.
 */
async function runCli(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync('npx', ['tsx', CLI_PATH, ...args], {
      cwd: path.resolve(__dirname, '..'),
      timeout: 30_000,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.code ?? 1,
    };
  }
}

beforeAll(() => {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  // Clean up any generated files
  const files = fs.readdirSync(TMP_DIR);
  for (const f of files) {
    fs.unlinkSync(path.join(TMP_DIR, f));
  }
});

// ─── Validate Command ──────────────────────────────────────────────────────────

describe('CLI validate command', () => {
  it('validates the default template successfully', async () => {
    const { stdout, exitCode } = await runCli(['validate', TEMPLATE_PATH]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Template Validation Report');
    expect(stdout).toContain('passed');
  });

  it('outputs JSON with --json flag', async () => {
    const { stdout, exitCode } = await runCli(['validate', TEMPLATE_PATH, '--json']);

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.results).toBeDefined();
    expect(parsed.summary).toBeDefined();
    expect(parsed.summary.total).toBeGreaterThan(0);
  });

  it('writes manifest to file with -o flag', async () => {
    const manifestPath = path.join(TMP_DIR, 'manifest.json');
    const { exitCode } = await runCli(['validate', TEMPLATE_PATH, '-o', manifestPath]);

    expect(exitCode).toBe(0);
    expect(fs.existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.template).toBeDefined();
    expect(manifest.tier).toBeGreaterThanOrEqual(1);
  });

  it('generates demo PPTX with --demo flag', async () => {
    const { stdout, exitCode } = await runCli(['validate', TEMPLATE_PATH, '--demo']);
    const demoPath = TEMPLATE_PATH.replace(/\.pptx$/i, '-demo.pptx');

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Demo PPTX written to');
    expect(fs.existsSync(demoPath)).toBe(true);

    // Cleanup demo file
    fs.unlinkSync(demoPath);
  });

  it('exits 1 for invalid file', async () => {
    const { exitCode, stderr } = await runCli(['validate', '/tmp/nonexistent.pptx']);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Error:');
  });
});

// ─── Generate Command ──────────────────────────────────────────────────────────

describe('CLI generate command', () => {
  it('generates PPTX from AST file', async () => {
    const astPath = path.join(TMP_DIR, 'test-ast.json');
    const outputPath = path.join(TMP_DIR, 'output.pptx');

    const ast = {
      title: 'CLI Test',
      slides: [
        {
          layout: 'title',
          elements: [
            { type: 'title', text: 'Hello' },
            { type: 'subtitle', text: 'World' },
          ],
        },
      ],
    };
    fs.writeFileSync(astPath, JSON.stringify(ast));

    const { stdout, exitCode } = await runCli(['generate', '--ast', astPath, '-o', outputPath]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Presentation written to');
    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.statSync(outputPath).size).toBeGreaterThan(0);
  });

  it('generates PPTX from CSV data file', async () => {
    const csvPath = path.join(TMP_DIR, 'test-data.csv');
    const outputPath = path.join(TMP_DIR, 'output-data.pptx');

    fs.writeFileSync(csvPath, 'Product,Revenue,Growth\nWidget A,1200,15%\nWidget B,800,8%\n');

    const { stdout, exitCode } = await runCli([
      'generate', '--data', csvPath, '--title', 'Sales Report', '-o', outputPath,
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Presentation written to');
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('generates PPTX from JSON data file', async () => {
    const jsonPath = path.join(TMP_DIR, 'test-data.json');
    const outputPath = path.join(TMP_DIR, 'output-json.pptx');

    const data = [
      { label: 'Revenue', value: '1.2M', unit: 'EUR', trend: 'up' },
      { label: 'Users', value: '50K', trend: 'stable' },
    ];
    fs.writeFileSync(jsonPath, JSON.stringify(data));

    const { stdout, exitCode } = await runCli([
      'generate', '--data', jsonPath, '--title', 'KPI Report', '-o', outputPath,
    ]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain('Presentation written to');
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('exits 1 when no --ast or --data provided', async () => {
    const { exitCode, stderr } = await runCli(['generate']);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('--ast');
  });

  it('exits 1 for invalid AST JSON', async () => {
    const astPath = path.join(TMP_DIR, 'bad-ast.json');
    fs.writeFileSync(astPath, '{"invalid": true}');

    const { exitCode, stderr } = await runCli(['generate', '--ast', astPath]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Error:');
  });

  it('exits 1 for invalid JSON data file', async () => {
    const jsonPath = path.join(TMP_DIR, 'bad-data.json');
    fs.writeFileSync(jsonPath, 'not valid json {{{');

    const { exitCode, stderr } = await runCli(['generate', '--data', jsonPath]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain('Invalid JSON');
  });
});
