import AddIcon from "@mui/icons-material/Add";
import React from "react";
import { useCreateStep } from "./hooks/useCreateStep";
import { PipelineActionButton } from "./PipelineActionButton";

export const CreateStepButton = () => {
  const createStep = useCreateStep();

  return (
    <PipelineActionButton
      onClick={() => createStep()}
      startIcon={<AddIcon />}
      data-test-id="step-create"
    >
      NEW STEP
    </PipelineActionButton>
  );
};
