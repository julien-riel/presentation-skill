/**
 * Builds a valid Tier 2 default-template.pptx using JSZip and raw OOXML XML.
 *
 * Produces 6 professionally styled slide layouts:
 *   LAYOUT_TITLE, LAYOUT_SECTION, LAYOUT_BULLETS,
 *   LAYOUT_GENERIC, LAYOUT_TWO_COLUMNS, LAYOUT_TIMELINE
 *
 * Run: npx tsx scripts/buildDefaultTemplate.ts
 */
import JSZip from 'jszip';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Color constants
const DARK_NAVY = '1B2A4A';
const BLUE_ACCENT = '2D7DD2';
const LIGHT_BG = 'F7F9FC';
const DARK_TEXT = '2C3E50';
const WHITE = 'FFFFFF';

const OUTPUT_PATH = path.resolve(__dirname, '../assets/default-template.pptx');

// ---------- Helpers ----------

interface ShapeOptions {
  phType: string;
  phIdx: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
  spId: number;
  /** Font size in hundredths of a point (e.g. 3600 = 36pt) */
  fontSize?: number;
  bold?: boolean;
  /** Hex RGB color for text */
  color?: string;
  /** Paragraph alignment */
  align?: 'l' | 'ctr' | 'r';
  /** Vertical anchor */
  anchor?: 'ctr' | 't' | 'b';
  /** Font reference: '+mj-lt' for major, '+mn-lt' for minor */
  fontRef?: string;
  /** Enable bullet styling */
  bullets?: boolean;
  /** Hex RGB color for bullet char */
  bulletColor?: string;
}

/**
 * Creates a shape XML with placeholder, transform, and optional text styling.
 */
function makeShape(opts: ShapeOptions): string {
  const { phType, phIdx, x, y, cx, cy, spId } = opts;
  const phAttr = phType === 'body' && phIdx === 0
    ? `type="${phType}"`
    : `type="${phType}" idx="${phIdx}"`;

  // Body properties
  const anchorAttr = opts.anchor ? ` anchor="${opts.anchor}"` : '';
  const bodyPr = `<a:bodyPr${anchorAttr}/>`;

  // List style (for bullet placeholders)
  let lstStyle = '<a:lstStyle/>';
  if (opts.bullets) {
    const bulletColor = opts.bulletColor ?? BLUE_ACCENT;
    lstStyle = `<a:lstStyle>
            <a:lvl1pPr marL="342900" indent="-342900">
              <a:buSzPct val="100000"/>
              <a:buFont typeface="Arial" panose="020B0604020202020204"/>
              <a:buChar char="\u2022"/>
              <a:defRPr sz="${opts.fontSize ?? 1600}">
                <a:solidFill><a:srgbClr val="${opts.color ?? DARK_TEXT}"/></a:solidFill>
                <a:latin typeface="${opts.fontRef ?? '+mn-lt'}"/>
              </a:defRPr>
            </a:lvl1pPr>
          </a:lstStyle>`;
    // Colored bullet — separate from text color
    lstStyle = lstStyle.replace(
      '<a:buChar',
      `<a:buClr><a:srgbClr val="${bulletColor}"/></a:buClr>\n              <a:buChar`,
    );
  }

  // End paragraph run properties (defines default text style)
  let endParaRPr = '<a:endParaRPr lang="en-US"/>';
  if (opts.fontSize || opts.bold || opts.color || opts.fontRef) {
    const attrs = ['lang="en-US"'];
    if (opts.fontSize) attrs.push(`sz="${opts.fontSize}"`);
    if (opts.bold) attrs.push('b="1"');
    let rPrContent = '';
    if (opts.color) {
      rPrContent += `<a:solidFill><a:srgbClr val="${opts.color}"/></a:solidFill>`;
    }
    if (opts.fontRef) {
      rPrContent += `<a:latin typeface="${opts.fontRef}"/>`;
    }
    endParaRPr = rPrContent
      ? `<a:endParaRPr ${attrs.join(' ')}>${rPrContent}</a:endParaRPr>`
      : `<a:endParaRPr ${attrs.join(' ')}/>`;
  }

  // Paragraph properties
  let pPr = '';
  if (opts.align) {
    pPr = `<a:pPr algn="${opts.align}"/>`;
  }

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
          ${bodyPr}
          ${lstStyle}
          <a:p>${pPr}${endParaRPr}</a:p>
        </p:txBody>
      </p:sp>`;
}

/**
 * Creates a thin horizontal line shape as a visual separator.
 */
function accentLine(spId: number, x: number, y: number, cx: number, color: string): string {
  return `
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="${spId}" name="Accent Line"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="${x}" y="${y}"/>
            <a:ext cx="${cx}" cy="0"/>
          </a:xfrm>
          <a:prstGeom prst="line"><a:avLst/></a:prstGeom>
          <a:ln w="28575">
            <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
          </a:ln>
        </p:spPr>
      </p:sp>`;
}

/**
 * Generates background XML for a slide layout.
 */
function bgXml(color: string): string {
  return `<p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>`;
}

/**
 * Wraps shapes in a slideLayout XML document with optional background.
 */
function makeSlideLayout(layoutName: string, shapes: string, background?: string): string {
  const bgBlock = background ? `\n    ${background}` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             type="obj" preserve="1">
  <p:cSld name="${layoutName}">${bgBlock}
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

// Standard body area below title bar (with space for accent line)
const LINE_Y = TITLE_Y + TITLE_CY + Math.floor(MARGIN / 2);
const BODY_X = MARGIN;
const BODY_Y = LINE_Y + Math.floor(MARGIN / 2);
const BODY_CX = SLIDE_W - 2 * MARGIN;
const BODY_CY = SLIDE_H - BODY_Y - MARGIN;

/**
 * LAYOUT_TITLE: ctrTitle@idx=0, subTitle@idx=1
 * Dark navy background, white centered text.
 */
function layoutTitle(): string {
  const ctrTitleCy = 1828800; // ~2"
  const ctrTitleY = Math.floor((SLIDE_H - ctrTitleCy - 914400 - MARGIN) / 2);
  const subTitleY = ctrTitleY + ctrTitleCy + MARGIN;
  const subTitleCy = 914400; // ~1"
  const shapes =
    makeShape({
      phType: 'ctrTitle', phIdx: 0,
      x: MARGIN, y: ctrTitleY, cx: TITLE_CX, cy: ctrTitleCy, spId: 2,
      fontSize: 4400, bold: true, color: WHITE, align: 'ctr', anchor: 'b',
      fontRef: '+mj-lt',
    }) +
    makeShape({
      phType: 'subTitle', phIdx: 1,
      x: MARGIN, y: subTitleY, cx: TITLE_CX, cy: subTitleCy, spId: 3,
      fontSize: 2000, color: 'B8C6D9', align: 'ctr', anchor: 't',
      fontRef: '+mn-lt',
    });
  return makeSlideLayout('LAYOUT_TITLE', shapes, bgXml(DARK_NAVY));
}

/**
 * LAYOUT_SECTION: title@idx=0, body@idx=1
 * Blue accent background, white text.
 */
function layoutSection(): string {
  const titleCy = 1600200; // ~1.75"
  const titleY = Math.floor((SLIDE_H - titleCy - 914400 - MARGIN) / 2);
  const bodyY = titleY + titleCy + MARGIN;
  const bodyCy = 914400;
  const shapes =
    makeShape({
      phType: 'title', phIdx: 0,
      x: MARGIN, y: titleY, cx: TITLE_CX, cy: titleCy, spId: 2,
      fontSize: 3200, bold: true, color: WHITE, align: 'l', anchor: 'b',
      fontRef: '+mj-lt',
    }) +
    makeShape({
      phType: 'body', phIdx: 1,
      x: MARGIN, y: bodyY, cx: TITLE_CX, cy: bodyCy, spId: 3,
      fontSize: 1800, color: 'D4E6F1', align: 'l', anchor: 't',
      fontRef: '+mn-lt',
    });
  return makeSlideLayout('LAYOUT_SECTION', shapes, bgXml(BLUE_ACCENT));
}

/**
 * LAYOUT_BULLETS: title@idx=0, body@idx=1 (body cy >= 2286000 EMU)
 * Light background, dark title, styled bullets with accent-colored bullet chars.
 */
function layoutBullets(): string {
  const shapes =
    makeShape({
      phType: 'title', phIdx: 0,
      x: TITLE_X, y: TITLE_Y, cx: TITLE_CX, cy: TITLE_CY, spId: 2,
      fontSize: 2800, bold: true, color: DARK_NAVY, align: 'l', anchor: 'b',
      fontRef: '+mj-lt',
    }) +
    accentLine(5, TITLE_X, LINE_Y, TITLE_CX, BLUE_ACCENT) +
    makeShape({
      phType: 'body', phIdx: 1,
      x: BODY_X, y: BODY_Y, cx: BODY_CX, cy: BODY_CY, spId: 3,
      fontSize: 1600, color: DARK_TEXT, anchor: 't',
      fontRef: '+mn-lt',
      bullets: true, bulletColor: BLUE_ACCENT,
    });
  return makeSlideLayout('LAYOUT_BULLETS', shapes, bgXml(LIGHT_BG));
}

/**
 * LAYOUT_GENERIC: title@idx=0, body@idx=1
 * Light background, dark title, plain body text.
 */
function layoutGeneric(): string {
  const shapes =
    makeShape({
      phType: 'title', phIdx: 0,
      x: TITLE_X, y: TITLE_Y, cx: TITLE_CX, cy: TITLE_CY, spId: 2,
      fontSize: 2800, bold: true, color: DARK_NAVY, align: 'l', anchor: 'b',
      fontRef: '+mj-lt',
    }) +
    accentLine(5, TITLE_X, LINE_Y, TITLE_CX, BLUE_ACCENT) +
    makeShape({
      phType: 'body', phIdx: 1,
      x: BODY_X, y: BODY_Y, cx: BODY_CX, cy: BODY_CY, spId: 3,
      fontSize: 1600, color: DARK_TEXT, anchor: 't',
      fontRef: '+mn-lt',
    });
  return makeSlideLayout('LAYOUT_GENERIC', shapes, bgXml(LIGHT_BG));
}

/**
 * LAYOUT_TWO_COLUMNS: title@idx=0, body@idx=1 (left), body@idx=2 (right)
 * Light background, dark title, two body columns.
 */
function layoutTwoColumns(): string {
  const gap = 228600; // 0.25"
  const colCx = Math.floor((BODY_CX - gap) / 2);
  const rightX = BODY_X + colCx + gap;

  const shapes =
    makeShape({
      phType: 'title', phIdx: 0,
      x: TITLE_X, y: TITLE_Y, cx: TITLE_CX, cy: TITLE_CY, spId: 2,
      fontSize: 2800, bold: true, color: DARK_NAVY, align: 'l', anchor: 'b',
      fontRef: '+mj-lt',
    }) +
    accentLine(6, TITLE_X, LINE_Y, TITLE_CX, BLUE_ACCENT) +
    makeShape({
      phType: 'body', phIdx: 1,
      x: BODY_X, y: BODY_Y, cx: colCx, cy: BODY_CY, spId: 3,
      fontSize: 1600, color: DARK_TEXT, anchor: 't',
      fontRef: '+mn-lt',
      bullets: true, bulletColor: BLUE_ACCENT,
    }) +
    makeShape({
      phType: 'body', phIdx: 2,
      x: rightX, y: BODY_Y, cx: colCx, cy: BODY_CY, spId: 4,
      fontSize: 1600, color: DARK_TEXT, anchor: 't',
      fontRef: '+mn-lt',
      bullets: true, bulletColor: BLUE_ACCENT,
    });
  return makeSlideLayout('LAYOUT_TWO_COLUMNS', shapes, bgXml(LIGHT_BG));
}

/**
 * LAYOUT_TIMELINE: title@idx=0, body@idx=1 (canvas, cy >= 60% of slide height)
 * Light background, dark title, large canvas area for programmatic drawing.
 */
function layoutTimeline(): string {
  // Canvas must be >= 4114800 EMU (60% of 6858000)
  const canvasY = TITLE_Y + TITLE_CY + MARGIN;
  const canvasCy = SLIDE_H - canvasY - MARGIN;
  // canvasCy should be ~4800600, well above 4114800

  const shapes =
    makeShape({
      phType: 'title', phIdx: 0,
      x: TITLE_X, y: TITLE_Y, cx: TITLE_CX, cy: TITLE_CY, spId: 2,
      fontSize: 2800, bold: true, color: DARK_NAVY, align: 'l', anchor: 'b',
      fontRef: '+mj-lt',
    }) +
    accentLine(5, TITLE_X, LINE_Y, TITLE_CX, BLUE_ACCENT) +
    makeShape({
      phType: 'body', phIdx: 1,
      x: BODY_X, y: canvasY, cx: BODY_CX, cy: canvasCy, spId: 3,
      fontSize: 1400, color: DARK_TEXT, anchor: 't',
      fontRef: '+mn-lt',
    });
  return makeSlideLayout('LAYOUT_TIMELINE', shapes, bgXml(LIGHT_BG));
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
