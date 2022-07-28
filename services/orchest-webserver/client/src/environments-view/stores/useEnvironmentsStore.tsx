import { queryArgs } from "@/pipeline-view/file-manager/common";
import { Environment, EnvironmentSpecs } from "@/types";
import { fetcher, FetchError } from "@orchest/lib-utils";
import create from "zustand";
import { postEnvironment } from "../common";

export type EnvironmentsState = {
  projectUuid?: string;
  environments?: Environment[];
  selectedEnvironment?: Environment;
  select: (environmentUuid: string) => void;
  fetch: (projectUuid: string, language?: string) => Promise<void>;
  isFetching: boolean;
  post: (environmentName: string, specs: EnvironmentSpecs) => Promise<void>;
  isPosting: boolean;
  error?: FetchError;
  clearError: () => void;
};

export const useEnvironmentsStore = create<EnvironmentsState>()((set, get) => ({
  select: (environmentUuid) => {
    set((state) => {
      const environments = state.environments || [];
      const foundEnvironment = environments.find(
        (environment) => environment.uuid === environmentUuid
      );
      return { selectedEnvironment: foundEnvironment };
    });
  },
  isFetching: false,
  fetch: async (projectUuid, language) => {
    try {
      const queryString = language ? `?${queryArgs({ language })}` : "";

      set({ isFetching: true, error: undefined });
      const environments = await fetcher<Environment[]>(
        `/store/environments/${projectUuid}${queryString}`
      );

      set({
        projectUuid,
        environments,
        selectedEnvironment: environments[0],
        isFetching: false,
      });
    } catch (error) {
      if (!error?.isCanceled) set({ error, isFetching: false });
    }
  },
  isPosting: false,
  post: async (environmentName: string, specs: EnvironmentSpecs) => {
    const projectUuid = get().projectUuid;
    if (!projectUuid) {
      set({ error: new Error("projectUuid unavailable") });
      return;
    }
    try {
      set({ isPosting: true, error: undefined });
      const newEnvironment = await postEnvironment(
        projectUuid,
        environmentName,
        specs
      );
      set((state) => {
        return {
          environments: state.environments
            ? [newEnvironment, ...state.environments]
            : [newEnvironment],
          selectedEnvironment: newEnvironment,
          isPosting: false,
        };
      });
    } catch (error) {
      set({ error, isPosting: false });
    }
  },
  clearError: () => {
    set({ error: undefined });
  },
}));
