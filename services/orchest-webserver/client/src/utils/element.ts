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
