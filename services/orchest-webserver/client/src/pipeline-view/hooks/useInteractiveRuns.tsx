import { useAppContext } from "@/contexts/AppContext";
import { PipelineRun } from "@/types";
import { fetcher, HEADER } from "@orchest/lib-utils";
import React from "react";
import {
  PIPELINE_JOBS_STATUS_ENDPOINT,
  PIPELINE_RUN_STATUS_ENDPOINT,
} from "../common";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import {
  convertStepsToObject,
  useStepExecutionState,
} from "./useStepExecutionState";

export type RunStepsType = "selection" | "incoming";

export const useInteractiveRuns = () => {
  const { setAlert } = useAppContext();
  const {
    pipelineJson,
    projectUuid,
    jobUuid,
    runUuid,
    setRunUuid,
  } = usePipelineEditorContext();

  const [pipelineRunning, setPipelineRunning] = React.useState(false);
  const [isCancellingRun, setIsCancellingRun] = React.useState(false);

  const runStatusEndpoint = jobUuid
    ? `${PIPELINE_JOBS_STATUS_ENDPOINT}/${jobUuid}`
    : PIPELINE_RUN_STATUS_ENDPOINT;

  const { stepExecutionState, setStepExecutionState } = useStepExecutionState(
    runUuid ? `${runStatusEndpoint}/${runUuid}` : null,
    (runStatus) => {
      if (["PENDING", "STARTED"].includes(runStatus)) {
        setPipelineRunning(true);
      }

      if (["SUCCESS", "ABORTED", "FAILURE"].includes(runStatus)) {
        // make sure stale opened files are reloaded in active
        // Jupyter instance

        if (window.orchest.jupyter)
          window.orchest.jupyter?.reloadFilesFromDisk();

        setPipelineRunning(false);
        setIsCancellingRun(false);
      }
    }
  );

  const executePipelineSteps = React.useCallback(
    async (uuids: string[], type: RunStepsType) => {
      try {
        const result = await fetcher<PipelineRun>(
          `${PIPELINE_RUN_STATUS_ENDPOINT}/`, // NOTE: trailing back slash is required
          {
            method: "POST",
            headers: HEADER.JSON,
            body: JSON.stringify({
              uuids: uuids,
              project_uuid: projectUuid,
              run_type: type,
              pipeline_definition: pipelineJson,
            }),
          }
        );

        setStepExecutionState((current) => ({
          ...current,
          ...convertStepsToObject(result),
        }));
        setRunUuid(result.uuid);
        return true;
      } catch (error) {
        setAlert(
          "Error",
          `Failed to start interactive run. ${error.message || "Unknown error"}`
        );
        return false;
      }
    },
    [projectUuid, setStepExecutionState, setAlert, pipelineJson, setRunUuid]
  );

  const executeRun = React.useCallback(
    async (uuids: string[], type: RunStepsType) => {
      if (pipelineRunning) {
        setAlert(
          "Error",
          "The pipeline is currently executing, please wait until it completes."
        );
        return;
      }
      setPipelineRunning(true);
      const executionStarted = await executePipelineSteps(uuids, type);
      if (!executionStarted) setPipelineRunning(false);
    },
    [executePipelineSteps, setPipelineRunning, pipelineRunning, setAlert]
  );

  return {
    stepExecutionState,
    setStepExecutionState,
    pipelineRunning,
    setPipelineRunning,
    isCancellingRun,
    setIsCancellingRun,
    executeRun,
  };
};
