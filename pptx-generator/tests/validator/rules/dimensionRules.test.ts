import { describe, it, expect } from 'vitest';
import { dimensionRules } from '../../../src/validator/rules/dimensionRules.js';
import { makeTier1Template, makeTier2Template, makeLayout } from '../helpers.js';

describe('dimensionRules', () => {
  it('DIM-001 passes for standard 16:9 dimensions', () => {
    const rule = dimensionRules.find(r => r.id === 'DIM-001')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('DIM-001 fails for 4:3 dimensions', () => {
    const rule = dimensionRules.find(r => r.id === 'DIM-001')!;
    const template = makeTier1Template();
    template.slideDimensions = { widthEmu: 9144000, heightEmu: 6858000 }; // 4:3
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });

  it('DIM-002 passes when placeholders respect margins', () => {
    const rule = dimensionRules.find(r => r.id === 'DIM-002')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('DIM-002 fails when placeholder is too close to edge', () => {
    const rule = dimensionRules.find(r => r.id === 'DIM-002')!;
    const template = makeTier1Template();
    template.layouts[0].placeholders[0].position.x = 100; // too close to left
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });

  it('DIM-003 passes when LAYOUT_BULLETS body is tall enough', () => {
    const rule = dimensionRules.find(r => r.id === 'DIM-003')!;
    const result = rule.validate(makeTier1Template());
    expect(result.status).toBe('pass');
  });

  it('DIM-003 fails when LAYOUT_BULLETS body is too short', () => {
    const rule = dimensionRules.find(r => r.id === 'DIM-003')!;
    const template = makeTier1Template();
    const bullets = template.layouts.find(l => l.name === 'LAYOUT_BULLETS')!;
    const body = bullets.placeholders.find(p => p.index === 1)!;
    body.position.cy = 1000000; // too short
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });

  it('DIM-004 passes when columns do not overlap', () => {
    const rule = dimensionRules.find(r => r.id === 'DIM-004')!;
    const result = rule.validate(makeTier2Template());
    expect(result.status).toBe('pass');
  });

  it('DIM-004 fails when columns overlap', () => {
    const rule = dimensionRules.find(r => r.id === 'DIM-004')!;
    const template = makeTier2Template();
    const twoCols = template.layouts.find(l => l.name === 'LAYOUT_TWO_COLUMNS')!;
    const left = twoCols.placeholders.find(p => p.index === 1)!;
    left.position.cx = 8000000; // extends past right column
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });

  it('DIM-005 passes when canvas placeholders are tall enough', () => {
    const rule = dimensionRules.find(r => r.id === 'DIM-005')!;
    const result = rule.validate(makeTier2Template());
    expect(result.status).toBe('pass');
  });

  it('DIM-005 fails when canvas placeholder is too short', () => {
    const rule = dimensionRules.find(r => r.id === 'DIM-005')!;
    const template = makeTier2Template();
    const timeline = template.layouts.find(l => l.name === 'LAYOUT_TIMELINE')!;
    const canvas = timeline.placeholders.find(p => p.index === 1)!;
    canvas.position.cy = 1000000; // too short
    const result = rule.validate(template);
    expect(result.status).toBe('fail');
  });
});
