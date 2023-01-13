import { hasValue } from "@orchest/lib-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRecord = Record<string, any>;
export type PropsOf<T extends AnyRecord> = readonly (keyof T)[];
export type EntryPredicate = (args: [string, unknown]) => boolean;

const entryHasValue: EntryPredicate = ([, value]) => hasValue(value);

/**
 * Returns the properties of the record T as a typed array.
 * Only call this when you are sure that T does not include any extra properties.
 */
const propsOf = <T extends AnyRecord>(record: T): PropsOf<T> =>
  Object.keys(record);

/** Returns a shallow copy of the record T with the properties P excluded. */
export const omit = <T extends AnyRecord, P extends PropsOf<T>>(
  record: T,
  ...keys: P
): Omit<T, P[number]> => {
  const result: Partial<T> = {};

  propsOf(record).forEach((key) => {
    // It's fine to have O(n^2) here.
    // Note that, in practice, the length of keys is usually very small.
    // Converting `keys` to an object would make the overall operation slower.
    if (!keys.includes(key)) result[key] = record[key];
  });

  return result as Omit<T, P[number]>;
};

/** Returns a shallow copy of the record T with only the properties P included. */
export const pick = <T extends AnyRecord, P extends PropsOf<T>>(
  record: T,
  ...props: P
): Pick<T, P[number]> => {
  const result: Partial<T> = {};

  for (const prop of props) {
    if (prop in record) {
      result[prop] = record[prop];
    }
  }

  return result as Pick<T, P[number]>;
};

/**
 * Removes some undesired properties from the record R.
 * By default, it removes all properties with nullish values.
 */
export const prune = <T extends AnyRecord, R extends AnyRecord = T>(
  record: T,
  predicate: EntryPredicate = entryHasValue
) => Object.fromEntries(Object.entries(record).filter(predicate)) as R;

/** Checks whether a record has the expected properties from another. */
export const equalsShallow = <T extends AnyRecord, A extends T>(
  expected: T,
  actual: A,
  props = propsOf(expected)
) => props.every((prop) => actual[prop] === expected[prop]);

export const mapRecord = <T>(arr: T[], key = "uuid") => {
  return Object.fromEntries(arr.map((env) => [env[key], env])) as Record<
    typeof key,
    T
  >;
};
