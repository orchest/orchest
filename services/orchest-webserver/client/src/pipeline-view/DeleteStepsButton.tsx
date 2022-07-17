import DeleteIcon from "@mui/icons-material/Delete";
import React from "react";
import { PipelineActionButton } from "./components/PipelineActionButton";
import { usePipelineUiStatesContext } from "./contexts/PipelineUiStatesContext";
import { useDeleteSteps } from "./hooks/useDeleteSteps";

export const DeleteStepsButton = () => {
  const {
    uiStates: { isDeletingSteps },
  } = usePipelineUiStatesContext();
  const { deleteSelectedSteps } = useDeleteSteps();
  return (
    <PipelineActionButton
      onClick={deleteSelectedSteps}
      startIcon={<DeleteIcon />}
      disabled={isDeletingSteps}
      data-test-id="step-delete-multi"
    >
      Delete
    </PipelineActionButton>
  );
};
