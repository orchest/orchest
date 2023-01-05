import { AnyAsyncFunction } from "@/types";
import { sequenceEquals } from "@/utils/array";
import React from "react";
import { useAsync } from "./useAsync";
import { useRegainBrowserTabFocus } from "./useFocusBrowserTab";
import { useHasChanged } from "./useHasChanged";

export type HydrationState<H extends AnyAsyncFunction> = {
  isLoading: boolean;
  isLoaded: boolean;
  error: unknown;
  refresh: (...args: Parameters<H>) => Promise<void>;
};

export const useHydrate = <H extends AnyAsyncFunction>(
  hydrate: H,
  ...parameters: Parameters<H>
): HydrationState<H> => {
  const { run, error, status } = useAsync();
  const didParametersUpdate = useHasChanged(parameters, sequenceEquals);
  const tabRegainedFocus = useRegainBrowserTabFocus();

  const refresh = React.useCallback(
    async (...args: Parameters<H>) => {
      await run(hydrate(...args)).catch();
    },
    [run, hydrate]
  );

  React.useEffect(() => {
    if (status === "PENDING") return;
    if (!didParametersUpdate || tabRegainedFocus) return;

    refresh(...parameters);
  }, [didParametersUpdate, tabRegainedFocus, status, parameters, refresh]);

  return {
    error,
    isLoading: status === "PENDING",
    isLoaded: status === "RESOLVED",
    refresh,
  };
};
