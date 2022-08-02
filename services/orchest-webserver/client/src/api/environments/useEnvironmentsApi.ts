import { environmentsApi } from "@/api/environments/environmentsApi";
import {
  Environment,
  EnvironmentSpec,
  EnvironmentState,
  EnvironmentValidationData,
} from "@/types";
import { FetchError } from "@orchest/lib-utils";
import create from "zustand";

type EnvironmentBuildStatus =
  | "allEnvironmentsBuilt"
  | "environmentsNotYetBuilt"
  | "environmentsBuildInProgress";

export type EnvironmentsApiState = {
  projectUuid?: string;
  environments?: EnvironmentState[];
  isFetching: boolean;
  fetch: (projectUuid: string, language?: string) => Promise<void>;
  isPosting: boolean;
  post: (
    environmentName: string,
    specs: EnvironmentSpec
  ) => Promise<Environment | undefined>;
  isPutting: boolean;
  put: (
    environmentUuid: string,
    payload: Partial<Environment>
  ) => Promise<void>;
  isDeleting: boolean;
  delete: (environmentUuid: string) => Promise<void>;
  validate: () => Promise<EnvironmentBuildStatus | undefined>;
  status: EnvironmentBuildStatus;
  error?: FetchError;
  clearError: () => void;
};

const getEnvironmentBuildStatus = (
  validationData: EnvironmentValidationData
): EnvironmentBuildStatus => {
  return validationData.validation === "pass"
    ? "allEnvironmentsBuilt"
    : validationData.actions.some((action) =>
        ["BUILD", "RETRY"].includes(action)
      )
    ? "environmentsNotYetBuilt"
    : "environmentsBuildInProgress";
};

export const useEnvironmentsApi = create<EnvironmentsApiState>((set, get) => {
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
        set({ projectUuid, isFetching: true, error: undefined });
        const environments = await environmentsApi.fetchAll(
          projectUuid,
          language
        );

        set({ projectUuid, environments, isFetching: false });
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
        const newEnvironmentWithAction: EnvironmentState = {
          ...newEnvironment,
          action: "BUILD",
        };
        set((state) => {
          const environments = state.environments
            ? [newEnvironmentWithAction, ...state.environments]
            : [newEnvironmentWithAction];
          return {
            environments: environments.sort(
              (a, b) => -1 * a.name.localeCompare(b.name)
            ),
            isPosting: false,
          };
        });
        return newEnvironmentWithAction;
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
    status: "environmentsNotYetBuilt",
    validate: async () => {
      try {
        const projectUuid = getProjectUuid();
        const results = await environmentsApi.validate(
          projectUuid,
          get().environments
        );

        if (results instanceof Error) {
          return;
        }

        const [
          validatedEnvironments,
          response,
          shouldUpdateEnvironments,
        ] = results;

        if (shouldUpdateEnvironments) {
          set({
            environments: validatedEnvironments,
            status: getEnvironmentBuildStatus(response),
          });
        }

        return getEnvironmentBuildStatus(response);
      } catch (error) {
        console.error("Failed to validate environments.");
      }
    },
    clearError: () => {
      set({ error: undefined });
    },
  };
});
