import type { ValidationRule } from '../types.js';
import { layoutRules } from './layoutRules.js';
import { placeholderRules } from './placeholderRules.js';
import { dimensionRules } from './dimensionRules.js';
import { themeRules } from './themeRules.js';
import { tierRules } from './tierRules.js';
import { manifestRules } from './manifestRules.js';

export const allRules: ValidationRule[] = [
  ...layoutRules,
  ...placeholderRules,
  ...dimensionRules,
  ...themeRules,
  ...tierRules,
  ...manifestRules,
];

export {
  layoutRules,
  placeholderRules,
  dimensionRules,
  themeRules,
  tierRules,
  manifestRules,
};
