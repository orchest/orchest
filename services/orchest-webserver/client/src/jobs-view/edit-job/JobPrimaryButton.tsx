import { useJobsApi } from "@/api/jobs/useJobsApi";
import { useThrottle } from "@/hooks/useThrottle";
import ArrowDropDownOutlinedIcon from "@mui/icons-material/ArrowDropDownOutlined";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useScheduleJob } from "../hooks/useScheduleJob";
import { useSelectJob } from "../hooks/useSelectJob";
import { useEditJob } from "../stores/useEditJob";
// import { JobPrimaryActionMenu } from "./JobPrimaryActionMenu";
import {
  JobPrimaryButtonIcon,
  JobPrimaryButtonIconType,
} from "./JobPrimaryButtonIcon";

export const JobPrimaryButton = () => {
  const { jobChanges } = useEditJob();
  const { selectJob } = useSelectJob();
  const { resumeCronJob, pauseCronJob, cancel, duplicate } = useJobsApi();

  const buttonRef = React.useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = React.useState<Element>();
  const openMenu = () => setAnchor(buttonRef.current ?? undefined);
  const closeMenu = () => setAnchor(undefined);

  const { withThrottle } = useThrottle();
  const scheduleJob = useScheduleJob();

  const hasStarted =
    jobChanges?.status === "STARTED" || jobChanges?.status === "PENDING";

  const [buttonLabel, mainAction, iconType] = React.useMemo<
    [string | undefined, (() => void) | undefined, JobPrimaryButtonIconType]
  >(() => {
    const isScheduledJob =
      hasValue(jobChanges?.schedule) ||
      hasValue(jobChanges?.next_scheduled_time);

    const hasPaused = jobChanges?.status === "PAUSED";

    if (jobChanges?.status === "DRAFT") {
      const shouldRunNow =
        !hasValue(jobChanges?.schedule) &&
        !hasValue(jobChanges?.next_scheduled_time);

      if (shouldRunNow) return ["Run job", scheduleJob, "run"];
      return ["Schedule job", scheduleJob, "schedule"];
    }

    if (hasPaused) {
      return ["Resume job", () => resumeCronJob(jobChanges.uuid), "resume"];
    }
    if (isScheduledJob && hasStarted) {
      return ["Pause job", () => pauseCronJob(jobChanges.uuid), "pause"];
    }
    if (!isScheduledJob && hasStarted) {
      return ["Cancel job", () => cancel(jobChanges.uuid), "cancel"];
    }

    return [
      "Copy job configuration",
      async () => {
        if (!jobChanges?.uuid) return;
        const duplicatedJob = await duplicate(jobChanges.uuid);
        selectJob(duplicatedJob.pipeline_uuid, duplicatedJob.uuid);
      },
      "duplicate",
    ];
  }, [
    jobChanges?.status,
    jobChanges?.schedule,
    jobChanges?.next_scheduled_time,
    jobChanges?.uuid,
    hasStarted,
    scheduleJob,
    resumeCronJob,
    pauseCronJob,
    cancel,
    duplicate,
    selectJob,
  ]);

  // Prevent the unintentional second click.
  const handleClick = mainAction ? withThrottle(mainAction) : undefined;

  return (
    <>
      <ButtonGroup
        ref={buttonRef}
        variant={hasStarted ? "outlined" : "contained"}
        color="primary"
        size="small"
      >
        <Button
          startIcon={<JobPrimaryButtonIcon type={iconType} />}
          onClick={handleClick}
        >
          {buttonLabel}
        </Button>
        <Button
          sx={{ backgroundColor: (theme) => theme.palette.primary.dark }}
          size="small"
          onClick={openMenu}
        >
          <ArrowDropDownOutlinedIcon fontSize="small" />
        </Button>
      </ButtonGroup>
      {/* <JobPrimaryActionMenu anchor={anchor} onClose={closeMenu} /> */}
    </>
  );
};
