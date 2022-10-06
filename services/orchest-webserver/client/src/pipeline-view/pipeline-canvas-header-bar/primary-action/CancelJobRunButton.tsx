import { useAsync } from "@/hooks/useAsync";
import { useActivePipelineRun } from "@/pipeline-view/hooks/useActivePipelineRun";
import { isPipelineRunning } from "@/utils/pipeline";
import CancelOutlined from "@mui/icons-material/CancelOutlined";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

export const CancelJobRunButton = () => {
  const cancelRun = useActivePipelineRun((state) => state.cancel);
  const activeRun = useActivePipelineRun((state) => state.run);
  const fetchRun = useActivePipelineRun((state) => state.fetch);
  const isCancelable = isPipelineRunning(activeRun?.status);
  const { run, status } = useAsync();

  if (!activeRun && status === "IDLE") {
    run(fetchRun());
  }

  const title = isCancelable ? "Cancel the job run" : "The job is not running";

  return (
    <Tooltip title={title}>
      {/* This span is needed because disabled elements cannot have tooltips. */}
      <span>
        <Button
          disabled={!isCancelable}
          startIcon={<CancelOutlined />}
          onClick={cancelRun}
          variant="contained"
        >
          Cancel run
        </Button>
      </span>
    </Tooltip>
  );
};
