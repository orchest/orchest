import { CreateEntityButton } from "@/blocks/CreateEntityButton";
import React from "react";
import { usePipelineDataContext } from "../contexts/PipelineDataContext";
import { CreatePipelineDialog } from "../CreatePipelineDialog";

export const CreatePipelineButton = () => {
  const { isReadOnly } = usePipelineDataContext();
  return (
    <CreatePipelineDialog>
      {(onCreateClick) => (
        <CreateEntityButton disabled={isReadOnly} onClick={onCreateClick}>
          New pipeline
        </CreateEntityButton>
      )}
    </CreatePipelineDialog>
  );
};
