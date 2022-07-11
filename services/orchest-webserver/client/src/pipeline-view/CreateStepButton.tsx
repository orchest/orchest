import { useAppContext } from "@/contexts/AppContext";
import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import React from "react";
import { createStepAction } from "./action-helpers/eventVarsHelpers";
import { usePipelineCanvasContext } from "./contexts/PipelineCanvasContext";
import { usePipelineEditorContext } from "./contexts/PipelineEditorContext";
import { STEP_HEIGHT, STEP_WIDTH } from "./PipelineStep";

export const CreateStepButton = ({
  pipelineViewportRef,
}: {
  pipelineViewportRef: React.MutableRefObject<HTMLDivElement | null>;
}) => {
  const { setAlert } = useAppContext();
  const { dispatch, environments } = usePipelineEditorContext();
  const { pipelineCanvasState } = usePipelineCanvasContext();

  const createStep = async () => {
    if (!pipelineViewportRef.current) {
      console.error(
        "Unable to create next step. pipelineCanvas is not yet instantiated!"
      );
      return;
    }
    try {
      // Assume the first environment as the default
      // user can change it afterwards
      const environment = environments.length > 0 ? environments[0] : null;
      // When new steps are successively created then we don't want
      // them to be spawned on top of each other. NOTE: we use the
      // same offset for X and Y position.
      const {
        clientWidth,
        clientHeight,
      } = (pipelineViewportRef.current as unknown) as HTMLDivElement;
      const [
        pipelineOffsetX,
        pipelineOffsetY,
      ] = pipelineCanvasState.pipelineOffset;

      const position = {
        x: -pipelineOffsetX + clientWidth / 2 - STEP_WIDTH / 2,
        y: -pipelineOffsetY + clientHeight / 2 - STEP_HEIGHT / 2,
      };

      dispatch(createStepAction(environment, position));
    } catch (error) {
      setAlert("Error", `Unable to create a new step. ${error}`);
    }
  };

  return (
    <Button
      size="small"
      onClick={createStep}
      startIcon={<AddIcon />}
      data-test-id="step-create"
    >
      NEW STEP
    </Button>
  );
};
