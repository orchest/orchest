import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useEditJob } from "../../stores/useEditJob";
import { JobPrimaryButtonIconType } from "../JobPrimaryButtonIcon";
import { useJobActions } from "./useJobActions";

export const useJobPrimaryButtonActions = () => {
  const { scheduleJob, cancelJob, duplicateJob } = useJobActions();

  const status = useEditJob((state) => state.jobChanges?.status);
  const schedule = useEditJob((state) => state.jobChanges?.schedule);

  const hasStarted =
    status === "STARTED" || status === "PENDING" || status === "PAUSED";

  const [buttonLabel, mainAction, iconType] = React.useMemo<
    [string, (() => void) | null, JobPrimaryButtonIconType]
  >(() => {
    if (!status) return ["Run job", null, "run"];
    if (status === "DRAFT") {
      const isCronJob = hasValue(schedule);

      if (isCronJob) return ["Schedule job", scheduleJob, "schedule"];
      return ["Run job", scheduleJob, "run"];
    }

    if (hasStarted) return ["Cancel job", cancelJob, "cancel"];

    return ["Copy job configuration", duplicateJob, "duplicate"];
  }, [schedule, status, hasStarted, scheduleJob, cancelJob, duplicateJob]);

  return [buttonLabel, mainAction, iconType] as const;
};
