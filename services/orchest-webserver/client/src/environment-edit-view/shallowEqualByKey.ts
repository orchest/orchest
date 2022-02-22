export function shallowEqualByKey<T extends Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  obj1: T,
  obj2: T,
  keys: (keyof Partial<T>)[]
) {
  if (!obj1 || !obj2) return obj1 === obj2;
  return keys.every((key) => {
    return obj1[key] === obj2[key];
  });
}
