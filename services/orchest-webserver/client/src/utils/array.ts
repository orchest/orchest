/** Determines whether some condition is true for a given item. */
export type FindPredicate<T> = (
  item: T,
  index: number,
  items: readonly T[]
) => boolean;
/** Replaces an item in an array with a new one. */
export type ArrayReplacer<T> = (items: readonly T[], item: T) => T[];
/** Selects a key from the given item. */
export type KeySelector<T> = (item: T) => string | number;
/** Merges multiple arrays into one. */
export type ArrayMerger<T> = (...arrays: readonly (readonly T[])[]) => T[];

/**
 * Returns a function which replaces the first item in an array that matches the predicate.
 * @param predicate Determines which item should be replaced with a new item.
 * @param fallback The strategy to use if an item is not found
 */
export const replaces = <T>(
  predicate: FindPredicate<T>,
  fallback: "ignore" | "push" | "unshift"
): ArrayReplacer<T> => (items, item) => {
  const index = items.findIndex(predicate);

  if (index === -1) {
    switch (fallback) {
      default:
        return [...items];
      case "push":
        return [...items, item];
      case "unshift":
        return [item, ...items];
    }
  }

  return [...items.slice(0, index), item, ...items.slice(index + 1)];
};

/**
 * Returns a function which merges multiple arrays and deduplicates items based on some shared key.
 * @param selectKey Selects the key which is used to determine uniqueness.
 */
export const deduplicates = <T>(selectKey: KeySelector<T>): ArrayMerger<T> => (
  ...arrays
) => {
  const result: T[] = [];
  const keys = new Set<string | number>();

  const isDuplicate = (item: T) => {
    const key = selectKey(item);
    const seen = keys.has(key);
    if (!seen) keys.add(key);

    return seen;
  };

  for (const array of arrays) {
    for (const item of array) {
      if (isDuplicate(item)) continue;

      result.push(item);
    }
  }

  return result;
};
