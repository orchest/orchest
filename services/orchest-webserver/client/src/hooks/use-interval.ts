import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useInterval = (
  callback: () => void,
  delay: number | null | undefined
) => {
  const memoizedCallback = React.useRef<() => void>();
  const intervalId = React.useRef<NodeJS.Timeout>();

  const reset = React.useCallback(() => {
    if (intervalId.current) clearInterval(intervalId.current);
    memoizedCallback.current = undefined;
  }, []);

  React.useEffect(() => {
    memoizedCallback.current = hasValue(delay) ? callback : undefined;
  }, [callback, delay]);

  React.useEffect(() => {
    if (hasValue(delay) && memoizedCallback.current) {
      intervalId.current = setInterval(
        () => memoizedCallback.current?.(),
        delay
      );
    }
    return () => reset();
  }, [delay, reset]);
};
