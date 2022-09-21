import { useProjectsContext } from "@/contexts/ProjectsContext";
import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import React from "react";
import { useCreateStep } from "./hooks/useCreateStep";

export const CreateStepButton = () => {
  const {
    state: { pipelineReadOnlyReason },
  } = useProjectsContext();

  const createStep = useCreateStep();

  return (
    <Button
      size="small"
      onClick={() => createStep()}
      startIcon={<AddIcon />}
      disabled={Boolean(pipelineReadOnlyReason)}
      data-test-id="step-create"
    >
      NEW STEP
    </Button>
  );
};
