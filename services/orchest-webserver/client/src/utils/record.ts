/** Returns a shallow copy of the record R with the property P excluded. */
export const omit = <R extends Record<string, unknown>, P extends string>(
  record: R,
  prop: P
): Omit<R, P> => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [prop]: _, ...result } = record;

  return result;
};
