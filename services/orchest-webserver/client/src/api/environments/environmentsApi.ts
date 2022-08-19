import { queryArgs } from "@/pipeline-view/file-manager/common";
import {
  EnvironmentData,
  EnvironmentImageBuild,
  EnvironmentSpec,
  EnvironmentState,
  EnvironmentValidationData,
} from "@/types";
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

const checkLatestBuilds = async ({
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
      return checkLatestBuilds({ projectUuid, environmentStates });
    }
    return new FetchError(error);
  }
};

export const environmentsApi = {
  fetchAll,
  post,
  put,
  delete: remove,
  validate,
  triggerBuilds,
  cancelBuild,
  checkLatestBuilds,
};
