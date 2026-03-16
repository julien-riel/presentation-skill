import * as fs from 'fs/promises';
import * as path from 'path';
import JSZip from 'jszip';
import type { Presentation } from '../schema/presentation.js';
import type { TemplateCapabilities } from '../schema/capabilities.js';
import type { LayoutInfo, TemplateInfo } from '../validator/types.js';
import { LAYOUT_TYPE_TO_PPT_NAME } from '../validator/constants.js';
import { buildSlideShapes } from './placeholderFiller.js';
import type { IconRequest, ImageRequest, HyperlinkRequest } from './placeholderFiller.js';
import type { ChartRequest } from './chartDrawer.js';
import { buildChartRelsXml } from './charts/chartStyleBuilder.js';
import { resolveIcon, createIconCache } from './iconResolver.js';
import { wrapSlideXml, notesSlideXml, pictureShape, textBoxShape, emu } from './xmlHelpers.js';

/** Slide entry collected during the per-slide loop. */
interface SlideEntry {
  slideNum: number;
  slideXml: string;
  layoutIndex: number;
  notes?: string;
  images: Array<{ relId: string; mediaPath: string; pngBuffer: Buffer }>;
  charts: Array<{ chartNum: number; chartRelId: string; chartRequest: ChartRequest }>;
  hyperlinks: Array<{ relId: string; url: string }>;
}

/**
 * Adds a relationship entry to a slide's .rels file.
 */
async function addSlideRelationship(
  zip: JSZip,
  slideNum: number,
  relId: string,
  type: string,
  target: string,
  targetMode?: string,
): Promise<void> {
  const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
  const relsEntry = zip.file(relsPath);
  if (!relsEntry) throw new Error(`Missing slide rels: ${relsPath}`);
  const currentRels = await relsEntry.async('text');
  const modeAttr = targetMode ? ` TargetMode="${targetMode}"` : '';
  const updated = currentRels.replace(
    '</Relationships>',
    `  <Relationship Id="${relId}" Type="${type}" Target="${target}"${modeAttr}/>\n</Relationships>`,
  );
  zip.file(relsPath, updated);
}

/**
 * Embeds speaker notes for a slide: writes the notesSlide XML, its rels,
 * adds the content-type override, and links the notes into the slide rels.
 * Returns the content-type override string to append.
 */
async function embedSlideNotes(
  zip: JSZip,
  slideNum: number,
  notes: string,
  relId: string,
): Promise<string> {
  const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`;
  const notesXml = notesSlideXml(notes);
  zip.file(notesPath, notesXml);

  // Notes relationships
  const notesRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${slideNum}.xml"/>
</Relationships>`;
  zip.file(`ppt/notesSlides/_rels/notesSlide${slideNum}.xml.rels`, notesRels);

  // Add notes reference to slide rels
  await addSlideRelationship(
    zip,
    slideNum,
    relId,
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide',
    `../notesSlides/notesSlide${slideNum}.xml`,
  );

  return `\n  <Override PartName="/${notesPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`;
}

/**
 * Embeds image files into the ZIP and adds their relationships to the slide.
 */
async function embedSlideImages(
  zip: JSZip,
  slideNum: number,
  images: Array<{ relId: string; mediaPath: string; pngBuffer: Buffer }>,
): Promise<void> {
  for (const img of images) {
    zip.file(img.mediaPath, img.pngBuffer);
  }
  if (images.length > 0) {
    for (const img of images) {
      await addSlideRelationship(
        zip,
        slideNum,
        img.relId,
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
        `../media/${img.mediaPath.split('/').pop()}`,
      );
    }
  }
}

/**
 * Embeds chart files into the ZIP, adds their relationships to the slide,
 * and collects content-type override strings.
 */
async function embedSlideCharts(
  zip: JSZip,
  slideNum: number,
  charts: Array<{ chartNum: number; chartRelId: string; chartRequest: ChartRequest }>,
  newContentTypes: string[],
): Promise<void> {
  for (const chart of charts) {
    const { chartNum, chartRelId, chartRequest } = chart;

    // Write chart XML files
    zip.file(`ppt/charts/chart${chartNum}.xml`, chartRequest.chartXml);
    zip.file(`ppt/charts/style${chartNum}.xml`, chartRequest.styleXml);
    zip.file(`ppt/charts/colors${chartNum}.xml`, chartRequest.colorsXml);

    // Write chart rels
    zip.file(`ppt/charts/_rels/chart${chartNum}.xml.rels`, buildChartRelsXml(chartNum));

    // Add chart relationship to slide rels
    await addSlideRelationship(
      zip,
      slideNum,
      chartRelId,
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart',
      `../charts/chart${chartNum}.xml`,
    );

    // Collect content type overrides for chart files
    newContentTypes.push(
      `\n  <Override PartName="/ppt/charts/chart${chartNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`,
    );
    newContentTypes.push(
      `\n  <Override PartName="/ppt/charts/style${chartNum}.xml" ContentType="application/vnd.ms-office.chartstyle+xml"/>`,
    );
    newContentTypes.push(
      `\n  <Override PartName="/ppt/charts/colors${chartNum}.xml" ContentType="application/vnd.ms-office.chartcolorstyle+xml"/>`,
    );
  }
}

/** Maps file extensions to OOXML content types for image embedding. */
const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

/**
 * Returns the OOXML-compatible extension (without dot) for a file path.
 * Falls back to 'png' for unrecognised extensions.
 */
function imageExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return ext && ext in IMAGE_CONTENT_TYPES ? ext.slice(1) : 'png';
}

/**
 * Maps layout type names (e.g. "bullets") to their slideLayout file index
 * inside the template ZIP.
 */
function buildLayoutFileMap(layouts: LayoutInfo[]): Map<string, { filePath: string; index: number }> {
  const map = new Map<string, { filePath: string; index: number }>();
  for (const layout of layouts) {
    // Extract index from path like "ppt/slideLayouts/slideLayout3.xml" -> 3
    const match = layout.filePath.match(/slideLayout(\d+)\.xml$/);
    const index = match ? parseInt(match[1], 10) : 0;
    map.set(layout.name, { filePath: layout.filePath, index });
  }
  return map;
}

/**
 * Assembles the [Content_Types].xml by appending overrides for new slides
 * and image extension defaults. Pure function — no ZIP manipulation.
 */
function buildContentTypesXml(
  baseXml: string,
  slideEntries: SlideEntry[],
  imageExtensionsUsed: Set<string>,
  noteOverrides: string[],
  chartOverrides: string[],
): string {
  let xml = baseXml.replace('</Types>', '');

  for (const entry of slideEntries) {
    const slidePath = `ppt/slides/slide${entry.slideNum}.xml`;
    xml += `\n  <Override PartName="/${slidePath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }

  xml += noteOverrides.join('');
  xml += chartOverrides.join('');

  for (const ext of imageExtensionsUsed) {
    const dotExt = `.${ext}`;
    const contentType = IMAGE_CONTENT_TYPES[dotExt] ?? 'image/png';
    if (!xml.includes(`Extension="${ext}"`)) {
      xml += `\n  <Default Extension="${ext}" ContentType="${contentType}"/>`;
    }
  }

  xml += '\n</Types>';
  return xml;
}

/**
 * Assembles ppt/_rels/presentation.xml.rels by appending slide relationships.
 * Returns the updated XML and a mapping of slideNum to its rId.
 * Pure function — no ZIP manipulation.
 */
function buildPresRelsXml(
  baseXml: string,
  slideEntries: SlideEntry[],
): { xml: string; slideRIds: Map<number, string> } {
  const rIdMatches = [...baseXml.matchAll(/Id="rId(\d+)"/g)];
  let nextRId = Math.max(...rIdMatches.map(m => parseInt(m[1], 10)), 0) + 1;

  let xml = baseXml.replace('</Relationships>', '');
  const slideRIds = new Map<number, string>();

  for (const entry of slideEntries) {
    const slideRId = `rId${nextRId++}`;
    slideRIds.set(entry.slideNum, slideRId);
    xml += `\n  <Relationship Id="${slideRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${entry.slideNum}.xml"/>`;
  }

  xml += '\n</Relationships>';
  return { xml, slideRIds };
}

/**
 * Patches presentation.xml with a sldIdLst containing the new slides.
 * Pure function — no ZIP manipulation.
 */
function updatePresentationXml(
  presXml: string,
  slideEntries: SlideEntry[],
  slideRIds: Map<number, string>,
): string {
  const baseSlideId = 256;
  let sldIdLst = '';
  for (const entry of slideEntries) {
    const slideRId = slideRIds.get(entry.slideNum)!;
    sldIdLst += `\n    <p:sldId id="${baseSlideId + entry.slideNum}" r:id="${slideRId}"/>`;
  }

  if (presXml.includes('<p:sldIdLst')) {
    return presXml.replace(
      /<p:sldIdLst[^>]*\/>/,
      `<p:sldIdLst>${sldIdLst}\n  </p:sldIdLst>`
    ).replace(
      /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
      `<p:sldIdLst>${sldIdLst}\n  </p:sldIdLst>`
    );
  }

  return presXml.replace(
    '</p:sldMasterIdLst>',
    `</p:sldMasterIdLst>\n  <p:sldIdLst>${sldIdLst}\n  </p:sldIdLst>`
  );
}

/**
 * Renders a presentation AST into a .pptx Buffer by opening the template,
 * adding slides that reference its slideLayouts, and filling placeholders.
 *
 * The template determines all visual styling: theme, fonts, colors, backgrounds.
 * The renderer only supplies content.
 */
export async function renderToBuffer(
  presentation: Presentation,
  templateBuffer: Buffer,
  templateInfo: TemplateInfo,
): Promise<Buffer> {
  // Open the template from the provided buffer
  const zip = await JSZip.loadAsync(templateBuffer);

  // Build layout map from already-read template info
  const layoutFileMap = buildLayoutFileMap(templateInfo.layouts);

  // Read and parse presentation.xml to get the relationship base
  const presXmlEntry = zip.file('ppt/presentation.xml');
  if (!presXmlEntry) throw new Error('Template is missing required file: ppt/presentation.xml');
  const presXml = await presXmlEntry.async('text');

  // Track new slides
  const slideEntries: SlideEntry[] = [];

  const iconCache = createIconCache();
  const missingIcons: string[] = [];
  let nextImageNum = 1;
  let nextChartNum = 1;
  let hasImages = false;
  const imageExtensionsUsed = new Set<string>();
  let nextShapeId = 100; // Start high to avoid conflicts with layout shapes

  for (let i = 0; i < presentation.slides.length; i++) {
    const slide = presentation.slides[i];
    const layoutType = slide._resolvedLayout ?? slide.layout;
    const pptName = LAYOUT_TYPE_TO_PPT_NAME[layoutType] ?? 'LAYOUT_GENERIC';
    const layoutEntry = layoutFileMap.get(pptName);
    const layoutIndex = layoutEntry?.index ?? 1;

    // Build the shapes XML for this slide
    const { shapes, nextId, iconRequests, pendingCharts, imageRequests, hyperlinkRequests } = buildSlideShapes(slide, nextShapeId, templateInfo);
    nextShapeId = nextId;

    let allShapes = shapes;
    const slideImages: Array<{ relId: string; mediaPath: string; pngBuffer: Buffer }> = [];

    for (const req of iconRequests) {
      const icon = await resolveIcon(req.name, req.color, req.sizePx, iconCache);
      if (!icon) {
        if (!missingIcons.includes(req.name)) missingIcons.push(req.name);
        continue;
      }

      const mediaPath = `ppt/media/image${nextImageNum}.png`;
      const relId = `rIdImg${nextImageNum}`;
      nextImageNum++;

      allShapes += pictureShape(nextShapeId++, relId, req.x, req.y, req.cx, req.cy, req.name);
      slideImages.push({ relId, mediaPath, pngBuffer: icon.pngBuffer });
      hasImages = true;
      imageExtensionsUsed.add('png');
    }

    // Process user-provided image elements
    for (const imgReq of imageRequests) {
      try {
        const fileBuffer = await fs.readFile(imgReq.filePath);
        const ext = imageExtension(imgReq.filePath);
        const mediaPath = `ppt/media/image${nextImageNum}.${ext}`;
        const relId = `rIdImg${nextImageNum}`;
        nextImageNum++;

        allShapes += pictureShape(nextShapeId++, relId, imgReq.x, imgReq.y, imgReq.cx, imgReq.cy, imgReq.altText);
        slideImages.push({ relId, mediaPath, pngBuffer: fileBuffer as Buffer });
        hasImages = true;
        imageExtensionsUsed.add(ext);
      } catch (err) {
        console.warn(`[pptx-generator] Could not read image "${imgReq.filePath}": ${err instanceof Error ? err.message : err}`);
      }
    }

    // Process pending charts: resolve relIds and build anchor shapes
    const slideCharts: Array<{ chartNum: number; chartRelId: string; chartRequest: ChartRequest }> = [];
    for (const pending of pendingCharts) {
      const chartNum = nextChartNum++;
      const chartRelId = `rIdChart${chartNum}`;
      allShapes += pending.buildAnchorShape(chartRelId);
      slideCharts.push({ chartNum, chartRelId, chartRequest: pending.chartRequest });
    }

    // Process pending hyperlinks: resolve relIds and build shapes
    const slideHyperlinks: Array<{ relId: string; url: string }> = [];
    let nextHlinkNum = 1;
    for (const hlReq of hyperlinkRequests) {
      const relId = `rIdHlink${nextHlinkNum++}`;
      allShapes += hlReq.shapeXmlBuilder(relId);
      slideHyperlinks.push({ relId, url: hlReq.url });
    }

    // Add slide number if enabled
    if (presentation.showSlideNumbers) {
      allShapes += textBoxShape(nextShapeId++, emu(8.5), emu(6.8), emu(1.5), emu(0.4),
        `${i + 1}`, { size: 8, color: '999999', align: 'r', valign: 'b' });
    }

    // Add footer if set
    if (presentation.footer) {
      allShapes += textBoxShape(nextShapeId++, emu(3.0), emu(6.8), emu(4.0), emu(0.4),
        presentation.footer, { size: 8, color: '999999', align: 'ctr', valign: 'b' });
    }

    const slideXml = wrapSlideXml(allShapes);

    slideEntries.push({
      slideNum: i + 1,
      slideXml,
      layoutIndex,
      notes: slide.notes,
      images: slideImages,
      charts: slideCharts,
      hyperlinks: slideHyperlinks,
    });
  }

  // Read existing Content_Types
  const contentTypesEntry = zip.file('[Content_Types].xml');
  if (!contentTypesEntry) throw new Error('Template is missing required file: [Content_Types].xml');
  const contentTypesXml = await contentTypesEntry.async('text');

  // Read existing presentation.xml.rels
  const presRelsEntry = zip.file('ppt/_rels/presentation.xml.rels');
  if (!presRelsEntry) throw new Error('Template is missing required file: ppt/_rels/presentation.xml.rels');
  const presRelsXml = await presRelsEntry.async('text');

  // Collect note and chart content-type overrides during ZIP embedding
  const noteOverrides: string[] = [];
  const chartOverrides: string[] = [];

  for (const entry of slideEntries) {
    // Write slide XML
    zip.file(`ppt/slides/slide${entry.slideNum}.xml`, entry.slideXml);

    // Write slide relationships (points to the correct slideLayout)
    const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${entry.layoutIndex}.xml"/>
</Relationships>`;
    zip.file(`ppt/slides/_rels/slide${entry.slideNum}.xml.rels`, slideRels);

    // Embed speaker notes
    if (entry.notes) {
      noteOverrides.push(await embedSlideNotes(zip, entry.slideNum, entry.notes, 'rIdNotes'));
    }

    // Embed images into ZIP and update slide rels
    await embedSlideImages(zip, entry.slideNum, entry.images);

    // Embed charts into ZIP and update slide rels
    const chartContentTypes: string[] = [];
    await embedSlideCharts(zip, entry.slideNum, entry.charts, chartContentTypes);
    chartOverrides.push(...chartContentTypes);

    // Embed hyperlink relationships
    for (const hl of entry.hyperlinks) {
      await addSlideRelationship(
        zip,
        entry.slideNum,
        hl.relId,
        'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
        hl.url,
        'External',
      );
    }
  }

  // Assemble XML metadata using pure helper functions
  const finalContentTypes = buildContentTypesXml(contentTypesXml, slideEntries, imageExtensionsUsed, noteOverrides, chartOverrides);
  const { xml: finalPresRels, slideRIds } = buildPresRelsXml(presRelsXml, slideEntries);
  const updatedPresXml = updatePresentationXml(presXml, slideEntries, slideRIds);

  // Write assembled XML back into the ZIP
  zip.file('[Content_Types].xml', finalContentTypes);
  zip.file('ppt/_rels/presentation.xml.rels', finalPresRels);
  zip.file('ppt/presentation.xml', updatedPresXml);

  if (missingIcons.length > 0) {
    console.warn(`[pptx-generator] Missing icons: ${missingIcons.join(', ')}`);
  }

  // Generate output
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buffer as Buffer;
}
