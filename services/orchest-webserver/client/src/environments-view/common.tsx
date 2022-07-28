import {
  Environment,
  EnvironmentImageBuild,
  EnvironmentSpecs,
  OrchestSession,
} from "@/types";
import { fetcher, HEADER } from "@orchest/lib-utils";

export const BUILD_POLL_FREQUENCY = 1000;

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
  const sessionData = await fetcher<{ sessions: OrchestSession[] }>(
    `/catch/api-proxy/api/sessions?project_uuid=${projectUuid}`
  );
  return sessionData.sessions;
};

export function getMostRecentEnvironmentBuildsUrl(
  projectUuid: string | undefined,
  environmentUuid?: string
) {
  return projectUuid
    ? `/catch/api-proxy/api/environment-builds/most-recent/${projectUuid}${
        environmentUuid ? `/${environmentUuid}` : ""
      }`
    : undefined;
}

const fetchMostRecentEnvironmentBuilds = async (
  projectUuid: string,
  environmentUuid?: string
) => {
  const url = getMostRecentEnvironmentBuildsUrl(projectUuid, environmentUuid);
  if (!url) return Promise.reject("Invalid URL");

  const { environment_image_builds } = await fetcher<{
    environment_image_builds: EnvironmentImageBuild[];
  }>(url);

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
  environments?: Environment[]
) => {
  if (!environments) return;
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

export const postEnvironment = (
  projectUuid: string,
  environmentName: string,
  defaultEnvironments: EnvironmentSpecs
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
