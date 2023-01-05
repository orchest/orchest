import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { GitConfig } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";
import { useRegainBrowserTabFocus } from "./useFocusBrowserTab";

/** Fetch user's git config; returns false if user is not authenticated. */
export const useFetchGitConfigs = () => {
  const getGitConfig = useGitConfigsApi((state) => state.getConfig);
  const { run, error } = useAsync<GitConfig | undefined>();

  const hasRegainedFocus = useRegainBrowserTabFocus();
  const shouldFetch = useGitConfigsApi(
    (state) => !hasValue(state.config) || hasRegainedFocus
  );

  React.useEffect(() => {
    if (shouldFetch) run(getGitConfig());
  }, [getGitConfig, run, shouldFetch]);

  return hasValue(error);
};
