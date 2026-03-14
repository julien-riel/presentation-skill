import { describe, it, expect } from 'vitest';
import { placeholderRules } from '../../../src/validator/rules/placeholderRules.js';
import { makeTier1Template, makeTier2Template, makeLayout } from '../helpers.js';
import type { TemplateInfo } from '../../../src/validator/types.js';

describe('placeholderRules', () => {
  it('PH-001 passes when LAYOUT_TITLE has Title at index 0', () => {
    const rule = placeholderRules.find(r => r.id === 'PH-001')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('PH-001 fails when LAYOUT_TITLE has wrong placeholder type at index 0', () => {
    const rule = placeholderRules.find(r => r.id === 'PH-001')!;
    const template = makeTier1Template();
    const titleLayout = template.layouts.find(l => l.name === 'LAYOUT_TITLE')!;
    titleLayout.placeholders[0].type = 'body';
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });

  it('PH-002 passes when LAYOUT_TITLE has Subtitle at index 1', () => {
    const rule = placeholderRules.find(r => r.id === 'PH-002')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('PH-006 passes when LAYOUT_BULLETS has Content at index 1', () => {
    const rule = placeholderRules.find(r => r.id === 'PH-006')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('PH-007 passes (skips) when LAYOUT_TWO_COLUMNS is absent', () => {
    const rule = placeholderRules.find(r => r.id === 'PH-007')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
    expect(result.message).toContain('not present');
  });

  it('PH-007 passes when LAYOUT_TWO_COLUMNS has Title at index 0', () => {
    const rule = placeholderRules.find(r => r.id === 'PH-007')!;
    const result = rule.validate(makeTier2Template());
    expect(result.status).toBe('pass');
  });

  it('PH-008 passes when LAYOUT_TWO_COLUMNS has Content at index 1', () => {
    const rule = placeholderRules.find(r => r.id === 'PH-008')!;
    const result = rule.validate(makeTier2Template());
    expect(result.status).toBe('pass');
  });

  it('PH-009 passes when LAYOUT_TWO_COLUMNS has Content at index 2', () => {
    const rule = placeholderRules.find(r => r.id === 'PH-009')!;
    const result = rule.validate(makeTier2Template());
    expect(result.status).toBe('pass');
  });

  it('PH-010 skips when LAYOUT_TIMELINE is absent', () => {
    const rule = placeholderRules.find(r => r.id === 'PH-010')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('PH-014 passes when LAYOUT_GENERIC has Title at index 0', () => {
    const rule = placeholderRules.find(r => r.id === 'PH-014')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('PH-015 fails when LAYOUT_GENERIC has no Content at index 1', () => {
    const rule = placeholderRules.find(r => r.id === 'PH-015')!;
    const template = makeTier1Template();
    const generic = template.layouts.find(l => l.name === 'LAYOUT_GENERIC')!;
    generic.placeholders = [{ index: 0, type: 'title', position: { x: 0, y: 0, cx: 0, cy: 0 } }];
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });
});
