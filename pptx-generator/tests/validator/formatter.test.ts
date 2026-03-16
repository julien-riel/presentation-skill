import { describe, it, expect } from 'vitest';
import { formatText, formatJson } from '../../src/validator/formatter.js';
import type { ValidationResult } from '../../src/validator/types.js';

function makeResult(overrides: Partial<ValidationResult> & Pick<ValidationResult, 'id' | 'severity' | 'status' | 'message'>): ValidationResult {
  return overrides;
}

describe('formatText', () => {
  it('formats a mix of errors, warnings, and infos', () => {
    const results: ValidationResult[] = [
      makeResult({ id: 'LAY-001', severity: 'ERROR', status: 'fail', message: 'LAYOUT_TITLE missing' }),
      makeResult({ id: 'LAY-004', severity: 'WARNING', status: 'fail', message: 'LAYOUT_TWO_COLUMNS missing' }),
      makeResult({ id: 'TIER-003', severity: 'INFO', status: 'fail', message: 'Tier 3 incomplete' }),
      makeResult({ id: 'LAY-002', severity: 'ERROR', status: 'pass', message: 'LAYOUT_SECTION present' }),
    ];

    const output = formatText(results);

    expect(output).toContain('Template Validation Report');
    expect(output).toContain('ERRORS:');
    expect(output).toContain('[ERROR] LAY-001: LAYOUT_TITLE missing');
    expect(output).toContain('WARNINGS:');
    expect(output).toContain('[WARNING] LAY-004: LAYOUT_TWO_COLUMNS missing');
    expect(output).toContain('INFO:');
    expect(output).toContain('[INFO] TIER-003: Tier 3 incomplete');
    expect(output).toContain('Summary: 1 passed, 3 failed (1 errors, 1 warnings, 1 info)');
  });

  it('omits sections with no results', () => {
    const results: ValidationResult[] = [
      makeResult({ id: 'LAY-001', severity: 'ERROR', status: 'pass', message: 'OK' }),
    ];

    const output = formatText(results);

    expect(output).not.toContain('ERRORS:');
    expect(output).not.toContain('WARNINGS:');
    expect(output).not.toContain('INFO:');
    expect(output).toContain('Summary: 1 passed, 0 failed');
  });

  it('handles all-pass results', () => {
    const results: ValidationResult[] = [
      makeResult({ id: 'A', severity: 'ERROR', status: 'pass', message: '' }),
      makeResult({ id: 'B', severity: 'WARNING', status: 'pass', message: '' }),
    ];

    const output = formatText(results);
    expect(output).toContain('Summary: 2 passed, 0 failed (0 errors, 0 warnings, 0 info)');
  });
});

describe('formatJson', () => {
  it('returns valid JSON with results and summary', () => {
    const results: ValidationResult[] = [
      makeResult({ id: 'LAY-001', severity: 'ERROR', status: 'fail', message: 'Missing' }),
      makeResult({ id: 'LAY-002', severity: 'ERROR', status: 'pass', message: 'OK' }),
      makeResult({ id: 'THM-001', severity: 'WARNING', status: 'fail', message: 'Theme issue' }),
    ];

    const output = formatJson(results);
    const parsed = JSON.parse(output);

    expect(parsed.results).toHaveLength(3);
    expect(parsed.summary.total).toBe(3);
    expect(parsed.summary.passed).toBe(1);
    expect(parsed.summary.failed).toBe(2);
    expect(parsed.summary.errors).toBe(1);
    expect(parsed.summary.warnings).toBe(1);
    expect(parsed.summary.info).toBe(0);
  });

  it('handles empty results', () => {
    const output = formatJson([]);
    const parsed = JSON.parse(output);

    expect(parsed.results).toHaveLength(0);
    expect(parsed.summary.total).toBe(0);
    expect(parsed.summary.passed).toBe(0);
    expect(parsed.summary.failed).toBe(0);
  });
});
