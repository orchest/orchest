import { queryArgs } from "@/pipeline-view/file-manager/common";
import {
  Environment,
  EnvironmentSpec,
  EnvironmentState,
  EnvironmentValidationData,
} from "@/types";
import { fetcher, FetchError, HEADER } from "@orchest/lib-utils";
import produce from "immer";

const fetchAll = (projectUuid: string, language?: string) => {
  const queryString = language ? `?${queryArgs({ language })}` : "";
  return fetcher<Environment[]>(
    `/store/environments/${projectUuid}${queryString}`
  );
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
): Promise<[EnvironmentState[], EnvironmentValidationData] | FetchError> => {
  try {
    const response = await validate(projectUuid);
    const envMap = new Map(existingEnvironments.map((env) => [env.uuid, env]));
    const updatedEnvironmentMap = produce(envMap, (draft) => {
      for (const [index, action] of response.actions.entries()) {
        const uuid = response.fail[index];
        const environment = draft.get(uuid);
        if (environment) {
          environment.action = action;
        } else {
          throw "refetch";
        }
      }
    });
    const environments = Array.from(
      updatedEnvironmentMap,
      ([, value]) => value
    );
    return [environments, response];
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
