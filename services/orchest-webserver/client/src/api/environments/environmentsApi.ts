import { queryArgs } from "@/pipeline-view/file-manager/common";
import {
  Environment,
  EnvironmentSpec,
  EnvironmentValidationData,
} from "@/types";
import { fetcher, HEADER } from "@orchest/lib-utils";

export const environmentsApi = {
  getAll: (projectUuid: string, language?: string) => {
    const queryString = language ? `?${queryArgs({ language })}` : "";
    return fetcher<Environment[]>(
      `/store/environments/${projectUuid}${queryString}`
    );
  },
  post: (projectUuid: string, name: string, spec: EnvironmentSpec) =>
    fetcher<Environment>(`/store/environments/${projectUuid}/new`, {
      method: "POST",
      headers: HEADER.JSON,
      body: JSON.stringify({
        environment: { ...spec, uuid: "new", name },
      }),
    }),
  put: (projectUuid: string, environment: Environment) =>
    fetcher<Environment>(
      `/store/environments/${projectUuid}/${environment.uuid}`,
      {
        method: "PUT",
        headers: HEADER.JSON,
        body: JSON.stringify({ environment }),
      }
    ),
  delete: (projectUuid: string, environmentUuid: string) =>
    fetcher<void>(`/store/environments/${projectUuid}/${environmentUuid}`, {
      method: "DELETE",
    }),
  validate: async (projectUuid: string) =>
    fetcher<EnvironmentValidationData>(
      `/catch/api-proxy/api/validations/environments`,
      {
        method: "POST",
        headers: HEADER.JSON,
        body: JSON.stringify({ project_uuid: projectUuid }),
      }
    ),
};
