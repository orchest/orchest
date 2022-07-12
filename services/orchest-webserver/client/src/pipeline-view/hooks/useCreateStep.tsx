import { absoluteToRelativePath } from "@orchest/lib-utils";
import React from "react";
import { createStepAction } from "../action-helpers/eventVarsHelpers";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";

const toRoot = (path?: string) => (path?.startsWith("/") ? path : "/" + path);

const unroot = (path?: string) =>
  path?.startsWith("/") ? path.substring(1) : path;

const relativeToPipeline = (pipelineCwd?: string, path?: string) =>
  path ? unroot(absoluteToRelativePath(path, toRoot(pipelineCwd))) : path;

/**
 * Creates a new step in the pipeline.
 *
 * @param filePath (Optional) the file path, relative to `project-dir:`, e.g. `/foo.py`.
 */
export type StepCreator = (filePath?: string) => void;

export const useCreateStep = (): StepCreator => {
  const {
    dispatch,
    environments,
    pipelineViewportRef,
    pipelineCwd,
  } = usePipelineEditorContext();
  const {
    pipelineCanvasState: { pipelineOffset },
  } = usePipelineCanvasContext();

  // Use the first environment as the default:
  // The user can change it later.
  const [environment] = environments;

  const createStep = React.useCallback(
    (filePath?: string) => {
      if (pipelineViewportRef.current) {
        // When new steps are successively created then we don't want
        // them to be spawned on top of each other.
        // NOTE: we use the same offset for X and Y position.
        const { clientWidth, clientHeight } = pipelineViewportRef.current;
        const [offsetX, offsetY] = pipelineOffset;

        const position = {
          x: -offsetX + clientWidth / 2 - STEP_WIDTH / 2,
          y: -offsetY + clientHeight / 2 - STEP_HEIGHT / 2,
        };

        const stepPath = relativeToPipeline(pipelineCwd, filePath);

        dispatch(createStepAction(environment, position, stepPath));
      } else {
        console.error("Failed to create step: pipeline viewport not set");
      }
    },
    [pipelineOffset, dispatch, pipelineViewportRef, environment, pipelineCwd]
  );

  return createStep;
};
