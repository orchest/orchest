export type RefLike<T> =
  | undefined
  | null
  | React.ForwardedRef<T | null>
  | React.ForwardedRef<T | undefined>;

export function setRefs<T>(...refs: RefLike<T>[]) {
  return function capture(value: T) {
    for (const ref of refs) {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref) {
        ref.current = value;
      }
    }
  };
}
