import type { Slide } from '../schema/presentation.js';
import type { IconRequest, ImageRequest, HyperlinkRequest } from './placeholderFiller.js';
import { emu, placeholderShape, bulletPlaceholderShape, hyperlinkTextBoxShape } from './xmlHelpers.js';
import { findElement } from './drawerUtils.js';

/**
 * Extended result for the imageText drawer, which also produces
 * image requests and hyperlink requests in addition to shapes.
 */
export interface ImageTextDrawerResult {
  shapes: string;
  nextId: number;
  iconRequests: IconRequest[];
  imageRequests: ImageRequest[];
  hyperlinkRequests: HyperlinkRequest[];
}

/**
 * Builds imageText body shapes for a slide (excluding the title placeholder).
 * Renders an image on the left and text/bullets on the right.
 */
export function buildImageTextShapes(
  slide: Slide,
  startId: number,
): ImageTextDrawerResult {
  let id = startId;
  let shapes = '';
  const iconRequests: IconRequest[] = [];
  const imageRequests: ImageRequest[] = [];
  const hyperlinkRequests: HyperlinkRequest[] = [];

  const imageEl = findElement(slide.elements, 'image');
  if (imageEl) {
    imageRequests.push({
      filePath: imageEl.path,
      altText: imageEl.altText,
      x: emu(0.5),
      y: emu(1.5),
      cx: emu(5.0),
      cy: emu(5.0),
    });
  }

  // TEXT_BODY is at placeholder index 2
  const textEl = findElement(slide.elements, 'text');
  const bulletsEl = findElement(slide.elements, 'bullets');
  if (textEl) {
    if (textEl.url) {
      const shapeId = id++;
      hyperlinkRequests.push({
        url: textEl.url,
        shapeXmlBuilder: (relId) => hyperlinkTextBoxShape(
          shapeId, emu(5.5), emu(1.8), emu(4.5), emu(0.5),
          textEl.text, textEl.url!, relId, { size: 14, align: 'l' },
        ),
      });
    } else {
      shapes += placeholderShape(id++, 'body', 2, [textEl.text]);
    }
  } else if (bulletsEl) {
    shapes += bulletPlaceholderShape(id++, 2, bulletsEl.items);
  }

  return { shapes, nextId: id, iconRequests, imageRequests, hyperlinkRequests };
}
