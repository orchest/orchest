export function windowOffsetTop<T extends HTMLElement>(element: T): number {
  const { top } = element.getBoundingClientRect();

  return top + window.scrollY - document.documentElement.clientTop;
}

export function windowOffsetLeft<T extends HTMLElement>(element: T): number {
  const { left } = element.getBoundingClientRect();

  return left + window.scrollX - document.documentElement.clientLeft;
}
export const getWidth = (element: HTMLElement | undefined | null) => {
  if (!element) return 0;

  const style = window.getComputedStyle(element, null);
  return parseFloat(style.width.replace("px", ""));
};

export const getHeight = (element: HTMLElement | undefined | null) => {
  if (!element) return 0;

  const style = window.getComputedStyle(element, null);
  return parseFloat(style.height.replace("px", ""));
};

export const getOuterWidth = (
  element: HTMLElement,
  margin?: number | undefined
) => {
  if (!element) return 0;

  if (margin !== undefined) {
    let width = element.offsetWidth;
    const style = window.getComputedStyle(element);

    width += parseInt(style.marginLeft, 10) + parseInt(style.marginRight, 10);
    return width;
  }
  return element.offsetWidth;
};

export const getOuterHeight = (
  element: HTMLElement,
  margin?: number | undefined
) => {
  if (!element) {
    return 0;
  }
  if (margin !== undefined) {
    let height = element.offsetHeight;
    const style = getComputedStyle(element);

    height += parseInt(style.marginTop, 10) + parseInt(style.marginBottom, 10);
    return height;
  }
  return element.offsetHeight;
};
