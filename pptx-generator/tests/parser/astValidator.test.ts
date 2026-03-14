import { describe, it, expect } from 'vitest';
import { validateAST } from '../../src/parser/astValidator.ts';

describe('validateAST', () => {
  it('should accept a valid minimal AST', () => {
    const result = validateAST({
      title: 'Test',
      slides: [
        { layout: 'title', elements: [{ type: 'title', text: 'Hello' }] },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Test');
      expect(result.data.slides).toHaveLength(1);
    }
  });

  it('should reject AST missing required title field', () => {
    const result = validateAST({ slides: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('title');
    }
  });

  it('should reject AST with invalid layout type', () => {
    const result = validateAST({
      title: 'Test',
      slides: [{ layout: 'nonexistent', elements: [] }],
    });
    expect(result.success).toBe(false);
  });

  it('should reject AST with invalid element type', () => {
    const result = validateAST({
      title: 'Test',
      slides: [{ layout: 'bullets', elements: [{ type: 'invalid', text: 'x' }] }],
    });
    expect(result.success).toBe(false);
  });

  it('should accept a full AST with all element types', () => {
    const result = validateAST({
      title: 'Full Test',
      metadata: { author: 'Test', date: '2026-03-14' },
      slides: [
        { layout: 'title', elements: [{ type: 'title', text: 'Title' }, { type: 'subtitle', text: 'Sub' }] },
        { layout: 'bullets', elements: [{ type: 'title', text: 'Bullets' }, { type: 'bullets', items: ['A', 'B'] }] },
        { layout: 'timeline', elements: [{ type: 'title', text: 'TL' }, { type: 'timeline', events: [{ date: '2026-Q1', label: 'Start', status: 'done' }] }] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should parse from a JSON string', () => {
    const json = JSON.stringify({
      title: 'From String',
      slides: [{ layout: 'generic', elements: [{ type: 'title', text: 'Hi' }] }],
    });
    const result = validateAST(json);
    expect(result.success).toBe(true);
  });

  it('should reject malformed JSON string', () => {
    const result = validateAST('not valid json {{{');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]).toContain('JSON');
    }
  });
});
