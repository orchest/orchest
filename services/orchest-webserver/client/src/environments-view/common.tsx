import {
  CustomImage,
  EnvironmentData,
  EnvironmentImageBuild,
  EnvironmentSpec,
  EnvironmentState,
  Language,
  OrchestSession,
} from "@/types";
import { getUniqueName } from "@/utils/getUniqueName";
import { omit } from "@/utils/record";
import { fetcher, hasValue, HEADER } from "@orchest/lib-utils";

export const isEnvironmentBuilding = (
  status?: EnvironmentImageBuild["status"]
) => hasValue(status) && ["PENDING", "STARTED"].includes(status);

export const isEnvironmentFailedToBuild = (
  status?: EnvironmentImageBuild["status"]
) => status && ["ABORTED", "FAILURE"].includes(status);

export const fetchSessionsInProject = async (projectUuid: string) => {
  const sessionData = await fetcher<{ sessions: OrchestSession[] }>(
    `/catch/api-proxy/api/sessions?project_uuid=${projectUuid}`
  );
  return sessionData.sessions;
};

function getMostRecentEnvironmentBuildsUrl(
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
  environments?: EnvironmentData[]
) => {
  if (!environments) return;

  return getUniqueName(
    defaultName,
    environments.map((e) => e.name)
  );
};

export const postEnvironment = (
  projectUuid: string,
  environmentName: string,
  defaultEnvironments: EnvironmentSpec
) =>
  fetcher<EnvironmentData>(`/store/environments/${projectUuid}/new`, {
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

export const environmentDataFromState = (
  environmentState?: EnvironmentState
): EnvironmentData | undefined => {
  if (!environmentState) return undefined;

  return omit(environmentState, "action", "latestBuild");
};

/**
 * Return the environment with the given UUID, or return the first environment if
 * not found.
 */
export const findEnvironment = (
  environments: EnvironmentState[] | undefined,
  uuid?: string
) => {
  const foundEnvironment = uuid
    ? environments?.find((env) => env.uuid === uuid)
    : environments?.[0];

  return foundEnvironment;
};

export const LANGUAGE_MAP: Record<Language, string> = {
  python: "Python",
  r: "R",
  julia: "Julia",
  javascript: "JavaScript",
};

// Related to the analytics.py module, "environment_image_build_start" event,
// which checks for the base image to start with "orchest/".
export const DEFAULT_BASE_IMAGES: (CustomImage & {
  img_src: string;
  label: string;
  unavailable?: boolean;
})[] = [
  {
    base_image: "orchest/base-kernel-py",
    img_src: "/image/python_logo.svg",
    language: "python",
    gpu_support: false,
    label: "Python",
  },
  {
    base_image: "orchest/base-kernel-r",
    img_src: "/image/r_logo.svg",
    language: "r",
    gpu_support: false,
    label: "R",
  },
  {
    base_image: "orchest/base-kernel-julia",
    img_src: "/image/julia_logo.svg",
    language: "julia",
    gpu_support: false,
    label: "Julia",
  },
  {
    base_image: "orchest/base-kernel-javascript",
    img_src: "/image/javascript_logo.svg",
    language: "javascript",
    gpu_support: false,
    label: "JavaScript",
  },
];

export const BASE_IMAGE_LANGUAGES = new Set<string>(
  DEFAULT_BASE_IMAGES.map((image) => image.language)
);

export function shallowEqualByKey<T extends Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  obj1: T,
  obj2: T,
  keys: (keyof Partial<T>)[]
) {
  if (!obj1 || !obj2) return obj1 === obj2;
  return keys.every((key) => {
    return obj1[key] === obj2[key];
  });
}

// Due to the migration to k8s, gpu-supported images are not yet available
export const GPU_SUPPORT_ENABLED = false;
