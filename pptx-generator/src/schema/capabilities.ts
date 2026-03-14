import { z } from 'zod';
import { LayoutTypeSchema } from './presentation.js';

/**
 * Schema for the template-capabilities.json manifest
 * produced by the validator after analyzing a .pptx template.
 */
export const TemplateCapabilitiesSchema = z.object({
  template: z.string(),
  generated_at: z.string(),
  validator_version: z.string(),
  tier: z.number().int().min(1).max(3),
  supported_layouts: z.array(LayoutTypeSchema),
  unsupported_layouts: z.array(LayoutTypeSchema),
  fallback_map: z.record(z.string(), z.string()),
  placeholders: z.record(z.string(), z.record(z.string(), z.number())),
  theme: z.object({
    title_font: z.string(),
    body_font: z.string(),
    accent_colors: z.array(z.string()),
  }),
  slide_dimensions: z.object({
    width_emu: z.number(),
    height_emu: z.number(),
  }),
});

export type TemplateCapabilities = z.infer<typeof TemplateCapabilitiesSchema>;
