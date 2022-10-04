import { Point2D } from "./geometry";

/**
 * Checks whether `start` or its ancestors matches provided delegate,
 * and returns the first element that does.
 * @param start An element to start searching from.
 * @param matches A delegate determining whether the element matches.
 */
export const firstAncestor = (
  start: Element | null | undefined,
  matches: (element: Element) => boolean
): Element | null | undefined =>
  !start || matches(start)
    ? start
    : firstAncestor(start?.parentElement, matches);

export function getOffset<T extends HTMLElement>(
  element: T | undefined | null
): Point2D {
  if (!element) return [0, 0];

  const box = element.getBoundingClientRect();

  return [
    box.left + window.scrollX - document.documentElement.clientLeft,
    box.top + window.scrollY - document.documentElement.clientTop,
  ];
}
