import type { ValidationResult } from './types.js';

/**
 * Formats validation results as human-readable text.
 */
export function formatText(results: ValidationResult[]): string {
  const lines: string[] = ['Template Validation Report', '='.repeat(40), ''];

  const failures = results.filter(r => r.status === 'fail');
  const passes = results.filter(r => r.status === 'pass');

  const errors = failures.filter(r => r.severity === 'ERROR');
  const warnings = failures.filter(r => r.severity === 'WARNING');
  const infos = failures.filter(r => r.severity === 'INFO');

  if (errors.length > 0) {
    lines.push('ERRORS:');
    for (const r of errors) {
      lines.push(`  [ERROR] ${r.id}: ${r.message}`);
    }
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push('WARNINGS:');
    for (const r of warnings) {
      lines.push(`  [WARNING] ${r.id}: ${r.message}`);
    }
    lines.push('');
  }

  if (infos.length > 0) {
    lines.push('INFO:');
    for (const r of infos) {
      lines.push(`  [INFO] ${r.id}: ${r.message}`);
    }
    lines.push('');
  }

  lines.push(`Summary: ${passes.length} passed, ${failures.length} failed (${errors.length} errors, ${warnings.length} warnings, ${infos.length} info)`);

  return lines.join('\n');
}

/**
 * Formats validation results as JSON.
 */
export function formatJson(results: ValidationResult[]): string {
  return JSON.stringify({
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      errors: results.filter(r => r.status === 'fail' && r.severity === 'ERROR').length,
      warnings: results.filter(r => r.status === 'fail' && r.severity === 'WARNING').length,
      info: results.filter(r => r.status === 'fail' && r.severity === 'INFO').length,
    },
  }, null, 2);
}
