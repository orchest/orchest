export const clamp = (
  value: number,
  min: number = value,
  max: number = value
) => Math.min(Math.max(value, min), max);

export const smoothstep = (value: number, min: number, max: number) => {
  const x = clamp((value - min) / (max - min), 0, 1);

  return x * x * (3 - 2 * x);
};
