import { usePipelineRunsApi } from "@/api/pipeline-runs/usePipelineRunsApi";
import { PipelineRun } from "@/types";
import { isJobRun } from "@/utils/pipeline-run";
import { useCancelJobRun } from "./useCancelJobRun";

/**
 * Returns a function that cancels the provided run.
 * Supports both job and interactive runs.
 */
export const useCancelPipelineRun = (run: PipelineRun | undefined) => {
  const cancelJobRun = useCancelJobRun();
  const cancelInteractiveRun = usePipelineRunsApi((api) => api.cancel);

  if (!run) return () => void 0;

  return isJobRun(run)
    ? () => cancelJobRun(run.job_uuid, run.uuid)
    : () => cancelInteractiveRun(run.uuid);
};
