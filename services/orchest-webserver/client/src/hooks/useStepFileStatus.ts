import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { stepPathToProjectPath } from "@/utils/pipeline";
import { hasValue } from "@orchest/lib-utils";
import { FileStatus, useFileStatus } from "./useFileStatus";

export type StepFileStatus = "unknown" | "not-found" | "found";

export const useStepFileStatus = (stepUuid: string | undefined): FileStatus => {
  const { pipelineJson, pipelineCwd } = usePipelineDataContext();
  const stepFilePath = stepUuid && pipelineJson?.steps[stepUuid]?.file_path;

  const { root, path } =
    hasValue(stepFilePath) && hasValue(pipelineCwd)
      ? stepPathToProjectPath(stepFilePath, pipelineCwd)
      : { root: undefined, path: undefined };

  return useFileStatus(root, path);
};
