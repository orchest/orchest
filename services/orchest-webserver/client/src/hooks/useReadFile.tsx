import { FILE_MANAGEMENT_ENDPOINT } from "@/pipeline-view/file-manager/common";
import { isValidFilePath } from "@/utils/path";
import { queryArgs } from "@/utils/text";
import { hasValue } from "@orchest/lib-utils";
import { useFetcher } from "./useFetcher";

type ReadFileProps = {
  projectUuid: string | undefined;
  pipelineUuid: string | undefined;
  jobUuid?: string;
  runUuid?: string;
  path: string | undefined;
  allowedExtensions: readonly string[];
};

/**
 * Read a file in the context of a pipeline.
 */
export function useReadFile<T>({
  projectUuid,
  pipelineUuid,
  jobUuid,
  runUuid,
  path,
  allowedExtensions,
}: ReadFileProps) {
  const isValidProps =
    hasValue(projectUuid) && hasValue(pipelineUuid) && hasValue(path);

  const isValidFilePathPattern =
    isValidProps && isValidFilePath(path, allowedExtensions);

  const { data, status } = useFetcher<T>(
    isValidFilePathPattern
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
}
