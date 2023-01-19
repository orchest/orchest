import React from "react";
import { useAsync } from "./useAsync";

export type HydrationState = {
  /** The last thrown error, or `undefined` if there is no error. */
  error: unknown;
  /** True if (re)hydration is currently in progress. */
  isLoading: boolean;
  /** True if the (re)hydration has completed. */
  isLoaded: boolean;
  /** Calls the hydrate function and tracks its promise. */
  reload: () => Promise<void>;
};

export type HydrateOptions = {
  /**
   * If true: Run the hydration function each time it updates.
   * The default behavior is to only run it once.
   */
  rehydrate?: boolean;
};

/**
 * Calls the hydrate function once and keeps track of its async state.
 *
 * Note: Consumers of `reload` function rely on the fact that each time `reload` changes,
 * it does so because because it now fetches a different item (e.g. with new parameters).
 * It's therefore recommended to memoize the hydrate function using `React.useCallback` or similar.
 * @param hydrate An async function that loads data and updates a store.
 */
export const useHydrate = <H extends () => Promise<unknown>>(
  hydrate: H,
  options: HydrateOptions = {}
): HydrationState => {
  const { run, error, status } = useAsync();

  const reload = React.useCallback(async () => {
    await run(hydrate()).catch();
  }, [hydrate, run]);

  React.useEffect(() => {
    if (status === "IDLE") reload();
  }, [status, reload]);

  React.useEffect(() => {
    if (options.rehydrate) reload();
  }, [reload, options.rehydrate]);

  return {
    error,
    isLoading: status === "PENDING",
    isLoaded: status === "RESOLVED",
    reload,
  };
};
