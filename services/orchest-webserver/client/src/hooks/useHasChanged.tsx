import React from "react";

export function useHasChanged<T>(
  value: T,
  isUpdated = (prev: T | undefined, curr: T) => prev !== curr
) {
  const previousValue = usePrevious<T>(value);
  return isUpdated(previousValue, value);
}

function usePrevious<T>(value: T) {
  const ref = React.useRef<T>();
  React.useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
