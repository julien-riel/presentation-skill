import type { Element } from '../schema/presentation.js';

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
