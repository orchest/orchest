import { queryArgs } from "@/pipeline-view/file-manager/common";
import {
  Environment,
  EnvironmentSpec,
  EnvironmentState,
  EnvironmentValidationData,
} from "@/types";
import { fetcher, FetchError, HEADER } from "@orchest/lib-utils";
import produce from "immer";

const fetchAll = async (projectUuid: string, language?: string) => {
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
const validate = async (projectUuid: string) =>
  fetcher<EnvironmentValidationData>(
    `/catch/api-proxy/api/validations/environments`,
    {
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify({ project_uuid: projectUuid }),
    }
  );

const validateLatest = async (
  projectUuid: string,
  existingEnvironments: EnvironmentState[] = []
): Promise<
  [EnvironmentState[], EnvironmentValidationData, boolean] | FetchError
> => {
  let hasActionChanged = false;
  try {
    const response = await validate(projectUuid);
    const envMap = new Map(existingEnvironments.map((env) => [env.uuid, env]));
    const updatedEnvironmentMap = produce(envMap, (draft) => {
      for (const [index, action] of response.actions.entries()) {
        const uuid = response.fail[index];
        const environment = draft.get(uuid);
        if (!environment) throw "refetch";
        if (environment.action !== action) hasActionChanged = true;
        environment.action = action;
      }
    });
    const environments = Array.from(
      updatedEnvironmentMap,
      ([, value]) => value
    );
    return [environments, response, hasActionChanged];
  } catch (error) {
    if (error === "refetch") {
      const latestEnvironments = await fetchAll(projectUuid);
      return validateLatest(projectUuid, latestEnvironments);
    }
    return new FetchError(error);
  }
};

export const environmentsApi = {
  fetchAll,
  post,
  put,
  delete: remove,
  validate: validateLatest,
};
