import { environmentsApi } from "@/api/environments/environmentsApi";
import {
  EnvironmentAction,
  EnvironmentData,
  EnvironmentImageBuild,
  EnvironmentSpec,
  EnvironmentState,
  EnvironmentValidationData,
} from "@/types";
import { pick } from "@/utils/record";
import { FetchError } from "@orchest/lib-utils";
import create from "zustand";

export type EnvironmentBuildStatus =
  | "allEnvironmentsBuilt"
  | "environmentsNotYetBuilt"
  | "environmentsFailedToBuild"
  | "environmentsBuildInProgress";

export type EnvironmentsApi = {
  projectUuid?: string;
  environments?: EnvironmentState[];
  setEnvironment: (uuid: string, value: Partial<EnvironmentData>) => void;
  isFetchingAll: boolean;
  fetch: (projectUuid: string, language?: string) => Promise<void>;
  isPosting: boolean;
  post: (
    environmentName: string,
    specs: EnvironmentSpec
  ) => Promise<EnvironmentData | undefined>;
  put: (
    environmentUuid: string,
    payload: Partial<EnvironmentData>
  ) => Promise<EnvironmentData | undefined>;
  isDeleting: boolean;
  delete: (uuid: string, action?: EnvironmentAction) => Promise<void>;
  buildingEnvironments: string[];
  environmentsToBeBuilt: string[];
  validate: () => Promise<
    [EnvironmentValidationData | undefined, EnvironmentBuildStatus | undefined]
  >;
  status: EnvironmentBuildStatus;
  hasLoadedBuildStatus: boolean;
  updateBuildStatus: () => Promise<void>;
  isTriggeringBuild: boolean;
  triggerBuilds: (environments: string[]) => Promise<void>;
  isCancelingBuild: boolean;
  cancelBuild: (environmentUuid: string) => Promise<void>;
  error?: FetchError;
  clearError: () => void;
};

const getEnvironmentBuildStatus = (
  validationData: EnvironmentValidationData
): EnvironmentBuildStatus => {
  if (validationData.validation === "pass") return "allEnvironmentsBuilt";

  let status = "environmentsBuildInProgress";
  for (const action of validationData.actions) {
    if (action === "RETRY") {
      status = "environmentsFailedToBuild";
      // "environmentsFailedToBuild" has higher priority to be shown in the warning than "environmentsNotYetBuilt".
      // Therefore, we can break if seeing any "RETRY".
      break;
    }
    if (action === "BUILD") {
      status = "environmentsNotYetBuilt";
    }
  }
  return status as EnvironmentBuildStatus;
};

const getEnvironmentFromState = (state: EnvironmentState): EnvironmentData => {
  return pick(
    state,
    "uuid",
    "name",
    "base_image",
    "gpu_support",
    "language",
    "project_uuid",
    "setup_script"
  );
};

export const useEnvironmentsApi = create<EnvironmentsApi>((set, get) => {
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
    setEnvironment: (uuid, payload) => {
      set((state) => {
        return {
          environments: (state.environments || []).map((environment) =>
            environment.uuid === uuid
              ? { ...environment, ...payload }
              : environment
          ),
        };
      });
    },
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
            environmentsToBeBuilt: [
              ...state.environmentsToBeBuilt,
              newEnvironmentWithAction.uuid,
            ],
            isPosting: false,
          };
        });
        return newEnvironmentWithAction;
      } catch (error) {
        set({ error, isPosting: false });
      }
    },
    put: async (environmentUuid, payload) => {
      try {
        const projectUuid = getProjectUuid();
        const environmentState = getEnvironment(environmentUuid);

        const updatedEnvironment = await environmentsApi.put(
          projectUuid,
          getEnvironmentFromState({ ...environmentState, ...payload })
        );
        // Note: Merging the response into the state after PUT is not always necessary,
        // It causes an unnecessary re-render for normal cases.
        return updatedEnvironment;
      } catch (error) {
        set({ error });
      }
    },
    isDeleting: false,
    delete: async (uuid, action) => {
      try {
        const projectUuid = getProjectUuid();
        set({ isDeleting: true, error: undefined });
        await environmentsApi.delete(projectUuid, uuid);
        set((state) => {
          const filteredEnvironments = state.environments?.filter(
            (environment) => environment.uuid !== uuid
          );

          const environmentsToBeBuilt = ["BUILD", "RETRY"].includes(
            action || ""
          )
            ? state.environmentsToBeBuilt.filter(
                (toBuildEnvironmentUuid) => toBuildEnvironmentUuid !== uuid
              )
            : state.environmentsToBeBuilt;

          const buildingEnvironments =
            action === "WAIT"
              ? state.buildingEnvironments.filter(
                  (toBuildEnvironmentUuid) => toBuildEnvironmentUuid !== uuid
                )
              : state.buildingEnvironments;

          return {
            environments: filteredEnvironments,
            environmentsToBeBuilt,
            buildingEnvironments,
            isDeleting: false,
          };
        });
      } catch (error) {
        set({ error, isDeleting: false });
      }
    },
    status: "allEnvironmentsBuilt",
    buildingEnvironments: [],
    environmentsToBeBuilt: [],
    validate: async () => {
      try {
        const projectUuid = getProjectUuid();
        const [
          validatedEnvironments,
          response,
          hasActionChanged,
          buildingEnvironments,
          environmentsToBeBuilt,
        ] = await environmentsApi.validate(projectUuid, get().environments);

        const status = getEnvironmentBuildStatus(response);

        if (hasActionChanged || status !== get().status) {
          set({
            environments: validatedEnvironments,
            status,
            buildingEnvironments,
            environmentsToBeBuilt,
          });
        }

        return [response, status];
      } catch (error) {
        console.error(`Failed to validate environments. ${String(error)}`);
        return [undefined, undefined];
      }
    },
    hasLoadedBuildStatus: false,
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
          set({
            environments: environmentsWithLatestBuildStatus,
            hasLoadedBuildStatus: true,
          });
        } else if (!get().hasLoadedBuildStatus) {
          set({ hasLoadedBuildStatus: true });
        }
      } catch (error) {
        console.error(
          `Failed to fetch most recent environment builds. ${String(error)}`
        );
      }
    },
    isTriggeringBuild: false,
    triggerBuilds: async (environments: string[]) => {
      try {
        const projectUuid = getProjectUuid();
        set({ isTriggeringBuild: true, error: undefined });
        const environmentImageBuilds = await environmentsApi.triggerBuilds(
          projectUuid,
          environments
        );

        const buildsMap = new Map(
          environmentImageBuilds.map((build) => [build.environment_uuid, build])
        );

        set((state) => {
          const updatedEnvironments = (state.environments || []).map((env) => {
            const newBuild = buildsMap.get(env.uuid);
            return newBuild ? { ...env, latestBuild: newBuild } : env;
          });
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
        if (!environment.latestBuild) {
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
