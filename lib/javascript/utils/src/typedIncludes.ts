// see https://github.com/microsoft/TypeScript/issues/26255#issuecomment-502899689
export function typedIncludes<T, U extends T>(
  arr: readonly U[],
  elem: T
): elem is U {
  return arr.includes(elem as any);
}
