import { Environment } from "@/types";
import create from "zustand";

type EnvironmentsState = {
  init: (projectUuid: string, environments: Environment[]) => void;
  projectUuid?: string;
  environments?: Environment[];
  selectedEnvironment?: Environment;
  add: (newEnvironment: Environment) => void;
  select: (environmentUuid: string) => void;
};

export const useEnvironmentsStore = create<EnvironmentsState>()((set) => ({
  init: (projectUuid, environments) =>
    set({ projectUuid, environments, selectedEnvironment: environments[0] }),
  add: (newEnvironment) => {
    set((state) => {
      return {
        environments: state.environments
          ? [...state.environments, newEnvironment]
          : [newEnvironment],
        selectedEnvironment: newEnvironment,
      };
    });
  },
  select: (environmentUuid) => {
    set((state) => {
      const environments = state.environments || [];
      const foundEnvironment = environments.find(
        (environment) => environment.uuid === environmentUuid
      );
      return { selectedEnvironment: foundEnvironment };
    });
  },
}));
