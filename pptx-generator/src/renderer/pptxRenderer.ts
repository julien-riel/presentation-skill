import * as fs from 'fs/promises';
import JSZip from 'jszip';
import type { Presentation } from '../schema/presentation.js';
import type { TemplateCapabilities } from '../schema/capabilities.js';
import type { LayoutInfo, TemplateInfo } from '../validator/types.js';
import { LAYOUT_TYPE_TO_PPT_NAME } from '../validator/constants.js';
import { buildSlideShapes } from './placeholderFiller.js';
import type { IconRequest } from './placeholderFiller.js';
import type { ChartRequest } from './chartDrawer.js';
import { buildChartRelsXml } from './charts/chartStyleBuilder.js';
import { resolveIcon, createIconCache } from './iconResolver.js';
import { wrapSlideXml, notesSlideXml, pictureShape } from './xmlHelpers.js';

/**
 * Maps layout type names (e.g. "bullets") to their slideLayout file index
 * inside the template ZIP.
 */
function buildLayoutFileMap(layouts: LayoutInfo[]): Map<string, { filePath: string; index: number }> {
  const map = new Map<string, { filePath: string; index: number }>();
  for (const layout of layouts) {
    // Extract index from path like "ppt/slideLayouts/slideLayout3.xml" → 3
    const match = layout.filePath.match(/slideLayout(\d+)\.xml$/);
    const index = match ? parseInt(match[1], 10) : 0;
    map.set(layout.name, { filePath: layout.filePath, index });
  }
  return map;
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
  templatePath: string,
  templateInfo: TemplateInfo,
): Promise<Buffer> {
  // Open the template
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  // Build layout map from already-read template info
  const layoutFileMap = buildLayoutFileMap(templateInfo.layouts);

  // Read and parse presentation.xml to get the relationship base
  const presXmlEntry = zip.file('ppt/presentation.xml');
  if (!presXmlEntry) throw new Error('Template is missing required file: ppt/presentation.xml');
  const presXml = await presXmlEntry.async('text');

  // Track new slides
  const slideEntries: Array<{
    slideNum: number;
    slideXml: string;
    layoutIndex: number;
    notes?: string;
    images: Array<{ relId: string; mediaPath: string; pngBuffer: Buffer }>;
    charts: Array<{ chartNum: number; chartRelId: string; chartRequest: ChartRequest }>;
  }> = [];

  const iconCache = createIconCache();
  let nextImageNum = 1;
  let nextChartNum = 1;
  let hasImages = false;
  let nextShapeId = 100; // Start high to avoid conflicts with layout shapes

  for (let i = 0; i < presentation.slides.length; i++) {
    const slide = presentation.slides[i];
    const layoutType = slide._resolvedLayout ?? slide.layout;
    const pptName = LAYOUT_TYPE_TO_PPT_NAME[layoutType] ?? 'LAYOUT_GENERIC';
    const layoutEntry = layoutFileMap.get(pptName);
    const layoutIndex = layoutEntry?.index ?? 1;

    // Build the shapes XML for this slide
    const { shapes, nextId, iconRequests, chartRequests } = buildSlideShapes(slide, nextShapeId, templateInfo);
    nextShapeId = nextId;

    let allShapes = shapes;
    const slideImages: Array<{ relId: string; mediaPath: string; pngBuffer: Buffer }> = [];

    for (const req of iconRequests) {
      const icon = await resolveIcon(req.name, req.color, req.sizePx, iconCache);
      if (!icon) continue;

      const mediaPath = `ppt/media/image${nextImageNum}.png`;
      const relId = `rIdImg${nextImageNum}`;
      nextImageNum++;

      allShapes += pictureShape(nextShapeId++, relId, req.x, req.y, req.cx, req.cy);
      slideImages.push({ relId, mediaPath, pngBuffer: icon.pngBuffer });
      hasImages = true;
    }

    // Process chart requests: replace __CHART_RELID__ tokens BEFORE wrapping
    const slideCharts: Array<{ chartNum: number; chartRelId: string; chartRequest: ChartRequest }> = [];
    for (const chartReq of chartRequests) {
      const chartNum = nextChartNum++;
      const chartRelId = `rIdChart${chartNum}`;
      allShapes = allShapes.replace('__CHART_RELID__', chartRelId);
      slideCharts.push({ chartNum, chartRelId, chartRequest: chartReq });
    }

    const slideXml = wrapSlideXml(allShapes);

    slideEntries.push({
      slideNum: i + 1,
      slideXml,
      layoutIndex,
      notes: slide.notes,
      images: slideImages,
      charts: slideCharts,
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

  // Find the highest existing rId in presentation.rels
  const rIdMatches = [...presRelsXml.matchAll(/Id="rId(\d+)"/g)];
  let nextRId = Math.max(...rIdMatches.map(m => parseInt(m[1], 10)), 0) + 1;

  // Build slide files and relationships
  let newContentTypes = contentTypesXml.replace('</Types>', '');
  let newPresRels = presRelsXml.replace('</Relationships>', '');
  let sldIdLst = '';
  const baseSlideId = 256;

  for (const entry of slideEntries) {
    const slidePath = `ppt/slides/slide${entry.slideNum}.xml`;
    const slideRId = `rId${nextRId++}`;

    // Write slide XML
    zip.file(slidePath, entry.slideXml);

    // Write slide relationships (points to the correct slideLayout)
    const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${entry.layoutIndex}.xml"/>
</Relationships>`;
    zip.file(`ppt/slides/_rels/slide${entry.slideNum}.xml.rels`, slideRels);

    // Add to Content_Types
    newContentTypes += `\n  <Override PartName="/${slidePath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;

    // Add to presentation.rels
    newPresRels += `\n  <Relationship Id="${slideRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${entry.slideNum}.xml"/>`;

    // Build sldIdLst entry
    sldIdLst += `\n    <p:sldId id="${baseSlideId + entry.slideNum}" r:id="${slideRId}"/>`;

    // Handle speaker notes
    if (entry.notes) {
      const notesPath = `ppt/notesSlides/notesSlide${entry.slideNum}.xml`;
      const notesXml = notesSlideXml(entry.notes);
      zip.file(notesPath, notesXml);

      // Notes relationships
      const notesRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${entry.slideNum}.xml"/>
</Relationships>`;
      zip.file(`ppt/notesSlides/_rels/notesSlide${entry.slideNum}.xml.rels`, notesRels);

      newContentTypes += `\n  <Override PartName="/${notesPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`;

      // Add notes reference to slide rels
      const slideRelsPath = `ppt/slides/_rels/slide${entry.slideNum}.xml.rels`;
      const slideRelsEntry = zip.file(slideRelsPath);
      if (!slideRelsEntry) throw new Error(`Template is missing required file: ${slideRelsPath}`);
      const slideRelsContent = await slideRelsEntry.async('text');
      const updatedSlideRels = slideRelsContent.replace(
        '</Relationships>',
        `  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${entry.slideNum}.xml"/>\n</Relationships>`
      );
      zip.file(`ppt/slides/_rels/slide${entry.slideNum}.xml.rels`, updatedSlideRels);
    }

    // Write image files to ZIP and update slide rels
    for (const img of entry.images) {
      zip.file(img.mediaPath, img.pngBuffer);
    }

    if (entry.images.length > 0) {
      const imgRelsPath = `ppt/slides/_rels/slide${entry.slideNum}.xml.rels`;
      const imgRelsEntry = zip.file(imgRelsPath);
      if (!imgRelsEntry) throw new Error(`Template is missing required file: ${imgRelsPath}`);
      const currentRels = await imgRelsEntry.async('text');
      const imageRels = entry.images.map(img =>
        `  <Relationship Id="${img.relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${img.mediaPath.split('/').pop()}"/>`
      ).join('\n');
      const updatedRels = currentRels.replace(
        '</Relationships>',
        `${imageRels}\n</Relationships>`
      );
      zip.file(`ppt/slides/_rels/slide${entry.slideNum}.xml.rels`, updatedRels);
    }

    // Write chart files to ZIP and update slide rels
    for (const chart of entry.charts) {
      const { chartNum, chartRelId, chartRequest } = chart;

      // Write chart XML files
      zip.file(`ppt/charts/chart${chartNum}.xml`, chartRequest.chartXml);
      zip.file(`ppt/charts/style${chartNum}.xml`, chartRequest.styleXml);
      zip.file(`ppt/charts/colors${chartNum}.xml`, chartRequest.colorsXml);

      // Write chart rels
      zip.file(`ppt/charts/_rels/chart${chartNum}.xml.rels`, buildChartRelsXml(chartNum));

      // Add chart relationship to slide rels
      const chartRelsPath = `ppt/slides/_rels/slide${entry.slideNum}.xml.rels`;
      const chartRelsEntry = zip.file(chartRelsPath);
      if (!chartRelsEntry) throw new Error(`Missing slide rels: ${chartRelsPath}`);
      const chartCurrentRels = await chartRelsEntry.async('text');
      const updatedChartRels = chartCurrentRels.replace(
        '</Relationships>',
        `  <Relationship Id="${chartRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${chartNum}.xml"/>\n</Relationships>`
      );
      zip.file(chartRelsPath, updatedChartRels);

      // Add content type overrides for chart files
      newContentTypes += `\n  <Override PartName="/ppt/charts/chart${chartNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`;
      newContentTypes += `\n  <Override PartName="/ppt/charts/style${chartNum}.xml" ContentType="application/vnd.ms-office.chartstyle+xml"/>`;
      newContentTypes += `\n  <Override PartName="/ppt/charts/colors${chartNum}.xml" ContentType="application/vnd.ms-office.chartcolorstyle+xml"/>`;
    }
  }

  if (hasImages && !newContentTypes.includes('Extension="png"')) {
    newContentTypes += '\n  <Default Extension="png" ContentType="image/png"/>';
  }
  newContentTypes += '\n</Types>';
  newPresRels += '\n</Relationships>';

  // Update Content_Types
  zip.file('[Content_Types].xml', newContentTypes);

  // Update presentation.xml.rels
  zip.file('ppt/_rels/presentation.xml.rels', newPresRels);

  // Update presentation.xml to include slide list
  let updatedPresXml: string;
  if (presXml.includes('<p:sldIdLst')) {
    // Replace empty or existing sldIdLst
    updatedPresXml = presXml.replace(
      /<p:sldIdLst[^>]*\/>/,
      `<p:sldIdLst>${sldIdLst}\n  </p:sldIdLst>`
    ).replace(
      /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,
      `<p:sldIdLst>${sldIdLst}\n  </p:sldIdLst>`
    );
  } else {
    // Insert sldIdLst after sldMasterIdLst
    updatedPresXml = presXml.replace(
      '</p:sldMasterIdLst>',
      `</p:sldMasterIdLst>\n  <p:sldIdLst>${sldIdLst}\n  </p:sldIdLst>`
    );
  }
  zip.file('ppt/presentation.xml', updatedPresXml);

  // Generate output
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buffer as Buffer;
}
