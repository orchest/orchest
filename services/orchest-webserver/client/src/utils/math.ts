export const clamp = (
  value: number,
  min: number = value,
  max: number = value
) => Math.min(Math.max(value, min), max);
