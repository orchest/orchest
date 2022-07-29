import { environmentsApi } from "@/api/environments/environmentsApi";
import { Environment, EnvironmentSpec } from "@/types";
import { FetchError } from "@orchest/lib-utils";
import create from "zustand";

export type EnvironmentsApiState = {
  projectUuid?: string;
  environments?: Environment[];
  isFetching: boolean;
  fetch: (projectUuid: string, language?: string) => Promise<void>;
  isPosting: boolean;
  post: (environmentName: string, specs: EnvironmentSpec) => Promise<void>;
  isPutting: boolean;
  put: (
    environmentUuid: string,
    payload: Partial<Environment>
  ) => Promise<void>;
  isDeleting: boolean;
  delete: (environmentUuid: string) => Promise<void>;
  error?: FetchError;
  clearError: () => void;
};

export const useEnvironmentsApi = create<EnvironmentsApiState>()((set, get) => {
  const getProjectUuid = (): string => {
    const projectUuid = get().projectUuid;
    if (!projectUuid) {
      throw new Error("projectUuid unavailable");
    }
    return projectUuid;
  };
  const getEnvironments = (): Environment[] => {
    const environments = get().environments;
    if (!environments) {
      throw new Error("Environments not yet fetched.");
    }
    return environments;
  };
  const getEnvironment = (uuid: string): Environment => {
    const environment = getEnvironments().find(
      (environment) => environment.uuid === uuid
    );
    if (!environment) {
      throw new Error("Failed to put. Environment not found.");
    }
    return environment;
  };
  return {
    isFetching: false,
    fetch: async (projectUuid, language) => {
      try {
        set({ isFetching: true, error: undefined });
        const environments = await environmentsApi.getAll(
          projectUuid,
          language
        );

        set({
          projectUuid,
          environments,
          isFetching: false,
        });
      } catch (error) {
        if (!error?.isCanceled) set({ error, isFetching: false });
      }
    },
    isPosting: false,
    post: async (environmentName: string, spec: EnvironmentSpec) => {
      try {
        const projectUuid = getProjectUuid();
        set({ isPosting: true, error: undefined });
        const newEnvironment = await environmentsApi.post(
          projectUuid,
          environmentName,
          spec
        );
        set((state) => {
          return {
            environments: state.environments
              ? [newEnvironment, ...state.environments]
              : [newEnvironment],
            isPosting: false,
          };
        });
      } catch (error) {
        set({ error, isPosting: false });
      }
    },
    isPutting: false,
    put: async (environmentUuid, payload) => {
      try {
        const projectUuid = getProjectUuid();
        const environments = getEnvironments();
        const environment = getEnvironment(environmentUuid);

        const updatedEnvironment = { ...environment, ...payload };
        const updatedEnvironments = environments.map((env) =>
          env.uuid === environmentUuid ? updatedEnvironment : env
        );

        set({ error: undefined, isPutting: true });
        await environmentsApi.put(projectUuid, updatedEnvironment);
        set({
          environments: updatedEnvironments,
          isPutting: false,
        });
      } catch (error) {
        set({ error, isPutting: false });
      }
    },
    isDeleting: false,
    delete: async (environmentUuid) => {
      try {
        const projectUuid = getProjectUuid();
        set({ isDeleting: true, error: undefined });
        await environmentsApi.delete(projectUuid, environmentUuid);
        set((state) => {
          const filteredEnvironments = state.environments?.filter(
            (environment) => environment.uuid !== environmentUuid
          );
          return {
            environments: filteredEnvironments,
            isDeleting: false,
          };
        });
      } catch (error) {
        set({ error, isDeleting: false });
      }
    },
    clearError: () => {
      set({ error: undefined });
    },
  };
});
