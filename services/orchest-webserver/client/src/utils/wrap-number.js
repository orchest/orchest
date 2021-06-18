// @ts-check

/**
 * Wraps a number when it leaves the specified range.
 * @param {number} min
 * @param {number} max
 * @param {number} index
 * @returns number
 */
export const wrapNumber = (min, max, index) => {
  const rangeSize = max - min;
  return ((((index - min) % rangeSize) + rangeSize) % rangeSize) + min;
};
