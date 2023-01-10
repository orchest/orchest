import { OrchestConfig, OrchestUserConfig } from "@/types";
import create from "zustand";
import { persist } from "zustand/middleware";
import { orchestConfigsApi } from "./orchestConfigsApi";

export type OrchestConfigsApi = {
  config: OrchestConfig | undefined;
  userConfig: OrchestUserConfig | undefined;
  fetch: () => Promise<
    { config?: OrchestConfig; userConfig: OrchestUserConfig } | undefined
  >;
  update: (payload: OrchestUserConfig) => Promise<(keyof OrchestUserConfig)[]>;
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
    update: async (payload) => {
      const { requires_restart } = await orchestConfigsApi.updateUserConfig(
        payload
      );
      return requires_restart;
    },
  };
});

type RequireRestartState = {
  requireRestart: (keyof Partial<OrchestUserConfig>)[] | undefined;
  setRequireRestart: (
    value: (keyof Partial<OrchestUserConfig>)[] | undefined
  ) => void;
  resetRequireRestart: () => void;
};

// Persists requireRestart in case
// user refresh the page without restarting.
// Q: Why not persist the whole user config?
// A: Not sure if it's safe to do so, and it seems unnecessary.
export const useRequireRestart = create(
  persist<RequireRestartState>(
    (set) => {
      return {
        requireRestart: undefined,
        setRequireRestart: (requireRestart) => set({ requireRestart }),
        resetRequireRestart: () => set({ requireRestart: [] }),
      };
    },
    { name: "orchest.configs" }
  )
);
