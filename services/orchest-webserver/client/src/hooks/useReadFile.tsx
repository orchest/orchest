import {
  FILE_MANAGEMENT_ENDPOINT,
  queryArgs,
} from "@/pipeline-view/file-manager/common";
import { Json } from "@/types";
import { isValidPath } from "@/utils/path";
import { hasValue } from "@orchest/lib-utils";
import { useFetcher } from "./useFetcher";

type ReadFileProps = {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  jobUuid?: string;
  runUuid?: string;
  path: string;
  allowedExtensions: readonly string[];
};

/**
 * Read a file in the context of a pipeline.
 */
export const useReadFile = <T extends Json>({
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
  path,
  allowedExtensions,
}: ReadFileProps) => {
  const isValidProps =
    hasValue(projectUuid) && hasValue(pipelineUuid) && hasValue(path);

  const isValidPathPattern =
    isValidProps && isValidPath(path, allowedExtensions);

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
