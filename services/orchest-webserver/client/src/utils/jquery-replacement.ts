export function getOffset<T extends HTMLElement>(
  element: T | undefined | null
) {
  if (!element) return { top: 0, left: 0 };
  const box = element.getBoundingClientRect();
  return {
    top: box.top + window.pageYOffset - document.documentElement.clientTop,
    left: box.left + window.pageXOffset - document.documentElement.clientLeft,
  };
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
