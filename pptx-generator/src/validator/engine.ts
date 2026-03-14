import type { TemplateInfo, ValidationResult } from './types.js';
import { allRules } from './rules/index.js';

/**
 * Runs all validation rules against a template and returns results.
 */
export function runValidation(template: TemplateInfo): ValidationResult[] {
  return allRules.map(rule => rule.validate(template));
}
