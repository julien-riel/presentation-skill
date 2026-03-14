import { describe, it, expect } from 'vitest';
import { tierRules } from '../../../src/validator/rules/tierRules.js';
import { makeTier1Template, makeTier2Template, makeEmptyTemplate } from '../helpers.js';

describe('tierRules', () => {
  it('TIER-001 passes for Tier 1 template', () => {
    const rule = tierRules.find(r => r.id === 'TIER-001')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('TIER-001 fails for empty template', () => {
    const rule = tierRules.find(r => r.id === 'TIER-001')!;
    const result = rule.validate(makeEmptyTemplate());
    expect(result.status).toBe('fail');
    expect(result.severity).toBe('ERROR');
    expect(result.context?.missing).toContain('title');
  });

  it('TIER-002 fails for Tier 1 template (missing twoColumns, timeline)', () => {
    const rule = tierRules.find(r => r.id === 'TIER-002')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('fail');
    expect(result.severity).toBe('WARNING');
  });

  it('TIER-002 passes for Tier 2 template', () => {
    const rule = tierRules.find(r => r.id === 'TIER-002')!;
    const result = rule.validate(makeTier2Template());
    expect(result.status).toBe('pass');
  });

  it('TIER-003 fails for Tier 2 template (missing Tier 3+ layouts)', () => {
    const rule = tierRules.find(r => r.id === 'TIER-003')!;
    const result = rule.validate(makeTier2Template());
    expect(result.status).toBe('fail');
    expect(result.severity).toBe('INFO');
  });
});
