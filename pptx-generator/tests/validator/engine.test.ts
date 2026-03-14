import { describe, it, expect } from 'vitest';
import { runValidation } from '../../src/validator/engine.js';
import { makeTier1Template, makeTier2Template, makeEmptyTemplate } from './helpers.js';

describe('runValidation', () => {
  it('returns results for all rules', () => {
    const results = runValidation(makeTier1Template());
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('severity');
      expect(r).toHaveProperty('status');
      expect(r).toHaveProperty('message');
    }
  });

  it('Tier 1 template has no ERROR failures', () => {
    const results = runValidation(makeTier1Template());
    const errors = results.filter(r => r.status === 'fail' && r.severity === 'ERROR');
    expect(errors).toEqual([]);
  });

  it('Tier 2 template has no ERROR failures', () => {
    const results = runValidation(makeTier2Template());
    const errors = results.filter(r => r.status === 'fail' && r.severity === 'ERROR');
    expect(errors).toEqual([]);
  });

  it('empty template has multiple ERROR failures', () => {
    const results = runValidation(makeEmptyTemplate());
    const errors = results.filter(r => r.status === 'fail' && r.severity === 'ERROR');
    expect(errors.length).toBeGreaterThan(0);
    const errorIds = errors.map(r => r.id);
    expect(errorIds).toContain('LAY-001');
    expect(errorIds).toContain('LAY-003');
    expect(errorIds).toContain('TIER-001');
  });

  it('Tier 1 template has expected WARNING failures for missing Tier 2 layouts', () => {
    const results = runValidation(makeTier1Template());
    const warnings = results.filter(r => r.status === 'fail' && r.severity === 'WARNING');
    const warningIds = warnings.map(r => r.id);
    expect(warningIds).toContain('LAY-004'); // LAYOUT_TWO_COLUMNS missing
    expect(warningIds).toContain('LAY-005'); // LAYOUT_TIMELINE missing
    expect(warningIds).toContain('TIER-002'); // Tier 2 incomplete
  });
});
