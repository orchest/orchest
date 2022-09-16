import {
  EnvironmentData,
  EnvironmentImageBuild,
  EnvironmentSpec,
  EnvironmentState,
  EnvironmentValidationData,
} from "@/types";
import { queryArgs } from "@/utils/text";
import { fetcher, FetchError, HEADER } from "@orchest/lib-utils";
import produce from "immer";

const fetchAll = async (
  projectUuid: string,
  language?: string
): Promise<EnvironmentState[]> => {
  const queryString = language ? `?${queryArgs({ language })}` : "";
  const unsortedEnvironment = await fetcher<EnvironmentData[]>(
    `/store/environments/${projectUuid}${queryString}`
  );
  return unsortedEnvironment.sort((a, b) => -1 * a.name.localeCompare(b.name));
};
const post = (projectUuid: string, name: string, spec: EnvironmentSpec) =>
  fetcher<EnvironmentData>(`/store/environments/${projectUuid}/new`, {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({
      environment: { ...spec, uuid: "new", name },
    }),
  });
const put = (projectUuid: string, environment: EnvironmentData) =>
  fetcher<EnvironmentData>(
    `/store/environments/${projectUuid}/${environment.uuid}`,
    {
      method: "PUT",
      headers: HEADER.JSON,
      body: JSON.stringify({ environment }),
    }
  );
const remove = (projectUuid: string, environmentUuid: string) =>
  fetcher<void>(`/store/environments/${projectUuid}/${environmentUuid}`, {
    method: "DELETE",
  });
const postValidate = async (projectUuid: string) =>
  fetcher<EnvironmentValidationData>(
    `/catch/api-proxy/api/validations/environments`,
    {
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify({ project_uuid: projectUuid }),
    }
  );

/**
 * Derive and map the follow-up action to the environment per failed environment build.
 * NOTE: will mutate `environmentsMap`.
 */
const processFollowupActions = (
  environmentsMap: Map<string, EnvironmentState>,
  validationData: EnvironmentValidationData
) => {
  const buildingEnvironments: string[] = [];
  const environmentsToBeBuilt: string[] = [];
  let hasActionChanged = false;
  const updatedEnvironmentsMap = produce(environmentsMap, (draft) => {
    validationData.actions.forEach((action, index) => {
      const uuid = validationData.fail[index];
      const environment = draft.get(uuid);
      if (!environment) throw new Error("environment unavailable");
      if (environment.action !== action) hasActionChanged = true;
      if (action === "WAIT") buildingEnvironments.push(uuid);
      if (["BUILD", "RETRY"].includes(action)) environmentsToBeBuilt.push(uuid);
      environment.action = action;
    });
  });
  return [
    updatedEnvironmentsMap,
    buildingEnvironments,
    environmentsToBeBuilt,
    hasActionChanged,
  ] as const;
};

/**
 * Remove the `action` of the environment per successful build.
 * NOTE: will mutate `environmentsMap`.
 */
const processSuccessBuilds = (
  environmentsMap: Map<string, EnvironmentState>,
  validationData: EnvironmentValidationData
) => {
  let hasActionChanged = false;
  const updatedEnvironmentsMap = produce(environmentsMap, (draft) => {
    validationData.pass.forEach((uuid) => {
      const environment = draft.get(uuid);
      if (!environment) throw new Error("environment unavailable");
      if (Boolean(environment.action)) hasActionChanged = true;
      environment.action = undefined;
    });
  });
  return [updatedEnvironmentsMap, hasActionChanged] as const;
};

const validate = async (
  projectUuid: string,
  existingEnvironments: EnvironmentState[] = []
): Promise<
  [EnvironmentState[], EnvironmentValidationData, boolean, string[], string[]]
> => {
  try {
    const response = await postValidate(projectUuid);
    const environmentsMap = new Map(
      existingEnvironments.map((env) => [env.uuid, env])
    );

    const [
      environmentsMapWithFollowupActions,
      buildingEnvironments,
      environmentsToBeBuilt,
      hasNewInvalidEnvironmentBuilds,
    ] = processFollowupActions(environmentsMap, response);

    const [updatedEnvironmentMap, hasNewSuccessBuilds] = processSuccessBuilds(
      environmentsMapWithFollowupActions,
      response
    );

    const hasActionChanged =
      hasNewInvalidEnvironmentBuilds || hasNewSuccessBuilds;

    const environments = Array.from(
      updatedEnvironmentMap,
      ([, value]) => value
    );

    return [
      environments,
      response,
      hasActionChanged,
      buildingEnvironments,
      environmentsToBeBuilt,
    ];
  } catch (error) {
    if (error.message === "environment unavailable") {
      const latestEnvironments = await fetchAll(projectUuid);
      return validate(projectUuid, latestEnvironments);
    }
    throw new FetchError(error);
  }
};

const ENVIRONMENT_BUILD_ENDPOINT = "/catch/api-proxy/api/environment-builds";

const triggerBuilds = (projectUuid: string, environments: string[]) =>
  fetcher<{ environment_image_builds: EnvironmentImageBuild[] }>(
    ENVIRONMENT_BUILD_ENDPOINT,
    {
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify({
        environment_image_build_requests: environments.map(
          (environment_uuid) => ({
            project_uuid: projectUuid,
            environment_uuid,
          })
        ),
      }),
    }
  ).then((response) => response.environment_image_builds);

const cancelBuild = (environmentBuild: EnvironmentImageBuild) =>
  fetcher(
    `${ENVIRONMENT_BUILD_ENDPOINT}/${environmentBuild.project_uuid}/` +
      `${environmentBuild.environment_uuid}/${environmentBuild.image_tag}`,
    { method: "DELETE" }
  );

const fetchLatestBuilds = async (
  projectUuid: string,
  environmentUuid?: string
) => {
  const baseUrl = `${ENVIRONMENT_BUILD_ENDPOINT}/most-recent`;

  const url = [baseUrl, projectUuid, environmentUuid].filter(Boolean).join("/");
  const response = await fetcher<Record<string, EnvironmentImageBuild[]>>(url);
  return response["environment_image_builds"];
};

const haveAllEnvironmentsBuilt = async (
  projectUuid: string,
  environments: string[]
) => {
  try {
    // To detect if any environment is not yet built, it's unnecessary to wait for all responses.
    // Return true if any of the environment has zero build.
    // `Promise.any` is used, instead of `Promise.all`.
    await Promise.any(
      environments.map((environmentUuid) => {
        return new Promise((resolve, reject) => {
          fetchLatestBuilds(projectUuid, environmentUuid)
            .then((builds) => {
              // `Promise.any` is resolved when any of the promises is resolved.
              // In this case, we have to return a rejection if an environment is built (has more than one build).
              if (builds.length > 0) {
                reject();
              } else {
                resolve(0);
              }
            })
            .catch(() => resolve(0)); // if the request is rejected, the environment does not exist.
        });
      })
    );
    return false;
  } catch (error) {
    // `Promise.any` will be rejected if all promises are rejected, meaning that all environments have more than zero builds.
    return true;
  }
};

const updateLatestBuildInEnvironments = async ({
  projectUuid,
  environmentUuid,
  environmentStates = [],
}: {
  projectUuid: string;
  environmentUuid?: string;
  environmentStates?: EnvironmentState[];
}): Promise<[EnvironmentState[], boolean] | FetchError> => {
  let hasBuildStateChanged = false;
  try {
    const response = await fetchLatestBuilds(projectUuid, environmentUuid);
    const envMap = new Map(
      environmentStates.map((env) => {
        return [env.uuid, env];
      })
    );
    const updatedEnvironmentMap = produce(envMap, (draft) => {
      response.forEach((build) => {
        const environment = draft.get(build.environment_uuid || "");
        if (!environment) throw new Error("requireRefetch");
        if (environment.latestBuild?.status !== build.status)
          hasBuildStateChanged = true;

        environment.latestBuild = build;
      });
    });
    const environments = Array.from(
      updatedEnvironmentMap,
      ([, value]) => value
    );
    return [environments, hasBuildStateChanged];
  } catch (error) {
    if (error.message === "requireRefetch") {
      const environmentStates = await fetchAll(projectUuid);
      return updateLatestBuildInEnvironments({
        projectUuid,
        environmentStates,
      });
    }
    return new FetchError(error);
  }
};

const isUsedByJobs = (projectUuid: string, environmentUuid: string) =>
  fetcher<{ in_use: boolean }>(
    `/catch/api-proxy/api/environments/in-use/${projectUuid}/${environmentUuid}`,
    { method: "GET" }
  ).then((response) => response.in_use);

export const environmentsApi = {
  fetchAll,
  post,
  put,
  delete: remove,
  validate,
  triggerBuilds,
  cancelBuild,
  haveAllEnvironmentsBuilt,
  isUsedByJobs,
  updateLatestBuildInEnvironments,
};
