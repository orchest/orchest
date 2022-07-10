import { createStepAction } from "../action-helpers/eventVarsHelpers";
import { usePipelineCanvasContext } from "../contexts/PipelineCanvasContext";
import { usePipelineEditorContext } from "../contexts/PipelineEditorContext";
import { STEP_HEIGHT, STEP_WIDTH } from "../PipelineStep";

export const useCreateStep = () => {
  const {
    dispatch,
    environments,
    pipelineViewportRef,
  } = usePipelineEditorContext();
  const { pipelineCanvasState } = usePipelineCanvasContext();

  return (fileName?: string) => {
    if (!pipelineViewportRef.current) {
      console.error("Failed to create step: pipeline viewport not set");
      return;
    }

    // Use the first environment as the default:
    // The user it can be changed later.
    const [environment] = environments;

    // When new steps are successively created then we don't want
    // them to be spawned on top of each other.
    // NOTE: we use the same offset for X and Y position.
    const { clientWidth, clientHeight } = pipelineViewportRef.current;
    const [offsetX, offsetY] = pipelineCanvasState.pipelineOffset;

    const position = {
      x: -offsetX + clientWidth / 2 - STEP_WIDTH / 2,
      y: -offsetY + clientHeight / 2 - STEP_HEIGHT / 2,
    };

    dispatch(createStepAction(environment, position, fileName));
  };
};
