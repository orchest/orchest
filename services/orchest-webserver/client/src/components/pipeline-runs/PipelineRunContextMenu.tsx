import { useCancelPipelineRun } from "@/hooks/useCancelPipelineRun";
import { useNavigate } from "@/hooks/useCustomRoute";
import { useToggle } from "@/hooks/useToggle";
import { PipelineRun } from "@/types";
import { canCancelRun, isJobRun } from "@/utils/pipeline-run";
import Menu, { MenuProps } from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import React from "react";
import { FullScreenDialog } from "../FullScreenDialog";
import { PipelineRunBreadcrumbs } from "./PipelineRunBreadcrumbs";
import { PipelineRunLogs } from "./PipelineRunLogs";

export type PipelineRunContextMenuProps = MenuProps & {
  run: PipelineRun;
};

export const PipelineRunContextMenu = ({
  run,
  ...menuProps
}: PipelineRunContextMenuProps) => {
  const cancelRun = useCancelPipelineRun(run);
  const navigate = useNavigate();
  const [isLogsOpen, toggleLogs] = useToggle();

  const onCancelRun = () => {
    if (canCancelRun(run)) cancelRun();
  };

  const closeAfter = (action: () => void) => {
    action();
    menuProps.onClose?.({}, "escapeKeyDown");
  };

  const jobRun = isJobRun(run);

  const onClickOpen = (event: React.MouseEvent) => {
    navigate({
      route: jobRun ? "jobRun" : "pipeline",
      query: {
        projectUuid: run.project_uuid,
        pipelineUuid: run.pipeline_uuid,
        jobUuid: jobRun ? run.job_uuid : undefined,
        runUuid: jobRun ? run.uuid : undefined,
      },
      sticky: false,
      event,
    });
  };

  return (
    <>
      <Menu
        data-test-id="pipeline-run-settings-menu"
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        {...menuProps}
      >
        <MenuItem onClick={onClickOpen}>
          {jobRun ? "Open Job Run" : "Open Pipeline"}
        </MenuItem>
        <MenuItem onClick={() => closeAfter(toggleLogs)}>Show logs</MenuItem>
        <MenuItem
          onClick={() => closeAfter(onCancelRun)}
          disabled={!canCancelRun(run)}
        >
          Cancel run
        </MenuItem>
      </Menu>

      <FullScreenDialog
        open={isLogsOpen}
        onClose={() => toggleLogs(false)}
        title={
          <PipelineRunBreadcrumbs variant="h5" color="text.primary" run={run} />
        }
      >
        {isLogsOpen && (
          <PipelineRunLogs
            projectUuid={run.project_uuid}
            pipelineUuid={run.pipeline_uuid}
            jobUuid={isJobRun(run) ? run.job_uuid : undefined}
            runUuid={run.uuid}
          />
        )}
      </FullScreenDialog>
    </>
  );
};
