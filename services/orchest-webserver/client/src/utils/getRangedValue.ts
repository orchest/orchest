export const getRangedValue = ({
  value,
  min = value,
  max = value,
}: {
  value: number;
  min?: number;
  max?: number;
}) => {
  return Math.min(Math.max(value, min), max);
};
