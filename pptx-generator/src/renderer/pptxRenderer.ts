import PptxGenJS from 'pptxgenjs';
import type { Presentation } from '../schema/presentation.js';
import { fillSlide } from './placeholderFiller.js';

/**
 * Renders an enriched presentation AST into a PptxGenJS instance.
 * The AST must have been through the Transform pipeline
 * (layouts resolved, content validated, overflow handled).
 *
 * Returns the PptxGenJS instance so callers can write to file or buffer.
 */
export function renderPresentation(presentation: Presentation): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.title = presentation.title;

  if (presentation.metadata?.author) {
    pptx.author = presentation.metadata.author;
  }

  for (const slide of presentation.slides) {
    const pptxSlide = pptx.addSlide();

    // Add speaker notes if present
    if (slide.notes) {
      pptxSlide.addNotes(slide.notes);
    }

    fillSlide(pptxSlide, slide);
  }

  return pptx;
}

/**
 * Renders a presentation AST to a Node.js Buffer (PPTX binary).
 */
export async function renderToBuffer(presentation: Presentation): Promise<Buffer> {
  const pptx = renderPresentation(presentation);
  const output = await pptx.write({ outputType: 'nodebuffer' });
  return output as Buffer;
}
