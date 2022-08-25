import { pipelineJsonApi } from "@/api/pipelines/pipelineJsonApi";
import { useGlobalContext } from "@/contexts/GlobalContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import type { PipelineJson, StepData, StepsDict } from "@/types";
import { resolve } from "@/utils/resolve";
import {
  clearOutgoingConnections,
  validatePipeline,
} from "@/utils/webserver-utils";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { updatePipelineJson } from "../common";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { useSavingIndicator } from "./useSavingIndicator";

export const useSavePipelineJson = () => {
  const { setAlert } = useGlobalContext();
  const { projectUuid } = useCustomRoute();
  const { isReadOnly, pipelineUuid, pipelineJson } = usePipelineDataContext();
  const {
    uiState: { hash, steps },
  } = usePipelineUiStateContext();

  const setOngoingSaves = useSavingIndicator();
  const savePipelineJson = React.useCallback(
    async (data: PipelineJson) => {
      if (!data || isReadOnly || !projectUuid || !pipelineUuid) return;
      setOngoingSaves((current) => current + 1);
      const dataForSaving: PipelineJson = {
        ...data,
        steps: clearOutgoingConnections<StepData>(data.steps),
      };

      const response = await resolve(() =>
        pipelineJsonApi.put(projectUuid, pipelineUuid, dataForSaving)
      );

      if (response.status === "rejected") {
        // currently step details doesn't do form field validation properly
        // don't apply setAlert here before the form validation is implemented
        console.error(`Failed to save pipeline. ${response.error.message}`);
      }

      setOngoingSaves((current) => current - 1);
    },
    [isReadOnly, projectUuid, pipelineUuid, setOngoingSaves]
  );

  const mergeStepsIntoPipelineJson = React.useCallback(
    (steps: StepsDict) => {
      if (!pipelineJson) return;
      if (isReadOnly) {
        console.error("savePipeline should be un-callable in readOnly mode.");
        return;
      }

      const updatedPipelineJson = updatePipelineJson(pipelineJson, steps);

      const pipelineValidation = validatePipeline(updatedPipelineJson);

      if (!pipelineValidation.valid) {
        // Show the fist error until valid.
        setAlert("Error", pipelineValidation.errors[0]);
        return;
      }

      return updatedPipelineJson;
    },

    [isReadOnly, setAlert, pipelineJson]
  );

  const saveSteps = React.useCallback(
    (steps: StepsDict) => {
      const newPipelineJson = mergeStepsIntoPipelineJson(steps);
      if (newPipelineJson) savePipelineJson(newPipelineJson);
    },
    [mergeStepsIntoPipelineJson, savePipelineJson]
  );

  // check usePipelineUiState to see if the action return value is wrapped by withTimestamp
  React.useEffect(() => {
    if (hasValue(hash)) {
      saveSteps(steps);
    }
  }, [saveSteps, hash, steps]);
};
