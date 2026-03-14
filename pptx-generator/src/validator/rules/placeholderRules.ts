import type { ValidationRule, TemplateInfo, LayoutInfo, Severity } from '../types.js';

/**
 * Finds a layout by PPT name.
 */
function findLayout(template: TemplateInfo, name: string): LayoutInfo | undefined {
  return template.layouts.find(l => l.name === name);
}

/**
 * Checks if a placeholder of the expected type exists at the given index.
 */
function hasPlaceholder(layout: LayoutInfo, index: number, types: string[]): boolean {
  return layout.placeholders.some(
    p => p.index === index && types.includes(p.type)
  );
}

const TITLE_TYPES = ['title', 'ctrTitle'];
const SUBTITLE_OR_BODY_TYPES = ['subTitle', 'body'];
const BODY_TYPES = ['body'];

/**
 * Creates a placeholder rule for a required layout (always checked).
 */
function requiredPhRule(
  id: string, severity: Severity, layoutName: string,
  phIndex: number, phLabel: string, phTypes: string[]
): ValidationRule {
  return {
    id,
    severity,
    description: `${layoutName} : placeholder ${phLabel} à l'index ${phIndex}`,
    validate: (template) => {
      const layout = findLayout(template, layoutName);
      if (!layout) {
        return {
          id, severity, status: 'fail',
          message: `${layoutName} not found, cannot check placeholder ${phLabel}`,
        };
      }
      const found = hasPlaceholder(layout, phIndex, phTypes);
      return {
        id, severity,
        status: found ? 'pass' : 'fail',
        message: found
          ? `${layoutName} has ${phLabel} at index ${phIndex}`
          : `${layoutName} missing ${phLabel} at index ${phIndex}`,
      };
    },
  };
}

/**
 * Creates a placeholder rule for an optional layout (only checked if layout exists).
 */
function optionalPhRule(
  id: string, severity: Severity, layoutName: string,
  phIndex: number, phLabel: string, phTypes: string[]
): ValidationRule {
  return {
    id,
    severity,
    description: `${layoutName} : placeholder ${phLabel} à l'index ${phIndex}`,
    validate: (template) => {
      const layout = findLayout(template, layoutName);
      if (!layout) {
        return {
          id, severity, status: 'pass',
          message: `${layoutName} not present, rule skipped`,
        };
      }
      const found = hasPlaceholder(layout, phIndex, phTypes);
      return {
        id, severity,
        status: found ? 'pass' : 'fail',
        message: found
          ? `${layoutName} has ${phLabel} at index ${phIndex}`
          : `${layoutName} missing ${phLabel} at index ${phIndex}`,
      };
    },
  };
}

export const placeholderRules: ValidationRule[] = [
  // LAYOUT_TITLE
  requiredPhRule('PH-001', 'ERROR', 'LAYOUT_TITLE', 0, 'Title', TITLE_TYPES),
  requiredPhRule('PH-002', 'ERROR', 'LAYOUT_TITLE', 1, 'Subtitle/Text', SUBTITLE_OR_BODY_TYPES),

  // LAYOUT_SECTION
  requiredPhRule('PH-003', 'ERROR', 'LAYOUT_SECTION', 0, 'Title', TITLE_TYPES),
  requiredPhRule('PH-004', 'WARNING', 'LAYOUT_SECTION', 1, 'Subtitle/Text', SUBTITLE_OR_BODY_TYPES),

  // LAYOUT_BULLETS
  requiredPhRule('PH-005', 'ERROR', 'LAYOUT_BULLETS', 0, 'Title', TITLE_TYPES),
  requiredPhRule('PH-006', 'ERROR', 'LAYOUT_BULLETS', 1, 'Content', BODY_TYPES),

  // LAYOUT_TWO_COLUMNS (optional layout)
  optionalPhRule('PH-007', 'ERROR', 'LAYOUT_TWO_COLUMNS', 0, 'Title', TITLE_TYPES),
  optionalPhRule('PH-008', 'ERROR', 'LAYOUT_TWO_COLUMNS', 1, 'Content (left)', BODY_TYPES),
  optionalPhRule('PH-009', 'ERROR', 'LAYOUT_TWO_COLUMNS', 2, 'Content (right)', BODY_TYPES),

  // LAYOUT_TIMELINE (optional layout)
  optionalPhRule('PH-010', 'ERROR', 'LAYOUT_TIMELINE', 0, 'Title', TITLE_TYPES),
  optionalPhRule('PH-011', 'ERROR', 'LAYOUT_TIMELINE', 1, 'Content (canvas)', BODY_TYPES),

  // LAYOUT_ARCHITECTURE (optional layout)
  optionalPhRule('PH-012', 'ERROR', 'LAYOUT_ARCHITECTURE', 0, 'Title', TITLE_TYPES),
  optionalPhRule('PH-013', 'ERROR', 'LAYOUT_ARCHITECTURE', 1, 'Content (canvas)', BODY_TYPES),

  // LAYOUT_GENERIC
  requiredPhRule('PH-014', 'ERROR', 'LAYOUT_GENERIC', 0, 'Title', TITLE_TYPES),
  requiredPhRule('PH-015', 'ERROR', 'LAYOUT_GENERIC', 1, 'Content', BODY_TYPES),
];
