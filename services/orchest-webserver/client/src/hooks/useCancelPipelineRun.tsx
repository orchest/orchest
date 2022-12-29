import { usePipelineRunsApi } from "@/api/pipeline-runs/usePipelineRunsApi";
import { PipelineRun } from "@/types";
import { isJobRun } from "@/utils/pipeline-run";
import { useCancelJobRun } from "./useCancelJobRun";

export const useCancelPipelineRun = (run: PipelineRun | undefined) => {
  const cancelJobRun = useCancelJobRun();
  const cancelInteractiveRun = usePipelineRunsApi((api) => api.cancel);

  if (!run) return () => void 0;

  return isJobRun(run)
    ? () => cancelJobRun(run.uuid)
    : () => cancelInteractiveRun(run.uuid);
};
