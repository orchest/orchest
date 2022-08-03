import { environmentsApi } from "@/api/environments/environmentsApi";
import {
  Environment,
  EnvironmentImageBuild,
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
  isFetchingAll: boolean;
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
  updateBuildStatus: () => Promise<void>;
  isTriggeringBuild: boolean;
  triggerBuild: (environmentUuid: string) => Promise<void>;
  isCancelingBuild: boolean;
  cancelBuild: (environmentUuid: string) => Promise<void>;
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
  const getEnvironments = (): EnvironmentState[] => {
    const environments = get().environments;
    if (!environments) {
      throw new Error("Environments not yet fetched.");
    }
    return environments;
  };
  const getEnvironment = (uuid: string): EnvironmentState => {
    const environment = getEnvironments().find(
      (environment) => environment.uuid === uuid
    );
    if (!environment) {
      throw new Error("Environment not found.");
    }
    return environment;
  };

  return {
    isFetchingAll: false,
    fetch: async (projectUuid, language) => {
      try {
        set({ projectUuid, isFetchingAll: true, error: undefined });
        const environments = await environmentsApi.fetchAll(
          projectUuid,
          language
        );

        set({ projectUuid, environments, isFetchingAll: false });
      } catch (error) {
        if (!error?.isCanceled) set({ error, isFetchingAll: false });
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
    updateBuildStatus: async () => {
      try {
        const projectUuid = getProjectUuid();
        const environmentStates = getEnvironments();
        const results = await environmentsApi.checkLatestBuilds({
          projectUuid,
          environmentStates,
        });

        if (results instanceof Error) {
          return;
        }

        const [
          environmentsWithLatestBuildStatus,
          shouldUpdateEnvironments,
        ] = results;
        if (shouldUpdateEnvironments) {
          set({ environments: environmentsWithLatestBuildStatus });
        }
      } catch (error) {
        console.error(
          `Failed to fetch most recent environment builds. ${String(error)}`
        );
      }
    },
    isTriggeringBuild: false,
    triggerBuild: async (environmentUuid: string) => {
      try {
        const projectUuid = getProjectUuid();
        set({ isTriggeringBuild: true, error: undefined });
        const environmentImageBuild = await environmentsApi.triggerBuild(
          projectUuid,
          environmentUuid
        );

        set((state) => {
          const updatedEnvironments = (state.environments || []).map((env) =>
            env.uuid === environmentUuid
              ? { ...env, latestBuild: environmentImageBuild }
              : env
          );
          return {
            environments: updatedEnvironments,
            isTriggeringBuild: false,
          };
        });
      } catch (error) {
        set({ error, isTriggeringBuild: false });
      }
    },
    isCancelingBuild: false,
    cancelBuild: async (environmentUuid: string) => {
      try {
        const environment = getEnvironment(environmentUuid);
        if (
          !environment.latestBuild ||
          environment.latestBuild.status === "INITIALIZING"
        ) {
          throw new Error("Environment has no ongoing build.");
        }

        set({ isCancelingBuild: true, error: undefined });
        await environmentsApi.cancelBuild(environment.latestBuild);
        set((state) => {
          const updatedEnvironments = (state.environments || []).map((env) =>
            env.uuid === environmentUuid
              ? {
                  ...env,
                  latestBuild: {
                    ...env.latestBuild,
                    status: "ABORTED",
                  } as EnvironmentImageBuild,
                }
              : env
          );
          return {
            environments: updatedEnvironments,
            isCancelingBuild: false,
          };
        });
      } catch (error) {
        set({ error, isCancelingBuild: false });
      }
    },
    clearError: () => {
      set({ error: undefined });
    },
  };
});
