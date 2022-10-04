import { hasValue } from "@orchest/lib-utils";
import React from "react";

export const useThrottle = (timeout = 250) => {
  const [isAllowed, setIsAllowed] = React.useState(true);
  const timeoutRef = React.useRef<number | undefined>();

  React.useEffect(() => {
    if (!isAllowed && !hasValue(timeoutRef.current)) {
      timeoutRef.current = window.setTimeout(() => {
        setIsAllowed(true);
        timeoutRef.current = undefined;
      }, timeout);
    }
    return () => {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    };
  }, [isAllowed, timeout]);

  const withThrottle = React.useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (callback: (...args: any) => any) => (
      params: Parameters<typeof callback>
    ) => {
      if (isAllowed) {
        setIsAllowed(false);
        callback(params);
      }
    },
    [isAllowed]
  );

  const reset = React.useCallback(() => setIsAllowed(false), []);

  return { withThrottle, reset };
};
