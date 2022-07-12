import React from "react";
import { createStepAction } from "../action-helpers/eventVarsHelpers";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";

/**
 * Removes leading slashes from file paths as the step API does not support them.
 */
const stepPath = (path?: string) =>
  path?.startsWith("/") ? path.substring(1) : path;

export const useCreateStep = () => {
  const {
    dispatch,
    environments,
    pipelineViewportRef,
  } = usePipelineEditorContext();
  const {
    pipelineCanvasState: { pipelineOffset },
  } = usePipelineCanvasContext();

  // Use the first environment as the default:
  // The user can change it later.
  const [environment] = environments;

  const createStep = React.useMemo(
    () => (filePath?: string) => {
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

        dispatch(createStepAction(environment, position, stepPath(filePath)));
      } else {
        console.error("Failed to create step: pipeline viewport not set");
      }
    },
    [pipelineOffset, dispatch, pipelineViewportRef, environment]
  );

  return createStep;
};
