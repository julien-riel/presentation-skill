import type { ValidationRule } from '../types.js';
import {
  TIER1_LAYOUTS,
  TIER2_LAYOUTS,
  ALL_LAYOUT_TYPES,
} from '../constants.js';
import { getSupportedLayoutTypes } from '../manifestGenerator.js';

export const tierRules: ValidationRule[] = [
  // TIER-001: must satisfy Tier 1
  {
    id: 'TIER-001',
    severity: 'ERROR',
    description: 'Template must satisfy Tier 1 (title, section, bullets, generic)',
    validate: (template) => {
      const supported = getSupportedLayoutTypes(template);
      const missing = TIER1_LAYOUTS.filter(t => !supported.includes(t));
      return {
        id: 'TIER-001',
        severity: 'ERROR',
        status: missing.length === 0 ? 'pass' : 'fail',
        message: missing.length === 0
          ? 'Tier 1 requirements satisfied'
          : `Tier 1 missing: ${missing.join(', ')}`,
        ...(missing.length > 0 && { context: { missing } }),
      };
    },
  },

  // TIER-002: Tier 2 layouts missing
  {
    id: 'TIER-002',
    severity: 'WARNING',
    description: 'Missing Tier 2 layouts (twoColumns, timeline)',
    validate: (template) => {
      const supported = getSupportedLayoutTypes(template);
      const tier2Only = TIER2_LAYOUTS.filter(t => !TIER1_LAYOUTS.includes(t));
      const missing = tier2Only.filter(t => !supported.includes(t));
      return {
        id: 'TIER-002',
        severity: 'WARNING',
        status: missing.length === 0 ? 'pass' : 'fail',
        message: missing.length === 0
          ? 'Tier 2 requirements satisfied'
          : `Tier 2 missing: ${missing.join(', ')}`,
        ...(missing.length > 0 && { context: { missing } }),
      };
    },
  },

  // TIER-003: Tier 3+ layouts missing
  {
    id: 'TIER-003',
    severity: 'INFO',
    description: 'Missing Tier 3+ layouts',
    validate: (template) => {
      const supported = getSupportedLayoutTypes(template);
      const tier3Only = ALL_LAYOUT_TYPES.filter(t => !TIER2_LAYOUTS.includes(t));
      const missing = tier3Only.filter(t => !supported.includes(t));
      return {
        id: 'TIER-003',
        severity: 'INFO',
        status: missing.length === 0 ? 'pass' : 'fail',
        message: missing.length === 0
          ? 'All Tier 3+ layouts present'
          : `Tier 3+ missing: ${missing.join(', ')}`,
        ...(missing.length > 0 && { context: { missing } }),
      };
    },
  },
];
