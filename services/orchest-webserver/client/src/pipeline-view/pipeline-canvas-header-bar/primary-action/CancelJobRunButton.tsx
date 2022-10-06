import { useActivePipelineRun } from "@/hooks/useActivePipelineRun";
import { useCancelJobRun } from "@/hooks/useCancelJobRun";
import { useFetchActivePipelineRun } from "@/hooks/useFetchActivePipelineRun";
import { isPipelineRunning } from "@/utils/pipeline";
import CancelOutlined from "@mui/icons-material/CancelOutlined";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

export const CancelJobRunButton = () => {
  const activeRun = useFetchActivePipelineRun();
  const cancelActiveRun = useActivePipelineRun((state) => state.cancel);
  const cancel = useCancelJobRun(cancelActiveRun);
  const isCancelable = isPipelineRunning(activeRun?.status);

  const title = isCancelable ? "Cancel the job run" : "The job is not running";

  return (
    <Tooltip title={title}>
      {/* This span is needed because disabled elements cannot have tooltips. */}
      <span>
        <Button
          disabled={!isCancelable}
          startIcon={<CancelOutlined />}
          onClick={cancel}
          variant="contained"
        >
          Cancel run
        </Button>
      </span>
    </Tooltip>
  );
};
