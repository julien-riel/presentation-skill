import { describe, it, expect } from 'vitest';
import { themeRules } from '../../../src/validator/rules/themeRules.js';
import { makeTier1Template } from '../helpers.js';

describe('themeRules', () => {
  it('THM-001 passes with 3+ distinct accent colors', () => {
    const rule = themeRules.find(r => r.id === 'THM-001')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('THM-001 fails with fewer than 3 accent colors', () => {
    const rule = themeRules.find(r => r.id === 'THM-001')!;
    const template = makeTier1Template();
    template.theme.accentColors = ['#FF0000', '#00FF00'];
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });

  it('THM-001 fails with duplicate colors counting as non-distinct', () => {
    const rule = themeRules.find(r => r.id === 'THM-001')!;
    const template = makeTier1Template();
    template.theme.accentColors = ['#FF0000', '#FF0000', '#00FF00'];
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });

  it('THM-002 passes when title font is defined', () => {
    const rule = themeRules.find(r => r.id === 'THM-002')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('THM-002 fails when title font is empty', () => {
    const rule = themeRules.find(r => r.id === 'THM-002')!;
    const template = makeTier1Template();
    template.theme.titleFont = '';
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });

  it('THM-003 passes when body font is defined', () => {
    const rule = themeRules.find(r => r.id === 'THM-003')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('THM-004 passes with high-contrast primary color', () => {
    const rule = themeRules.find(r => r.id === 'THM-004')!;
    const template = makeTier1Template();
    template.theme.accentColors = ['#000000', '#2C7DA0', '#E76F51'];
    const result = rule.validate(template);
    expect(result.status).toBe('pass');
  });

  it('THM-004 fails with low-contrast primary color', () => {
    const rule = themeRules.find(r => r.id === 'THM-004')!;
    const template = makeTier1Template();
    template.theme.accentColors = ['#FFFF00', '#2C7DA0', '#E76F51']; // yellow on white
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });

  it('THM-004 fails with no accent colors', () => {
    const rule = themeRules.find(r => r.id === 'THM-004')!;
    const template = makeTier1Template();
    template.theme.accentColors = [];
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });
});
