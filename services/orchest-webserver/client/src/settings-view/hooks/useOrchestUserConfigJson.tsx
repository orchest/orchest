import { OrchestConfig, OrchestUserConfig } from "@/types";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import useSWR, { MutatorCallback } from "swr";
import { configToVisibleConfig } from "../common";

export const useOrchestUserConfigJson = (
  orchestConfig: OrchestConfig | undefined
) => {
  const { data, mutate } = useSWR(
    orchestConfig ? "/async/user-config" : null,
    (url) =>
      fetcher<{ user_config: Partial<OrchestUserConfig> }>(url).then(
        (response) => {
          if (!orchestConfig) return response.user_config;
          return configToVisibleConfig(orchestConfig, response.user_config);
        }
      )
  );

  const setUserConfigJson = React.useCallback(
    (
      data?:
        | Partial<OrchestUserConfig>
        | Promise<Partial<OrchestUserConfig>>
        | MutatorCallback<Partial<OrchestUserConfig>>
    ) => mutate(data, false),
    [mutate]
  );

  return { userConfigJson: data, setUserConfigJson };
};
