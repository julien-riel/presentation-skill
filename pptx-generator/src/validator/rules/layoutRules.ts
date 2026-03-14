import type { ValidationRule, TemplateInfo, Severity } from '../types.js';
import { KNOWN_LAYOUT_PPT_NAMES } from '../types.js';

/**
 * Finds a layout by PPT name in the template.
 */
function findLayout(template: TemplateInfo, name: string) {
  return template.layouts.find(l => l.name === name);
}

/**
 * Creates a rule checking that a layout exists.
 */
function layoutExistsRule(id: string, layoutName: string, severity: Severity, tierNote?: string): ValidationRule {
  const desc = `${layoutName} ${severity === 'ERROR' ? 'doit' : 'devrait'} exister${tierNote ? ` (${tierNote})` : ''}`;
  return {
    id,
    severity,
    description: desc,
    validate: (template) => {
      const found = !!findLayout(template, layoutName);
      return {
        id,
        severity,
        status: found ? 'pass' : 'fail',
        message: found ? `${layoutName} found` : `${layoutName} is missing`,
      };
    },
  };
}

export const layoutRules: ValidationRule[] = [
  // LAY-001 to LAY-007: required/recommended layouts
  layoutExistsRule('LAY-001', 'LAYOUT_TITLE', 'ERROR'),
  layoutExistsRule('LAY-002', 'LAYOUT_SECTION', 'ERROR'),
  layoutExistsRule('LAY-003', 'LAYOUT_BULLETS', 'ERROR'),
  layoutExistsRule('LAY-004', 'LAYOUT_TWO_COLUMNS', 'WARNING', 'Tier 2'),
  layoutExistsRule('LAY-005', 'LAYOUT_TIMELINE', 'WARNING', 'Tier 2'),
  layoutExistsRule('LAY-006', 'LAYOUT_ARCHITECTURE', 'WARNING', 'Tier 3'),
  layoutExistsRule('LAY-007', 'LAYOUT_GENERIC', 'ERROR'),

  // LAY-008: no unexpected layouts
  {
    id: 'LAY-008',
    severity: 'WARNING',
    description: 'Aucun layout inattendu ne devrait être présent',
    validate: (template) => {
      const unexpected = template.layouts
        .map(l => l.name)
        .filter(name => name && !KNOWN_LAYOUT_PPT_NAMES.includes(name));
      return {
        id: 'LAY-008',
        severity: 'WARNING',
        status: unexpected.length === 0 ? 'pass' : 'fail',
        message: unexpected.length === 0
          ? 'No unexpected layouts'
          : `Unexpected layouts: ${unexpected.join(', ')}`,
        ...(unexpected.length > 0 && { context: { unexpected } }),
      };
    },
  },

  // LAY-009: no duplicate layouts
  {
    id: 'LAY-009',
    severity: 'ERROR',
    description: 'Aucun layout ne doit être dupliqué',
    validate: (template) => {
      const names = template.layouts.map(l => l.name).filter(Boolean);
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const name of names) {
        if (seen.has(name)) {
          if (!duplicates.includes(name)) duplicates.push(name);
        }
        seen.add(name);
      }
      return {
        id: 'LAY-009',
        severity: 'ERROR',
        status: duplicates.length === 0 ? 'pass' : 'fail',
        message: duplicates.length === 0
          ? 'No duplicate layouts'
          : `Duplicate layouts: ${duplicates.join(', ')}`,
        ...(duplicates.length > 0 && { context: { duplicates } }),
      };
    },
  },

  // LAY-010: layout names ASCII only
  {
    id: 'LAY-010',
    severity: 'WARNING',
    description: 'Noms de layouts en ASCII uniquement',
    validate: (template) => {
      const nonAscii = template.layouts
        .map(l => l.name)
        .filter(name => name && !/^[\x20-\x7E]+$/.test(name));
      return {
        id: 'LAY-010',
        severity: 'WARNING',
        status: nonAscii.length === 0 ? 'pass' : 'fail',
        message: nonAscii.length === 0
          ? 'All layout names are ASCII'
          : `Non-ASCII layout names: ${nonAscii.join(', ')}`,
        ...(nonAscii.length > 0 && { context: { nonAscii } }),
      };
    },
  },
];
