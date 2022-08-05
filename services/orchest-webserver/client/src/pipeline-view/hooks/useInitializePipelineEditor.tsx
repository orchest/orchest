import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useEnsureValidPipeline } from "@/hooks/useEnsureValidPipeline";
import { PipelineJson, StepsDict } from "@/types";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { extractStepsFromPipelineJson } from "../common";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";

export const useInitializePipelineEditor = (
  initializeEventVars: (steps: StepsDict) => void
) => {
  const { pipelineUuid } = useCustomRoute();

  useEnsureValidPipeline();

  const {
    pipelineJson,
    setPipelineJson: originalSetPipelineJson,
    isFetchingPipelineJson,
  } = usePipelineDataContext();

  const hash = React.useRef<string>(uuidv4());
  const setPipelineJson = React.useCallback(
    (
      data?:
        | PipelineJson
        | ((currentValue: PipelineJson | undefined) => PipelineJson | undefined)
        | undefined,
      flushPage?: boolean
    ) => {
      // in case you want to re-initialize all components according to the new PipelineJson
      // to be part of the re-initialization, you need to assign hash.current as part of the key of your component
      if (flushPage) hash.current = uuidv4();
      originalSetPipelineJson(data);
    },
    [originalSetPipelineJson]
  );

  const initialized = React.useRef(false);

  // Only start to initialize if the uuid in pipelineJson is correct.
  // Because pipelineJson will be cached by SWR, initialization should only starts when uuid matches.
  const shouldInitialize =
    !isFetchingPipelineJson &&
    pipelineUuid &&
    pipelineUuid === pipelineJson?.uuid;

  // initialize eventVars.steps
  React.useEffect(() => {
    if (shouldInitialize && !initialized.current) {
      initialized.current = true;
      let newSteps = extractStepsFromPipelineJson(pipelineJson);
      initializeEventVars(newSteps);
    }
  }, [shouldInitialize, pipelineJson, initializeEventVars]);

  return {
    pipelineJson,
    setPipelineJson,
    hash,
    isFetching: isFetchingPipelineJson,
  };
};
