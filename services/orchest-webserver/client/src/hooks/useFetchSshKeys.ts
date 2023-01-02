import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { SshKey } from "@/types";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useAsync } from "./useAsync";
import { useRegainBrowserTabFocus } from "./useFocusBrowserTab";

export const useFetchSshKeys = () => {
  const getSshKeys = useGitConfigsApi((state) => state.getSshKeys);
  const { run } = useAsync<SshKey[] | undefined>();

  const hasRegainedFocus = useRegainBrowserTabFocus();
  const shouldFetch = useGitConfigsApi(
    (state) => !hasValue(state.sshKeys) || hasRegainedFocus
  );

  React.useEffect(() => {
    if (shouldFetch) run(getSshKeys());
  }, [getSshKeys, run, shouldFetch]);
};
