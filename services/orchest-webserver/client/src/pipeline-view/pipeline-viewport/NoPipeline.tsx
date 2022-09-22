import { EmptyState } from "@/components/common/EmptyState";
import AddOutlined from "@mui/icons-material/AddOutlined";
import Button from "@mui/material/Button";
import React from "react";
import { CreatePipelineDialog } from "../CreatePipelineDialog";

export const NoPipeline = () => {
  return (
    <EmptyState
      imgSrc="/image/no-pipeline.svg"
      title="No Pipelines in Project"
      description="Pipelines are an interactive tool for creating and experimenting with
    your data workflow. They are made up of Steps and connections."
      docPath="/fundamentals/pipelines.html"
      actions={
        <CreatePipelineDialog>
          {(createPipeline) => (
            <Button
              startIcon={<AddOutlined />}
              variant="contained"
              onClick={createPipeline}
            >
              New pipeline
            </Button>
          )}
        </CreatePipelineDialog>
      }
    />
  );
};
