import { hasValue } from "@orchest/lib-utils";

export type AnyRecord = Record<string, unknown>;
export type PropsOf<T extends AnyRecord> = readonly (keyof T)[];

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

/** Remove unwanted properties from the record R.
 * By default, it removes all properties with value `null` and `undefined`. */
export const prune = <R extends Record<string, unknown>>(
  record: Record<string, unknown>,
  predicate: (args: [string, unknown]) => boolean = ([, value]) =>
    hasValue(value)
): R => {
  return Object.fromEntries(Object.entries(record).filter(predicate)) as R;
};
