export const wrapNumber = (min: number, max: number, index: number) => {
  if (min == max) {
    return min;
  }

  const rangeSize = max - min;
  return ((((index - min) % rangeSize) + rangeSize) % rangeSize) + min;
};
