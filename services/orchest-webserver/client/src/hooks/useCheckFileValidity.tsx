import {
  FILE_MANAGEMENT_ENDPOINT,
  queryArgs,
} from "@/pipeline-view/file-manager/common";
import { extensionFromFilename, fetcher, hasValue } from "@orchest/lib-utils";
import { useDebounce } from "./useDebounce";
import { useFetcher } from "./useFetcher";

export const pathValidator = (value: string, allowedExtension: string[]) => {
  if (!hasValue(value)) return false;
  if (value === "" || value.endsWith("/")) {
    return false;
  }
  const ext = extensionFromFilename(value);

  return allowedExtension.includes(ext);
};

export const isValidFile = async (
  project_uuid: string,
  pipeline_uuid: string,
  path: string,
  allowedExtensions: string[]
) => {
  // only check file existence if it passes rule-based validation
  if (
    !project_uuid ||
    !pipeline_uuid ||
    !pathValidator(path, allowedExtensions)
  )
    return false;
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
  path: string | undefined,
  allowedExtensions: string[]
) => {
  const isQueryArgsComplete =
    hasValue(projectUuid) && hasValue(pipelineUuid) && hasValue(path);

  const isValidPathPattern =
    isQueryArgsComplete && pathValidator(path, allowedExtensions);

  const delayedPath = useDebounce(path, 250);

  const { data = false, status } = useFetcher<{ message: string }, boolean>(
    isValidPathPattern
      ? `${FILE_MANAGEMENT_ENDPOINT}/exists?${queryArgs({
          projectUuid,
          pipelineUuid,
          path: delayedPath || path,
        })}`
      : undefined,
    { transform: () => true }
  );

  return [isValidPathPattern && data, status === "PENDING"] as const;
};
