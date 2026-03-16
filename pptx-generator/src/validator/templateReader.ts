import * as fs from 'fs/promises';
import JSZip from 'jszip';
import { parseStringPromise } from 'xml2js';
import type { TemplateInfo, LayoutInfo, PlaceholderInfo, ThemeInfo } from './types.js';

/**
 * Reads a .pptx file and extracts template structure:
 * layout names, placeholders (index, type, position in EMU), theme info.
 */
export async function readTemplate(pptxPath: string): Promise<TemplateInfo> {
  const buffer = await fs.readFile(pptxPath);
  const zip = await JSZip.loadAsync(buffer);

  const layouts = await extractLayouts(zip);
  const theme = await extractTheme(zip);
  const slideDimensions = await extractSlideDimensions(zip);

  return { layouts, theme, slideDimensions };
}

/**
 * Extracts layout information from slideLayout XML files.
 */
async function extractLayouts(zip: JSZip): Promise<LayoutInfo[]> {
  const layouts: LayoutInfo[] = [];
  const layoutFiles = Object.keys(zip.files).filter(
    (f) => f.startsWith('ppt/slideLayouts/slideLayout') && f.endsWith('.xml')
  );

  for (const file of layoutFiles) {
    const xml = await zip.file(file)!.async('text');
    const parsed = await parseStringPromise(xml, { explicitArray: true });

    const cSld = parsed['p:sldLayout']?.['p:cSld']?.[0];
    if (!cSld) continue;

    const name = cSld.$?.name ?? parsed['p:sldLayout']?.$?.['name'] ?? '';
    const layoutName = name || extractLayoutNameFromAttrs(parsed);

    const placeholders = extractPlaceholders(cSld);

    layouts.push({
      name: layoutName,
      filePath: file,
      placeholders,
    });
  }

  return layouts;
}

/**
 * Tries to extract layout name from various XML attributes.
 */
function extractLayoutNameFromAttrs(parsed: Record<string, unknown>): string {
  const root = parsed['p:sldLayout'] as Record<string, unknown> | undefined;
  if (!root) return '';
  const attrs = root['$'] as Record<string, string> | undefined;
  return attrs?.['name'] ?? '';
}

/**
 * Parses an integer from an XML attribute, returning fallback on NaN.
 */
function safeParseInt(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? String(fallback), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Extracts placeholder info from a cSld element.
 */
function extractPlaceholders(cSld: Record<string, unknown>): PlaceholderInfo[] {
  const placeholders: PlaceholderInfo[] = [];
  const spTree = (cSld['p:spTree'] as unknown[])?.[0] as Record<string, unknown> | undefined;
  if (!spTree) return placeholders;

  const shapes = (spTree['p:sp'] as unknown[]) ?? [];
  for (const sp of shapes) {
    const shape = sp as Record<string, unknown>;
    const nvSpPr = (shape['p:nvSpPr'] as unknown[])?.[0] as Record<string, unknown> | undefined;
    if (!nvSpPr) continue;

    const nvPr = (nvSpPr['p:nvPr'] as unknown[])?.[0] as Record<string, unknown> | undefined;
    if (!nvPr) continue;

    const ph = (nvPr['p:ph'] as unknown[])?.[0] as Record<string, unknown> | undefined;
    if (!ph) continue;

    const phAttrs = ph['$'] as Record<string, string> | undefined;
    if (!phAttrs) continue;

    const index = safeParseInt(phAttrs['idx'], 0);
    const type = phAttrs['type'] ?? 'body';

    const spPr = (shape['p:spPr'] as unknown[])?.[0] as Record<string, unknown> | undefined;
    const xfrm = (spPr?.['a:xfrm'] as unknown[])?.[0] as Record<string, unknown> | undefined;
    const off = (xfrm?.['a:off'] as unknown[])?.[0] as Record<string, unknown> | undefined;
    const ext = (xfrm?.['a:ext'] as unknown[])?.[0] as Record<string, unknown> | undefined;

    const offAttrs = off?.['$'] as Record<string, string> | undefined;
    const extAttrs = ext?.['$'] as Record<string, string> | undefined;

    placeholders.push({
      index,
      type,
      position: {
        x: safeParseInt(offAttrs?.['x'], 0),
        y: safeParseInt(offAttrs?.['y'], 0),
        cx: safeParseInt(extAttrs?.['cx'], 0),
        cy: safeParseInt(extAttrs?.['cy'], 0),
      },
    });
  }

  return placeholders;
}

/**
 * Extracts theme information (fonts, accent colors) from theme1.xml.
 */
async function extractTheme(zip: JSZip): Promise<ThemeInfo> {
  const defaultTheme: ThemeInfo = {
    titleFont: '',
    bodyFont: '',
    accentColors: [],
  };

  const themeFile = Object.keys(zip.files).find(
    (f) => f.startsWith('ppt/theme/theme') && f.endsWith('.xml')
  );
  if (!themeFile) return defaultTheme;

  const xml = await zip.file(themeFile)!.async('text');
  const parsed = await parseStringPromise(xml, { explicitArray: true });

  const themeElements = parsed['a:theme']?.['a:themeElements']?.[0];
  if (!themeElements) return defaultTheme;

  // Extract fonts
  const fontScheme = themeElements['a:fontScheme']?.[0];
  const majorFont = fontScheme?.['a:majorFont']?.[0];
  const minorFont = fontScheme?.['a:minorFont']?.[0];

  const titleFont = (majorFont?.['a:latin']?.[0]?.['$'] as Record<string, string>)?.typeface ?? '';
  const bodyFont = (minorFont?.['a:latin']?.[0]?.['$'] as Record<string, string>)?.typeface ?? '';

  // Extract accent colors from color scheme
  const clrScheme = themeElements['a:clrScheme']?.[0];
  const accentColors: string[] = [];
  if (clrScheme) {
    for (let i = 1; i <= 6; i++) {
      const accent = clrScheme[`a:accent${i}`]?.[0];
      if (accent) {
        const srgb = accent['a:srgbClr']?.[0];
        const sysClr = accent['a:sysClr']?.[0];
        const val = (srgb?.['$'] as Record<string, string>)?.val
          ?? (sysClr?.['$'] as Record<string, string>)?.lastClr
          ?? '';
        if (val) {
          accentColors.push(`#${val}`);
        }
      }
    }
  }

  return { titleFont, bodyFont, accentColors };
}

/**
 * Extracts slide dimensions from presentation.xml.
 */
async function extractSlideDimensions(zip: JSZip): Promise<{ widthEmu: number; heightEmu: number }> {
  const defaultDimensions = { widthEmu: 12192000, heightEmu: 6858000 };

  const presFile = zip.file('ppt/presentation.xml');
  if (!presFile) return defaultDimensions;

  const xml = await presFile.async('text');
  const parsed = await parseStringPromise(xml, { explicitArray: true });

  const sldSz = parsed['p:presentation']?.['p:sldSz']?.[0];
  if (!sldSz) return defaultDimensions;

  const attrs = sldSz['$'] as Record<string, string> | undefined;
  return {
    widthEmu: safeParseInt(attrs?.['cx'], 12192000),
    heightEmu: safeParseInt(attrs?.['cy'], 6858000),
  };
}
