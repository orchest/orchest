import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useInterval = (
  callback: () => void,
  delay: number | null | undefined
) => {
  const callbackRef = React.useRef<() => void>();
  const idRef = React.useRef<number>();

  const reset = React.useCallback(() => {
    if (idRef.current) clearInterval(idRef.current);

    callbackRef.current = undefined;
  }, []);

  React.useEffect(() => {
    callbackRef.current = hasValue(delay) ? callback : undefined;
  }, [callback, delay]);

  React.useEffect(() => {
    if (hasValue(delay) && callbackRef.current) {
      idRef.current = window.setInterval(callbackRef.current, delay);
    }

    return reset;
  }, [delay, reset]);
};
