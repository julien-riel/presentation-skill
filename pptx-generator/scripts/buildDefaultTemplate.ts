/**
 * Builds a valid Tier 2 default-template.pptx using JSZip and raw OOXML XML.
 *
 * Produces 6 slide layouts:
 *   LAYOUT_TITLE, LAYOUT_SECTION, LAYOUT_BULLETS,
 *   LAYOUT_GENERIC, LAYOUT_TWO_COLUMNS, LAYOUT_TIMELINE
 *
 * Run: npx tsx scripts/buildDefaultTemplate.ts
 */
import JSZip from 'jszip';
import * as fs from 'fs/promises';
import * as path from 'path';

// ---------- Constants ----------
const SLIDE_W = 12192000; // 16:9 width in EMU
const SLIDE_H = 6858000;  // 16:9 height in EMU
const MARGIN = 457200;    // 0.5 inch in EMU

// Accent colors — professional palette, WCAG AA contrast >= 4.5:1 against white
const ACCENT_COLORS = [
  '1B2A4A', // accent1 - dark navy (primary)
  '2D7DD2', // accent2 - vibrant blue
  '17A2B8', // accent3 - teal
  'E8625C', // accent4 - warm coral
  '27AE60', // accent5 - green
  'F39C12', // accent6 - amber (contrast ~3.0 vs white, but 8.5:1 vs dark bg)
];

const OUTPUT_PATH = path.resolve(__dirname, '../assets/default-template.pptx');

// ---------- Helpers ----------

/**
 * Creates a shape XML with placeholder and transform.
 */
function makeShape(
  phType: string,
  phIdx: number,
  x: number,
  y: number,
  cx: number,
  cy: number,
  spId: number,
): string {
  const phAttr = phType === 'body' && phIdx === 0
    ? `type="${phType}"`
    : phType === 'body'
      ? `type="${phType}" idx="${phIdx}"`
      : `type="${phType}" idx="${phIdx}"`;

  return `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${spId}" name="Placeholder ${phIdx}"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph ${phAttr}/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="${x}" y="${y}"/>
            <a:ext cx="${cx}" cy="${cy}"/>
          </a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p><a:endParaRPr lang="en-US"/></a:p>
        </p:txBody>
      </p:sp>`;
}

/**
 * Wraps shapes in a slideLayout XML document.
 */
function makeSlideLayout(layoutName: string, shapes: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             type="obj" preserve="1">
  <p:cSld name="${layoutName}">
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>${shapes}
    </p:spTree>
  </p:cSld>
</p:sldLayout>`;
}

// ---------- Layout Definitions ----------

// Standard title bar: across top, leaving margins
const TITLE_X = MARGIN;
const TITLE_Y = MARGIN;
const TITLE_CX = SLIDE_W - 2 * MARGIN;
const TITLE_CY = 1143000; // ~1.25"

// Standard body area below title bar
const BODY_X = MARGIN;
const BODY_Y = TITLE_Y + TITLE_CY + MARGIN;
const BODY_CX = SLIDE_W - 2 * MARGIN;
const BODY_CY = SLIDE_H - BODY_Y - MARGIN;

/**
 * LAYOUT_TITLE: ctrTitle@idx=0, subTitle@idx=1
 */
function layoutTitle(): string {
  const ctrTitleCy = 1828800; // ~2"
  const ctrTitleY = Math.floor((SLIDE_H - ctrTitleCy - 914400 - MARGIN) / 2);
  const subTitleY = ctrTitleY + ctrTitleCy + MARGIN;
  const subTitleCy = 914400; // ~1"
  const shapes =
    makeShape('ctrTitle', 0, MARGIN, ctrTitleY, TITLE_CX, ctrTitleCy, 2) +
    makeShape('subTitle', 1, MARGIN, subTitleY, TITLE_CX, subTitleCy, 3);
  return makeSlideLayout('LAYOUT_TITLE', shapes);
}

/**
 * LAYOUT_SECTION: title@idx=0, body@idx=1
 */
function layoutSection(): string {
  const shapes =
    makeShape('title', 0, TITLE_X, TITLE_Y, TITLE_CX, TITLE_CY, 2) +
    makeShape('body', 1, BODY_X, BODY_Y, BODY_CX, BODY_CY, 3);
  return makeSlideLayout('LAYOUT_SECTION', shapes);
}

/**
 * LAYOUT_BULLETS: title@idx=0, body@idx=1 (body cy >= 2286000 EMU)
 */
function layoutBullets(): string {
  // BODY_CY is already well above 2286000
  const shapes =
    makeShape('title', 0, TITLE_X, TITLE_Y, TITLE_CX, TITLE_CY, 2) +
    makeShape('body', 1, BODY_X, BODY_Y, BODY_CX, BODY_CY, 3);
  return makeSlideLayout('LAYOUT_BULLETS', shapes);
}

/**
 * LAYOUT_GENERIC: title@idx=0, body@idx=1
 */
function layoutGeneric(): string {
  const shapes =
    makeShape('title', 0, TITLE_X, TITLE_Y, TITLE_CX, TITLE_CY, 2) +
    makeShape('body', 1, BODY_X, BODY_Y, BODY_CX, BODY_CY, 3);
  return makeSlideLayout('LAYOUT_GENERIC', shapes);
}

/**
 * LAYOUT_TWO_COLUMNS: title@idx=0, body@idx=1 (left), body@idx=2 (right)
 * Non-overlapping halves with gap.
 */
function layoutTwoColumns(): string {
  const gap = 228600; // 0.25"
  const colCx = Math.floor((BODY_CX - gap) / 2);
  const rightX = BODY_X + colCx + gap;

  const shapes =
    makeShape('title', 0, TITLE_X, TITLE_Y, TITLE_CX, TITLE_CY, 2) +
    makeShape('body', 1, BODY_X, BODY_Y, colCx, BODY_CY, 3) +
    makeShape('body', 2, rightX, BODY_Y, colCx, BODY_CY, 4);
  return makeSlideLayout('LAYOUT_TWO_COLUMNS', shapes);
}

/**
 * LAYOUT_TIMELINE: title@idx=0, body@idx=1 (canvas, cy >= 60% of slide height)
 */
function layoutTimeline(): string {
  // Canvas must be >= 4114800 EMU (60% of 6858000)
  const canvasY = TITLE_Y + TITLE_CY + MARGIN;
  const canvasCy = SLIDE_H - canvasY - MARGIN;
  // canvasCy should be ~4800600, well above 4114800

  const shapes =
    makeShape('title', 0, TITLE_X, TITLE_Y, TITLE_CX, TITLE_CY, 2) +
    makeShape('body', 1, BODY_X, canvasY, BODY_CX, canvasCy, 3);
  return makeSlideLayout('LAYOUT_TIMELINE', shapes);
}

// ---------- Supporting XML files ----------

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout4.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout5.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout6.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
</Types>`;
}

function rootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
}

function presentationXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}" type="screen16x9"/>
  <p:notesSz cx="${SLIDE_H}" cy="${SLIDE_W}"/>
</p:presentation>`;
}

function presentationRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`;
}

function slideMasterXml(): string {
  let layoutIdList = '';
  for (let i = 1; i <= 6; i++) {
    layoutIdList += `    <p:sldLayoutId id="${2147483649 + i}" r:id="rId${i}"/>\n`;
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:sldLayoutIdLst>
${layoutIdList}  </p:sldLayoutIdLst>
</p:sldMaster>`;
}

function slideMasterRels(): string {
  let rels = '';
  for (let i = 1; i <= 6; i++) {
    rels += `  <Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout${i}.xml"/>\n`;
  }
  rels += `  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${rels}
</Relationships>`;
}

function slideLayoutRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
}

function themeXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Professional">
  <a:themeElements>
    <a:clrScheme name="Professional">
      <a:dk1><a:srgbClr val="1B2A4A"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="2C3E50"/></a:dk2>
      <a:lt2><a:srgbClr val="F7F9FC"/></a:lt2>
      <a:accent1><a:srgbClr val="${ACCENT_COLORS[0]}"/></a:accent1>
      <a:accent2><a:srgbClr val="${ACCENT_COLORS[1]}"/></a:accent2>
      <a:accent3><a:srgbClr val="${ACCENT_COLORS[2]}"/></a:accent3>
      <a:accent4><a:srgbClr val="${ACCENT_COLORS[3]}"/></a:accent4>
      <a:accent5><a:srgbClr val="${ACCENT_COLORS[4]}"/></a:accent5>
      <a:accent6><a:srgbClr val="${ACCENT_COLORS[5]}"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="ProfessionalFonts">
      <a:majorFont>
        <a:latin typeface="Calibri Light"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="Calibri"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="DefaultFormat">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;
}

// ---------- Main ----------

async function main() {
  const zip = new JSZip();

  // Content types
  zip.file('[Content_Types].xml', contentTypesXml());

  // Root relationships
  zip.file('_rels/.rels', rootRels());

  // Presentation
  zip.file('ppt/presentation.xml', presentationXml());
  zip.file('ppt/_rels/presentation.xml.rels', presentationRels());

  // Slide master
  zip.file('ppt/slideMasters/slideMaster1.xml', slideMasterXml());
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', slideMasterRels());

  // Slide layouts
  const layouts = [
    layoutTitle(),
    layoutSection(),
    layoutBullets(),
    layoutGeneric(),
    layoutTwoColumns(),
    layoutTimeline(),
  ];

  const layoutRelsContent = slideLayoutRels();
  for (let i = 0; i < layouts.length; i++) {
    zip.file(`ppt/slideLayouts/slideLayout${i + 1}.xml`, layouts[i]);
    zip.file(`ppt/slideLayouts/_rels/slideLayout${i + 1}.xml.rels`, layoutRelsContent);
  }

  // Theme
  zip.file('ppt/theme/theme1.xml', themeXml());

  // Generate the zip buffer
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

  // Write output
  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, buffer);

  console.log(`Template written to ${OUTPUT_PATH}`);

  // Generate the pre-computed manifest
  const { readTemplate } = await import('../src/validator/templateReader.js');
  const { generateManifest } = await import('../src/validator/manifestGenerator.js');
  const templateInfo = await readTemplate(OUTPUT_PATH);
  const manifest = generateManifest(templateInfo, 'default-template.pptx');
  const manifestPath = path.resolve(__dirname, '../assets/default-capabilities.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Manifest written to ${manifestPath}`);

  console.log(`  Slide dimensions: ${SLIDE_W} x ${SLIDE_H} EMU (16:9)`);
  console.log(`  Layouts: 6 (Tier 2)`);
  console.log(`  Accent colors: ${ACCENT_COLORS.length}`);
}

main().catch((err) => {
  console.error('Failed to build template:', err);
  process.exit(1);
});
