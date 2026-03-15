import type { TemplateInfo, LayoutInfo } from '../types.js';

/**
 * Finds a layout by PPT name in the template.
 */
export function findLayout(template: TemplateInfo, name: string): LayoutInfo | undefined {
  return template.layouts.find(l => l.name === name);
}
