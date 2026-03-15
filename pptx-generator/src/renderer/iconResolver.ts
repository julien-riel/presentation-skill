import * as fs from 'fs/promises';
import * as path from 'path';
import { Resvg } from '@resvg/resvg-js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export interface ResolvedIcon {
  pngBuffer: Buffer;
  widthPx: number;
  heightPx: number;
}

export type IconCache = Map<string, ResolvedIcon>;

export function createIconCache(): IconCache {
  return new Map();
}

function getLucideIconPath(name: string): string | null {
  try {
    const lucideDir = path.dirname(require.resolve('lucide-static/package.json'));
    return path.join(lucideDir, 'icons', `${name}.svg`);
  } catch {
    return null;
  }
}

export async function resolveIcon(
  name: string,
  color: string,
  sizePx: number,
  cache: IconCache,
): Promise<ResolvedIcon | null> {
  const cacheKey = `${name}-${color}-${sizePx}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const iconPath = getLucideIconPath(name);
  if (!iconPath) {
    console.warn(`[pptx-generator] Icon "${name}" not found in lucide-static`);
    return null;
  }

  let svgContent: string;
  try {
    svgContent = await fs.readFile(iconPath, 'utf-8');
  } catch {
    console.warn(`[pptx-generator] Could not read icon file for "${name}"`);
    return null;
  }

  svgContent = svgContent.replace(/stroke="currentColor"/g, `stroke="#${color}"`);
  svgContent = svgContent.replace(/\bwidth="[^"]*"/, `width="${sizePx}"`);
  svgContent = svgContent.replace(/\bheight="[^"]*"/, `height="${sizePx}"`);

  try {
    const resvg = new Resvg(svgContent, {
      fitTo: { mode: 'width', value: sizePx },
    });
    const rendered = resvg.render();
    const pngBuffer = Buffer.from(rendered.asPng());

    const result: ResolvedIcon = { pngBuffer, widthPx: sizePx, heightPx: sizePx };
    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn(`[pptx-generator] Failed to render icon "${name}": ${err}`);
    return null;
  }
}
