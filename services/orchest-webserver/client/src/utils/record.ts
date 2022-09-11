import { hasValue } from "@orchest/lib-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRecord = Record<string, any>;
export type PropsOf<T extends AnyRecord> = readonly (keyof T)[];
export type EntryPredicate = ([string, unknown]) => boolean;

const entryHasValue: EntryPredicate = ([, value]) => hasValue(value);

/**
 * Returns the properties of the record T as a typed array.
 * Only call this when you are sure that T does not include any extra properties.
 */
export const propsOf = <T extends AnyRecord>(record: T): PropsOf<T> =>
  Object.keys(record);

/** Returns a shallow copy of the record T with the properties P excluded. */
export const omit = <T extends AnyRecord, P extends PropsOf<T>>(
  record: T,
  ...props: P
): Omit<T, P[number]> => {
  const result: Partial<T> = {};

  for (const prop of propsOf(record)) {
    if (!props.includes(prop)) {
      result[prop] = record[prop];
    }
  }

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

/**
 * Returns a predicate which returns true when a property of a record is strictly equal to a provided value.
 * This is useful in for instance, `Array.find` or `replaces`.
 */
export const equates = <T extends AnyRecord, P extends keyof T>(
  prop: P,
  value: unknown
) => (item: T) => item[prop] === value;
