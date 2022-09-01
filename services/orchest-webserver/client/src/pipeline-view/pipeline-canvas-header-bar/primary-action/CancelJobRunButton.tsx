import { useCurrentJobRun } from "@/hooks/useCurrentJobRun";
import CancelOutlined from "@mui/icons-material/CancelOutlined";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

export const CancelJobRunButton = () => {
  const { cancelRun, isCancellable } = useCurrentJobRun();
  const title = isCancellable ? "Cancel the job run" : "The job is not running";

  return (
    <Tooltip title={title}>
      {/* This span is needed because disabled elements cannot have tooltips. */}
      <span>
        <Button
          disabled={!isCancellable}
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
