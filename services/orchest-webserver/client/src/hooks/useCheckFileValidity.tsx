import { FILE_MANAGEMENT_ENDPOINT } from "@/pipeline-view/file-manager/common";
import { isValidFilePath } from "@/utils/path";
import { queryArgs } from "@/utils/text";
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
    projectUuid && pipelineUuid && isValidFilePath(path, allowedExtensions);

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
 * Checks if a file exists with the given path.
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

  const isValidFilePathPattern =
    isValidProps && isValidFilePath(path, allowedExtensions);

  const delayedPath = useDebounce(path, 250);

  const { data = false, status } = useFetcher<{ message: string }, boolean>(
    isValidFilePathPattern
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

  return [isValidFilePathPattern && data, status === "PENDING"] as const;
};
