import type { ValidationRule } from '../types.js';
import { FALLBACK_CASCADES } from '../types.js';
import { generateManifest } from '../manifestGenerator.js';

export const manifestRules: ValidationRule[] = [
  // MAN-001: manifest must be generated successfully
  {
    id: 'MAN-001',
    severity: 'ERROR',
    description: 'Le manifeste doit être généré avec succès',
    validate: (template) => {
      try {
        generateManifest(template, 'validation-check');
        return {
          id: 'MAN-001',
          severity: 'ERROR',
          status: 'pass',
          message: 'Manifest generated successfully',
        };
      } catch (err) {
        return {
          id: 'MAN-001',
          severity: 'ERROR',
          status: 'fail',
          message: `Manifest generation failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  },

  // MAN-002: fallback_map must be coherent (each cascade reaches generic)
  {
    id: 'MAN-002',
    severity: 'ERROR',
    description: 'Le fallback_map doit être cohérent (chaque cascade atteint generic)',
    validate: (template) => {
      try {
        const manifest = generateManifest(template, 'validation-check');
        const supported = new Set(manifest.supported_layouts);
        const broken: string[] = [];

        for (const [layout, cascade] of Object.entries(FALLBACK_CASCADES)) {
          if (supported.has(layout)) continue;
          // Check that at least one layout in the cascade is supported
          const reachesSupported = cascade.some(t => supported.has(t));
          if (!reachesSupported) {
            broken.push(layout);
          }
          // Check that generic is reachable (must be in cascade and supported)
          if (!cascade.includes('generic') || !supported.has('generic')) {
            if (!broken.includes(layout)) broken.push(layout);
          }
        }

        return {
          id: 'MAN-002',
          severity: 'ERROR',
          status: broken.length === 0 ? 'pass' : 'fail',
          message: broken.length === 0
            ? 'All fallback cascades reach generic'
            : `Broken cascades for: ${broken.join(', ')}`,
          ...(broken.length > 0 && { context: { broken } }),
        };
      } catch {
        return {
          id: 'MAN-002',
          severity: 'ERROR',
          status: 'fail',
          message: 'Cannot check fallback coherence: manifest generation failed',
        };
      }
    },
  },
];
