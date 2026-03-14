import type { ValidationRule, TemplateInfo, LayoutInfo } from '../types.js';

const HALF_INCH_EMU = 457200;
const MIN_BODY_HEIGHT_EMU = 2286000;
const CANVAS_HEIGHT_RATIO = 0.6;

/**
 * Finds a layout by PPT name.
 */
function findLayout(template: TemplateInfo, name: string): LayoutInfo | undefined {
  return template.layouts.find(l => l.name === name);
}

export const dimensionRules: ValidationRule[] = [
  // DIM-001: slide ratio 16:9 (between 1.7 and 1.8)
  {
    id: 'DIM-001',
    severity: 'WARNING',
    description: 'Ratio largeur/hauteur entre 1.7 et 1.8 (16:9)',
    validate: (template) => {
      const { widthEmu, heightEmu } = template.slideDimensions;
      const ratio = widthEmu / heightEmu;
      const ok = ratio >= 1.7 && ratio <= 1.8;
      return {
        id: 'DIM-001',
        severity: 'WARNING',
        status: ok ? 'pass' : 'fail',
        message: ok
          ? `Slide ratio is ${ratio.toFixed(3)} (16:9)`
          : `Slide ratio is ${ratio.toFixed(3)}, expected 1.7–1.8`,
        context: { ratio: parseFloat(ratio.toFixed(3)) },
      };
    },
  },

  // DIM-002: placeholders at least 0.5" from edges
  {
    id: 'DIM-002',
    severity: 'WARNING',
    description: 'Placeholders à au moins 0.5 po des bords',
    validate: (template) => {
      const { widthEmu, heightEmu } = template.slideDimensions;
      const violations: string[] = [];

      for (const layout of template.layouts) {
        for (const ph of layout.placeholders) {
          const { x, y, cx, cy } = ph.position;
          // Skip placeholders with no real position data
          if (cx === 0 && cy === 0) continue;

          if (x < HALF_INCH_EMU) violations.push(`${layout.name}[${ph.index}]: left margin ${x} EMU`);
          if (y < HALF_INCH_EMU) violations.push(`${layout.name}[${ph.index}]: top margin ${y} EMU`);
          if (x + cx > widthEmu - HALF_INCH_EMU) violations.push(`${layout.name}[${ph.index}]: right margin too small`);
          if (y + cy > heightEmu - HALF_INCH_EMU) violations.push(`${layout.name}[${ph.index}]: bottom margin too small`);
        }
      }

      return {
        id: 'DIM-002',
        severity: 'WARNING',
        status: violations.length === 0 ? 'pass' : 'fail',
        message: violations.length === 0
          ? 'All placeholders respect 0.5" margins'
          : `${violations.length} margin violation(s)`,
        ...(violations.length > 0 && { context: { violations } }),
      };
    },
  },

  // DIM-003: LAYOUT_BULLETS BODY height >= 2.5" (2286000 EMU)
  {
    id: 'DIM-003',
    severity: 'WARNING',
    description: 'BODY de LAYOUT_BULLETS : hauteur ≥ 2.5 po',
    validate: (template) => {
      const layout = findLayout(template, 'LAYOUT_BULLETS');
      if (!layout) {
        return {
          id: 'DIM-003', severity: 'WARNING', status: 'pass',
          message: 'LAYOUT_BULLETS not present, rule skipped',
        };
      }
      const body = layout.placeholders.find(p => p.index === 1 && p.type === 'body');
      if (!body) {
        return {
          id: 'DIM-003', severity: 'WARNING', status: 'pass',
          message: 'LAYOUT_BULLETS body placeholder not found, rule skipped',
        };
      }
      if (body.position.cy === 0) {
        return {
          id: 'DIM-003', severity: 'WARNING', status: 'pass',
          message: 'LAYOUT_BULLETS body has no dimension data, rule skipped',
        };
      }
      const ok = body.position.cy >= MIN_BODY_HEIGHT_EMU;
      return {
        id: 'DIM-003',
        severity: 'WARNING',
        status: ok ? 'pass' : 'fail',
        message: ok
          ? `LAYOUT_BULLETS body height: ${body.position.cy} EMU (≥ ${MIN_BODY_HEIGHT_EMU})`
          : `LAYOUT_BULLETS body height: ${body.position.cy} EMU (< ${MIN_BODY_HEIGHT_EMU})`,
      };
    },
  },

  // DIM-004: LEFT and RIGHT of TWO_COLUMNS don't overlap
  {
    id: 'DIM-004',
    severity: 'WARNING',
    description: 'LEFT et RIGHT de LAYOUT_TWO_COLUMNS ne se chevauchent pas',
    validate: (template) => {
      const layout = findLayout(template, 'LAYOUT_TWO_COLUMNS');
      if (!layout) {
        return {
          id: 'DIM-004', severity: 'WARNING', status: 'pass',
          message: 'LAYOUT_TWO_COLUMNS not present, rule skipped',
        };
      }
      const left = layout.placeholders.find(p => p.index === 1);
      const right = layout.placeholders.find(p => p.index === 2);
      if (!left || !right) {
        return {
          id: 'DIM-004', severity: 'WARNING', status: 'pass',
          message: 'LEFT or RIGHT placeholder not found, rule skipped',
        };
      }
      if (left.position.cx === 0 || right.position.cx === 0) {
        return {
          id: 'DIM-004', severity: 'WARNING', status: 'pass',
          message: 'No dimension data, rule skipped',
        };
      }
      const leftEnd = left.position.x + left.position.cx;
      const overlap = leftEnd > right.position.x;
      return {
        id: 'DIM-004',
        severity: 'WARNING',
        status: overlap ? 'fail' : 'pass',
        message: overlap
          ? `LEFT and RIGHT overlap: left ends at ${leftEnd}, right starts at ${right.position.x}`
          : 'LEFT and RIGHT columns do not overlap',
      };
    },
  },

  // DIM-005: canvas placeholders occupy >= 60% of slide height
  {
    id: 'DIM-005',
    severity: 'WARNING',
    description: 'Placeholders canvas occupent ≥ 60% de la hauteur de la slide',
    validate: (template) => {
      const { heightEmu } = template.slideDimensions;
      const minHeight = heightEmu * CANVAS_HEIGHT_RATIO;
      const canvasLayouts = ['LAYOUT_TIMELINE', 'LAYOUT_ARCHITECTURE'];
      const violations: string[] = [];

      for (const layoutName of canvasLayouts) {
        const layout = findLayout(template, layoutName);
        if (!layout) continue;
        const canvas = layout.placeholders.find(p => p.index === 1);
        if (!canvas || canvas.position.cy === 0) continue;
        if (canvas.position.cy < minHeight) {
          violations.push(`${layoutName} canvas height: ${canvas.position.cy} EMU (< ${Math.round(minHeight)})`);
        }
      }

      return {
        id: 'DIM-005',
        severity: 'WARNING',
        status: violations.length === 0 ? 'pass' : 'fail',
        message: violations.length === 0
          ? 'Canvas placeholders meet 60% height requirement'
          : violations.join('; '),
      };
    },
  },
];
