import {
  FILE_MANAGEMENT_ENDPOINT,
  queryArgs,
} from "@/pipeline-view/file-manager/common";
import { hasExtension, isDirectory } from "@/utils/path";
import { fetcher, hasValue } from "@orchest/lib-utils";
import { useDebounce } from "./useDebounce";
import { useFetcher } from "./useFetcher";

type ValidateFileProps = {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  jobUuid?: string;
  runUuid?: string;
  path: string;
  allowedExtensions: readonly string[];
  useProjectRoot?: boolean;
};

export const isValidPath = (
  path: string,
  allowedExtensions: readonly string[]
) =>
  Boolean(path) &&
  !isDirectory(path) &&
  hasExtension(path, ...allowedExtensions);

export const isValidFile = async ({
  path,
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
  allowedExtensions,
  useProjectRoot = false,
}: ValidateFileProps) => {
  const validByConvention =
    projectUuid && pipelineUuid && isValidPath(path, allowedExtensions);

  if (validByConvention) {
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
  } else {
    return false;
  }
};

/**
 * checks if a file exists with the given path, poll per 1000 ms
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
  const isValidProps =
    hasValue(projectUuid) && hasValue(pipelineUuid) && hasValue(path);

  const isValidPathPattern =
    isValidProps && isValidPath(path, allowedExtensions);

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
