import { AnyFunction } from "@/types";
import React from "react";

/**
 * Runs the provided callback some condition has been met.
 */
export const useOnce = <C extends AnyFunction>(
  condition: boolean,
  callback: C
): ReturnType<C> | undefined => {
  const called = React.useRef(false);
  const result = React.useRef<ReturnType<C>>();

  React.useEffect(() => {
    if (called.current || !condition) return;

    result.current = callback();
    called.current = true;
  }, [callback, condition]);

  return result.current;
};
