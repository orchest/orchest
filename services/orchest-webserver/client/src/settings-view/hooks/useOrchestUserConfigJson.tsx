import { useFetcher } from "@/hooks/useFetcher";
import { OrchestConfig, OrchestUserConfig } from "@/types";
import { configToVisibleConfig } from "../common";

export const useOrchestUserConfigJson = (
  orchestConfig: OrchestConfig | undefined
) => {
  const { data, setData } = useFetcher<
    { user_config: Partial<OrchestUserConfig> },
    Partial<OrchestUserConfig>
  >(orchestConfig ? "/async/user-config" : undefined, {
    transform: (response) => {
      return orchestConfig
        ? configToVisibleConfig(orchestConfig, response.user_config)
        : response.user_config;
    },
  });

  return { userConfigJson: data, setUserConfigJson: setData };
};
