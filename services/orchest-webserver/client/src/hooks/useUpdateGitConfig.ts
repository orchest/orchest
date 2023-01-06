import { useGitConfigsApi } from "@/api/git-configs/useGitConfigsApi";
import { useAsync } from "@/hooks/useAsync";
import { useDebounce } from "@/hooks/useDebounce";
import { GitConfig } from "@/types";
import { omit } from "@/utils/record";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import shallow from "zustand/shallow";

export const GIT_CONFIG_KEYS: Partial<Record<
  keyof GitConfig,
  (value: string) => boolean
>> = {
  name: (value: string) => value.trim().length > 0,
  email: (value: string) => /^\S+@\S+\.\S+$/.test(value.trim()),
};

const isValidPayload = (
  payload: Partial<GitConfig> | undefined
): payload is GitConfig => {
  return (
    hasValue(payload) &&
    Object.entries(GIT_CONFIG_KEYS).every(([key, predicate]) => {
      const value = payload[key];
      return hasValue(value) && predicate(value);
    })
  );
};

/** Watch the change of the attributes and update BE accordingly. */
export const useUpdateGitConfig = () => {
  const newConfig = useGitConfigsApi(
    (state) =>
      isValidPayload(state.config) ? omit(state.config, "uuid") : undefined,
    shallow
  );

  const payload = useDebounce(newConfig, 250);

  const { run } = useAsync();
  const requestToUpdate = useGitConfigsApi((state) => state.updateConfig);

  React.useEffect(() => {
    if (payload) run(requestToUpdate(payload));
  }, [payload, requestToUpdate, run]);
};
