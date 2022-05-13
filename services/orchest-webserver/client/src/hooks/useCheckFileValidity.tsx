import {
  FILE_MANAGEMENT_ENDPOINT,
  queryArgs,
} from "@/pipeline-view/file-manager/common";
import {
  ALLOWED_STEP_EXTENSIONS,
  extensionFromFilename,
  fetcher,
  hasValue,
} from "@orchest/lib-utils";
import useSWR from "swr";

export const pathValidator = (value: string) => {
  if (!hasValue(value)) return false;
  if (value === "" || value.endsWith("/")) {
    return false;
  }
  let ext = extensionFromFilename(value);
  if (ALLOWED_STEP_EXTENSIONS.indexOf(ext) === -1) {
    return false;
  }
  return true;
};

export const isValidFile = async (
  project_uuid: string,
  pipeline_uuid: string,
  path: string
) => {
  // only check file existence if it passes rule based validation
  if (!project_uuid || !pipeline_uuid || !pathValidator(path)) return false;
  const response = await fetcher(
    `${FILE_MANAGEMENT_ENDPOINT}/exists?${queryArgs({
      project_uuid,
      pipeline_uuid,
      path,
    })}`
  );
  return hasValue(response);
};

/**
 * checks if a file exists with the given path, poll per 1000 ms
 * @param project_uuid {string|undefined}
 * @param pipeline_uuid {string|undefined}
 * @param path {string|undefined}
 * @returns boolean
 */
export const useCheckFileValidity = (
  projectUuid: string | undefined,
  pipelineUuid: string | undefined,
  path: string | undefined
) => {
  const isQueryArgsComplete =
    hasValue(projectUuid) && hasValue(pipelineUuid) && hasValue(path);

  const cacheKey = isQueryArgsComplete
    ? `${FILE_MANAGEMENT_ENDPOINT}/exists?${queryArgs({
        projectUuid,
        pipelineUuid,
        path,
      })}`
    : null;

  const { data = false } = useSWR(
    cacheKey,
    () => isQueryArgsComplete && isValidFile(projectUuid, pipelineUuid, path),
    { refreshInterval: 1000 }
  );

  return data;
};
