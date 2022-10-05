import { useActiveJobRun } from "@/hooks/useActiveJobRun";
import {
  isPipelineRunning,
  usePollPipelineRunStatus,
} from "@/pipeline-view/hooks/usePollRunStatus";
import CancelOutlined from "@mui/icons-material/CancelOutlined";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

export const CancelJobRunButton = () => {
  const { cancelRun, run } = useActiveJobRun();
  const { runStatus } = usePollPipelineRunStatus(run?.job_uuid, run?.uuid);
  const isCancelable = isPipelineRunning(runStatus);
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
