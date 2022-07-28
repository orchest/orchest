import { Environment } from "@/types";
import create from "zustand";

type EnvironmentsState = {
  init: (environments: Environment[]) => void;
  projectUuid?: string;
  environments?: Environment[];
  add: (newEnvironment: Environment) => void;
};

export const useEnvironmentsStore = create<EnvironmentsState>()((set) => ({
  init: (environments) => set({ environments }),
  add: (newEnvironment) => {
    set((state) => {
      return {
        environments: state.environments
          ? [...state.environments, newEnvironment]
          : [newEnvironment],
      };
    });
  },
}));
