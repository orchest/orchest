import { RunStepsType } from "@/api/pipeline-runs/pipelineRunsApi";
import { useActivePipeline } from "@/hooks/useActivePipeline";
import { useHasChanged } from "@/hooks/useHasChanged";
import { pickJobChanges } from "@/jobs-view/common";
import { useCreateJob } from "@/jobs-view/hooks/useCreateJob";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "@/pipeline-view/contexts/PipelineUiStateContext";
import { useInteractiveRuns } from "@/pipeline-view/hooks/useInteractiveRuns";
import React from "react";

export const usePipelineActions = () => {
  const initJobChanges = useEditJob((state) => state.initJobChanges);
  const startEditing = useEditJob((state) => state.startEditing);
  const { isReadOnly } = usePipelineDataContext();
  const {
    uiState: { selectedSteps, steps },
    uiStateDispatch,
  } = usePipelineUiStateContext();
  const pipeline = useActivePipeline();

  const {
    displayStatus,
    runSteps,
    cancelActiveRun: cancelRun,
  } = useInteractiveRuns();

  const doRunSteps = React.useCallback(
    (stepsToRun: string[], type: RunStepsType) => {
      if (displayStatus === "IDLING") runSteps(stepsToRun, type);
    },
    [displayStatus, runSteps]
  );

  const allSteps = Object.keys(steps);
  const shouldRunAll =
    selectedSteps.length === 0 || selectedSteps.length === allSteps.length;

  // Only re-create runAllSteps if the UUID of all steps are changed.
  // Strict equality is not needed. In practice, user is not able to delete one step and create a new step
  // in one operation. Comparing the length of the keys is enough.
  const hasAllStepsChanged = useHasChanged(
    allSteps,
    (prev, curr) => prev?.length !== curr.length
  );

  const runAllSteps = React.useCallback(() => {
    doRunSteps(allSteps, "selection");
  }, [hasAllStepsChanged, doRunSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  const runSelectedSteps = React.useCallback(() => {
    doRunSteps(selectedSteps, "selection");
  }, [doRunSteps, selectedSteps]);

  const runIncomingSteps = React.useCallback(() => {
    doRunSteps(selectedSteps, "incoming");
  }, [doRunSteps, selectedSteps]);

  const { createJob, canCreateJob } = useCreateJob(pipeline);

  const createDraftJob = React.useCallback(async () => {
    if (!canCreateJob) return;
    const jobData = await createJob();
    const jobChanges = pickJobChanges(jobData);
    if (jobChanges) {
      initJobChanges(jobChanges);
      startEditing();
    }
    if (jobChanges)
      uiStateDispatch({ type: "SET_DRAFT_JOB", payload: jobChanges.uuid });
  }, [canCreateJob, createJob, uiStateDispatch, initJobChanges, startEditing]);

  // No operation is allowed when read-only.
  if (isReadOnly) return {};

  const hasSelectedSteps = selectedSteps.length > 0;
  const hasSteps = allSteps.length > 0;

  return {
    displayStatus,
    shouldRunAll,
    runIncomingSteps: hasSelectedSteps ? runIncomingSteps : undefined,
    runSelectedSteps: hasSelectedSteps ? runSelectedSteps : undefined,
    runAllSteps: hasSteps ? runAllSteps : undefined,
    cancelRun,
    createDraftJob,
  };
};
