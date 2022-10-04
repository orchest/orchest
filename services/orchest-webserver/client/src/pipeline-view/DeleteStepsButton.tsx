import DeleteIcon from "@mui/icons-material/Delete";
import React from "react";
import { PipelineActionButton } from "./components/PipelineActionButton";
import { usePipelineUiStateContext } from "./contexts/PipelineUiStateContext";
import { useDeleteSteps } from "./hooks/useDeleteSteps";

export const DeleteStepsButton = () => {
  const {
    uiState: { isDeletingSteps },
  } = usePipelineUiStateContext();
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
