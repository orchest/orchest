import { useCustomRoute } from "@/hooks/useCustomRoute";
import { useEditJob } from "@/jobs-view/stores/useEditJob";
import { toUtcDateTimeString } from "@/utils/date-time";
import { hasValue } from "@orchest/lib-utils";
import React from "react";
import { useCronString } from "./useCronString";
import { useScheduleDateTime } from "./useScheduleDateTime";

export type ScheduleOption = "one-off" | "recurring";

export const useJobScheduleOption = () => {
  const { jobUuid } = useCustomRoute();

  const setJobChanges = useEditJob((state) => state.setJobChanges);

  const [scheduleOption, setScheduleOption] = React.useState<ScheduleOption>(
    "one-off"
  );

  const initialScheduleOption = useEditJob((state) => {
    const isLoading =
      !hasValue(state.jobChanges) || jobUuid !== state.jobChanges.uuid;

    return (isLoading
      ? undefined
      : hasValue(state.jobChanges?.schedule)
      ? "recurring"
      : "one-off") as ScheduleOption | undefined;
  });

  const jobPipelineUuid = useEditJob(
    (state) => state.jobChanges?.pipeline_uuid
  );
  const hasInitializedForPipelineUuid = React.useRef<string>();
  const shouldSetScheduleOption =
    hasValue(initialScheduleOption) &&
    (!hasValue(hasInitializedForPipelineUuid.current) ||
      hasInitializedForPipelineUuid.current !== jobPipelineUuid);

  React.useEffect(() => {
    if (shouldSetScheduleOption) {
      hasInitializedForPipelineUuid.current = jobPipelineUuid;
      setScheduleOption(initialScheduleOption);
    }
  }, [initialScheduleOption, jobPipelineUuid, shouldSetScheduleOption]);

  const [cronString, setCronString] = useCronString();
  const [nextScheduledTime, setNextScheduledTime] = useScheduleDateTime();

  const setSchedule = React.useCallback(
    (value: ScheduleOption) => {
      if (value === "one-off") {
        setJobChanges({
          next_scheduled_time: toUtcDateTimeString(nextScheduledTime),
          schedule: null,
        });
      }
      if (value === "recurring") {
        setJobChanges({
          next_scheduled_time: null,
          schedule: cronString,
        });
      }
    },
    [cronString, nextScheduledTime, setJobChanges]
  );

  React.useEffect(() => {
    setSchedule(scheduleOption);
  }, [scheduleOption, setSchedule, jobPipelineUuid]);

  return {
    scheduleOption,
    setScheduleOption,
    cronString,
    setCronString,
    nextScheduledTime,
    setNextScheduledTime,
  };
};
