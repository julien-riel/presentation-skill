import { describe, it, expect } from 'vitest';
import { emuFromPx, pictureShape } from '../../src/renderer/xmlHelpers.js';

describe('emuFromPx', () => {
  it('converts pixels to EMU at 96 DPI', () => {
    expect(emuFromPx(1)).toBe(9525);
    expect(emuFromPx(32)).toBe(304800);
    expect(emuFromPx(96)).toBe(914400); // 1 inch
  });
});

describe('pictureShape', () => {
  it('generates valid p:pic XML with correct attributes', () => {
    const xml = pictureShape(42, 'rIdImg1', 100, 200, 300, 400);
    expect(xml).toContain('<p:pic>');
    expect(xml).toContain('id="42"');
    expect(xml).toContain('name="Icon 42"');
    expect(xml).toContain('r:embed="rIdImg1"');
    expect(xml).toContain('x="100"');
    expect(xml).toContain('y="200"');
    expect(xml).toContain('cx="300"');
    expect(xml).toContain('cy="400"');
    expect(xml).toContain('noChangeAspect="1"');
    expect(xml).toContain('</p:pic>');
  });
});
