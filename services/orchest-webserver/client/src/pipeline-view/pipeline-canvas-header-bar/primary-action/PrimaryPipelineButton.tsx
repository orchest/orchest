import { usePipelineDataContext } from "@/pipeline-view/contexts/PipelineDataContext";
import React from "react";
import { CancelJobRunButton } from "./CancelJobRunButton";
import { RunPipelineButton } from "./RunPipelineButton";

export const PrimaryPipelineButton = () => {
  const { isJobRun } = usePipelineDataContext();

  if (isJobRun) {
    return <CancelJobRunButton />;
  } else {
    return <RunPipelineButton />;
  }
};
