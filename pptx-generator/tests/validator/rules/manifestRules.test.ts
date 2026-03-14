import { describe, it, expect } from 'vitest';
import { manifestRules } from '../../../src/validator/rules/manifestRules.js';
import { makeTier1Template, makeEmptyTemplate } from '../helpers.js';

describe('manifestRules', () => {
  it('MAN-001 passes when manifest can be generated', () => {
    const rule = manifestRules.find(r => r.id === 'MAN-001')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('MAN-002 passes for Tier 1 template (all cascades reach generic)', () => {
    const rule = manifestRules.find(r => r.id === 'MAN-002')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('MAN-002 fails when generic is missing (cascades broken)', () => {
    const rule = manifestRules.find(r => r.id === 'MAN-002')!;
    const result = rule.validate(makeEmptyTemplate());
    expect(result.status).toBe('fail');
  });
});
