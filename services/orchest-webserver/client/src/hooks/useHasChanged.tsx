import { usePrevious } from "./usePrevious";

export function useHasChanged<T>(
  value: T,
  isUpdated = (prev: T | undefined, curr: T) => prev !== curr
) {
  const previous = usePrevious(value);

  return isUpdated(previous, value);
}
