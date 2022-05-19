import {
  DefaultEnvironment,
  Environment,
  EnvironmentImageBuild,
  IOrchestSession,
} from "@/types";
import { fetcher, HEADER } from "@orchest/lib-utils";

export const BUILD_POLL_FREQUENCY = 3000;

export const requestToRemoveEnvironment = (
  projectUuid: string | undefined,
  environmentUuid: string | undefined
) => {
  if (!projectUuid || !environmentUuid) return Promise.reject();
  // ultimately remove Image
  return fetcher<void>(
    `/store/environments/${projectUuid}/${environmentUuid}`,
    { method: "DELETE" }
  );
};

export const fetchSessionsInProject = async (projectUuid: string) => {
  const sessionData = await fetcher<{ sessions: IOrchestSession[] }>(
    `/catch/api-proxy/api/sessions/?project_uuid=${projectUuid}`
  );
  return sessionData.sessions;
};

export const fetchMostRecentEnvironmentBuilds = async (
  projectUuid: string,
  environmentUuid?: string
) => {
  const buildData = await fetcher<{
    environment_image_builds: EnvironmentImageBuild[];
  }>(
    `/catch/api-proxy/api/environment-builds/most-recent/${projectUuid}${
      environmentUuid ? `/${environmentUuid}` : ""
    }`
  );
  const { environment_image_builds } = buildData;
  return environment_image_builds;
};

export const hasSuccessfulBuild = async (
  projectUuid: string,
  environmentUuid: string
) => {
  const builds = await fetchMostRecentEnvironmentBuilds(
    projectUuid,
    environmentUuid
  );
  // No successful build; safe to remove this environment.
  return builds.some((x) => x.status === "SUCCESS");
};

export const getNewEnvironmentName = (
  defaultName: string,
  environments: Environment[]
) => {
  let count = 0;
  let finalName = defaultName;
  const allNames = new Set(environments.map((e) => e.name));
  while (count < 100) {
    const newName = `${finalName}${count === 0 ? "" : ` (${count})`}`;
    if (!allNames.has(newName)) {
      finalName = newName;
      break;
    }
    count += 1;
  }
  return finalName;
};

export const requestToCreateEnvironment = (
  projectUuid: string,
  environmentName: string,
  defaultEnvironments: DefaultEnvironment
) =>
  fetcher<Environment>(`/store/environments/${projectUuid}/new`, {
    method: "POST",
    headers: HEADER.JSON,
    body: JSON.stringify({
      environment: {
        ...defaultEnvironments,
        uuid: "new",
        name: environmentName,
      },
    }),
  });
