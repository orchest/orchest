import { queryArgs } from "@/pipeline-view/file-manager/common";
import {
  Environment,
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
  const unsortedEnvironment = await fetcher<Environment[]>(
    `/store/environments/${projectUuid}${queryString}`
  );
  return unsortedEnvironment.sort((a, b) => -1 * a.name.localeCompare(b.name));
};
const post = (projectUuid: string, name: string, spec: EnvironmentSpec) =>
  fetcher<Environment>(`/store/environments/${projectUuid}/new`, {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({
      environment: { ...spec, uuid: "new", name },
    }),
  });
const put = (projectUuid: string, environment: Environment) =>
  fetcher<Environment>(
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

const validate = async (
  projectUuid: string,
  existingEnvironments: EnvironmentState[] = []
): Promise<
  | [EnvironmentState[], EnvironmentValidationData, boolean, string[], string[]]
  | FetchError
> => {
  let hasActionChanged = false;
  try {
    const response = await postValidate(projectUuid);
    const envMap = new Map(existingEnvironments.map((env) => [env.uuid, env]));
    let buildingEnvironments: string[] = [];
    const environmentsToBeBuilt: string[] = [];
    const updatedEnvironmentMap = produce(envMap, (draft) => {
      response.actions.forEach((action, index) => {
        const uuid = response.fail[index];
        const environment = draft.get(uuid);
        if (!environment) throw "refetch";
        if (environment.action !== action) hasActionChanged = true;
        if (action === "WAIT") buildingEnvironments.push(uuid);
        if (["BUILD", "RETRY"].includes(action))
          environmentsToBeBuilt.push(uuid);
        environment.action = action;
      });
      response.pass.forEach((uuid) => {
        const environment = draft.get(uuid);
        if (!environment) throw "refetch";
        if (Boolean(environment.action)) hasActionChanged = true;
        environment.action = undefined;
      });
    });
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
    if (error === "refetch") {
      const latestEnvironments = await fetchAll(projectUuid);
      return validate(projectUuid, latestEnvironments);
    }
    return new FetchError(error);
  }
};

const ENVIRONMENT_BUILD_ENDPOINT = "/catch/api-proxy/api/environment-builds";

const triggerBuild = (projectUuid: string, environmentUuid: string) =>
  fetcher<{ environment_image_builds: EnvironmentImageBuild[] }>(
    ENVIRONMENT_BUILD_ENDPOINT,
    {
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify({
        environment_image_build_requests: [
          { project_uuid: projectUuid, environment_uuid: environmentUuid },
        ],
      }),
    }
  ).then((response) => response.environment_image_builds[0]);

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
        if (!environment) throw "refetch";
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
    if (error === "refetch") {
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
  triggerBuild,
  cancelBuild,
  checkLatestBuilds,
};
