import { describe, it, expect } from 'vitest';
import { layoutRules } from '../../../src/validator/rules/layoutRules.js';
import { makeTier1Template, makeEmptyTemplate, makeLayout } from '../helpers.js';

describe('layoutRules', () => {
  it('LAY-001 passes when LAYOUT_TITLE exists', () => {
    const rule = layoutRules.find(r => r.id === 'LAY-001')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('LAY-001 fails when LAYOUT_TITLE is missing', () => {
    const rule = layoutRules.find(r => r.id === 'LAY-001')!;
    const result = rule.validate(makeEmptyTemplate());
    expect(result.status).toBe('fail');
    expect(result.severity).toBe('ERROR');
  });

  it('LAY-003 fails when LAYOUT_BULLETS is missing', () => {
    const rule = layoutRules.find(r => r.id === 'LAY-003')!;
    const result = rule.validate(makeEmptyTemplate());
    expect(result.status).toBe('fail');
  });

  it('LAY-004 is a WARNING for missing LAYOUT_TWO_COLUMNS', () => {
    const rule = layoutRules.find(r => r.id === 'LAY-004')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('fail');
    expect(result.severity).toBe('WARNING');
  });

  it('LAY-008 passes with only known layouts', () => {
    const rule = layoutRules.find(r => r.id === 'LAY-008')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('LAY-008 fails with unexpected layouts', () => {
    const rule = layoutRules.find(r => r.id === 'LAY-008')!;
    const template = makeTier1Template();
    template.layouts.push(makeLayout('CUSTOM_LAYOUT', []));
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
    expect(result.context?.unexpected).toContain('CUSTOM_LAYOUT');
  });

  it('LAY-009 passes with no duplicates', () => {
    const rule = layoutRules.find(r => r.id === 'LAY-009')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('LAY-009 fails with duplicate layouts', () => {
    const rule = layoutRules.find(r => r.id === 'LAY-009')!;
    const template = makeTier1Template();
    template.layouts.push(makeLayout('LAYOUT_TITLE', [{ index: 0, type: 'title' }]));
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
    expect(result.severity).toBe('ERROR');
  });

  it('LAY-010 passes with ASCII-only names', () => {
    const rule = layoutRules.find(r => r.id === 'LAY-010')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('LAY-010 fails with non-ASCII names', () => {
    const rule = layoutRules.find(r => r.id === 'LAY-010')!;
    const template = makeTier1Template();
    template.layouts.push(makeLayout('LAYOUT_RÉSUMÉ', []));
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });
});
