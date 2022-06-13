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

type ValidateFileProps = {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  jobUuid?: string;
  runUuid?: string;
  path: string;
  allowedExtensions: string[];
  useProjectRoot?: boolean;
};

export const isValidFile = async ({
  path,
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
  allowedExtensions,
  useProjectRoot = false,
}: ValidateFileProps) => {
  // only check file existence if it passes rule-based validation
  if (!projectUuid || !pipelineUuid || !pathValidator(path, allowedExtensions))
    return false;

  const response = await fetcher(
    `${FILE_MANAGEMENT_ENDPOINT}/exists?${queryArgs({
      projectUuid,
      pipelineUuid,
      jobUuid,
      runUuid,
      path,
      useProjectRoot,
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
export const useCheckFileValidity = ({
  path,
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
  allowedExtensions,
  useProjectRoot = false,
}: ValidateFileProps) => {
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
          jobUuid,
          runUuid,
          path: delayedPath || path,
          useProjectRoot,
        })}`
      : undefined,
    { transform: () => true }
  );

  return [isValidPathPattern && data, status === "PENDING"] as const;
};
