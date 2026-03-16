import type { Element } from '../schema/presentation.js';
import type { IconRequest } from './placeholderFiller.js';
import { emuFromPx } from './xmlHelpers.js';

/**
 * Extracts the first element of a given type from a slide's elements.
 * Shared utility used by all drawer modules.
 */
export function findElement<T extends Element['type']>(
  elements: Element[],
  type: T,
): Extract<Element, { type: T }> | undefined {
  return elements.find((el) => el.type === type) as Extract<Element, { type: T }> | undefined;
}

/**
 * Creates an icon request with standard EMU sizing.
 * Reduces boilerplate across all drawers.
 */
export function makeIconRequest(
  name: string,
  color: string,
  sizePx: number,
  x: number,
  y: number,
): IconRequest {
  const iconEmu = emuFromPx(sizePx);
  return { name, color, sizePx, x, y, cx: iconEmu, cy: iconEmu };
}
