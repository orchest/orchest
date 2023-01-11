import create from "zustand";
import { jupyterLabSetupScriptApi } from "./jupyterLabSetupScriptApi";

export type JupyterLabSetupScriptApi = {
  setupScript: string | undefined;
  fetch: () => Promise<string>;
  update: (payload: string) => Promise<void>;
};

export const useJupyterLabSetupScriptApi = create<JupyterLabSetupScriptApi>(
  (set) => {
    return {
      setupScript: undefined,
      fetch: async () => {
        const setupScript = await jupyterLabSetupScriptApi.fetchOne();
        set({ setupScript });
        return setupScript;
      },
      update: async (payload) => {
        set({ setupScript: payload });
        return await jupyterLabSetupScriptApi.update(payload);
      },
    };
  }
);
