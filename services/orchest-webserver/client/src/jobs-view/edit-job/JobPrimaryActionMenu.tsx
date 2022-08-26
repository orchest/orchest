import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../stores/useEditJob";
import { useJobActions } from "./hooks/useJobActions";
import {
  JobPrimaryButtonIcon,
  JobPrimaryButtonIconType,
} from "./JobPrimaryButtonIcon";

type PrimaryPipelineActionMenuProps = {
  anchor: Element | undefined;
  onClose: () => void;
};

export const JobPrimaryActionMenu = ({
  anchor,
  onClose,
}: PrimaryPipelineActionMenuProps) => {
  const status = useEditJob((state) => state.jobChanges?.status);
  const schedule = useEditJob((state) => state.jobChanges?.schedule);
  const nextScheduledTime = useEditJob(
    (state) => state.jobChanges?.next_scheduled_time
  );
  const {
    scheduleJob,
    resumeJob,
    pauseJob,
    cancelJob,
    duplicateJob,
    triggerJobNow,
  } = useJobActions();

  const isSubmitted = status !== "DRAFT";
  const isCronJob = hasValue(schedule);
  const isOneOffJob = !schedule && hasValue(nextScheduledTime);
  const isScheduledJob = isCronJob || isOneOffJob;

  const isAllowedToTriggerScheduledRuns =
    (isCronJob && ["PAUSED", "STARTED"].includes(status || "")) ||
    (isOneOffJob && status === "PENDING");

  const shouldRunNow = !hasValue(schedule) && !hasValue(nextScheduledTime);
  const isRunning = ["PAUSED", "STARTED", "PENDING"].includes(status || "");
  const hasPaused = status === "PAUSED";

  const operationOptions = React.useMemo<
    {
      label: string;
      icon: JobPrimaryButtonIconType;
      action: () => void | Promise<void>;
      disabled?: boolean;
    }[]
  >(
    () => [
      {
        label: shouldRunNow ? "Run job" : "Schedule job",
        icon: shouldRunNow ? "run" : "schedule",
        disabled: isSubmitted,
        action: scheduleJob,
      },
      {
        label: hasPaused ? "Resume scheduled job" : "Pause scheduled job",
        icon: hasPaused ? "resume" : "pause",
        disabled: !isScheduledJob || !isRunning,
        action: hasPaused ? resumeJob : pauseJob,
      },
      {
        label: "Trigger job now",
        icon: "run",
        disabled: !isAllowedToTriggerScheduledRuns,
        action: triggerJobNow,
      },
      {
        label: "Cancel job",
        icon: "cancel",
        disabled: !isRunning,
        action: cancelJob,
      },
      {
        label: "Copy job configuration",
        icon: "duplicate",
        action: duplicateJob,
      },
    ],
    [
      scheduleJob,
      cancelJob,
      duplicateJob,
      isSubmitted,
      hasPaused,
      isRunning,
      isScheduledJob,
      pauseJob,
      resumeJob,
      shouldRunNow,
      triggerJobNow,
      isAllowedToTriggerScheduledRuns,
    ]
  );

  return (
    <Menu
      anchorEl={anchor}
      open={hasValue(anchor)}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      MenuListProps={{
        dense: true,
        "aria-labelledby": "pipeline-operations",
      }}
    >
      {operationOptions.map((option) => {
        const onClick = () => {
          option.action?.();
          onClose();
        };

        return (
          <MenuItem
            key={option.label}
            disabled={option.disabled}
            onClick={onClick}
          >
            <ListItemIcon>
              <JobPrimaryButtonIcon type={option.icon} />
            </ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        );
      })}
    </Menu>
  );
};
