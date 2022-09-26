import { useEnvironmentsApi } from "@/api/environments/useEnvironmentsApi";
import { Point2D } from "@/utils/geometry";
import { relative } from "@/utils/path";
import React from "react";
import { createStepAction } from "../action-helpers/eventVarsHelpers";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { usePipelineRefs } from "../contexts/PipelineRefsContext";
import { usePipelineUiStateContext } from "../contexts/PipelineUiStateContext";
import { CANVAS_PADDING } from "../pipeline-viewport/common";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";
import { useSetShouldAutoFocusStepName } from "../step-details/store/useAutoFocusStepName";

const toRoot = (path?: string) => (path?.startsWith("/") ? path : "/" + path);

const unroot = (path?: string) =>
  path?.startsWith("/") ? path.substring(1) : path;

const relativeToPipeline = (pipelinePath?: string, path?: string) =>
  path ? unroot(relative(toRoot(pipelinePath), path)) : path;

/**
 * Creates a new step in the pipeline.
 * @param filePath (Optional) the file path, relative to `project-dir:`, e.g. `/foo.py`.
 */
export type StepCreator = (filePath?: string) => void;

export const useCreateStep = (): StepCreator => {
  const environments = useEnvironmentsApi((state) => state.environments || []);
  const { pipelineCwd } = usePipelineDataContext();
  const { uiStateDispatch } = usePipelineUiStateContext();
  const { pipelineViewportRef } = usePipelineRefs();
  const {
    pipelineCanvasState: { pipelineOffset },
  } = usePipelineCanvasContext();

  // Use the first environment as the default:
  // The user can change it later.
  const [environment] = environments;

  const { setShouldAutoFocusStepName } = useSetShouldAutoFocusStepName();

  const createStep = React.useCallback(
    (filePath?: string) => {
      if (pipelineViewportRef.current) {
        // When new steps are successively created then we don't want
        // them to be spawned on top of each other.
        // NOTE: we use the same offset for X and Y position.
        const { clientWidth, clientHeight } = pipelineViewportRef.current;
        const [offsetX, offsetY] = pipelineOffset;

        const position: Point2D = [
          -offsetX + clientWidth / 2 - STEP_WIDTH / 2 - CANVAS_PADDING,
          -offsetY + clientHeight / 2 - STEP_HEIGHT / 2 - CANVAS_PADDING,
        ];

        const stepPath = relativeToPipeline(pipelineCwd, filePath);

        uiStateDispatch(createStepAction(environment, position, stepPath));
        setShouldAutoFocusStepName(true);
      } else {
        console.error("Failed to create step: pipeline viewport not set");
      }
    },
    [
      pipelineOffset,
      uiStateDispatch,
      pipelineViewportRef,
      environment,
      pipelineCwd,
      setShouldAutoFocusStepName,
    ]
  );

  return createStep;
};
