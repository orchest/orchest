import { useProjectsContext } from "@/contexts/ProjectsContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHasChanged } from "@/hooks/useHasChanged";
import { pickJobChanges } from "@/jobs-view/common";
import { useCreateJob } from "@/jobs-view/hooks/useCreateJob";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { useInteractiveRunsContext } from "@/pipeline-view/contexts/InteractiveRunsContext";
import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "@/pipeline-view/contexts/PipelineUiStateContext";
import { RunStepsType } from "@/pipeline-view/hooks/useInteractiveRuns";
import React from "react";

export const usePipelineActions = () => {
  const { jobUuid } = useCustomRoute();
  const initJobChanges = useEditJob((state) => state.initJobChanges);
  const startEditing = useEditJob((state) => state.startEditing);
  const { runUuid, isReadOnly } = usePipelineDataContext();
  const {
    uiState: { selectedSteps, steps },
    uiStateDispatch,
  } = usePipelineUiStateContext();

  const {
    state: { pipeline },
  } = useProjectsContext();

  const {
    displayedPipelineStatus,
    runSteps,
    cancelRun,
  } = useInteractiveRunsContext();

  const doCancelRun = React.useCallback(() => {
    return cancelRun({ jobUuid, runUuid });
  }, [jobUuid, runUuid, cancelRun]);

  const doRunSteps = React.useCallback(
    (stepsToRun: string[], type: RunStepsType) => {
      if (displayedPipelineStatus === "IDLING") runSteps(stepsToRun, type);
    },
    [displayedPipelineStatus, runSteps]
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

  const { createJob, isAllowedToCreateJob } = useCreateJob(pipeline);

  const createDraftJob = React.useCallback(async () => {
    if (!isAllowedToCreateJob) return;
    const jobData = await createJob();
    const jobChanges = pickJobChanges(jobData);
    if (jobChanges) {
      initJobChanges(jobChanges);
      startEditing();
    }
    if (jobChanges)
      uiStateDispatch({ type: "SET_DRAFT_JOB", payload: jobChanges.uuid });
  }, [
    createJob,
    uiStateDispatch,
    isAllowedToCreateJob,
    initJobChanges,
    startEditing,
  ]);

  // No operation is allowed when read-only.
  if (isReadOnly) return {};

  const hasSelectedSteps = selectedSteps.length > 0;
  const hasSteps = allSteps.length > 0;

  return {
    displayedPipelineStatus,
    shouldRunAll,
    runIncomingSteps: hasSelectedSteps ? runIncomingSteps : undefined,
    runSelectedSteps: hasSelectedSteps ? runSelectedSteps : undefined,
    runAllSteps: hasSteps ? runAllSteps : undefined,
    cancelRun: doCancelRun,
    createDraftJob,
  };
};
