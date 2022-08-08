import {
  FILE_MANAGEMENT_ENDPOINT,
  queryArgs,
} from "@/pipeline-view/file-manager/common";
import { Json } from "@/types";
import { isValidPath } from "@/utils/path";
import { hasValue } from "@orchest/lib-utils";
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

/**
 * Read a JSON file in a pipeline.
 */
export const useReadFile = <T extends Json>({
  path,
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
}: ValidateFileProps) => {
  const isValidProps =
    hasValue(projectUuid) && hasValue(pipelineUuid) && hasValue(path);

  const isValidPathPattern = isValidProps && isValidPath(path, ["json"]);

  const { data, status } = useFetcher<T>(
    isValidPathPattern
      ? `${FILE_MANAGEMENT_ENDPOINT}/read?${queryArgs({
          projectUuid,
          pipelineUuid,
          jobUuid,
          runUuid,
          path,
        })}`
      : undefined
  );

  return [data, status === "PENDING"] as const;
};
