import { PipelineRunsTable } from "@/components/pipeline-runs/PipelineRunsTable";
import { usePollPipelineRuns } from "@/hooks/usePollPipelineRuns";
import React from "react";

const POLL_TIMEOUT = 5000;

export const AllRunsTab = () => {
  const { runs: interactiveRuns } = usePollPipelineRuns(POLL_TIMEOUT);

  return (
    <PipelineRunsTable
      runs={interactiveRuns.filter((run) => run.status === "STARTED")}
    />
  );
};
