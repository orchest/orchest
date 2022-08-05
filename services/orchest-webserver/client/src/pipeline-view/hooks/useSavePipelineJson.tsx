import { useAppContext } from "@/contexts/AppContext";
import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useHasChanged } from "@/hooks/useHasChanged";
import type { PipelineJson, StepsDict } from "@/types";
import { resolve } from "@/utils/resolve";
import { validatePipeline } from "@/utils/webserver-utils";
import { fetcher, hasValue } from "@orchest/lib-utils";
import React from "react";
import { updatePipelineJson } from "../common";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { useSavingIndicator } from "./useSavingIndicator";

export const useSavePipelineJson = () => {
  const { setAlert } = useAppContext();
  const { projectUuid } = useCustomRoute();
  const { isReadOnly, pipelineUuid } = usePipelineDataContext();
  const {
    pipelineJson,
    setPipelineJson,
    eventVars,
  } = usePipelineEditorContext();

  const shouldSave = useHasChanged(eventVars.timestamp);
  const setOngoingSaves = useSavingIndicator();
  const savePipelineJson = React.useCallback(
    async (data: PipelineJson) => {
      if (!data || isReadOnly) return;
      setOngoingSaves((current) => current + 1);

      let formData = new FormData();
      formData.append("pipeline_json", JSON.stringify(data));
      const response = await resolve(() =>
        fetcher(`/async/pipelines/json/${projectUuid}/${pipelineUuid}`, {
          method: "POST",
          body: formData,
        })
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
    (steps?: StepsDict) => {
      if (!pipelineJson) return;
      if (isReadOnly) {
        console.error("savePipeline should be un-callable in readOnly mode.");
        return;
      }

      const updatedPipelineJson = steps
        ? updatePipelineJson(pipelineJson, steps)
        : pipelineJson;

      // validate pipelineJSON
      let pipelineValidation = validatePipeline(updatedPipelineJson);

      if (!pipelineValidation.valid) {
        // Just show the first error
        setAlert("Error", pipelineValidation.errors[0]);
        return;
      }

      setPipelineJson(updatedPipelineJson);

      return updatedPipelineJson;
    },
    [isReadOnly, setAlert, pipelineJson, setPipelineJson]
  );

  const saveSteps = React.useCallback(
    (steps: StepsDict) => {
      const newPipelineJson = mergeStepsIntoPipelineJson(steps);
      if (newPipelineJson) savePipelineJson(newPipelineJson);
    },
    [mergeStepsIntoPipelineJson, savePipelineJson]
  );

  // if timestamp is changed, auto-save
  // check useEventVars to see if the action return value is wrapped by withTimestamp
  React.useEffect(() => {
    if (hasValue(eventVars.timestamp) && shouldSave) {
      saveSteps(eventVars.steps);
    }
  }, [saveSteps, eventVars.timestamp, eventVars.steps, shouldSave]);
};
