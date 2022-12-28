import { OrchestConfig, OrchestUserConfig } from "@/types";
import create from "zustand";
import { orchestConfigsApi } from "./orchestConfigsApi";

export type OrchestConfigsApi = {
  config: OrchestConfig | undefined;
  userConfig: OrchestUserConfig | undefined;
  fetch: () => Promise<
    { config?: OrchestConfig; userConfig: OrchestUserConfig } | undefined
  >;
};

export const useOrchestConfigsApi = create<OrchestConfigsApi>((set) => {
  return {
    config: undefined,
    userConfig: undefined,
    fetch: async () => {
      const { config, user_config } = await orchestConfigsApi.fetch();
      const state = { config, userConfig: user_config };
      set(state);
      return state;
    },
  };
});
