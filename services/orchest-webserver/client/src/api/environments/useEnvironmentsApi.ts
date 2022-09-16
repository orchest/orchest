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
import create from "zustand";

export type EnvironmentBuildStatus =
  | "allEnvironmentsBuilt"
  | "environmentsNotYetBuilt"
  | "environmentsFailedToBuild"
  | "environmentsBuildInProgress";

export type EnvironmentsApi = {
  projectUuid?: string;
  environments?: EnvironmentState[];
  setEnvironments: (
    value:
      | EnvironmentState[]
      | undefined
      | ((environments: EnvironmentState[]) => EnvironmentState[])
  ) => void;
  setEnvironment: (uuid: string, value: Partial<EnvironmentData>) => void;
  fetchAll: (
    projectUuid: string,
    language?: string
  ) => Promise<EnvironmentState[]>;
  post: (
    environmentName: string,
    specs: EnvironmentSpec
  ) => Promise<EnvironmentData | undefined>;
  put: (
    environmentUuid: string,
    payload: Partial<EnvironmentData>
  ) => Promise<EnvironmentData | undefined>;
  delete: (uuid: string, action?: EnvironmentAction) => Promise<void>;
  buildingEnvironments: string[];
  environmentsToBeBuilt: string[];
  validate: () => Promise<
    [EnvironmentValidationData, EnvironmentBuildStatus] | undefined
  >;
  status: EnvironmentBuildStatus;
  hasLoadedBuildStatus: boolean;
  updateBuildStatus: () => Promise<void>;
  isTriggeringBuild: boolean;
  triggerBuilds: (environments: string[]) => Promise<void>;
  cancelBuild: (environmentUuid: string) => Promise<void>;
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
  return {
    setEnvironments: (value) => {
      set((state) => {
        const updatedEnvironments =
          value instanceof Function ? value(state.environments || []) : value;
        return updatedEnvironments
          ? { environments: updatedEnvironments }
          : { environments: undefined, projectUuid: undefined };
      });
    },
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
    fetchAll: async (projectUuid, language) => {
      set({ projectUuid });
      const environments = await environmentsApi.fetchAll(
        projectUuid,
        language
      );

      set({ projectUuid, environments });
      return environments;
    },
    post: async (environmentName: string, spec: EnvironmentSpec) => {
      const projectUuid = get().projectUuid;
      if (!projectUuid) return;

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
        };
      });
      return newEnvironmentWithAction;
    },
    put: async (environmentUuid, payload) => {
      const projectUuid = get().projectUuid;
      if (!projectUuid) return;

      const environment = get().environments?.find(
        (environment) => environment.uuid === environmentUuid
      );
      if (!environment) return;

      const updatedEnvironment = await environmentsApi.put(
        projectUuid,
        getEnvironmentFromState({ ...environment, ...payload })
      );

      set((state) => {
        return {
          environments: state.environments?.map((env) =>
            env.uuid === environmentUuid
              ? { ...env, ...updatedEnvironment }
              : env
          ),
        };
      });

      return updatedEnvironment;
    },
    delete: async (uuid, action) => {
      const projectUuid = get().projectUuid;
      if (!projectUuid) return;

      await environmentsApi.delete(projectUuid, uuid);
      set((state) => {
        const filteredEnvironments = state.environments?.filter(
          (environment) => environment.uuid !== uuid
        );

        const environmentsToBeBuilt = ["BUILD", "RETRY"].includes(action || "")
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
        };
      });
    },
    status: "allEnvironmentsBuilt",
    buildingEnvironments: [],
    environmentsToBeBuilt: [],
    validate: async () => {
      const projectUuid = get().projectUuid;
      if (!projectUuid) return;

      const [
        validatedEnvironments,
        response,
        hasActionChanged,
        buildingEnvironments,
        environmentsToBeBuilt,
      ] = await environmentsApi.validate(projectUuid, get().environments);

      const status = getEnvironmentBuildStatus(response);

      if (hasActionChanged || status !== get().status) {
        set((state) => {
          const environmentsMap = new Map(
            (state.environments || []).map((env) => [env.uuid, env])
          );
          return {
            environments: validatedEnvironments.map((env) => ({
              ...environmentsMap.get(env.uuid),
              ...env,
            })),
            status,
            buildingEnvironments,
            environmentsToBeBuilt,
          };
        });
      }

      return [response, status];
    },
    hasLoadedBuildStatus: false,
    updateBuildStatus: async () => {
      try {
        const projectUuid = get().projectUuid;
        if (!projectUuid) return;

        const environmentStates = get().environments;
        if (!environmentStates) return;

        const results = await environmentsApi.updateLatestBuildInEnvironments({
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
        const projectUuid = get().projectUuid;
        if (!projectUuid) return;

        set({ isTriggeringBuild: true });
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
        set({ isTriggeringBuild: false });
      }
    },
    cancelBuild: async (environmentUuid: string) => {
      const environment = get().environments?.find(
        (environment) => environment.uuid === environmentUuid
      );
      if (!environment?.latestBuild) {
        throw new Error("Environment has no ongoing build.");
      }

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
        };
      });
    },
  };
});
