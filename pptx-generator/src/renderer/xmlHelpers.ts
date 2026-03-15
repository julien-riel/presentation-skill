/**
 * Low-level OOXML generation helpers.
 * Generates raw PresentationML XML fragments for slides and shapes.
 *
 * Units: all positions/dimensions in EMU (English Metric Units).
 * 1 inch = 914400 EMU. Font sizes in hundredths of a point (18pt = 1800).
 */

const INCH = 914400;

/** Converts inches to EMU. */
export function emu(inches: number): number {
  return Math.round(inches * INCH);
}

/** Converts pixels to EMU assuming 96 DPI. */
export function emuFromPx(px: number): number {
  return Math.round(px * 9525);
}

/** Escapes XML special characters. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Creates a placeholder shape that inherits formatting from the slideLayout.
 * The key: <p:ph type="..." idx="..."/> tells PowerPoint to pull
 * position, size, font, color from the layout's matching placeholder.
 * We only supply the text content.
 */
export function placeholderShape(
  id: number,
  phType: string,
  phIdx: number,
  paragraphs: string[],
): string {
  const phAttr = phType
    ? `type="${phType}" idx="${phIdx}"`
    : `idx="${phIdx}"`;

  const parasXml = paragraphs.map(text =>
    `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escapeXml(text)}</a:t></a:r></a:p>`
  ).join('');

  return `<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="Placeholder ${phIdx}"/>
    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
    <p:nvPr><p:ph ${phAttr}/></p:nvPr>
  </p:nvSpPr>
  <p:spPr/>
  <p:txBody>
    <a:bodyPr/>
    <a:lstStyle/>
    ${parasXml}
  </p:txBody>
</p:sp>`;
}

/**
 * Creates a bullet-list placeholder shape.
 * Each item gets its own paragraph with level 0 indentation.
 */
export function bulletPlaceholderShape(
  id: number,
  phIdx: number,
  items: string[],
): string {
  const parasXml = items.map(text =>
    `<a:p><a:pPr lvl="0"/><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escapeXml(text)}</a:t></a:r></a:p>`
  ).join('');

  return `<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="Content ${phIdx}"/>
    <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
    <p:nvPr><p:ph idx="${phIdx}"/></p:nvPr>
  </p:nvSpPr>
  <p:spPr/>
  <p:txBody>
    <a:bodyPr/>
    <a:lstStyle/>
    ${parasXml}
  </p:txBody>
</p:sp>`;
}

/** Options for a freeform shape (rectangle, ellipse, line). */
export interface ShapeOpts {
  x: number;
  y: number;
  cx: number;
  cy: number;
  fill?: string;
  lineColor?: string;
  lineWidth?: number;
  lineDash?: 'solid' | 'dash' | 'dot';
  rectRadius?: number;
  endArrow?: boolean;
  flipH?: boolean;
}

/**
 * Creates a freeform rectangle shape with optional fill and rounded corners.
 */
export function rectShape(id: number, opts: ShapeOpts): string {
  const preset = opts.rectRadius ? 'roundRect' : 'rect';
  const avLst = opts.rectRadius
    ? `<a:avLst><a:gd name="adj" fmla="val ${Math.round(opts.rectRadius * 100000)}"/></a:avLst>`
    : '<a:avLst/>';
  const fill = opts.fill
    ? `<a:solidFill><a:srgbClr val="${opts.fill}"/></a:solidFill>`
    : '<a:noFill/>';
  const line = opts.lineColor
    ? `<a:ln w="${(opts.lineWidth ?? 1) * 12700}"><a:solidFill><a:srgbClr val="${opts.lineColor}"/></a:solidFill></a:ln>`
    : '<a:ln><a:noFill/></a:ln>';

  return `<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="Shape ${id}"/>
    <p:cNvSpPr/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${opts.x}" y="${opts.y}"/><a:ext cx="${opts.cx}" cy="${opts.cy}"/></a:xfrm>
    <a:prstGeom prst="${preset}">${avLst}</a:prstGeom>
    ${fill}
    ${line}
  </p:spPr>
</p:sp>`;
}

/**
 * Creates an ellipse shape.
 */
export function ellipseShape(id: number, opts: ShapeOpts): string {
  const fill = opts.fill
    ? `<a:solidFill><a:srgbClr val="${opts.fill}"/></a:solidFill>`
    : '<a:noFill/>';
  const line = opts.lineColor
    ? `<a:ln w="${(opts.lineWidth ?? 1) * 12700}"><a:solidFill><a:srgbClr val="${opts.lineColor}"/></a:solidFill></a:ln>`
    : '<a:ln><a:noFill/></a:ln>';

  return `<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="Shape ${id}"/>
    <p:cNvSpPr/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${opts.x}" y="${opts.y}"/><a:ext cx="${opts.cx}" cy="${opts.cy}"/></a:xfrm>
    <a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom>
    ${fill}
    ${line}
  </p:spPr>
</p:sp>`;
}

/**
 * Creates a line (connector) shape.
 */
export function lineShape(id: number, opts: ShapeOpts): string {
  const lw = (opts.lineWidth ?? 1) * 12700;
  const dash = opts.lineDash === 'dash' ? '<a:prstDash val="dash"/>' : '';
  const arrow = opts.endArrow ? '<a:tailEnd type="triangle"/>' : '';
  const flipAttr = opts.flipH ? ' flipH="1"' : '';

  return `<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="Connector ${id}"/>
    <p:cNvSpPr/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm${flipAttr}><a:off x="${opts.x}" y="${opts.y}"/><a:ext cx="${opts.cx}" cy="${opts.cy}"/></a:xfrm>
    <a:prstGeom prst="line"><a:avLst/></a:prstGeom>
    <a:noFill/>
    <a:ln w="${lw}"><a:solidFill><a:srgbClr val="${opts.lineColor ?? '666666'}"/></a:solidFill>${dash}${arrow}</a:ln>
  </p:spPr>
</p:sp>`;
}

/**
 * Creates a text box shape with explicit position (not a placeholder).
 * Used for labels in timeline/architecture canvas layouts.
 */
export function textBoxShape(
  id: number,
  x: number,
  y: number,
  cx: number,
  cy: number,
  text: string,
  fontOpts?: {
    size?: number;
    bold?: boolean;
    color?: string;
    align?: 'l' | 'ctr' | 'r';
    valign?: 'ctr' | 't' | 'b';
  },
): string {
  const sz = (fontOpts?.size ?? 10) * 100;
  const bold = fontOpts?.bold ? ' b="1"' : '';
  const color = fontOpts?.color ?? '000000';
  const align = fontOpts?.align ?? 'ctr';
  const anchor = fontOpts?.valign ?? 'ctr';

  return `<p:sp>
  <p:nvSpPr>
    <p:cNvPr id="${id}" name="TextBox ${id}"/>
    <p:cNvSpPr txBox="1"/>
    <p:nvPr/>
  </p:nvSpPr>
  <p:spPr>
    <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
    <a:noFill/>
    <a:ln><a:noFill/></a:ln>
  </p:spPr>
  <p:txBody>
    <a:bodyPr wrap="square" anchor="${anchor}"/>
    <a:lstStyle/>
    <a:p>
      <a:pPr algn="${align}"/>
      <a:r><a:rPr lang="en-US" sz="${sz}"${bold} dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:rPr><a:t>${escapeXml(text)}</a:t></a:r>
    </a:p>
  </p:txBody>
</p:sp>`;
}

/**
 * Wraps shape fragments in a complete slide XML document.
 */
export function wrapSlideXml(shapes: string, notesText?: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
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
      ${shapes}
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

/**
 * Creates a picture shape that references an embedded image.
 * Used for icon rendering in slides.
 */
export function pictureShape(
  id: number,
  relId: string,
  x: number,
  y: number,
  cx: number,
  cy: number,
): string {
  return `<p:pic>
  <p:nvPicPr>
    <p:cNvPr id="${id}" name="Icon ${id}"/>
    <p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr>
    <p:nvPr/>
  </p:nvPicPr>
  <p:blipFill>
    <a:blip r:embed="${relId}"/>
    <a:stretch><a:fillRect/></a:stretch>
  </p:blipFill>
  <p:spPr>
    <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
  </p:spPr>
</p:pic>`;
}

/**
 * Creates a notes slide XML.
 */
export function notesSlideXml(text: string, slideRId: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
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
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Notes Placeholder"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${escapeXml(text)}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`;
}
