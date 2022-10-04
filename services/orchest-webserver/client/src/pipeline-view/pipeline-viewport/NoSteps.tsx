import { EmptyState } from "@/components/common/EmptyState";
import AddOutlined from "@mui/icons-material/AddOutlined";
import Button from "@mui/material/Button";
import React from "react";
import { useCreateStep } from "../hooks/useCreateStep";

export const NoSteps = () => {
  const createStep = useCreateStep();

  return (
    <EmptyState
      imgSrc="/image/no-steps.svg"
      title="No Pipeline Steps"
      description={`A Pipeline Step is an executable file running in its own isolated environment. Drag & drop files from the file manager to get started.`}
      docPath="/fundamentals/pipelines.html"
      actions={
        <Button
          onClick={() => createStep()}
          variant="contained"
          startIcon={<AddOutlined />}
        >
          New step
        </Button>
      }
    />
  );
};
