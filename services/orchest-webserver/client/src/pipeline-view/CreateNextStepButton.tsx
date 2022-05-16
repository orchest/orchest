import { useAppContext } from "@/contexts/AppContext";
import AddIcon from "@mui/icons-material/Add";
import { uuidv4 } from "@orchest/lib-utils";
import React from "react";
import { usePipelineCanvasContext } from "./contexts/PipelineCanvasContext";
import { usePipelineEditorContext } from "./contexts/PipelineEditorContext";
import { PipelineActionButton } from "./PipelineActionButton";
import { STEP_HEIGHT, STEP_WIDTH } from "./PipelineStep";

export const CreateNextStepButton = ({
  pipelineViewportRef,
}: {
  pipelineViewportRef: React.MutableRefObject<HTMLDivElement | null>;
}) => {
  const { setAlert } = useAppContext();
  const { dispatch, environments } = usePipelineEditorContext();
  const { pipelineCanvasState } = usePipelineCanvasContext();

  const createNextStep = async () => {
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

      const position = [
        -pipelineOffsetX + clientWidth / 2 - STEP_WIDTH / 2,
        -pipelineOffsetY + clientHeight / 2 - STEP_HEIGHT / 2,
      ] as [number, number];

      dispatch({
        type: "CREATE_STEP",
        payload: {
          title: "",
          uuid: uuidv4(),
          incoming_connections: [],
          file_path: "",
          kernel: {
            name: environment?.language || "python",
            display_name: environment?.name || "Python",
          },
          environment: environment?.uuid || "",
          parameters: {},
          meta_data: {
            position,
            hidden: false,
          },
        },
      });
    } catch (error) {
      setAlert("Error", `Unable to create a new step. ${error}`);
    }
  };

  return (
    <PipelineActionButton
      onClick={createNextStep}
      startIcon={<AddIcon />}
      data-test-id="step-create"
    >
      NEW STEP
    </PipelineActionButton>
  );
};
