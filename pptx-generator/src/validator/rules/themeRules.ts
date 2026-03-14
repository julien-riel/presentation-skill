import type { ValidationRule } from '../types.js';

/**
 * Computes relative luminance of a hex color (#RRGGBB).
 */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const [rs, gs, bs] = [r, g, b].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Computes WCAG contrast ratio between two hex colors.
 */
function contrastRatio(color1: string, color2: string): number {
  const l1 = relativeLuminance(color1);
  const l2 = relativeLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export const themeRules: ValidationRule[] = [
  // THM-001: at least 3 distinct accent colors
  {
    id: 'THM-001',
    severity: 'WARNING',
    description: 'Au moins 3 couleurs d\'accent distinctes dans le thème',
    validate: (template) => {
      const unique = new Set(template.theme.accentColors.map(c => c.toLowerCase()));
      const ok = unique.size >= 3;
      return {
        id: 'THM-001',
        severity: 'WARNING',
        status: ok ? 'pass' : 'fail',
        message: ok
          ? `${unique.size} distinct accent colors found`
          : `Only ${unique.size} distinct accent color(s), need at least 3`,
      };
    },
  },

  // THM-002: title font defined
  {
    id: 'THM-002',
    severity: 'WARNING',
    description: 'Police de titre du thème définie',
    validate: (template) => {
      const ok = template.theme.titleFont.trim().length > 0;
      return {
        id: 'THM-002',
        severity: 'WARNING',
        status: ok ? 'pass' : 'fail',
        message: ok
          ? `Title font: ${template.theme.titleFont}`
          : 'Title font is not defined',
      };
    },
  },

  // THM-003: body font defined
  {
    id: 'THM-003',
    severity: 'WARNING',
    description: 'Police de corps du thème définie',
    validate: (template) => {
      const ok = template.theme.bodyFont.trim().length > 0;
      return {
        id: 'THM-003',
        severity: 'WARNING',
        status: ok ? 'pass' : 'fail',
        message: ok
          ? `Body font: ${template.theme.bodyFont}`
          : 'Body font is not defined',
      };
    },
  },

  // THM-004: contrast ratio >= 4.5:1 (WCAG AA)
  {
    id: 'THM-004',
    severity: 'WARNING',
    description: 'Contraste Primary/fond suffisant (ratio WCAG AA ≥ 4.5:1)',
    validate: (template) => {
      const colors = template.theme.accentColors;
      if (colors.length === 0) {
        return {
          id: 'THM-004', severity: 'WARNING', status: 'fail',
          message: 'No accent colors to check contrast',
        };
      }
      const primary = colors[0];
      const white = '#FFFFFF';
      const ratio = contrastRatio(primary, white);
      const ok = ratio >= 4.5;
      return {
        id: 'THM-004',
        severity: 'WARNING',
        status: ok ? 'pass' : 'fail',
        message: ok
          ? `Primary (${primary}) contrast ratio: ${ratio.toFixed(2)}:1`
          : `Primary (${primary}) contrast ratio: ${ratio.toFixed(2)}:1 (< 4.5:1)`,
        context: { primary, ratio: parseFloat(ratio.toFixed(2)) },
      };
    },
  },
];
