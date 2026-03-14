import * as fs from 'fs/promises';
import JSZip from 'jszip';
import type { Presentation } from '../schema/presentation.js';
import type { TemplateCapabilities } from '../schema/capabilities.js';
import type { LayoutInfo } from '../validator/types.js';
import { LAYOUT_TYPE_TO_PPT_NAME } from '../validator/types.js';
import { readTemplate } from '../validator/templateReader.js';
import { buildSlideShapes } from './placeholderFiller.js';
import { wrapSlideXml, notesSlideXml } from './xmlHelpers.js';

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
): Promise<Buffer> {
  // Open the template
  const templateBuffer = await fs.readFile(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);

  // Read template structure
  const templateInfo = await readTemplate(templatePath);
  const layoutFileMap = buildLayoutFileMap(templateInfo.layouts);

  // Read and parse presentation.xml to get the relationship base
  const presXml = await zip.file('ppt/presentation.xml')!.async('text');

  // Track new slides
  const slideEntries: Array<{
    slideNum: number;
    slideXml: string;
    layoutIndex: number;
    notes?: string;
  }> = [];

  let nextShapeId = 100; // Start high to avoid conflicts with layout shapes

  for (let i = 0; i < presentation.slides.length; i++) {
    const slide = presentation.slides[i];
    const layoutType = slide._resolvedLayout ?? slide.layout;
    const pptName = LAYOUT_TYPE_TO_PPT_NAME[layoutType] ?? 'LAYOUT_GENERIC';
    const layoutEntry = layoutFileMap.get(pptName);
    const layoutIndex = layoutEntry?.index ?? 1;

    // Build the shapes XML for this slide
    const { shapes, nextId } = buildSlideShapes(slide, nextShapeId, templateInfo);
    nextShapeId = nextId;

    const slideXml = wrapSlideXml(shapes);

    slideEntries.push({
      slideNum: i + 1,
      slideXml,
      layoutIndex,
      notes: slide.notes,
    });
  }

  // Read existing Content_Types
  const contentTypesXml = await zip.file('[Content_Types].xml')!.async('text');

  // Read existing presentation.xml.rels
  const presRelsXml = await zip.file('ppt/_rels/presentation.xml.rels')!.async('text');

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
      const notesXml = notesSlideXml(entry.notes, 'rId1');
      zip.file(notesPath, notesXml);

      // Notes relationships
      const notesRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${entry.slideNum}.xml"/>
</Relationships>`;
      zip.file(`ppt/notesSlides/_rels/notesSlide${entry.slideNum}.xml.rels`, notesRels);

      newContentTypes += `\n  <Override PartName="/${notesPath}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`;

      // Add notes reference to slide rels
      const slideRelsContent = await zip.file(`ppt/slides/_rels/slide${entry.slideNum}.xml.rels`)!.async('text');
      const updatedSlideRels = slideRelsContent.replace(
        '</Relationships>',
        `  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${entry.slideNum}.xml"/>\n</Relationships>`
      );
      zip.file(`ppt/slides/_rels/slide${entry.slideNum}.xml.rels`, updatedSlideRels);
    }
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
