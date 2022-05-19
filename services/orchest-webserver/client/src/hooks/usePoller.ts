import { Poller } from "@/utils/Poller";
import { hasValue } from "@orchest/lib-utils";
import React from "react";

export function usePoller<T, E = unknown>(
  callback: () => Promise<T>,
  refreshInterval?: undefined | number
) {
  const memoizedCallback = React.useRef(callback);
  const pollerRef = React.useRef(Poller(refreshInterval));

  React.useEffect(() => {
    pollerRef.current.clean();
    if (hasValue(refreshInterval)) {
      pollerRef.current = Poller(refreshInterval);
      pollerRef.current.add<T, E>(memoizedCallback.current);
    }
    return () => pollerRef.current.clean();
  }, [refreshInterval]);

  return pollerRef;
}
