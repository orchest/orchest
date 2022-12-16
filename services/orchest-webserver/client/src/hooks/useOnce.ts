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

  // We want this result back in the
  // first render cycle if possible.
  // Don't run this as a `useEffect`.
  if (condition && !called.current) {
    called.current = true;
    result.current = callback();
  }

  return result.current;
};
